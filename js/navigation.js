import { registrationState, saveState } from "./state.js";

const allowedViews = new Set([
  "mobile",
  "code",
  "identity",
  "contact",
  "education",
  "employment",
  "success",
]);
let renderView;

function resolveView(view) {
  if (!allowedViews.has(view)) return "mobile";
  if (view === "code" && !registrationState.verification.requestedMobile) return "mobile";
  if (
    ["identity", "contact", "education", "employment", "success"].includes(view) &&
    !registrationState.verification.verified
  ) {
    return registrationState.verification.requestedMobile ? "code" : "mobile";
  }
  if (view === "success" && !registrationState.submission.completed) return "employment";
  return view;
}

export function initializeNavigation(render) {
  renderView = render;
  registrationState.view = resolveView(registrationState.view);
  saveState();
  history.replaceState({ netbime: true, view: registrationState.view }, "", location.href);
  window.addEventListener("popstate", (event) => {
    registrationState.view = resolveView(event.state?.netbime ? event.state.view : "mobile");
    saveState();
    renderView(true);
  });
}

export function navigateTo(view, { replace = false } = {}) {
  const nextView = resolveView(view);
  if (nextView === registrationState.view) {
    renderView?.(false);
    return;
  }
  registrationState.view = nextView;
  saveState();
  const method = replace ? "replaceState" : "pushState";
  history[method]({ netbime: true, view: nextView }, "", location.href);
  renderView?.(true);
}

export function returnToMobile() {
  navigateTo("mobile");
}

export function completeOtpVerification() {
  registrationState.verification.verified = true;
  saveState();
  window.dispatchEvent(new CustomEvent("registration:verified", { detail: { verified: true } }));
}

export function completeIdentityContactDetails() {
  saveState();
  window.dispatchEvent(new CustomEvent("registration:identity-contact-complete", { detail: { nextView: "education" } }));
}
