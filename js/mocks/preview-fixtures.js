import { initialRecruitment } from "./recruitment.mock.js";
import { setRecruitmentStageStatus } from "../../shared/recruitment/recruitment-state.js";

export function previewFixture(stage, name, slots) {
  const names = ["initial", "scheduling", "selected", "modal", "modal-selected", "custom", "pending", "approved", "rejected", "completed", stage === "moarefe" ? "interview" : "completed"];
  if (!names.includes(name)) return null;

  let recruitment = initialRecruitment();
  if (stage === "interview") {
    recruitment = setRecruitmentStageStatus(recruitment, "moarefe", "completed");
  }

  const appointment = slots.find(slot => slot.featured) || slots.find(slot => slot.status === "available");
  const custom = slots.filter(slot => slot.status === "available").at(-1) || appointment;
  const status = name === "interview" ? "completed" : name === "approved" ? "in_progress" : name;

  if (["pending", "in_progress", "rejected", "completed"].includes(status)) {
    recruitment = setRecruitmentStageStatus(recruitment, stage, status, { appointment });
  }

  return {
    recruitment,
    view: ["scheduling", "selected", "modal", "modal-selected", "custom"].includes(name) ? "scheduling" : "process",
    scheduling: {
      selectedSlotId: name === "selected" ? appointment?.id || "" : name === "custom" ? custom?.id || "" : "",
      customAppointment: name === "custom" ? custom : null,
      termsAccepted: ["selected", "custom"].includes(name),
    },
    preview: {
      openModal: name.startsWith("modal"),
      modalSelected: name === "modal-selected",
      selectedSlotId: custom?.id || "",
    },
  };
}
