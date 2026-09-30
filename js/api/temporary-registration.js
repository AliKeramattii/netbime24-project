// TEMPORARY registration fallback (config: MOCK_REGISTRATION_SUBMIT).
//
// The registration is ALWAYS sent to the real POST /api/registration first; if the backend saves
// it, nothing else happens. Backend validation errors (400) are shown to the user as usual.
// Only when the backend cannot accept it at all — no registration session cookie
// (401 / REGISTRATION_SESSION_REQUIRED: the cookie cannot be sent until the backend allows
// credentials), a server error (5xx) or no connection — is the registration completed locally,
// so the user can continue to the Moarefe/Interview dashboard. Such a registration is NOT saved
// in the backend database.
// The payload is built and checked by buildRegistrationRequest (real-api.js), the same function
// the real call uses. When the endpoint works: set MOCK_REGISTRATION_SUBMIT to false and delete
// this file.
import { failure } from "./errors.js";
import { buildRegistrationRequest } from "./real-api.js";

const text = (value) => (typeof value === "string" ? value.trim() : "");

const backendCannotAccept = (result) =>
  result?.code === "NETWORK_ERROR" ||
  result?.status === 401 ||
  ["UNAUTHORIZED", "REGISTRATION_SESSION_REQUIRED"].includes(result?.code) ||
  result?.status >= 500;

export function withTemporaryRegistration(api) {
  async function submitRegistration(payload) {
    const built = buildRegistrationRequest(payload);
    if (!built.success) return built;

    const result = await api.submitRegistration(payload);
    if (result?.success || !backendCannotAccept(result)) return result;

    const { identity, contact, education } = built.body;
    // Same minimum the backend needs: names, a valid mobile, postal code and a degree.
    if (!text(identity.firstName) || !text(identity.lastName) || !/^09\d{9}$/.test(text(contact.mobile))) {
      return failure("VALIDATION_ERROR", "اطلاعات ثبت نام کامل نیست.");
    }
    if (!/^\d{10}$/.test(text(contact.postalCode))) return failure("VALIDATION_ERROR", "کد پستی الزامی است.");
    if (!text(education.degree)) return failure("VALIDATION_ERROR", "اطلاعات ثبت نام کامل نیست.");
    return { success: true, completedLocally: true };
  }

  return Object.freeze({ ...api, submitRegistration });
}
