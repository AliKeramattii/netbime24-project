import { trackFormControl, disposeFormControls } from "./form-controls.js";
import { mountTemplate, readTextTemplate } from "./html.js";
import {
  registrationState as state,
  saveState,
  clearManualReferral,
  hasValidatedReferral,
} from "./state.js";
import {
  normalizeMobile,
  normalizeNumeric,
  toPersianDigits,
  validateBirthDate,
  validateLandline,
  validateNationalId,
  validatePostalCode,
  validateReferralCode,
  validateRequiredText,
} from "./validation.js";
import { jalaliToIso, parseJalaliDate } from "./jalali.js";
import { PersianDatePicker } from "./persian-date-picker.js";
import { SearchableCombobox } from "./searchable-combobox.js";
import {
  IRAN_PROVINCE_NAMES,
  getIranCities,
  isIranCity,
  isIranProvince,
} from "./iran-locations.js";
import { api } from "./api.js";
import { completeIdentityContactDetails, navigateTo } from "./navigation.js";
import { createRegistrationStepper, showInformation } from "./components.js";

const card = document.querySelector("#registration-details-card");
const stepperMount = document.querySelector("#registration-stepper");
let busy = false;
let referralRequestId = 0;
let referralUrlInitialized = false;

function registrationCopy(key, values = {}) {
  return readTextTemplate(`[data-registration-copy="${key}"]`, document, values);
}

const invalidReferralCopy = () =>
  readTextTemplate('[data-validation-copy="referral-invalid"]', document);

function identityBaseValid() {
  return !(
    validateNationalId(state.identity.nationalId) ||
    validateBirthDate(state.identity.birthDate) ||
    validateRequiredText(state.identity.firstName, registrationCopy("first-name-label")) ||
    validateRequiredText(state.identity.lastName, registrationCopy("last-name-label"))
  );
}

function identityCanContinue() {
  if (!identityBaseValid() || state.referral.hasReferral === null) return false;
  if (state.referral.hasReferral === false) return true;
  // Typed and link codes alike: submitIdentity only continues after backend validation.
  return Boolean(state.referral.referralCode) && !state.errors.referralCode;
}

function contactCanContinue() {
  return (
    isIranProvince(state.contact.province) &&
    isIranCity(state.contact.province, state.contact.city) &&
    !validatePostalCode(state.contact.postalCode) &&
    !validateLandline(state.contact.landline)
  );
}

function sanitizeLocationState() {
  if (state.contact.province && !isIranProvince(state.contact.province)) {
    state.contact.province = "";
    state.contact.city = "";
  }
  if (
    state.contact.city &&
    !isIranCity(state.contact.province, state.contact.city)
  ) {
    state.contact.city = "";
  }
}

function syncRenderedError(input, errorElement, message) {
  if (input) input.setAttribute("aria-invalid", String(Boolean(message)));
  if (errorElement) {
    errorElement.textContent = message || "";
    errorElement.hidden = !message;
  }
}

