// TEMPORARY local logout: Swagger has no POST /api/auth/logout yet (task API-07, D-018).
// Logging out only ends the session in this browser tab: every session key in sessionStorage is
// removed. The OTP send limit (localStorage) is kept on purpose so logging out cannot reset it.
// The backend HttpOnly cookie, if any, cannot be cleared from JS; once the endpoint exists,
// real-api.js calls it first and still clears this local state.
import { STORAGE_KEYS } from "./storage-keys.js";

export const LOCAL_SESSION_KEYS = Object.freeze([
  STORAGE_KEYS.temporarySession,
  STORAGE_KEYS.temporaryAppointments,
  STORAGE_KEYS.registration,
  STORAGE_KEYS.moarefe,
  STORAGE_KEYS.interview,
]);

export function clearLocalSession() {
  for (const key of LOCAL_SESSION_KEYS) {
    try { sessionStorage.removeItem(key); } catch { /* storage is optional */ }
  }
}

export async function localLogout() {
  clearLocalSession();
  return { success: true };
}
