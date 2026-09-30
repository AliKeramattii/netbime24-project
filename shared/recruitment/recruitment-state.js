import { RECRUITMENT_ROUTES } from "../dashboard/app-routes.js";

export const RECRUITMENT_WORKFLOW_STAGE_IDS = Object.freeze([
  "registration",
  "referral",
  "moarefe",
  "interview",
]);

export const RECRUITMENT_FUTURE_STAGE_IDS = Object.freeze([
  "documents",
  "contract",
]);

export const RECRUITMENT_DISPLAY_STAGE_IDS = Object.freeze([
  ...RECRUITMENT_WORKFLOW_STAGE_IDS,
  ...RECRUITMENT_FUTURE_STAGE_IDS,
]);

export const RECRUITMENT_STAGE_IDS = Object.freeze([
  ...RECRUITMENT_DISPLAY_STAGE_IDS,
  "completed",
]);

export const RECRUITMENT_STATUSES = Object.freeze([
  "locked",
  "available",
  "in_progress",
  "pending",
  "completed",
  "rejected",
  "needs_action",
]);

export const ACCOUNT_STATUSES = Object.freeze(["registration", "recruitment", "active"]);

export const RECRUITMENT_STAGE_LABELS = Object.freeze({
  registration: "ثبت‌نام",
  referral: "معرفی",
  moarefe: "جلسه معارفه",
  interview: "مصاحبه",
  documents: "مدارک",
  contract: "قرارداد",
  completed: "تکمیل مراحل فعلی جذب",
});

export const RECRUITMENT_STATUS_LABELS = Object.freeze({
  locked: "هنوز فعال نشده",
  available: "آماده انجام",
  in_progress: "در حال انجام",
  pending: "در انتظار بررسی",
  completed: "تکمیل شده",
  rejected: "رد شده",
  needs_action: "نیاز به اقدام",
});

export const RECRUITMENT_STAGE_META = Object.freeze(Object.fromEntries(
  RECRUITMENT_STAGE_IDS.map((id) => [id, Object.freeze({
    id,
    title: RECRUITMENT_STAGE_LABELS[id],
    route: id === "completed" ? null : RECRUITMENT_ROUTES[id],
  })]),
));

// An approved Moarefe appointment ("in_progress"; legacy "approved" maps to it) unlocks Interview
// before the session itself is completed. Interview approval is not assumed to do the same.
const STAGE_UNLOCKING_STATUSES = Object.freeze({ moarefe: Object.freeze(["in_progress"]) });
const unlocksNextStage = (id, status) => status === "completed" || Boolean(STAGE_UNLOCKING_STATUSES[id]?.includes(status));

// First stage still needing the user's attention; falls back to the first unfinished stage.
function currentWorkflowStageId(normalized) {
  return RECRUITMENT_WORKFLOW_STAGE_IDS.find(id => !unlocksNextStage(id, normalized[id].status))
    || RECRUITMENT_WORKFLOW_STAGE_IDS.find(id => normalized[id].status !== "completed")
    || null;
}

const LEGACY_STAGE_IDS = Object.freeze({ introductionSession: "moarefe", introduction: "moarefe" });
const LEGACY_STATUSES = Object.freeze({ approved: "in_progress" });
const LEGACY_ACCOUNT_STATUSES = Object.freeze({ active_agent: "active" });

export function normalizeRecruitmentStageId(value) {
  const id = String(value || "").trim();
  if (RECRUITMENT_STAGE_IDS.includes(id)) return id;
  return LEGACY_STAGE_IDS[id] || null;
}

export function normalizeRecruitmentStatus(value) {
  const raw = String(value || "").trim();
  const status = LEGACY_STATUSES[raw] || raw;
  return RECRUITMENT_STATUSES.includes(status) ? status : "locked";
}

export function normalizeAccountStatus(value) {
  const raw = String(value || "").trim();
  const status = LEGACY_ACCOUNT_STATUSES[raw] || raw;
  return ACCOUNT_STATUSES.includes(status) ? status : "registration";
}

export function normalizeRecruitment(recruitment = {}) {
  const source = recruitment || {};
  const normalized = Object.fromEntries(RECRUITMENT_DISPLAY_STAGE_IDS.map((id) => {
    const legacyValue = id === "moarefe" ? (source.moarefe ?? source.introductionSession ?? source.introduction) : source[id];
    const stage = legacyValue && typeof legacyValue === "object" ? legacyValue : {};
    return [id, { ...stage, status: normalizeRecruitmentStatus(stage.status) }];
  }));

  const requestedCurrent = normalizeRecruitmentStageId(source.currentStage);
  if (requestedCurrent) normalized.currentStage = requestedCurrent;
  return normalized;
}

/**
 * Reconciles only the currently implemented recruitment journey:
 * Registration -> Moarefe -> Interview. Future stages stay locked/coming-soon.
 */
export function reconcileRecruitmentWorkflow(recruitment = {}) {
  const normalized = normalizeRecruitment(recruitment);
  let blocked = false;

  for (const id of RECRUITMENT_WORKFLOW_STAGE_IDS) {
    const stage = normalized[id];
    if (blocked) {
      if (stage.status !== "completed") normalized[id] = { ...stage, status: "locked" };
      continue;
    }
    if (stage.status === "completed") continue;
    if (stage.status === "locked") normalized[id] = { ...stage, status: "available" };
    if (!unlocksNextStage(id, normalized[id].status)) blocked = true;
  }

  // These stages are intentionally not part of this extracted version.
  for (const id of RECRUITMENT_FUTURE_STAGE_IDS) {
    normalized[id] = { ...normalized[id], status: "locked" };
  }

  const allCompleted = RECRUITMENT_WORKFLOW_STAGE_IDS.every(id => normalized[id].status === "completed");
  normalized.currentStage = allCompleted ? "completed" : currentWorkflowStageId(normalized) || "completed";
  return normalized;
}

