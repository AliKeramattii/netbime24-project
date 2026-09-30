import { createAnnouncer } from "../../shared/recruitment/page-feedback.js";
import { appointmentView } from "../../js/appointment-data.js";
import { api } from "../../js/api.js";
import { ensureDashboardAccess } from "../../shared/dashboard/dashboard-context.js";
import { APP_ROUTES } from "../../shared/dashboard/app-routes.js";
import { renderRecruitmentProgress } from "../../shared/recruitment/recruitment-process.js";
import { mountTemplate, readTextTemplate } from "../../js/html.js";
import { AppointmentScheduler, formatAppointmentDate, formatAppointmentTimeRange } from "../../shared/recruitment/appointment-scheduler.js";
import {
  moarefeState,
  saveMoarefeState,
} from "./moarefe-state.js";
import { interviewState, saveInterviewState } from "../interview/interview-state.js";
import { describeAppointmentStage } from "../../shared/recruitment/appointment-approval.js";
import { canAccessRecruitmentStage } from "../../shared/recruitment/recruitment-state.js";

const root = document.querySelector("#moarefe-root");
const statusRegion = document.querySelector("#moarefe-status");
const appointmentDialog = document.querySelector("#appointment-dialog");

let previewMeta = {};

let availableAppointments = [];
let availableDays = [];
let scheduler = null;

const announce = createAnnouncer(statusRegion);

function pageCopy(key, values = {}) {
  return readTextTemplate(`[data-page-copy="${key}"]`, document, values);
}

function approvedDescription() {
  const appointment = appointmentView(moarefeState.recruitment.moarefe.appointment);
  if (!appointment) return pageCopy("confirmed-time-missing");
  return pageCopy("moarefe-approved", { appointment: `${formatAppointmentDate(appointment)} ${formatAppointmentTimeRange(appointment)}` });
}


function stepCopy(id) {
  const copy = root.querySelector(`[data-step-copy="${id}"]`);
  return {
    title: copy?.querySelector("[data-step-title]")?.textContent?.trim() || id,
    description: copy?.querySelector("[data-step-description]")?.textContent?.trim() || "",
    icon: copy?.dataset.stepIcon || "",
  };
}

function getRecruitmentSteps() {
  const introStatus = moarefeState.recruitment.moarefe.status;
  let introDescription = pageCopy("moarefe-available");

  if (introStatus === "pending") introDescription = pageCopy("moarefe-pending");
  if (introStatus === "in_progress") introDescription = approvedDescription();
  if (introStatus === "rejected") introDescription = pageCopy("moarefe-rejected");
  if (introStatus === "completed") introDescription = pageCopy("moarefe-completed");

  const interviewAvailable = moarefeState.recruitment.interview.status === "available";
  const steps = [
    {
      id: "registration",
      ...stepCopy("registration"),
      status: moarefeState.recruitment.registration.status,
    },
    {
      id: "referral",
      ...stepCopy("referral"),
      status: moarefeState.recruitment.referral.status,
    },
    {
      id: "moarefe",
      ...stepCopy("moarefe"),
      description: introDescription,
      status: introStatus,
    },
    {
      id: "interview",
      ...stepCopy("interview"),
      description: interviewAvailable ? pageCopy("interview-available") : "",
      status: moarefeState.recruitment.interview.status,
    },
    {
      id: "documents",
      ...stepCopy("documents"),
      status: moarefeState.recruitment.documents.status,
    },
    {
      id: "contract",
      ...stepCopy("contract"),
      status: moarefeState.recruitment.contract.status,
    },
  ];

  return introStatus === "rejected" ? steps.slice(0, 3) : steps;
}

function renderProcess() {
  mountTemplate(root, "moarefe-process-template");
  const currentStatus = moarefeState.recruitment.moarefe.status;
  root.querySelector("[data-process-extra]").hidden = currentStatus !== "rejected";
  renderRecruitmentProgress(root.querySelector("[data-process-progress]"), getRecruitmentSteps(), {
    actionableStatuses: ["available"],
    onStepAction(stepId) {
      if (stepId === "moarefe") {
        moarefeState.view = "scheduling";
        saveMoarefeState();
        render();
        root.querySelector("h1")?.focus?.();
      } else if (stepId === "interview") {
        location.href = APP_ROUTES.interview;
      }
    },
  });
  root.querySelector("[data-process-withdraw]")?.addEventListener("click", async () => {
    const result = await api.withdrawRecruitment();
    announce(result.message);
  });
}

