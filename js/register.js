import {
  registrationState as state,
  saveState,
  clearVerification,
} from "./state.js";
import {
  normalizeDigits,
  normalizeMobile,
  toPersianDigits,
  validateMobile,
  validateVerificationCode,
} from "./validation.js";
import { api } from "./api.js";
import { mountTemplate, readTextTemplate } from "./html.js";
import { navigateTo, returnToMobile, completeOtpVerification } from "./navigation.js";
import { showInformation } from "./components.js";
import { APP_ROUTES } from "../shared/dashboard/app-routes.js";
import { invalidateDashboardContext } from "../shared/dashboard/dashboard-context.js";
import { clearOtpSends, otpBlockedUntil, recordOtpSend } from "./otp-limit.js";

const card = document.querySelector("#registration-card");
let busy = false;

function registrationCopy(key, values = {}) {
  return readTextTemplate(`[data-registration-copy="${key}"]`, document, values);
}

// Next allowed request: the backend's resend delay, or the end of the send-limit block.
function nextResendAt(mobile, resendAfterSeconds) {
  return Math.max(Date.now() + resendAfterSeconds * 1000, otpBlockedUntil(mobile));
}

// Over the send limit: no new code is requested. The last code stays usable and the resend
// timer counts down to the end of the block.
function showOtpLimit(blockedUntil) {
  state.verification.resendAt = blockedUntil;
  const minutes = Math.max(1, Math.ceil((blockedUntil - Date.now()) / 60000));
  showInformation(
    registrationCopy("otp-limit-title"),
    registrationCopy("otp-limit-message", { minutes: toPersianDigits(minutes) }),
  );
}

function announce(message) {
  document.querySelector("#app-status").textContent = message;
}

// Carries the API layer's message so backend errors reach the user instead of generic copy.
function apiError(result) {
  const error = new Error(result?.message || "");
  error.apiMessage = result?.message || "";
  return error;
}

export function updateControls() {
  saveState();
  card.dataset.screen = state.currentScreen;
  const form = card.querySelector("form");
  form.setAttribute("aria-busy", String(busy));
  const submit = form.querySelector('[type="submit"]');
  if (state.view === "mobile") {
    form.classList.toggle("has-value", Boolean(state.contact.mobile));
    const error = card.querySelector("#mobile-error");
    error.textContent = state.errors.mobile;
    error.hidden = !state.errors.mobile;
    card.querySelector(".error-icon").hidden = !state.errors.mobile;
    card
      .querySelector("#mobile")
      .setAttribute("aria-invalid", String(Boolean(state.errors.mobile)));
    card.querySelector("#mobile").readOnly = busy;
    submit.disabled =
      busy || !state.contact.mobile || Boolean(state.errors.mobile);
    submit.textContent = busy ? registrationCopy("busy") : registrationCopy("mobile-submit");
  } else {
    form.classList.toggle("has-error", Boolean(state.errors.code));
    const error = card.querySelector("#code-error");
    error.textContent = state.errors.code;
    error.hidden = !state.errors.code;
    card.querySelectorAll(".code-input").forEach((input) => {
      input.value = toPersianDigits(
        state.verification.digits[Number(input.dataset.index)],
      );
      input.setAttribute("aria-invalid", String(Boolean(state.errors.code)));
      input.readOnly = busy;
    });
    submit.disabled =
      busy || Boolean(validateVerificationCode(state.verification.digits));
    submit.textContent = busy ? registrationCopy("busy") : registrationCopy("code-submit");
    card.querySelectorAll(".back-button, .edit-button").forEach((button) => {
      button.disabled = busy;
    });
    updateCountdown();
  }
}