export function setRecruitmentStageStatus(recruitment, stageId, status, patch = {}) {
  const id = normalizeRecruitmentStageId(stageId);
  if (!id || id === "completed" || RECRUITMENT_FUTURE_STAGE_IDS.includes(id)) {
    return reconcileRecruitmentWorkflow(recruitment);
  }
  const normalized = normalizeRecruitment(recruitment);
  normalized[id] = {
    ...normalized[id],
    ...patch,
    status: normalizeRecruitmentStatus(status),
  };
  return reconcileRecruitmentWorkflow(normalized);
}

export function isRecruitmentCompleted(recruitment) {
  const normalized = reconcileRecruitmentWorkflow(recruitment);
  return RECRUITMENT_WORKFLOW_STAGE_IDS.every(id => normalized[id].status === "completed");
}

export function getRecruitmentStageStatus(recruitment, stageId) {
  const id = normalizeRecruitmentStageId(stageId);
  if (!id) return "locked";
  if (id === "completed") return isRecruitmentCompleted(recruitment) ? "completed" : "locked";
  if (Array.isArray(recruitment?.stages)) {
    const stage = recruitment.stages.find(item => normalizeRecruitmentStageId(item?.id) === id);
    return RECRUITMENT_FUTURE_STAGE_IDS.includes(id) ? "locked" : normalizeRecruitmentStatus(stage?.status);
  }
  return reconcileRecruitmentWorkflow(recruitment)[id].status;
}

export function getCurrentRecruitmentStage(recruitment) {
  if (!recruitment) return null;
  const reconciled = reconcileRecruitmentWorkflow(recruitment);
  const id = currentWorkflowStageId(reconciled);
  return id ? { ...RECRUITMENT_STAGE_META[id], status: reconciled[id].status } : null;
}

function stageActionLabel(stageId, status) {
  const stage = RECRUITMENT_STAGE_META[stageId];
  if (!stage) return "ادامه فرایند جذب";
  const overrides = {
    moarefe: {
      available: "انتخاب زمان جلسه معارفه",
      in_progress: "ادامه جلسه معارفه",
      needs_action: "تکمیل جلسه معارفه",
      rejected: "بررسی وضعیت جلسه معارفه",
    },
    interview: {
      available: "انتخاب زمان مصاحبه",
      in_progress: "ادامه مصاحبه",
      needs_action: "تکمیل مصاحبه",
      rejected: "بررسی وضعیت مصاحبه",
    },
  };
  if (overrides[stageId]?.[status]) return overrides[stageId][status];
  if (status === "available") return `شروع ${stage.title}`;
  if (status === "in_progress") return `ادامه ${stage.title}`;
  if (status === "needs_action") return "تکمیل اطلاعات";
  if (status === "rejected") return "بررسی و ارسال مجدد";
  return "ادامه فرایند جذب";
}

export function getNextRecruitmentAction(recruitment) {
  const current = getCurrentRecruitmentStage(recruitment);
  if (!current || !current.route) return null;
  if (["available", "in_progress", "needs_action"].includes(current.status)) {
    return { type: "navigate", label: stageActionLabel(current.id, current.status), route: current.route, stageId: current.id };
  }
  if (current.status === "rejected") {
    return { type: "retry", label: stageActionLabel(current.id, current.status), route: current.route, stageId: current.id };
  }
  return null;
}

export function getRecruitmentProgressPercentage(recruitment) {
  const normalized = reconcileRecruitmentWorkflow(recruitment);
  const completed = RECRUITMENT_WORKFLOW_STAGE_IDS.filter(id => normalized[id].status === "completed").length;
  return Math.round((completed / RECRUITMENT_WORKFLOW_STAGE_IDS.length) * 100);
}

export function canAccessRecruitmentStage(contextOrRecruitment, stageId) {
  const id = normalizeRecruitmentStageId(stageId);
  if (!id || id === "completed" || RECRUITMENT_FUTURE_STAGE_IDS.includes(id) || !RECRUITMENT_STAGE_META[id]?.route) return false;
  const recruitment = contextOrRecruitment?.recruitment || contextOrRecruitment;
  return getRecruitmentStageStatus(recruitment, id) !== "locked";
}

export function buildRecruitmentDashboardView(recruitment) {
  if (!recruitment) return null;
  const normalized = reconcileRecruitmentWorkflow(recruitment);
  const stages = RECRUITMENT_DISPLAY_STAGE_IDS.map((id) => ({
    id,
    title: RECRUITMENT_STAGE_META[id].title,
    status: normalized[id].status,
    route: RECRUITMENT_STAGE_META[id].route,
  }));
  const current = getCurrentRecruitmentStage(normalized);
  const appointmentStageId = RECRUITMENT_WORKFLOW_STAGE_IDS.find(id => normalized[id].appointment && ["pending", "in_progress"].includes(normalized[id].status))
    || RECRUITMENT_WORKFLOW_STAGE_IDS.find(id => normalized[id].appointment);
  const appointment = appointmentStageId ? normalized[appointmentStageId].appointment : null;
  return {
    currentStage: current?.id || "completed",
    currentStageTitle: current?.title || RECRUITMENT_STAGE_LABELS.completed,
    currentStageStatus: current?.status || "completed",
    progressPercentage: getRecruitmentProgressPercentage(normalized),
    stages,
    nextAction: getNextRecruitmentAction(normalized),
    upcomingAppointment: appointment ? {
      stageId: appointmentStageId,
      stageTitle: RECRUITMENT_STAGE_META[appointmentStageId].title,
      ...structuredClone(appointment),
    } : null,
  };
}