function createAppointmentPayload(selected) {
  if (!selected || !moarefeState.scheduling.termsAccepted) return null;
  return {
    recruitmentStage: "moarefe",
    slotId: selected.id,
    termsAccepted: true,
  };
}

async function submitAppointmentRequest(selected) {
  const payload = createAppointmentPayload(selected);
  if (!payload) {
    announce(pageCopy("selection-required"));
    return;
  }

  try {
    const response = await api.submitAppointmentRequest(payload);
    if (!response?.success) {
      if (response.code === "SLOT_UNAVAILABLE") {
        scheduler.clearSelection();
        await loadAvailability();
      }
      scheduler.showMessage(response.message || pageCopy("submit-failed"));
      return;
    }
    moarefeState.request.lastPayload = payload;
    moarefeState.request.submittedAt = new Date().toISOString();
    moarefeState.recruitment = response.recruitment;
    moarefeState.view = "process";
    saveMoarefeState();
    // The approval strategy (shared/recruitment/appointment-approval.js) has already set the
    // status; approved continues to Interview selection, pending waits for a status update.
    if (describeAppointmentStage(response.recruitment, "moarefe").approved && canAccessRecruitmentStage(response.recruitment, "interview")) {
      announce(pageCopy("submit-approved"));
      interviewState.view = "scheduling";
      saveInterviewState();
      location.href = APP_ROUTES.interview;
      return;
    }
    announce(pageCopy("submit-success"));
    render();
  } catch {
    scheduler.showMessage(pageCopy("submit-failed"));
  }
}

function createScheduler() {
  return new AppointmentScheduler({
    root,
    dialog: appointmentDialog,
    state: moarefeState.scheduling,
    appointments: availableAppointments,
    days: availableDays,
    config: {
      idPrefix: "appointment",
      templateId: "moarefe-scheduler-template",
    },
    onBack() {
      moarefeState.view = "process";
      saveMoarefeState();
      render();
    },
    onChange() {
      saveMoarefeState();
    },
    onSubmit: submitAppointmentRequest,
    announce,
    onRetry: loadAvailability,
  });
}

function render() {
  if (moarefeState.view === "scheduling") {
    scheduler?.setAvailability(availableAppointments, availableDays);
    scheduler?.render();
  } else {
    renderProcess();
  }
}


async function loadAvailability() {
  scheduler.setLoadState("loading");
  if (moarefeState.view === "scheduling") scheduler.render();
  try {
    const response = await api.getAvailableAppointments();
    if (!response.success) throw new Error(response.message);
    availableAppointments = response.slots || [];
    availableDays = response.days || [];
    scheduler.setAvailability(availableAppointments, availableDays);
    scheduler.setLoadState("loaded");
  } catch (error) {
    availableAppointments = [];
    availableDays = [];
    scheduler.setAvailability([], []);
    scheduler.setLoadState("error", error.message);
  }
  render();
}
async function initialize() {
  if (!await ensureDashboardAccess({ recruitmentStageId: "moarefe" })) return;
  mountTemplate(root, "recruitment-loading-template");
  try {
    const response = await api.getRecruitmentStatus();
    if (response.code === "UNAUTHORIZED") { location.replace(APP_ROUTES.auth); return; }
    if (!response.success) throw new Error(response.message);
    moarefeState.recruitment = response.recruitment;
    if (response.view) moarefeState.view = response.view;
    if (response.scheduling) Object.assign(moarefeState.scheduling, response.scheduling);
    previewMeta = response.preview || {};
    if (moarefeState.recruitment.moarefe.status !== "available") moarefeState.view = "process";
    scheduler?.destroy();
    scheduler = createScheduler();
    if (moarefeState.recruitment.moarefe.status === "available") await loadAvailability();
    else render();
    if (previewMeta.openModal) scheduler.openDialog({ selectedSlotId: previewMeta.modalSelected ? previewMeta.selectedSlotId : "" });
  } catch (error) {
    mountTemplate(root, "recruitment-page-error-template");
    if (error.message) root.querySelector("[data-page-error-message]").textContent = error.message;
    root.querySelector("[data-page-retry]")?.addEventListener("click", initialize);
  }
}
initialize();

// Manual approval (moarefeAutoApproval: false): while the reservation is pending, re-read the
// authoritative status when the user returns to the tab, so an approval unlocks Interview.
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || moarefeState.view !== "process") return;
  if (!describeAppointmentStage(moarefeState.recruitment, "moarefe").pending) return;
  const response = await api.getRecruitmentStatus();
  if (!response?.success) return;
  moarefeState.recruitment = response.recruitment;
  render();
});
