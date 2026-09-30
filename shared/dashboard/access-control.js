import { APP_ROUTES, resolveRecruitmentStageRoute } from "./app-routes.js";
import { cloneTemplate } from "../../js/html.js";
import { canAccessRecruitmentStage, getCurrentRecruitmentStage, normalizeAccountStatus } from "../recruitment/recruitment-state.js";

export function canAccessModule(context, moduleId) {
  if (!context?.authenticated || !context?.user) return false;
  const accountStatus = normalizeAccountStatus(context.account?.status);
  if (moduleId === "recruitment") return accountStatus === "recruitment" || accountStatus === "active";
  return false;
}

export function getModuleAccessReason(context) {
  if (!context?.authenticated || !context?.user) return "unauthenticated";
  return normalizeAccountStatus(context.account?.status) === "registration" ? "registration_incomplete" : "unavailable";
}

export function getRecruitmentStageAccess(context, stageId) {
  if (!canAccessModule(context, "recruitment")) return { allowed: false, reason: getModuleAccessReason(context) };
  if (canAccessRecruitmentStage(context, stageId)) return { allowed: true, reason: null };
  return { allowed: false, reason: "stage_locked" };
}

function mountAccessTemplate(templateId, actionHref) {
  const main = document.querySelector("#main-content") || document.querySelector("main");
  if (!main) return null;
  const fragment = cloneTemplate(templateId, main.ownerDocument);
  const action = fragment.querySelector("[data-access-action]");
  if (action && actionHref) action.href = actionHref;
  main.replaceChildren(fragment);
  return main;
}

export function renderModuleAccessDenied(context, reason = "unavailable") {
  const registration = reason === "registration_incomplete";
  mountAccessTemplate(
    registration ? "module-access-registration-template" : "module-access-unavailable-template",
    registration ? APP_ROUTES.auth : APP_ROUTES.moarefe,
  );
}


function getStageTitleFromHtml(stageId) {
  if (!stageId) return "";
  const selector = `[data-step-copy="${stageId}"] [data-step-title]`;
  const mounted = document.querySelector(selector);
  if (mounted) return mounted.textContent?.trim() || "";
  for (const template of document.querySelectorAll("template")) {
    const source = template.content.querySelector(selector);
    if (source) return source.textContent?.trim() || "";
  }
  return "";
}

export function renderRecruitmentStageAccessDenied(context) {
  const current = getCurrentRecruitmentStage(context?.recruitment);
  const currentHref = current ? resolveRecruitmentStageRoute(current.id) : null;
  const main = mountAccessTemplate("recruitment-stage-locked-template", currentHref || APP_ROUTES.interview);
  const title = main?.querySelector("[data-current-stage-title]");
  if (title) title.textContent = getStageTitleFromHtml(current?.id) || context?.recruitment?.currentStageTitle || title.textContent;
}
