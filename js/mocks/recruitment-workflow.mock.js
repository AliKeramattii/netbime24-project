import { readServer, writeServer } from "./server-state.js";
import { initialRecruitment, completedRecruitment } from "./recruitment.mock.js";
import {
  isRecruitmentCompleted,
  normalizeAccountStatus,
  reconcileRecruitmentWorkflow,
  setRecruitmentStageStatus,
} from "../../shared/recruitment/recruitment-state.js";

const copy = value => structuredClone(value);

function accountStatus() {
  return normalizeAccountStatus(readServer("account")?.account?.status || "registration");
}

export function ensureMockRecruitmentState() {
  let recruitment = readServer("recruitment");
  if (!recruitment) {
    recruitment = accountStatus() === "active" ? completedRecruitment() : initialRecruitment();
  }
  recruitment = reconcileRecruitmentWorkflow(recruitment);
  writeServer("recruitment", recruitment);
  return recruitment;
}

function promoteAccountWhenCurrentFlowComplete(recruitment) {
  if (!isRecruitmentCompleted(recruitment)) return;
  const stored = readServer("account");
  if (!stored) return;
  if (normalizeAccountStatus(stored.account?.status) !== "active") {
    writeServer("account", { ...stored, account: { ...(stored.account || {}), status: "active" } });
  }
}

export function updateMockRecruitmentStage(stageId, status, patch = {}) {
  const recruitment = reconcileRecruitmentWorkflow(
    setRecruitmentStageStatus(ensureMockRecruitmentState(), stageId, status, patch),
  );
  writeServer("recruitment", recruitment);
  promoteAccountWhenCurrentFlowComplete(recruitment);
  return recruitment;
}

export function getMockRecruitmentApplicationState() {
  return {
    recruitment: copy(ensureMockRecruitmentState()),
    account: copy(readServer("account")),
  };
}

export function simulateRecruitmentAdminEvent(event = {}) {
  const type = String(event.type || "");
  if (type === "complete_moarefe") {
    return { success: true, recruitment: copy(updateMockRecruitmentStage("moarefe", "completed")) };
  }
  if (type === "complete_interview") {
    return { success: true, recruitment: copy(updateMockRecruitmentStage("interview", "completed")) };
  }
  return { success: false, code: "UNKNOWN_EVENT", message: "رویداد نمایشی شناخته نشد." };
}
