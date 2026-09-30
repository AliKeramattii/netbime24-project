import { api } from "../../js/api.js";
import { APP_ROUTES } from "./app-routes.js";
import { canAccessModule, getModuleAccessReason, getRecruitmentStageAccess, renderModuleAccessDenied, renderRecruitmentStageAccessDenied } from "./access-control.js";
import { cloneTemplate } from "../../js/html.js";

let contextPromise = null;
let cachedContext = null;
let contextGeneration = 0;

export function redirectToAuth() {
  if (typeof window === "undefined") return;
  try { window.location.replace(APP_ROUTES.auth); }
  catch { window.location.href = APP_ROUTES.auth; }
}

function normalizeContext(context) {
  if (!context?.success) {
    const error = new Error(context?.message || "");
    error.apiCode = context?.code || "DASHBOARD_CONTEXT_ERROR";
    throw error;
  }
  return context;
}

export function invalidateDashboardContext() {
  contextGeneration += 1;
  cachedContext = null;
  contextPromise = null;
}

export function getDashboardContext({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedContext) return Promise.resolve(cachedContext);
  if (!forceRefresh && contextPromise) return contextPromise;

  if (forceRefresh) invalidateDashboardContext();
  const requestGeneration = contextGeneration;
  contextPromise = api.getDashboardContext()
    .then(normalizeContext)
    .then((context) => {
      if (requestGeneration === contextGeneration) cachedContext = context;
      return context;
    })
    .catch((error) => ({
      success: false,
      code: error.apiCode || "DASHBOARD_CONTEXT_ERROR",
      message: error.message || "",
    }))
    .finally(() => { if (requestGeneration === contextGeneration) contextPromise = null; });

  return contextPromise;
}

export function refreshDashboardContext() {
  return getDashboardContext({ forceRefresh: true });
}

// Backward-compatible alias for existing feature modules and QA.
export function initializeDashboardContext() {
  return getDashboardContext();
}

export async function ensureDashboardAccess({ refresh = false, moduleId = null, recruitmentStageId = null } = {}) {
  const context = refresh ? await refreshDashboardContext() : await getDashboardContext();
  if (!context?.success) {
    if (context?.code === "UNAUTHORIZED") {
      redirectToAuth();
      return false;
    }
    const main = typeof document !== "undefined" && (document.querySelector("#main-content") || document.querySelector("main"));
    if (main) {
      const fragment = cloneTemplate("dashboard-context-error-template", main.ownerDocument);
      const message = fragment.querySelector("[data-context-error-message]");
      if (message && context?.message) message.textContent = context.message;
      fragment.querySelector("[data-context-retry]")?.addEventListener("click", () => window.location.reload());
      main.replaceChildren(fragment);
    }
    return false;
  }
  if (context.authenticated === false || !context.user) {
    redirectToAuth();
    return false;
  }

  const body = typeof document !== "undefined" ? document.body : null;
  const requestedModule = moduleId || body?.dataset.moduleAccess || null;
  const requestedStage = recruitmentStageId || body?.dataset.recruitmentStage || null;

  if (requestedModule && !canAccessModule(context, requestedModule)) {
    renderModuleAccessDenied(context, getModuleAccessReason(context, requestedModule));
    return false;
  }
  if (requestedStage) {
    const access = getRecruitmentStageAccess(context, requestedStage);
    if (!access.allowed) {
      if (access.reason === "stage_locked") renderRecruitmentStageAccessDenied(context);
      else renderModuleAccessDenied(context, access.reason);
      return false;
    }
  }
  return true;
}