export function updateCountdown() {
  if (state.view !== "code") return;
  const remaining = Math.max(
    0,
    Math.ceil((state.verification.resendAt - Date.now()) / 1000),
  );
  const button = card.querySelector(".resend-button");
  if (!button) return;
  // The countdown runs from the moment the code was sent (resendAt), so it is shown right away.
  const showTimer = remaining > 0;
  button.hidden = showTimer;
  button.disabled = busy || remaining > 0;
  button.setAttribute(
    "aria-label",
    remaining > 0
      ? registrationCopy("resend-wait-label")
      : registrationCopy("resend-label"),
  );
  card.querySelector(".resend-timer").hidden = !showTimer;
  card.querySelector("#countdown").textContent = toPersianDigits(
    `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`,
  );
}

async function submitMobile(event) {
  event.preventDefault();
  if (busy) return;
  state.errors.mobile = validateMobile(state.contact.mobile);
  if (state.errors.mobile) {
    updateControls();
    card.querySelector("#mobile").focus();
    return;
  }
  if (state.verification.requestedMobile === state.contact.mobile) {
    navigateTo("code");
    return;
  }
  const blockedUntil = otpBlockedUntil(state.contact.mobile);
  if (blockedUntil) {
    state.verification.requestedMobile = state.contact.mobile;
    navigateTo("code");
    showOtpLimit(blockedUntil);
    updateControls();
    return;
  }
  busy = true;
  updateControls();
  try {
    const requestedMobile = state.contact.mobile;
    const result = await api.requestVerificationCode(requestedMobile);
    if (state.view !== "mobile" || state.contact.mobile !== requestedMobile)
      return;
    // Only a sent code may unlock the code screen; a failed request must stay retryable.
    if (!result.success) throw apiError(result);
    recordOtpSend(requestedMobile);
    state.verification.requestedMobile = requestedMobile;
    state.verification.resendAt = nextResendAt(requestedMobile, result.resendAfterSeconds);
    busy = false;
    navigateTo("code");
  } catch (error) {
    state.errors.mobile = error?.apiMessage || registrationCopy("request-code-failed");
    // Network failures stay retryable and do not mark a correctly formatted phone invalid.
    showInformation(registrationCopy("request-code-error-title"), state.errors.mobile);
    state.errors.mobile = "";
  } finally {
    busy = false;
    updateControls();
  }
}

async function submitCode(event) {
  event.preventDefault();
  if (busy) return;
  state.errors.code = validateVerificationCode(state.verification.digits);
  if (state.errors.code) {
    updateControls();
    return;
  }
  busy = true;
  updateControls();
  try {
    const submittedMobile = state.contact.mobile;
    const result = await api.verifyVerificationCode({
      mobile: submittedMobile,
      code: state.verification.digits.join(""),
    });
    if (state.view !== "code" || state.contact.mobile !== submittedMobile)
      return;
    // Only a rejected code is shown inline; network/auth/server failures use the error dialog.
    if (!result.success && result.verified !== false) throw apiError(result);
    if (!result.verified) {
      state.errors.code = result.message || registrationCopy("verification-invalid");
      card.querySelector(".code-input").focus();
    } else {
      state.errors.code = "";
      clearOtpSends(submittedMobile);
      if (result.isNewUser === false) {
        // Registered user: the session cookie set by OTP verification authenticates /me.
        // Dashboard data comes only from /me, never from the OTP response.
        invalidateDashboardContext();
        const context = await api.getDashboardContext();
        if (!context?.success || context.authenticated !== true) throw apiError(context);
        const currentStage = context?.recruitment?.currentStage;
        const destination = currentStage === "interview" || currentStage === "completed"
          ? APP_ROUTES.interview
          : APP_ROUTES.moarefe;
        window.location.replace(destination);
        return;
      }
      completeOtpVerification();
      navigateTo("identity");
    }
  } catch (error) {
    showInformation(
      registrationCopy("verification-error-title"),
      error?.apiMessage || registrationCopy("verification-error-message"),
    );
  } finally {
    busy = false;
    updateControls();
  }
}

