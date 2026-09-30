import {
  demoOtp,
  resendAfterSeconds,
  referralManagers,
} from "../mocks/registration.mock.js";
import { demoExistingAccount } from "../mocks/dashboard.mock.js";
import { introductionAvailability } from "../mocks/moarefe.mock.js";
import { interviewAvailability } from "../mocks/interview.mock.js";
import {
  completedRecruitment,
  initialRecruitment,
} from "../mocks/recruitment.mock.js";
import {
  ensureMockRecruitmentState,
  getMockRecruitmentApplicationState,
  simulateRecruitmentAdminEvent as simulateAdminEvent,
  updateMockRecruitmentStage,
} from "../mocks/recruitment-workflow.mock.js";
import { previewFixture } from "../mocks/preview-fixtures.js";
import {
  buildRecruitmentDashboardView,
  normalizeAccountStatus,
  normalizeRecruitment,
} from "../../shared/recruitment/recruitment-state.js";
import { reservationStatus } from "../../shared/recruitment/appointment-approval.js";
import { failure } from "./errors.js";
import {
  readServer as read,
  writeServer as write,
} from "../mocks/server-state.js";

const copy = (value) => structuredClone(value);
const params = () => new URLSearchParams(globalThis.location?.search || "");
const scenario = () => params().get("mockScenario");
const availabilityFor = (stage) =>
  stage === "interview" ? interviewAvailability() : introductionAvailability();
const slotsFor = (stage) => availabilityFor(stage).slots;

function fixture(stage) {
  const stateParam =
    stage === "interview"
      ? params().get("interviewState")
      : params().get("moarefeState");
  return previewFixture(stage, stateParam, slotsFor(stage));
}

function seedDevelopmentAccount() {
  if (read("auth.loggedOut") === true || scenario() === "unauthenticated")
    return null;
  let account = read("account");
  if (!account) {
    account = copy(demoExistingAccount);
    write("account", account);
  }
  if (!read("recruitment")) {
    const status = normalizeAccountStatus(
      account.account?.status || "recruitment",
    );
    write(
      "recruitment",
      status === "active" ? completedRecruitment() : initialRecruitment(),
    );
  }
  getMockRecruitmentApplicationState();
  return account;
}

function accountContext({
  seedDevelopment = false,
  recruitmentOverride = null,
} = {}) {
  let stored = read("account");
  if (!stored && seedDevelopment) stored = seedDevelopmentAccount();
  if (!stored) {
    return {
      success: true,
      authenticated: false,
      user: null,
      account: null,
      notifications: { unreadCount: 0 },
      recruitment: null,
    };
  }

  const effectiveStatus = normalizeAccountStatus(
    stored.account?.status || "recruitment",
  );
  const recruitmentSource =
    recruitmentOverride ||
    read("recruitment") ||
    (effectiveStatus === "active"
      ? completedRecruitment()
      : initialRecruitment());
  const recruitment = normalizeRecruitment(recruitmentSource);

  return {
    success: true,
    authenticated: true,
    user: copy(stored.user),
    account: { ...copy(stored.account || {}), status: effectiveStatus },
    notifications: { unreadCount: 0 },
    recruitment: buildRecruitmentDashboardView(recruitment),
  };
}

const storageStage = (stage) => (fixture(stage) ? `preview.${stage}` : stage);

async function status(stage) {
  const preview = fixture(stage);
  if (preview) return { success: true, ...copy(preview) };
  let account = read("account");
  if (!account && read("auth.loggedOut") !== true)
    account = seedDevelopmentAccount();
  if (!account)
    return failure("UNAUTHORIZED", "ابتدا ثبت نام خود را تکمیل کنید.");
  return { success: true, recruitment: copy(ensureMockRecruitmentState()) };
}

async function availability(stage) {
  const progress = await status(stage);
  if (!progress.success) return progress;
  if (progress.recruitment[stage].status !== "available")
    return failure("STAGE_LOCKED", "این مرحله در حال حاضر قابل انتخاب نیست.");
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (scenario() === "appointments-error")
    return failure("NETWORK_ERROR", "دریافت زمان‌های موجود با مشکل مواجه شد.");
  const blocked = read(`blocked.${storageStage(stage)}`) || [];
  const data = availabilityFor(stage);
  return {
    success: true,
    days: copy(data.days),
    slots:
      scenario() === "appointments-empty"
        ? []
        : data.slots.map((slot) => ({
            ...slot,
            status: blocked.includes(slot.id) ? "taken" : slot.status,
          })),
  };
}

