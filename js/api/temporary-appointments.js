// TEMPORARY frontend-only appointment flow (config: MOCK_APPOINTMENT_FLOW).
//
// The backend has no Moarefe/Interview endpoints yet (future: GET /api/appointments/availability,
// POST /api/appointments/reservations). Until they exist, this adapter wraps the real API and
// simulates only the appointment steps in the browser:
//   - user, session and base recruitment stages still come from the real GET /api/me/context;
//   - time slots come from the mock datasets (js/mocks);
//   - a reservation is saved locally per user (sessionStorage) with the status the approval rule
//     gives it (shared/recruitment/appointment-approval.js): Moarefe is approved immediately,
//     Interview stays pending.
// Nothing here is sent to the backend. When the endpoints exist, implement them in real-api.js,
// set MOCK_APPOINTMENT_FLOW to false and delete this file.
import { STORAGE_KEYS } from "../storage-keys.js";
import { failure } from "./errors.js";
import { introductionAvailability } from "../mocks/moarefe.mock.js";
import { interviewAvailability } from "../mocks/interview.mock.js";
import { reservationStatus } from "../../shared/recruitment/appointment-approval.js";
import {
  buildRecruitmentDashboardView,
  normalizeRecruitment,
  reconcileRecruitmentWorkflow,
} from "../../shared/recruitment/recruitment-state.js";

const APPOINTMENT_STAGES = ["moarefe", "interview"];
const KEY = STORAGE_KEYS.temporaryAppointments;

const availabilityFor = (stage) =>
  stage === "moarefe" ? introductionAvailability() : interviewAvailability();

const userKey = (context) => String(context?.user?.id ?? context?.user?.mobile ?? "");

// A registration completed in this browser (the registration draft). Its dashboard runs fully on
// local data, so Moarefe and Interview can be shown without any backend call.
function locallyRegisteredContext() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.registration));
    if (draft?.submission?.completed !== true) return null;
    const firstName = String(draft.identity?.firstName || "").trim();
    const lastName = String(draft.identity?.lastName || "").trim();
    const mobile = String(draft.contact?.mobile || "");
    return {
      success: true,
      authenticated: true,
      user: {
        id: `local-${mobile}`,
        firstName,
        lastName,
        displayName: [firstName, lastName].filter(Boolean).join(" "),
        mobile,
        avatarUrl: null,
      },
      account: { status: "recruitment" },
      recruitment: { stages: [] },
    };
  } catch {
    return null;
  }
}

function readProgress(user) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY));
    return saved?.user === user && saved.stages && typeof saved.stages === "object" ? saved.stages : {};
  } catch {
    return {};
  }
}

function writeProgress(user, stages) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ user, stages }));
  } catch {
    /* Storage unavailable: the simulated reservation lasts for this page only. */
  }
}

// Backend stages as the base. A signed-in user has finished registration (and its referral step),
// so the simulated journey starts at Moarefe; locally reserved appointments go on top.
function simulatedRecruitment(context) {
  const stages = Array.isArray(context.recruitment?.stages) ? context.recruitment.stages : [];
  const recruitment = normalizeRecruitment(
    Object.fromEntries(
      stages
        .filter((stage) => typeof stage?.id === "string" && stage.id)
        .map((stage) => [stage.id, { status: stage.status }]),
    ),
  );
  recruitment.registration = { ...recruitment.registration, status: "completed" };
  recruitment.referral = { ...recruitment.referral, status: "completed" };
  const local = readProgress(userKey(context));
  for (const stage of APPOINTMENT_STAGES) {
    if (local[stage]) recruitment[stage] = { ...recruitment[stage], ...local[stage] };
  }
  return reconcileRecruitmentWorkflow(recruitment);
}

export function withTemporaryAppointments(realApi) {
  // Just registered in this browser -> local context, no API call. Otherwise (existing user who
  // signed in with OTP) the real /api/me/context.
  const baseContext = () => locallyRegisteredContext() || realApi.getDashboardContext();

  async function signedInContext() {
    const context = await baseContext();
    if (!context.success) return context;
    if (context.authenticated !== true || !context.user) {
      return failure("UNAUTHORIZED", "ابتدا وارد حساب کاربری شوید.");
    }
    return context;
  }

  async function getDashboardContext() {
    const context = await baseContext();
    if (!context.success || context.authenticated !== true || !context.user) return context;
    return { ...context, recruitment: buildRecruitmentDashboardView(simulatedRecruitment(context)) };
  }

  async function getRecruitmentStatus() {
    const context = await signedInContext();
    if (!context.success) return context;
    return { success: true, recruitment: simulatedRecruitment(context) };
  }

  async function getAvailability(stage) {
    const progress = await getRecruitmentStatus();
    if (!progress.success) return progress;
    if (progress.recruitment[stage].status !== "available") {
      return failure("STAGE_LOCKED", "این مرحله در حال حاضر قابل انتخاب نیست.");
    }
    const { days, slots } = availabilityFor(stage);
    return { success: true, days, slots };
  }

  async function submitReservation(stage, payload) {
    const context = await signedInContext();
    if (!context.success) return context;
    if (simulatedRecruitment(context)[stage].status !== "available") {
      return failure("STAGE_LOCKED", "این مرحله در حال حاضر قابل انتخاب نیست.");
    }
    if (!payload?.termsAccepted || payload.recruitmentStage !== stage) {
      return failure("VALIDATION_ERROR", "شرایط را تایید کنید.");
    }
    const slot = availabilityFor(stage).slots.find((item) => item.id === payload.slotId);
    if (!slot) return failure("NOT_FOUND", "زمان انتخابی یافت نشد.");
    if (slot.status !== "available") {
      return failure(
        "SLOT_UNAVAILABLE",
        "زمان انتخاب‌شده دیگر در دسترس نیست. لطفاً زمان دیگری را انتخاب کنید.",
      );
    }

    const request = {
      id: `temporary-${stage}-${Date.now()}`,
      status: reservationStatus(stage),
      slotId: slot.id,
      appointment: slot,
    };
    const user = userKey(context);
    writeProgress(user, {
      ...readProgress(user),
      [stage]: { status: request.status, appointment: slot },
    });
    return { success: true, request, recruitment: simulatedRecruitment(context) };
  }

  return Object.freeze({
    ...realApi,
    getDashboardContext,
    getRecruitmentStatus,
    getInterviewStatus: getRecruitmentStatus,
    getAvailableAppointments: () => getAvailability("moarefe"),
    submitAppointmentRequest: (payload) => submitReservation("moarefe", payload),
    getInterviewAvailability: () => getAvailability("interview"),
    submitInterviewRequest: (payload) => submitReservation("interview", payload),
  });
}
