import { failure } from "./errors.js";
import { apiRequest } from "./http.js";
import { normalizeRecruitment } from "../../shared/recruitment/recruitment-state.js";
import { localLogout } from "../local-session.js";

const unconfigured = async () =>
  failure("API_NOT_CONFIGURED", "اتصال سرویس واقعی هنوز پیکربندی نشده است.");

// Swagger: POST /api/auth/otp/request { mobile } -> { success, resendAfterSeconds }
async function requestVerificationCode(mobile) {
  const result = await apiRequest({
    method: "POST",
    path: "/auth/otp/request",
    body: { mobile },
  });
  if (!result.success) return result;
  const seconds = Number(result.data?.resendAfterSeconds);
  return {
    success: true,
    resendAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 0,
  };
}

// Swagger: POST /api/auth/otp/verify { mobile, code } ->
//   { success, verified, authenticated, isNewUser, registrationCompleted,
//     registrationSessionKey, marketerSessionToken, user: UserInfo }
// Sent with credentials so the browser keeps the session cookie the backend sets for
// registered users. registrationSessionKey and marketerSessionToken are deliberately neither
// returned nor stored: authentication is the backend-managed cookie, not a frontend token.
async function verifyVerificationCode({ mobile, code }) {
  const result = await apiRequest({
    method: "POST",
    path: "/auth/otp/verify",
    body: { mobile, code },
    withCredentials: true,
  });
  if (!result.success) {
    // A rejected code (backend verified:false, or a 400/422 validation failure) is reported
    // as verified:false; transport, auth and server failures are left without it.
    const rejected =
      result.details?.verified === false || [400, 422].includes(result.status);
    return rejected ? { ...result, verified: false } : result;
  }
  const data = result.data || {};
  // New/existing branching depends on isNewUser; a verified answer without it is not guessed.
  if (data.verified === true && typeof data.isNewUser !== "boolean") {
    return failure("INVALID_RESPONSE", "پاسخ سرور برای تعیین وضعیت کاربر نامعتبر است. لطفاً دوباره تلاش کنید.");
  }
  return {
    success: true,
    verified: data.verified === true,
    authenticated: data.authenticated === true,
    isNewUser: data.isNewUser === true,
    registrationCompleted: data.registrationCompleted === true,
    user: data.user ?? null,
  };
}

// Swagger: GET /api/me/context -> DashboardContextResponse
//   { success, authenticated, user: UserContextDto, account: { status }, recruitment: RecruitmentContextDto }
// Authenticated by the session cookie from OTP verification. The shape already matches the
// frontend dashboard contract (recruitment.stages[] is supported by recruitment-state.js).
async function getDashboardContext() {
  const result = await apiRequest({
    path: "/me/context",
    withCredentials: true,
  });
  if (!result.success) return result;
  const data = result.data || {};
  return {
    success: true,
    authenticated: data.authenticated === true,
    user: data.user ?? null,
    account: data.account ?? null,
    recruitment: data.recruitment ?? null,
  };
}

// Swagger has no separate recruitment-status endpoint: the recruitment block of
// GET /api/me/context (stages[] of RecruitmentStageDto) is the source. It is mapped to the keyed
// shape the recruitment pages read ({ moarefe: { status }, interview: { status }, ... }).
async function getRecruitmentStatus() {
  const context = await getDashboardContext();
  if (!context.success) return context;
  if (context.authenticated !== true) {
    return failure("UNAUTHORIZED", "ابتدا وارد حساب کاربری شوید.");
  }
  const stages = Array.isArray(context.recruitment?.stages) ? context.recruitment.stages : [];
  const keyed = Object.fromEntries(
    stages
      .filter((stage) => typeof stage?.id === "string" && stage.id)
      .map((stage) => [stage.id, { status: stage.status }]),
  );
  return {
    success: true,
    recruitment: normalizeRecruitment({ ...keyed, currentStage: context.recruitment?.currentStage }),
  };
}

