import { disposeFormControls } from "./form-controls.js";
import { api } from "./api.js";
import "../shared/dashboard/header.js";
import { registrationState } from "./state.js";
import { initializeNavigation } from "./navigation.js";
import { renderRegistration, updateCountdown } from "./register.js";
import { renderIdentityContactRegistration } from "./registration-identity-contact.js";
import { renderEducationEmploymentRegistration } from "./registration-education-employment.js";
import { showInformation } from "./components.js";
import { STORAGE_KEYS } from "./storage-keys.js";
import { APP_ROUTES } from "../shared/dashboard/app-routes.js";
import { invalidateDashboardContext } from "../shared/dashboard/dashboard-context.js";

const entryLayout = document.querySelector("#entry-layout");
const workspace = document.querySelector("#registration-workspace");
const appHeader = document.querySelector("#app-header");

function closeProfileMenu() {
  appHeader?.closeProfileMenu?.();
}

function openProfileMenu() {
  appHeader?.openProfileMenu?.();
}

function showStaticInformation(key, messageOverride = "") {
  const source = document.querySelector(`[data-dialog-copy="${key}"]`);
  if (!source) return;
  showInformation(
    source.querySelector("[data-dialog-title]")?.textContent?.trim() || "",
    messageOverride || source.querySelector("[data-dialog-message]")?.textContent?.trim() || "",
  );
}

function renderApp(focusHeading = false) {
  disposeFormControls();
  const workspaceView = ["identity", "contact", "education", "employment", "success"].includes(registrationState.view);
  entryLayout.hidden = workspaceView;
  workspace.hidden = !workspaceView;
  appHeader.hidden = !workspaceView;
  document.body.classList.toggle("has-registration-workspace", workspaceView);

  if (!workspaceView) {
    closeProfileMenu();
    renderRegistration(focusHeading);
    return;
  }

  if (["identity", "contact"].includes(registrationState.view)) {
    closeProfileMenu();
    renderIdentityContactRegistration(focusHeading);
  } else {
    renderEducationEmploymentRegistration(focusHeading);
    if (registrationState.view === "success") openProfileMenu();
    else closeProfileMenu();
  }
}

initializeNavigation(renderApp);
renderApp();
window.setInterval(() => {
  if (registrationState.view === "code") updateCountdown();
}, 1000);
document.addEventListener("visibilitychange", () => {
  if (registrationState.view === "code") updateCountdown();
});

document.querySelectorAll("[data-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    showStaticInformation(button.dataset.dialog === "guide" ? "guide" : "support");
  });
});

appHeader.addEventListener("netbime:profile", () => {
  if (registrationState.view !== "success") {
    showStaticInformation("account-locked");
    return;
  }
  appHeader.toggleProfileMenu?.();
});

appHeader.addEventListener("netbime:notifications", () => {
  showStaticInformation("registration-notifications");
});

appHeader.addEventListener("netbime:profile-action", async (event) => {
  const action = event.detail?.action;
  if (action === "account") {
    showStaticInformation("account-unavailable");
  } else if (action === "logout") {
    const result = await api.logout();
    if (!result?.success) {
      showStaticInformation("logout-error", result?.message);
      return;
    }
    invalidateDashboardContext();
    try { sessionStorage.removeItem(STORAGE_KEYS.registration); } catch { /* storage is optional */ }
    window.location.replace(APP_ROUTES.auth);
  }
});
