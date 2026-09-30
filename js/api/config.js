export const API_MODE = "real"; // "mock" keeps the offline development datasets.

// TEMPORARY: the Moarefe/Interview appointment endpoints do not exist in the backend yet.
// While true, real mode simulates only the appointment steps in the browser
// (js/api/temporary-appointments.js); everything else still uses the real API.
// Set to false once the appointment endpoints are implemented in real-api.js.
export const MOCK_APPOINTMENT_FLOW = true;

// TEMPORARY: the registration is always sent to POST /api/registration first. While true, if the
// backend cannot accept it (no session cookie, server error, no connection) it is completed in the
// browser so the user can continue (js/api/temporary-registration.js); that registration is not
// saved in the database. Set to false once the endpoint accepts registrations.
export const MOCK_REGISTRATION_SUBMIT = true;

// TEMPORARY: no cross-origin session cookie and no logout endpoint yet. While true, an existing
// user's dashboard context is built from the user returned by OTP verification, and logout
// clears the browser session (js/api/temporary-session.js). Set to false once the backend allows
// credentials (CROSS_ORIGIN_COOKIES) and provides POST /api/auth/logout.
export const MOCK_SESSION = true;

// DIRECT MODE (owner's decision, 2026-09-30): the host of ramatest.ir cannot run the Node proxy,
// so the browser calls the backend directly and requests its own Bearer tokens with the
// privateKey in js/api/private-key.js. Anyone can read that key in DevTools.
// Proxy mode instead: API_BASE_URL = "/api", BROWSER_TOKEN = false, run proxy/server.js.
export const API_BASE_URL = "https://api.ramatest.ir/api";
export const BROWSER_TOKEN = true;

// Send the backend session cookie (OTP verify, /me/context, referral, registration).
// The backend must answer with "Access-Control-Allow-Credentials: true" first (checked
// 2026-09-30: it does not). Kept false until then: with true, every cookie request is first
// blocked by the browser (red CORS errors in the console) and the dashboard makes several failing
// /me/context calls. If set true anyway, js/api/http.js retries without cookies, so nothing breaks.
// Without cookies, existing users are shown with the user from the OTP verify API (MOCK_SESSION).
export const CROSS_ORIGIN_COOKIES = false;

// A request with no answer after this long fails as a network error instead of hanging.
// The backend's first request after idle time can take ~20 s (measured 2026-09-30), so 30 s.
export const REQUEST_TIMEOUT_MS = 30000;

// path is relative to API_BASE_URL, e.g. "/auth/otp/request".
export function apiUrl(path, query) {
  const url = new URL(`${API_BASE_URL.replace(/\/+$/, "")}${path}`, globalThis.location.origin);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}
