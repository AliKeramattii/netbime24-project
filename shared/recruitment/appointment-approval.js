import { reconcileRecruitmentWorkflow } from "./recruitment-state.js";

/**
 * Single source of truth for appointment approval behaviour.
 *
 * moarefeAutoApproval: true  (current business rule)
 *   A successful Moarefe reservation is approved immediately and Interview selection opens.
 * moarefeAutoApproval: false (future manual review)
 *   The reservation stays "pending" until an authoritative status update approves it.
 *
 * Interview approval is never decided here; it always follows the reported status.
 */
export const APPOINTMENT_CONFIG = Object.freeze({
  moarefeAutoApproval: true,
});

// Frontend vocabulary: an approved appointment is "in_progress" (legacy "approved" maps to it).
const APPROVED = "in_progress";
const PENDING = "pending";

/**
 * Status a stage takes after a successful reservation. `reportedStatus` is what the backend
 * (or mock backend) reported; only a pending Moarefe is upgraded, and only under auto approval.
 */
export function reservationStatus(stageId, reportedStatus = PENDING) {
  if (stageId === "moarefe" && APPOINTMENT_CONFIG.moarefeAutoApproval && reportedStatus === PENDING) return APPROVED;
  return reportedStatus;
}

/** Read-only appointment state of one stage, derived from the authoritative recruitment snapshot. */
export function describeAppointmentStage(recruitment, stageId) {
  const stage = reconcileRecruitmentWorkflow(recruitment)[stageId] || {};
  const status = stage.status || "locked";
  return {
    status,
    appointment: stage.appointment || null,
    reserved: Boolean(stage.appointment) && [PENDING, APPROVED, "completed"].includes(status),
    pending: status === PENDING,
    approved: [APPROVED, "completed"].includes(status),
  };
}
