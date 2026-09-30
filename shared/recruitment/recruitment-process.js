import { cloneTemplate } from "../../js/html.js";

function statusMeta(status, ownerDocument = document) {
  const source = ownerDocument.querySelector(`[data-recruitment-status-copy="${status}"]`)
    || ownerDocument.querySelector('[data-recruitment-status-copy="locked"]');
  return {
    label: source?.textContent?.trim() || status || "",
    tone: source?.dataset.tone || "locked",
    marker: source?.dataset.marker || "",
    icon: source?.dataset.icon || "",
  };
}

function accessibleStepLabel(step, ownerDocument = document) {
  const label = statusMeta(step.status, ownerDocument).label;
  return [step.title, label, step.description].filter(Boolean).join("، ");
}

function replaceSurface(fragment, tagName) {
  const current = fragment.querySelector("[data-step-surface]");
  if (!current || current.tagName.toLowerCase() === tagName) return current;
  const replacement = current.ownerDocument.createElement(tagName);
  replacement.className = current.className;
  replacement.dataset.stepSurface = "";
  replacement.append(...current.childNodes);
  current.replaceWith(replacement);
  return replacement;
}

function createStep(step, { onStepAction, actionableStatuses, resolveStepHref }, ownerDocument) {
  const fragment = cloneTemplate("recruitment-step-template", ownerDocument);
  const item = fragment.querySelector(".recruitment-step");
  if (!item) throw new Error("Recruitment step template is incomplete.");
  item.classList.add(`recruitment-step--${step.status}`);
  item.dataset.stepId = step.id;

  const href = typeof resolveStepHref === "function" ? resolveStepHref(step) : null;
  const canUseAction = actionableStatuses.includes(step.status) && typeof onStepAction === "function";
  const isLink = Boolean(href) && step.status !== "locked";
  const isButton = !isLink && canUseAction;
  const surface = replaceSurface(fragment, isLink ? "a" : isButton ? "button" : "div");
  const ariaLabel = accessibleStepLabel(step, ownerDocument);

  if (isLink) {
    surface.href = href;
    surface.setAttribute("aria-label", ariaLabel);
  } else if (isButton) {
    surface.type = "button";
    surface.addEventListener("click", () => onStepAction(step.id));
    surface.setAttribute("aria-label", ariaLabel);
  }

  const icon = fragment.querySelector("[data-step-icon]");
  const title = fragment.querySelector("[data-step-title]");
  const description = fragment.querySelector("[data-step-description]");
  if (icon) icon.src = step.icon || "";
  if (title) title.textContent = step.title || "";
  if (description) description.textContent = step.description || "";

  const meta = statusMeta(step.status, ownerDocument);
  const badge = fragment.querySelector("[data-step-status]");
  const statusIcon = fragment.querySelector("[data-status-icon]");
  const marker = fragment.querySelector("[data-status-marker]");
  const statusLabel = fragment.querySelector("[data-status-label]");
  badge?.classList.add(`status-badge--${meta.tone}`);
  if (statusIcon) {
    statusIcon.hidden = !meta.icon;
    if (meta.icon) statusIcon.src = meta.icon;
  }
  if (marker) {
    marker.hidden = Boolean(meta.icon);
    marker.textContent = meta.marker;
  }
  if (statusLabel) statusLabel.textContent = meta.label;
  return fragment;
}

export function createRecruitmentProgress(steps = [], {
  onStepAction,
  actionableStatuses = ["available"],
  resolveStepHref,
  ariaLabel,
  className = "",
} = {}, ownerDocument = document) {
  const fragment = cloneTemplate("recruitment-progress-template", ownerDocument);
  const list = fragment.querySelector(".recruitment-progress");
  if (!list) throw new Error("Recruitment progress template is incomplete.");
  if (className) list.classList.add(...className.split(/\s+/).filter(Boolean));
  if (ariaLabel) list.setAttribute("aria-label", ariaLabel);
  steps.forEach(step => list.append(createStep(step, { onStepAction, actionableStatuses, resolveStepHref }, ownerDocument)));
  return fragment;
}

export function renderRecruitmentProgress(container, steps = [], options = {}) {
  if (!container) return null;
  const fragment = createRecruitmentProgress(steps, options, container.ownerDocument);
  container.replaceChildren(fragment);
  return container.querySelector(".recruitment-progress");
}
