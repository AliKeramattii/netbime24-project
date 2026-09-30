import { introductionAvailability } from "./moarefe.mock.js";

export const interviewAvailability = () => introductionAvailability("interview");
export const interviewSlots = () => interviewAvailability().slots;
