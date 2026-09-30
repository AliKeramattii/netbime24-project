import { createAnnouncer } from "../../shared/recruitment/page-feedback.js";
import { appointmentView } from "../../js/appointment-data.js";
import { api } from "../../js/api.js";
import { ensureDashboardAccess } from "../../shared/dashboard/dashboard-context.js";
import { APP_ROUTES } from "../../shared/dashboard/app-routes.js";
import { renderRecruitmentProgress } from "../../shared/recruitment/recruitment-process.js";
import { mountTemplate, readTextTemplate } from "../../js/html.js";
import {
  AppointmentScheduler,
  formatAppointmentDate,
  formatAppointmentTimeRange,
} from "../../shared/recruitment/appointment-scheduler.js";
import {
  interviewState,
  saveInterviewState,
} from "./interview-state.js";

const root = document.querySelector("#interview-root");
const statusRegion = document.querySelector("#interview-status");
const appointmentDialog = document.querySelector("#interview-appointment-dialog");

let previewMeta = {};

let availableAppointments = [];
let availableDays = [];
let scheduler = null;

const announce = createAnnouncer(statusRegion);

function pageCopy(key, values = {}) {
  return readTextTemplate(`[data-page-copy="${key}"]`, document, values);
}

function approvedDescription() {
  const appointment = appointmentView(interviewState.recruitment.interview.appointment);
  if (!appointment) return pageCopy("confirmed-time-missing");
  return pageCopy("interview-approved", { appointment: `${formatAppointmentDate(appointment)} ${formatAppointmentTimeRange(appointment)}` });
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
  const interviewStatus = interviewState.recruitment.interview.status;
  let interviewDescription = pageCopy("interview-available");

  if (interviewStatus === "pending") interviewDescription = pageCopy("interview-pending");
  if (interviewStatus === "in_progress") interviewDescription = approvedDescription();
  if (interviewStatus === "rejected") interviewDescription = pageCopy("interview-rejected");
  if (interviewStatus === "completed") interviewDescription = pageCopy("interview-completed");

  const documentsAvailable = interviewState.recruitment.documents.status === "available";
  const steps = [
    {
      id: "registration",
      ...stepCopy("registration"),
      status: interviewState.recruitment.registration.status,
    },
    {
      id: "referral",
      ...stepCopy("referral"),
      status: interviewState.recruitment.referral.status,
    },
    {
      id: "moarefe",
      ...stepCopy("moarefe"),
      status: interviewState.recruitment.moarefe.status,
    },
    {
      id: "interview",
      ...stepCopy("interview"),
      description: interviewDescription,
      status: interviewStatus,
    },
    {
      id: "documents",
      ...stepCopy("documents"),
      description: documentsAvailable ? pageCopy("documents-available") : "",
      status: interviewState.recruitment.documents.status,
    },
    {
      id: "contract",
      ...stepCopy("contract"),
      status: interviewState.recruitment.contract.status,
    },
  ];

  return interviewStatus === "rejected" ? steps.slice(0, 4) : steps;
}

function renderProcess() {
  mountTemplate(root, "interview-process-template");
  const currentStatus = interviewState.recruitment.interview.status;
  root.querySelector("[data-process-extra]").hidden = currentStatus !== "rejected";
  renderRecruitmentProgress(root.querySelector("[data-process-progress]"), getRecruitmentSteps(), {
    actionableStatuses: ["available"],
    onStepAction(stepId) {
      if (stepId === "interview") {
        interviewState.view = "scheduling";
        saveInterviewState();
        render();
        root.querySelector("h1")?.focus?.();
      }
    },
  });
  root.querySelector("[data-process-withdraw]")?.addEventListener("click", async () => {
    const result = await api.withdrawRecruitment();
    announce(result.message);
  });
}

function createInterviewPayload(selected) {
  if (!selected || !interviewState.scheduling.termsAccepted) return null;
  return {
    recruitmentStage: "interview",
    slotId: selected.id,
    termsAccepted: true,
  };
}

async function submitInterviewRequest(selected) {
  const payload = createInterviewPayload(selected);
  if (!payload) {
    announce(pageCopy("selection-required"));
    return;
  }

  try {
    const response = await api.submitInterviewRequest(payload);
    if (!response?.success) {
      if (response.code === "SLOT_UNAVAILABLE") {
        scheduler.clearSelection();
        await loadAvailability();
      }
      scheduler.showMessage(response.message || pageCopy("submit-failed"));
      return;
    }

    interviewState.request.lastPayload = payload;
    interviewState.request.submittedAt = new Date().toISOString();
    interviewState.recruitment = response.recruitment;
    interviewState.view = "process";
    saveInterviewState();
    announce(pageCopy("submit-success"));
    render();
  } catch {
    scheduler.showMessage(pageCopy("submit-failed-interview"));
  }
}

function createScheduler() {
  return new AppointmentScheduler({
    root,
    dialog: appointmentDialog,
    state: interviewState.scheduling,
    appointments: availableAppointments,
    days: availableDays,
    config: {
      idPrefix: "interview-appointment",
      templateId: "interview-scheduler-template",
    },
    onBack() {
      interviewState.view = "process";
      saveInterviewState();
      render();
    },
    onChange() {
      saveInterviewState();
    },
    onSubmit: submitInterviewRequest,
    announce,
    onRetry: loadAvailability,
  });
}

function render() {
  if (interviewState.view === "scheduling") {
    scheduler?.setAvailability(availableAppointments, availableDays);
    scheduler?.render();
  } else {
    renderProcess();
  }
}


async function loadAvailability() {
  scheduler.setLoadState("loading");
  if (interviewState.view === "scheduling") scheduler.render();
  try {
    const response = await api.getInterviewAvailability();
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
  if (!await ensureDashboardAccess({ recruitmentStageId: "interview" })) return;
  mountTemplate(root, "recruitment-loading-template");
  try {
    const response = await api.getInterviewStatus();
    if (response.code === "UNAUTHORIZED") { location.replace(APP_ROUTES.auth); return; }
    if (!response.success) throw new Error(response.message);
    if (response.recruitment.interview.status === "locked") { location.replace(APP_ROUTES.moarefe); return; }
    interviewState.recruitment = response.recruitment;
    if (response.view) interviewState.view = response.view;
    if (response.scheduling) Object.assign(interviewState.scheduling, response.scheduling);
    previewMeta = response.preview || {};
    if (interviewState.recruitment.interview.status !== "available") interviewState.view = "process";
    scheduler?.destroy();
    scheduler = createScheduler();
    if (interviewState.recruitment.interview.status === "available") await loadAvailability();
    else render();
    if (previewMeta.openModal) scheduler.openDialog({ selectedSlotId: previewMeta.modalSelected ? previewMeta.selectedSlotId : "" });
  } catch (error) {
    mountTemplate(root, "recruitment-page-error-template");
    if (error.message) root.querySelector("[data-page-error-message]").textContent = error.message;
    root.querySelector("[data-page-retry]")?.addEventListener("click", initialize);
  }
}
initialize();