function renderIdentityMarkup() {
  const expanded = state.referral.hasReferral !== null;
  const resolved = Boolean(
    state.referral.hasReferral === true &&
    state.referral.referralSource === "manual" &&
    state.referral.managerName,
  );
  card.className = `registration-details-card identity-card${expanded ? " is-expanded" : ""}${resolved ? " has-manager" : ""}`;
  mountTemplate(card, "registration-identity-template");

  const nationalId = card.querySelector("#national-id");
  const birthDate = card.querySelector("#birth-date");
  const firstName = card.querySelector("#first-name");
  const lastName = card.querySelector("#last-name");
  nationalId.value = toPersianDigits(state.identity.nationalId);
  birthDate.value = toPersianDigits(state.identity.birthDate);
  firstName.value = state.identity.firstName;
  lastName.value = state.identity.lastName;
  syncRenderedError(nationalId, card.querySelector("#national-id-error"), state.errors.nationalId);
  syncRenderedError(birthDate, card.querySelector("#birth-date-error"), state.errors.birthDate);
  syncRenderedError(firstName, card.querySelector("#first-name-error"), state.errors.firstName);
  syncRenderedError(lastName, card.querySelector("#last-name-error"), state.errors.lastName);

  const locked = state.referral.referralSource === "link";
  const referralFieldset = card.querySelector(".referral-choice");
  if (locked) referralFieldset.setAttribute("aria-describedby", "referral-link-details");
  else referralFieldset.removeAttribute("aria-describedby");

  const yes = card.querySelector('input[name="hasReferral"][value="yes"]');
  const no = card.querySelector('input[name="hasReferral"][value="no"]');
  yes.checked = state.referral.hasReferral === true;
  no.checked = state.referral.hasReferral === false;
  yes.disabled = locked;
  no.disabled = locked;
  card.querySelector('[data-referral-option="yes"]').classList.toggle("is-selected", yes.checked);
  card.querySelector('[data-referral-option="no"]').classList.toggle("is-selected", no.checked);

  const linkDetails = card.querySelector("[data-referral-link-details]");
  const manualField = card.querySelector("[data-manual-referral-field]");
  const showLink = locked && state.referral.hasReferral === true;
  const showManual = !locked && state.referral.hasReferral === true;
  linkDetails.hidden = !showLink;
  manualField.hidden = !showManual;
  if (showLink) {
    card.querySelector("[data-referral-link-name]").textContent = state.referral.managerName || registrationCopy("referral-pending");
    card.querySelector("[data-referral-link-code]").textContent = toPersianDigits(state.referral.managerCode || state.referral.referralCode);
  }
  if (showManual) {
    const code = card.querySelector("#referral-code");
    code.value = toPersianDigits(state.referral.referralCode);
    syncRenderedError(code, card.querySelector("#referral-code-error"), state.errors.referralCode);
    const manager = card.querySelector("#referral-manager-name");
    manager.hidden = !state.referral.managerName;
    card.querySelector("[data-referral-manager-name]").textContent = state.referral.managerName || "";
  }

  card.querySelector("[data-identity-confirmation]").hidden = state.referral.hasReferral === null;
  card.querySelector(".registration-next-button").disabled = !identityCanContinue() || busy;
}

function renderContactMarkup() {
  sanitizeLocationState();
  card.className = "registration-details-card contact-card";
  mountTemplate(card, "registration-contact-template");
  card.querySelector("#address").value = state.contact.address;
  card.querySelector("#postal-code").value = toPersianDigits(state.contact.postalCode);
  card.querySelector("#contact-mobile").value = toPersianDigits(state.contact.mobile);
  card.querySelector("#landline").value = toPersianDigits(state.contact.landline);
  syncRenderedError(card.querySelector("#postal-code"), card.querySelector("#postal-code-error"), state.errors.postalCode);
  syncRenderedError(card.querySelector("#landline"), card.querySelector("#landline-error"), state.errors.landline);
  card.querySelector(".registration-next-button").disabled = !contactCanContinue() || busy;
}

function updateScreen() {
  saveState();
  card.dataset.screen = state.currentScreen;
}

function updateIdentityButton() {
  if (state.view !== "identity") return;
  updateScreen();
  const button = card.querySelector(".registration-next-button");
  if (button) button.disabled = !identityCanContinue() || busy;
}

function updateContactButton() {
  if (state.view !== "contact") return;
  updateScreen();
  const button = card.querySelector(".registration-next-button");
  if (button) button.disabled = !contactCanContinue() || busy;
}

function syncFieldError(name, message) {
  state.errors[name] = message;
  const input = card.querySelector(`[name="${name}"]`);
  const error = card.querySelector(
    `#${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-error`,
  );
  if (input) input.setAttribute("aria-invalid", String(Boolean(message)));
  if (error) {
    error.textContent = message;
    error.hidden = !message;
  }
}

