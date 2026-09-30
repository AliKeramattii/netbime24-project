import { STORAGE_KEYS } from "../../js/storage-keys.js";
import { createRecruitmentPageState } from "../../shared/recruitment/page-state.js";
export const { state: moarefeState, save: saveMoarefeState, reset: resetMoarefeState } = createRecruitmentPageState(STORAGE_KEYS.moarefe);