async function submit(stage, payload) {
  const progress = await status(stage);
  if (!progress.success) return progress;
  const recruitment = progress.recruitment;
  if (recruitment[stage].status !== "available")
    return failure("STAGE_LOCKED", "این مرحله در حال حاضر قابل انتخاب نیست.");
  if (!payload?.termsAccepted || payload.recruitmentStage !== stage)
    return failure("VALIDATION_ERROR", "شرایط را تایید کنید.");
  const slot = slotsFor(stage).find((item) => item.id === payload.slotId);
  const blocked = read(`blocked.${storageStage(stage)}`) || [];
  if (!slot) return failure("NOT_FOUND", "زمان انتخابی یافت نشد.");
  if (
    scenario() === "slot-unavailable" &&
    !read(`race.${storageStage(stage)}`)
  ) {
    blocked.push(slot.id);
    write(`blocked.${storageStage(stage)}`, blocked);
    write(`race.${storageStage(stage)}`, true);
  }
  if (slot.status !== "available" || blocked.includes(slot.id)) {
    return failure(
      "SLOT_UNAVAILABLE",
      "زمان انتخاب‌شده دیگر در دسترس نیست. لطفاً زمان دیگری را انتخاب کنید.",
    );
  }
  if (scenario() === "submission-error")
    return failure("NETWORK_ERROR", "ثبت درخواست انجام نشد. دوباره تلاش کنید.");

  const request = {
    id: `mock-${stage}-${Date.now()}`,
    status: reservationStatus(stage),
    slotId: slot.id,
    appointment: copy(slot),
  };
  const nextRecruitment = fixture(stage)
    ? {
        ...recruitment,
        [stage]: { status: request.status, appointment: copy(slot) },
      }
    : updateMockRecruitmentStage(stage, request.status, {
        appointment: copy(slot),
      });
  blocked.push(slot.id);
  write(`blocked.${storageStage(stage)}`, blocked);
  return { success: true, request, recruitment: copy(nextRecruitment) };
}

export const mockApi = {
  async getDashboardContext() {
    const preview = fixture("moarefe") || fixture("interview");
    return copy(
      accountContext({
        seedDevelopment: true,
        recruitmentOverride: preview?.recruitment || null,
      }),
    );
  },

  async requestVerificationCode(mobile) {
    return /^09\d{9}$/.test(mobile)
      ? { success: true, resendAfterSeconds }
      : failure("VALIDATION_ERROR", "شماره موبایل معتبر نیست.");
  },

  async verifyVerificationCode({ mobile, code }) {
    if (!/^09\d{9}$/.test(mobile) || code !== demoOtp) {
      return {
        ...failure("VALIDATION_ERROR", "کد تایید وارد شده نادرست است"),
        verified: false,
      };
    }
    const existingStored = read("account");
    const existingDemo =
      mobile === demoExistingAccount.user.mobile ||
      scenario() === "existing-user";
    const isExisting = Boolean(
      existingStored?.user?.mobile === mobile || existingDemo,
    );
    if (!isExisting) {
      return {
        success: true,
        verified: true,
        authenticated: false,
        isNewUser: true,
        registrationCompleted: false,
        user: null,
      };
    }
    const account = existingStored || copy(demoExistingAccount);
    write("account", account);
    write("auth.loggedOut", false);
    if (!read("recruitment")) write("recruitment", initialRecruitment());
    return {
      success: true,
      verified: true,
      authenticated: true,
      isNewUser: false,
      registrationCompleted: true,
      user: copy(account.user),
    };
  },

  async getReferralManager(code) {
    const manager = referralManagers.get(String(code));
    return manager
      ? { success: true, manager: copy(manager) }
      : { ...failure("NOT_FOUND", "کد معرف یافت نشد."), manager: null };
  },

  async submitRegistration(payload) {
    if (
      !payload?.identity?.firstName?.trim() ||
      !payload.identity.lastName?.trim() ||
      !/^09\d{9}$/.test(payload.contact?.mobile) ||
      !payload.education ||
      !payload.employment
    ) {
      return failure("VALIDATION_ERROR", "اطلاعات ثبت نام کامل نیست.");
    }
    const existing = read("account");
    if (!existing) {
      write("account", {
        user: {
          id: `mock-account-${Date.now()}`,
          firstName: payload.identity.firstName.trim(),
          lastName: payload.identity.lastName.trim(),
          displayName: `${payload.identity.firstName.trim()} ${payload.identity.lastName.trim()}`,
          mobile: payload.contact.mobile,
          avatarUrl: null,
        },
        account: { status: "recruitment" },
        profile: {
          identity: copy(payload.identity || {}),
          contact: copy(payload.contact || {}),
          education: copy(payload.education || {}),
          employment: copy(payload.employment || {}),
          referral: copy(payload.referral || {}),
        },
      });
      write("recruitment", initialRecruitment());
    }
    write("registration.completed", true);
    write("auth.loggedOut", false);
    return copy(accountContext());
  },

  getRecruitmentStatus: () => status("moarefe"),
  getAvailableAppointments: () => availability("moarefe"),
  submitAppointmentRequest: (payload) => submit("moarefe", payload),
  getInterviewStatus: () => status("interview"),
  getInterviewAvailability: () => availability("interview"),
  submitInterviewRequest: (payload) => submit("interview", payload),

  async withdrawRecruitment() {
    return { success: true, message: "در نسخه نمایشی انصراف ذخیره نمی‌شود." };
  },

  async simulateRecruitmentAdminEvent(event) {
    return simulateAdminEvent(event);
  },

  async logout() {
    write("account", null);
    write("auth.loggedOut", true);
    return { success: true, message: "با موفقیت از حساب کاربری خارج شدید." };
  },
};