function bindIdentityTextFields() {
  const nationalId = card.querySelector("#national-id");
  const birthDate = card.querySelector("#birth-date");
  const calendarButton = card.querySelector(".birth-date-calendar-button");
  const firstName = card.querySelector("#first-name");
  const lastName = card.querySelector("#last-name");

  nationalId.addEventListener("input", () => {
    state.identity.nationalId = normalizeNumeric(nationalId.value).slice(0, 10);
    nationalId.value = toPersianDigits(state.identity.nationalId);
    syncFieldError("nationalId", "");
    updateIdentityButton();
  });
  nationalId.addEventListener("blur", () => {
    syncFieldError("nationalId", validateNationalId(state.identity.nationalId));
    updateIdentityButton();
  });

  const parsedSavedDate = parseJalaliDate(state.identity.birthDate);
  if (parsedSavedDate && !state.identity.birthDateIso) {
    state.identity.birthDateIso = jalaliToIso(
      parsedSavedDate.year,
      parsedSavedDate.month,
      parsedSavedDate.day,
    );
    saveState();
  }

  trackFormControl(new PersianDatePicker({
    input: birthDate,
    button: calendarButton,
    value: state.identity.birthDate,
    onSelect: ({ jalali, iso }) => {
      state.identity.birthDate = jalali;
      state.identity.birthDateIso = iso;
      syncFieldError("birthDate", "");
      updateIdentityButton();
    },
  }));

  for (const [input, key, label] of [
    [firstName, "firstName", registrationCopy("first-name-label")],
    [lastName, "lastName", registrationCopy("last-name-label")],
  ]) {
    input.addEventListener("input", () => {
      state.identity[key] = input.value.slice(0, 120);
      syncFieldError(key, "");
      updateIdentityButton();
    });
    input.addEventListener("blur", () => {
      syncFieldError(key, validateRequiredText(state.identity[key], label));
      updateIdentityButton();
    });
  }
}

// Applies a referral lookup for `code` and returns "valid", "invalid" or "error".
// Only a backend "invalid code" answer marks the code invalid; network, auth and server
// failures leave it unvalidated so the user can retry. The owner name comes only from the backend.
function applyReferralResult(code, result) {
  if (result?.success && result.manager?.name) {
    state.referral.managerName = result.manager.name;
    state.referral.managerCode = code;
    state.errors.referralCode = "";
    return "valid";
  }
  state.referral.managerName = "";
  state.referral.managerCode = "";
  if (result?.invalid || ["NOT_FOUND", "REFERRAL_NOT_FOUND"].includes(result?.code)) {
    // An invalid link code moves to the editable field so it can be corrected or removed.
    state.referral.referralSource = "manual";
    state.errors.referralCode = result.message || invalidReferralCopy();
    return "invalid";
  }
  return "error";
}

async function resolveReferral({ navigateAfter = false } = {}) {
  if (state.referral.hasReferral !== true) return false;
  if (hasValidatedReferral()) {
    if (navigateAfter) navigateTo("contact");
    return true;
  }

  const formatError = validateReferralCode(state.referral.referralCode);
  if (formatError) {
    state.referral.referralSource = "manual";
    state.errors.referralCode = formatError;
    renderIdentityContactRegistration();
    card.querySelector("#referral-code")?.focus();
    return false;
  }

  const code = state.referral.referralCode;
  const requestId = ++referralRequestId;
  busy = true;
  updateIdentityButton();
  try {
    const result = await api.getReferralManager(code);
    if (requestId !== referralRequestId || state.view !== "identity")
      return false;
    const outcome = applyReferralResult(code, result);
    saveState();
    if (outcome === "valid" && navigateAfter) {
      busy = false;
      navigateTo("contact");
      return true;
    }
    if (outcome === "error") {
      showInformation(
        registrationCopy("referral-error-title"),
        result?.message || registrationCopy("referral-error-message"),
      );
    }
    renderIdentityContactRegistration();
    if (outcome === "invalid") card.querySelector("#referral-code")?.focus();
    return outcome === "valid";
  } finally {
    busy = false;
    updateIdentityButton();
  }
}

