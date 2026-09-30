import { cloneTemplate } from "./html.js";
import { toPersianDigits } from "./validation.js";

export function createRegistrationStepper(activeIndex = 0) {
  const fragment = cloneTemplate("registration-stepper-template");
  const navigation = fragment.querySelector(".registration-stepper");
  navigation.dataset.activeIndex = String(activeIndex);
  const stepCount = navigation.querySelectorAll("[data-step-index]").length;
  navigation.querySelector("[data-stepper-current]").textContent = toPersianDigits(activeIndex + 1);
  navigation.querySelector("[data-stepper-percent]").textContent =
    `${toPersianDigits(Math.round(((activeIndex + 1) / stepCount) * 100))}٪`;
  navigation.querySelectorAll("[data-step-index]").forEach((item) => {
    const index = Number(item.dataset.stepIndex);
    item.classList.toggle("is-complete", index < activeIndex);
    item.classList.toggle("is-current", index === activeIndex);
    if (index === activeIndex) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  return navigation;
}

export function showInformation(title, message) {
  document.querySelector("#dialog-title").textContent = title;
  document.querySelector("#dialog-content").textContent = message;
  document.querySelector("#information-dialog").showModal();
}