async function resendCode() {
  if (busy || Date.now() < state.verification.resendAt) return;
  const blockedUntil = otpBlockedUntil(state.contact.mobile);
  if (blockedUntil) {
    showOtpLimit(blockedUntil);
    updateControls();
    return;
  }
  busy = true;
  updateControls();
  try {
    const requestedMobile = state.contact.mobile;
    const result = await api.requestVerificationCode(requestedMobile);
    if (state.view !== "code" || state.contact.mobile !== requestedMobile)
      return;
    state.verification.digits.fill("");
    state.verification.verified = false;
    if (!result.success) throw apiError(result);
    recordOtpSend(requestedMobile);
    state.verification.resendAt = nextResendAt(requestedMobile, result.resendAfterSeconds);
    state.errors.code = "";
    announce(registrationCopy("resend-success"));
    card.querySelector(".code-input").focus();
  } catch (error) {
    showInformation(
      registrationCopy("request-code-error-title"),
      error?.apiMessage || registrationCopy("resend-failed"),
    );
  } finally {
    busy = false;
    updateControls();
  }
}

function fillCode(startIndex, value) {
  if (busy) return;
  const digits = normalizeDigits(value).replace(/\D/g, "").slice(0, 6);
  if (!digits) state.verification.digits[startIndex] = "";
  else {
    const offset = digits.length === 6 ? 0 : startIndex;
    [...digits].forEach((digit, index) => {
      if (offset + index < 6) state.verification.digits[offset + index] = digit;
    });
    startIndex = Math.min(5, offset + digits.length);
  }
  state.errors.code = "";
  state.verification.verified = false;
  updateControls();
  const target = card.querySelector(`#code-${startIndex}`);
  target.focus();
  target.select();
}

function bindCodeInputs() {
  const inputs = [...card.querySelectorAll(".code-input")];
  inputs.forEach((input, index) => {
    input.addEventListener("input", () => fillCode(index, input.value));
    input.addEventListener("focus", () => input.select());
    input.addEventListener("paste", (event) => {
      event.preventDefault();
      fillCode(index, event.clipboardData.getData("text"));
    });
    input.addEventListener("keydown", (event) => {
      if (busy && ["Backspace", "Delete"].includes(event.key)) {
        event.preventDefault();
        return;
      }
      if (event.key === "Backspace" && !input.value && index > 0) {
        event.preventDefault();
        state.verification.digits[index - 1] = "";
        state.errors.code = "";
        updateControls();
        inputs[index - 1].focus();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        inputs[
          Math.max(0, Math.min(5, index + (event.key === "ArrowLeft" ? -1 : 1)))
        ].focus();
      }
    });
  });
}

export function renderRegistration(focusHeading = false) {
  card.classList.toggle("is-code", state.view === "code");
  mountTemplate(card, state.view === "mobile" ? "registration-mobile-template" : "registration-code-template");
  if (state.view === "mobile") {
    const mobile = card.querySelector("#mobile");
    mobile.value = toPersianDigits(state.contact.mobile);
    mobile.addEventListener("input", () => {
      const value = normalizeMobile(mobile.value);
      if (value !== state.contact.mobile) clearVerification();
      state.contact.mobile = value;
      state.errors.mobile = "";
      updateControls();
    });
    mobile.addEventListener("blur", () => {
      if (state.contact.mobile.length >= 11)
        state.errors.mobile = validateMobile(state.contact.mobile);
      updateControls();
    });
    card.querySelector("form").addEventListener("submit", submitMobile);
  } else {
    card.querySelector("#verification-mobile").textContent = toPersianDigits(
      state.contact.mobile,
    );
    card
      .querySelector(".back-button")
      .addEventListener("click", returnToMobile);
    card
      .querySelector(".edit-button")
      .addEventListener("click", returnToMobile);
    card.querySelector(".resend-button").addEventListener("click", resendCode);
    card.querySelector("form").addEventListener("submit", submitCode);
    bindCodeInputs();
  }
  updateControls();
  if (focusHeading) card.querySelector("#form-title").focus();
}