function bindReferral() {
  card.querySelectorAll('input[name="hasReferral"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      state.referral.referralSource = "manual";
      state.referral.hasReferral = radio.value === "yes";
      clearManualReferral();
      saveState();
      renderIdentityContactRegistration();
      if (state.referral.hasReferral)
        card.querySelector("#referral-code")?.focus();
    });
  });

  const code = card.querySelector("#referral-code");
  if (!code) return;
  code.addEventListener("input", () => {
    ++referralRequestId;
    state.referral.referralCode = normalizeNumeric(code.value).slice(0, 20);
    state.referral.managerName = "";
    state.referral.managerCode = "";
    state.errors.referralCode = "";
    code.value = toPersianDigits(state.referral.referralCode);
    const error = card.querySelector("#referral-code-error");
    if (error) error.hidden = true;
    code.setAttribute("aria-invalid", "false");
    updateIdentityButton();
  });
  code.addEventListener("blur", () => {
    if (state.referral.referralCode) void resolveReferral();
  });
}

function validateIdentityForSubmit() {
  state.errors.nationalId = validateNationalId(state.identity.nationalId);
  state.errors.birthDate = validateBirthDate(state.identity.birthDate);
  state.errors.firstName = validateRequiredText(
    state.identity.firstName,
    registrationCopy("first-name-label"),
  );
  state.errors.lastName = validateRequiredText(
    state.identity.lastName,
    registrationCopy("last-name-label"),
  );
  if (state.referral.hasReferral === null) return false;
  if (
    state.referral.referralSource !== "link" &&
    state.referral.hasReferral === true
  )
    state.errors.referralCode = validateReferralCode(
      state.referral.referralCode,
    );
  return ![
    state.errors.nationalId,
    state.errors.birthDate,
    state.errors.firstName,
    state.errors.lastName,
    state.errors.referralCode,
  ].some(Boolean);
}

