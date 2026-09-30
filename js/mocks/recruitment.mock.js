import { reconcileRecruitmentWorkflow } from "../../shared/recruitment/recruitment-state.js";

export function initialRecruitment() {
  return reconcileRecruitmentWorkflow({
    registration: { status: "completed" },
    referral: { status: "completed" },
    moarefe: { status: "available" },
    interview: { status: "locked" },
    documents: { status: "locked" },
    contract: { status: "locked" },
  });
}

export function completedRecruitment() {
  return reconcileRecruitmentWorkflow({
    registration: { status: "completed" },
    referral: { status: "completed" },
    moarefe: { status: "completed" },
    interview: { status: "completed" },
    documents: { status: "locked" },
    contract: { status: "locked" },
  });
}