// Swagger: GET /api/referrals/managers/{code} (200 schema undocumented). Observed backend contract:
//   200 { success, manager: { id, firstName, lastName, displayName, referralCode } }
//   404 { success: false, code: "REFERRAL_NOT_FOUND", message }
// Resolves to { success: true, manager: { name, code } }, or a failure with invalid: true only
// when the backend rejects the code; network/auth/server failures stay retryable.
async function getReferralManager(code) {
  const result = await apiRequest({
    path: `/referrals/managers/${encodeURIComponent(String(code))}`,
    withCredentials: true,
  });
  if (!result.success) {
    const invalid = result.status === 404 || ["REFERRAL_NOT_FOUND", "NOT_FOUND"].includes(result.code);
    return { ...result, invalid, manager: null };
  }
  const manager = result.data?.manager;
  const name =
    [manager?.displayName, [manager?.firstName, manager?.lastName].filter(Boolean).join(" ")]
      .find((value) => typeof value === "string" && value.trim())?.trim() || "";
  if (!name) return { ...failure("INVALID_RESPONSE", "پاسخ سرویس معرف نامعتبر است."), manager: null };
  return { success: true, manager: { name, code: String(manager.referralCode || code) } };
}

// Maps the frontend payload (createRegistrationPayload) onto Swagger's RegistrationRequest.
// Every DTO has additionalProperties:false, so fields are picked explicitly.
const pick = (source, keys) =>
  Object.fromEntries(keys.map((key) => [key, source?.[key] ?? null]));

function toEmploymentRecord(record) {
  return {
    ...pick(record, [
      "companyName",
      "jobTitle",
      "startYear",
      "startMonth",
      "endYear",
      "endMonth",
    ]),
    currentlyWorking: record?.currentlyWorking === true,
  };
}

// Only a backend-validated code is sent (the payload builder omits unvalidated ones).
// ReferralDto.manager is never sent: the backend resolves the owner from the code.
function toReferral(referral) {
  const code = typeof referral?.code === "string" ? referral.code.trim() : "";
  return referral?.hasReferral === true && code && ["manual", "link"].includes(referral.source)
    ? { hasReferral: true, source: referral.source, code }
    : { hasReferral: false, source: null, code: null };
}

function toRegistrationRequest(payload) {
  const hasHistory = payload?.employment?.hasHistory === true;
  return {
    identity: {
      ...pick(payload?.identity, ["nationalId", "firstName", "lastName"]),
      birthDate: pick(payload?.identity?.birthDate, [
        "jalali",
        "year",
        "month",
        "day",
        "iso",
      ]),
    },
    contact: pick(payload?.contact, [
      "mobile",
      "province",
      "city",
      "address",
      "postalCode",
      "landline",
    ]),
    education: pick(payload?.education, ["degree", "graduationYear", "field"]),
    employment: {
      hasHistory,
      records: hasHistory
        ? (payload.employment.records || []).map(toEmploymentRecord)
        : [],
    },
    referral: toReferral(payload?.referral),
  };
}

// Swagger: POST /api/registration (RegistrationRequest) -> 200 with no response body.
// Authenticated by the registration session cookie set by OTP verification (credentials: include);
// without it the backend answers 401 REGISTRATION_SESSION_REQUIRED.
// Builds the Swagger RegistrationRequest from the frontend payload. Shared by the real call and the
// temporary simulation (js/api/temporary-registration.js), so both send/check the same body.
export function buildRegistrationRequest(payload) {
  const body = toRegistrationRequest(payload);
  // EmploymentRecordDto.startYear/startMonth are non-nullable int32 in Swagger while the form
  // treats the start date as optional; stop here instead of sending null or an invented value.
  if (
    body.employment.records.some(
      (record) => record.startYear === null || record.startMonth === null,
    )
  ) {
    return failure(
      "VALIDATION_ERROR",
      "لطفاً ماه و سال شروع همه سوابق کاری را وارد کنید.",
    );
  }
  return { success: true, body };
}

async function submitRegistration(payload) {
  const built = buildRegistrationRequest(payload);
  if (!built.success) return built;
  const result = await apiRequest({
    method: "POST",
    path: "/registration",
    body: built.body,
    withCredentials: true,
  });
  return result.success ? { success: true } : result;
}

export const realApi = Object.freeze({
  getDashboardContext,
  requestVerificationCode,
  verifyVerificationCode,
  getReferralManager,
  submitRegistration,
  getRecruitmentStatus,
  getAvailableAppointments: unconfigured,
  submitAppointmentRequest: unconfigured,
  getInterviewStatus: getRecruitmentStatus,
  getInterviewAvailability: unconfigured,
  submitInterviewRequest: unconfigured,
  withdrawRecruitment: unconfigured,
  // TEMPORARY: local-only logout until POST /api/auth/logout exists (API-07).
  logout: localLogout,
});