async function submitIdentity(event) {
  event.preventDefault();
  if (busy) return;
  if (!validateIdentityForSubmit()) {
    renderIdentityContactRegistration();
    card.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  // hasReferral=true never continues without a successful backend validation.
  if (state.referral.hasReferral === true) {
    await resolveReferral({ navigateAfter: true });
    return;
  }
  navigateTo("contact");
}

function bindIdentityForm() {
  bindIdentityTextFields();
  bindReferral();
  card
    .querySelector(".identity-form")
    .addEventListener("submit", submitIdentity);
  card
    .querySelector(".registration-back-button")
    .addEventListener("click", () => navigateTo("code"));
}

function bindContactForm() {
  const provinceRoot = card.querySelector('[data-searchable-root="province"]');
  const cityRoot = card.querySelector('[data-searchable-root="city"]');
  const address = card.querySelector("#address");
  const postalCode = card.querySelector("#postal-code");
  const landline = card.querySelector("#landline");

  const provinceCombobox = trackFormControl(new SearchableCombobox(provinceRoot, {
    options: IRAN_PROVINCE_NAMES,
    value: state.contact.province,
    onChange: (value) => {
      state.contact.province = value;
      if (!isIranCity(value, state.contact.city)) state.contact.city = "";
      state.errors.province = "";
      state.errors.city = "";
      saveState();
      renderIdentityContactRegistration();
      card.querySelector("#city-trigger")?.focus();
    },
  }));
  provinceCombobox.setError(state.errors.province);

  const cityCombobox = trackFormControl(new SearchableCombobox(cityRoot, {
    options: getIranCities(state.contact.province),
    value: state.contact.city,
    placeholder: state.contact.province
      ? cityRoot.dataset.placeholder
      : cityRoot.dataset.disabledPlaceholder,
    onChange: (value) => {
      state.contact.city = value;
      state.errors.city = "";
      cityCombobox.setError("");
      saveState();
      updateContactButton();
    },
  }));
  cityCombobox.setError(state.errors.city);
  if (!state.contact.province)
    cityCombobox.updateOptions([], { disabled: true, value: "" });

  address.addEventListener("input", () => {
    state.contact.address = address.value.slice(0, 500);
    saveState();
  });
  postalCode.addEventListener("input", () => {
    state.contact.postalCode = normalizeNumeric(postalCode.value).slice(0, 10);
    postalCode.value = toPersianDigits(state.contact.postalCode);
    state.errors.postalCode = "";
    syncFieldError("postalCode", "");
    updateContactButton();
  });
  postalCode.addEventListener("blur", () => {
    syncFieldError("postalCode", validatePostalCode(state.contact.postalCode));
    updateContactButton();
  });
  landline.addEventListener("input", () => {
    state.contact.landline = normalizeMobile(landline.value)
      .replace(/\D/g, "")
      .slice(0, 12);
    landline.value = toPersianDigits(state.contact.landline);
    state.errors.landline = "";
    syncFieldError("landline", "");
    updateContactButton();
  });
  landline.addEventListener("blur", () => {
    syncFieldError("landline", validateLandline(state.contact.landline));
    updateContactButton();
  });

  card.querySelector(".contact-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.errors.province = isIranProvince(state.contact.province)
      ? ""
      : registrationCopy("province-required");
    state.errors.city = isIranCity(state.contact.province, state.contact.city)
      ? ""
      : registrationCopy("city-required");
    state.errors.postalCode = validatePostalCode(state.contact.postalCode);
    state.errors.landline = validateLandline(state.contact.landline);
    provinceCombobox.setError(state.errors.province);
    cityCombobox.setError(state.errors.city);
    syncFieldError("postalCode", state.errors.postalCode);
    syncFieldError("landline", state.errors.landline);
    if (!contactCanContinue()) {
      card.querySelector('[aria-invalid="true"]')?.focus();
      saveState();
      return;
    }
    completeIdentityContactDetails();
    navigateTo("education");
  });
  card
    .querySelector(".registration-back-button")
    .addEventListener("click", () => navigateTo("identity"));
}

async function initializeReferralFromUrl() {
  if (referralUrlInitialized) return;
  referralUrlInitialized = true;
  const rawCode = new URLSearchParams(window.location.search).get("ref");
  if (!rawCode) return;

  const code = normalizeNumeric(rawCode);
  if (!code) return;
  state.referral.hasReferral = true;
  state.referral.referralSource = "link";
  state.referral.referralCode = code;
  state.referral.managerCode = "";
  state.referral.managerName = "";
  state.errors.referralCode = "";
  saveState();
  renderIdentityContactRegistration();

  // A link code is treated like a typed one: validated by the backend before it is trusted.
  // A failed lookup stays pending here and is retried (with an error) when the user continues.
  const result = await api.getReferralManager(code);
  if (
    state.referral.referralSource !== "link" ||
    state.referral.referralCode !== code
  )
    return;
  applyReferralResult(code, result);
  saveState();
  if (state.view === "identity") renderIdentityContactRegistration();
}

export function renderIdentityContactRegistration(focusHeading = false) {
  if (!card || !stepperMount) return;
  disposeFormControls();
  const activeIndex = state.view === "contact" ? 1 : 0;
  stepperMount.replaceChildren(createRegistrationStepper(activeIndex));
  if (state.view === "contact") renderContactMarkup();
  else renderIdentityMarkup();
  updateScreen();

  if (state.view === "contact") bindContactForm();
  else bindIdentityForm();

  if (focusHeading) card.querySelector("#registration-form-title")?.focus();
  if (state.view === "identity") void initializeReferralFromUrl();
}
