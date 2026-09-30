// TEMPORARY frontend session (config: MOCK_SESSION).
//
// In direct mode the browser cannot send the backend session cookie (the backend's CORS has no
// Access-Control-Allow-Credentials), so GET /api/me/context answers 401, and there is no logout
// endpoint. Until the backend supports both:
//   - after OTP verification of an EXISTING user, the user returned by the backend
//     (VerifyOtpResponse.user = Swagger UserInfo) is kept in sessionStorage and used as the
//     dashboard context. With CROSS_ORIGIN_COOKIES on, the real /api/me/context is tried first.
//   - logout is the local session clear of real-api.js (js/local-session.js).
// Stored data is user info only (no token, no key). To remove: set MOCK_SESSION to false and
// delete this file once cookies work cross-origin and POST /api/auth/logout exists.
import { CROSS_ORIGIN_COOKIES } from "./config.js";
import { STORAGE_KEYS } from "../storage-keys.js";

const text = (value) => (typeof value === "string" ? value.trim() : "");

function readUser() {
  try {
    const user = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.temporarySession))?.user;
    return user && typeof user === "object" ? user : null;
  } catch {
    return null;
  }
}

function writeUser(user) {
  try {
    sessionStorage.setItem(STORAGE_KEYS.temporarySession, JSON.stringify({ user }));
  } catch {
    /* Storage unavailable: the session lasts for this page only. */
  }
}

// Swagger DashboardContextResponse built from Swagger UserInfo.
function contextFromUser(user) {
  const firstName = text(user.firstName);
  const lastName = text(user.lastName);
  return {
    success: true,
    authenticated: true,
    user: {
      id: user.id ?? `user-${text(user.mobile)}`,
      firstName,
      lastName,
      displayName: text(user.displayName) || [firstName, lastName].filter(Boolean).join(" "),
      mobile: text(user.mobile),
      avatarUrl: user.avatarUrl ?? null,
    },
    account: { status: "recruitment" },
    recruitment: { stages: [] },
  };
}

export function withTemporarySession(api) {
  async function verifyVerificationCode(input) {
    const result = await api.verifyVerificationCode(input);
    if (result?.success && result.verified) {
      if (result.isNewUser === false && result.user) writeUser(result.user);
      else {
        try { sessionStorage.removeItem(STORAGE_KEYS.temporarySession); } catch { /* optional */ }
      }
    }
    return result;
  }

  async function getDashboardContext() {
    const user = readUser();
    // Without cross-origin cookies the real call can only answer 401; skip the round trip.
    // No session user (never signed in, or logged out) then means signed out -> login page.
    if (!CROSS_ORIGIN_COOKIES) {
      return user ? contextFromUser(user) : { success: true, authenticated: false, user: null };
    }
    const context = await api.getDashboardContext();
    if (context?.success && context.authenticated === true && context.user) return context;
    return user ? contextFromUser(user) : context;
  }

  return Object.freeze({ ...api, verifyVerificationCode, getDashboardContext });
}
