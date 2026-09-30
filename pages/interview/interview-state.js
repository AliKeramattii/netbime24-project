import { STORAGE_KEYS } from "../../js/storage-keys.js";
import { createRecruitmentPageState } from "../../shared/recruitment/page-state.js";
export const { state: interviewState, save: saveInterviewState, reset: resetInterviewState } = createRecruitmentPageState(STORAGE_KEYS.interview);
