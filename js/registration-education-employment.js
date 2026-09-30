import { trackFormControl, disposeFormControls } from "./form-controls.js";
import { invalidateDashboardContext } from "../shared/dashboard/dashboard-context.js";
import { cloneTemplate, mountTemplate, readTextTemplate } from "./html.js";
import {
  MAX_EMPLOYMENT_RECORDS,
  addEmploymentRecord,
  clearVerification,
  ensureEmploymentRecord,
  hasValidatedReferral,
  registrationState as state,
  saveState,
} from "./state.js";
import {
  normalizeDigits,
  normalizeNumeric,
  toPersianDigits,
  validateBirthDate,
  validateEducationYear,
  validateLandline,
  validateNationalId,
  validateOptionalDatePair,
  validatePostalCode,
  validateRequiredText,
} from "./validation.js";
import {
  getCurrentJalaliYear,
  jalaliToIso,
  parseJalaliDate,
} from "./jalali.js";
import { SearchableCombobox } from "./searchable-combobox.js";
import { isIranCity, isIranProvince } from "./iran-locations.js";
import { api } from "./api.js";
import { navigateTo } from "./navigation.js";
import { createRegistrationStepper, showInformation } from "./components.js";

const card = document.querySelector("#registration-details-card");
const stepperMount = document.querySelector("#registration-stepper");
const status = document.querySelector("#app-status");
let submitting = false;

function registrationCopy(key, values = {}) {
  return readTextTemplate(`[data-registration-copy="${key}"]`, document, values);
}

const monthOptions = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
const currentJalaliYear = getCurrentJalaliYear();
const educationYearOptions = Array.from(
  { length: currentJalaliYear - 1200 + 1 },
  (_, index) => String(currentJalaliYear - index),
);
const workYearOptions = educationYearOptions.slice();

function educationCanContinue() {
  return (
    Boolean(state.education.degree) &&
    !state.errors.degree &&
    !validateEducationYear(state.education.graduationYear) &&
    !state.errors.educationYear
  );
}

function syncRenderedError(control, errorElement, message) {
  control?.setAttribute("aria-invalid", String(Boolean(message)));
  if (!errorElement) return;
  errorElement.textContent = message || "";
  errorElement.hidden = !message;
}

function renderEducationMarkup() {
  card.className = "registration-details-card education-card";
  mountTemplate(card, "registration-education-template");

  const degree = card.querySelector("#education-degree");
  const degreeError = card.querySelector("#education-degree-error");
  const field = card.querySelector("#education-field");
  degree.value = state.education.degree || "";
  field.value = state.education.field || "";
  syncRenderedError(degree, degreeError, state.errors.degree);
  card.querySelector(".registration-next-button").disabled = !educationCanContinue();
}

function employmentError(index, key) {
  return state.errors.employmentRecords?.[index]?.[key] || "";
}

function populateSelect(select, values, selected) {
  if (!select) return;
  while (select.options.length > 1) select.remove(1);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = toPersianDigits(value);
    option.selected = value === selected;
    select.append(option);
  });
  if (!selected) select.selectedIndex = 0;
}

function createEmploymentRecord(record, index) {
  const fragment = cloneTemplate("employment-record-template");
  const fieldset = fragment.querySelector(".employment-record");
  const number = toPersianDigits(index + 1);
  const startError = employmentError(index, "startDate");
  const endError = employmentError(index, "endDate");
  const startErrorId = `start-date-error-${index}`;
  const endErrorId = `end-date-error-${index}`;

  fieldset.dataset.recordIndex = String(index);
  fieldset.querySelector("[data-record-legend-number]").textContent = number;

  const heading = fieldset.querySelector("[data-record-heading]");
  heading.hidden = index === 0;
  fieldset.querySelector("[data-record-heading-number]").textContent = number;
  const removeButton = fieldset.querySelector("[data-remove-employment]");
  removeButton.dataset.removeEmployment = String(index);

  const company = fieldset.querySelector('[data-record-field="company"]');
  const companyLabel = fieldset.querySelector("[data-company-label]");
  company.id = `company-${index}`;
  company.value = record.company || "";
  companyLabel.htmlFor = company.id;
  fieldset.querySelector("[data-company-optional]").hidden = index !== 0;

  const title = fieldset.querySelector('[data-record-field="title"]');
  const titleLabel = fieldset.querySelector("[data-title-label]");
  title.id = `title-${index}`;
  title.value = record.title || "";
  titleLabel.htmlFor = title.id;
  fieldset.querySelector("[data-title-first]").hidden = index !== 0;
  fieldset.querySelector("[data-title-later]").hidden = index === 0;

  const startMonth = fieldset.querySelector("[data-start-month]");
  const startYear = fieldset.querySelector("[data-start-year]");
  const endMonth = fieldset.querySelector("[data-end-month]");
  const endYear = fieldset.querySelector("[data-end-year]");
  const startMonthLabel = fieldset.querySelector("[data-start-month-label]");
  const startYearLabel = fieldset.querySelector("[data-start-year-label]");
  const endMonthLabel = fieldset.querySelector("[data-end-month-label]");
  const endYearLabel = fieldset.querySelector("[data-end-year-label]");

  startMonth.id = `start-month-${index}`;
  startYear.id = `start-year-${index}`;
  endMonth.id = `end-month-${index}`;
  endYear.id = `end-year-${index}`;
  startMonthLabel.htmlFor = startMonth.id;
  startYearLabel.htmlFor = startYear.id;
  endMonthLabel.htmlFor = endMonth.id;
  endYearLabel.htmlFor = endYear.id;
  [startMonth, startYear].forEach((control) => {
    control.setAttribute("aria-describedby", startErrorId);
    control.setAttribute("aria-invalid", String(Boolean(startError)));
  });
  [endMonth, endYear].forEach((control) => {
    control.setAttribute("aria-describedby", endErrorId);
    control.setAttribute("aria-invalid", String(Boolean(endError)));
    control.disabled = Boolean(record.current);
  });
  populateSelect(startMonth, monthOptions, record.startMonth);
  populateSelect(startYear, workYearOptions, record.startYear);
  populateSelect(endMonth, monthOptions, record.endMonth);
  populateSelect(endYear, workYearOptions, record.endYear);

  const startErrorElement = fieldset.querySelector("[data-start-date-error]");
  startErrorElement.id = startErrorId;
  startErrorElement.textContent = startError;
  startErrorElement.hidden = !startError;
  const endErrorElement = fieldset.querySelector("[data-end-date-error]");
  endErrorElement.id = endErrorId;
  endErrorElement.textContent = endError;
  endErrorElement.hidden = !endError;

  fieldset.querySelector("[data-end-group]").classList.toggle("is-disabled", Boolean(record.current));
  const current = fieldset.querySelector("[data-current-employed]");
  current.id = `current-${index}`;
  current.checked = Boolean(record.current);

  return fragment;
}

function renderEmploymentMarkup() {
  const hasHistory = state.employment.hasHistory === true;
  if (hasHistory && state.employment.records.length === 0) ensureEmploymentRecord(0);
  if (state.employment.records.length > MAX_EMPLOYMENT_RECORDS) {
    state.employment.records = state.employment.records.slice(0, MAX_EMPLOYMENT_RECORDS);
  }
  const multi = state.employment.records.length > 1;
  const atLimit = state.employment.records.length >= MAX_EMPLOYMENT_RECORDS;
  card.className = `registration-details-card employment-card${hasHistory ? " has-history" : ""}${multi ? " has-multiple-records" : ""}`;
  mountTemplate(card, "registration-employment-template");

  card.querySelectorAll('input[name="hasEmployment"]').forEach((radio) => {
    radio.checked = radio.value === (hasHistory ? "yes" : "no");
    radio.closest(".employment-option")?.classList.toggle("is-selected", radio.checked);
  });

  const recordsRoot = card.querySelector("[data-employment-records]");
  recordsRoot.hidden = !hasHistory;
  if (hasHistory) {
    state.employment.records.forEach((record, index) => {
      const fragment = createEmploymentRecord(record, index);
      const divider = fragment.querySelector("[data-record-divider]");
      if (divider) divider.hidden = index === 0;
      recordsRoot.append(fragment);
    });
  }

  const addButton = card.querySelector("[data-add-employment]");
  addButton.hidden = !hasHistory || atLimit;
  const limitStatus = card.querySelector("[data-employment-limit-status]");
  limitStatus.textContent = atLimit
    ? registrationCopy("employment-limit", { count: toPersianDigits(MAX_EMPLOYMENT_RECORDS) })
    : "";

  const submitButton = card.querySelector(".registration-next-button");
  submitButton.disabled = submitting;
  submitButton.classList.toggle("is-final", multi);
  card.querySelector("[data-employment-submit-label]").textContent = multi ? registrationCopy("employment-submit-final") : registrationCopy("employment-submit-next");
  card.querySelector("[data-employment-submit-arrow]").hidden = multi;
  card.querySelector("[data-employment-final-check]").hidden = !multi;
}

function renderSuccessMarkup() {
  card.className = "registration-details-card success-card";
  mountTemplate(card, "registration-success-template");
}

function syncScreen() {
  saveState();
  card.dataset.screen = String(state.currentScreen);
}

function syncEducationButton() {
  const button = card.querySelector(".registration-next-button");
  if (button) button.disabled = !educationCanContinue();
  syncScreen();
}

function bindEducation() {
  const degree = card.querySelector("#education-degree");
  const field = card.querySelector("#education-field");
  const yearRoot = card.querySelector(
    '[data-searchable-root="education-year"]',
  );

  degree.addEventListener("focus", () => {
    card.dataset.screen = "19";
  });
  degree.addEventListener("blur", syncScreen);
  degree.addEventListener("change", () => {
    state.education.degree = degree.value;
    state.errors.degree = "";
    degree.setAttribute("aria-invalid", "false");
    const error = card.querySelector("#education-degree-error");
    if (error) error.hidden = true;
    syncEducationButton();
  });

  const yearCombobox = trackFormControl(new SearchableCombobox(yearRoot, {
    options: educationYearOptions,
    value: state.education.graduationYear,
    allowCustom: true,
    customValidator: (value) => /^\d{4}$/.test(normalizeDigits(value).trim()),
    onChange: (value) => {
      state.education.graduationYear = normalizeDigits(value).trim();
      state.errors.educationYear = validateEducationYear(
        state.education.graduationYear,
      );
      yearCombobox.setError(state.errors.educationYear);
      syncEducationButton();
    },
    onInvalidCustom: (value) => {
      state.education.graduationYear = normalizeDigits(value).trim();
      state.errors.educationYear =
        validateEducationYear(state.education.graduationYear) ||
        registrationCopy("education-year-invalid");
      yearCombobox.setError(state.errors.educationYear);
      syncEducationButton();
    },
  }));
  yearCombobox.setError(state.errors.educationYear);
  yearCombobox.trigger.addEventListener("focus", () => {
    card.dataset.screen = "19";
  });

  field.addEventListener("input", () => {
    state.education.field = field.value.slice(0, 160);
    saveState();
  });

  card.querySelector(".education-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.errors.degree = state.education.degree
      ? ""
      : registrationCopy("degree-required");
    state.errors.educationYear = validateEducationYear(
      state.education.graduationYear,
    );
    degree.setAttribute("aria-invalid", String(Boolean(state.errors.degree)));
    const degreeError = card.querySelector("#education-degree-error");
    if (degreeError) {
      degreeError.textContent = state.errors.degree;
      degreeError.hidden = !state.errors.degree;
    }
    yearCombobox.setError(state.errors.educationYear);
    if (!educationCanContinue()) {
      card.querySelector('[aria-invalid="true"]')?.focus();
      saveState();
      return;
    }
    navigateTo("employment");
  });
  card
    .querySelector(".registration-back-button")
    .addEventListener("click", () => navigateTo("contact"));
}

function updateRecordFromControls(fieldset, record) {
  record.company =
    fieldset
      .querySelector('[data-record-field="company"]')
      ?.value.slice(0, 160) || "";
  record.title =
    fieldset
      .querySelector('[data-record-field="title"]')
      ?.value.slice(0, 160) || "";
  record.startMonth =
    fieldset.querySelector('[id^="start-month-"]')?.value || "";
  record.startYear = fieldset.querySelector('[id^="start-year-"]')?.value || "";
  record.endMonth = record.current
    ? ""
    : fieldset.querySelector('[id^="end-month-"]')?.value || "";
  record.endYear = record.current
    ? ""
    : fieldset.querySelector('[id^="end-year-"]')?.value || "";
}

function ensureRecordError(index) {
  while (state.errors.employmentRecords.length <= index) {
    state.errors.employmentRecords.push({ startDate: "", endDate: "" });
  }
  return state.errors.employmentRecords[index];
}

function validateEmploymentRecord(record, index) {
  const errors = ensureRecordError(index);
  errors.startDate = validateOptionalDatePair(
    record.startMonth,
    record.startYear,
    registrationCopy("start-date-label"),
  );
  errors.endDate = record.current
    ? ""
    : validateOptionalDatePair(
        record.endMonth,
        record.endYear,
        registrationCopy("end-date-label"),
      );
  return !errors.startDate && !errors.endDate;
}

function validateEmploymentRecords() {
  if (state.employment.hasHistory !== true) {
    state.errors.employmentRecords = [];
    return true;
  }
  state.errors.employmentRecords = state.employment.records.map(() => ({
    startDate: "",
    endDate: "",
  }));
  return state.employment.records.every((record, index) =>
    validateEmploymentRecord(record, index),
  );
}

function clearRecordErrorIfFixed(index, key, record, fieldset) {
  const errors = ensureRecordError(index);
  const next =
    key === "startDate"
      ? validateOptionalDatePair(
          record.startMonth,
          record.startYear,
          registrationCopy("start-date-label"),
        )
      : record.current
        ? ""
        : validateOptionalDatePair(
            record.endMonth,
            record.endYear,
            registrationCopy("end-date-label"),
          );
  if (!next && errors[key]) {
    errors[key] = "";
    const errorElement = fieldset.querySelector(
      `#${key === "startDate" ? "start-date" : "end-date"}-error-${index}`,
    );
    if (errorElement) {
      errorElement.textContent = "";
      errorElement.hidden = true;
    }
    const selector = key === "startDate" ? '[id^="start-"]' : '[id^="end-"]';
    fieldset
      .querySelectorAll(selector)
      .forEach((control) => control.setAttribute("aria-invalid", "false"));
  }
}

function bindEmploymentRecords() {
  card.querySelectorAll(".employment-record").forEach((fieldset) => {
    const index = Number(fieldset.dataset.recordIndex);
    const record = state.employment.records[index];
    fieldset.querySelectorAll("input[type=text]").forEach((input) => {
      input.addEventListener("input", () => {
        updateRecordFromControls(fieldset, record);
        syncScreen();
      });
    });
    fieldset.querySelectorAll("select").forEach((select) => {
      select.addEventListener("focus", () => {
        card.dataset.screen = "23";
      });
      select.addEventListener("blur", syncScreen);
      select.addEventListener("change", () => {
        updateRecordFromControls(fieldset, record);
        clearRecordErrorIfFixed(
          index,
          select.id.startsWith("start-") ? "startDate" : "endDate",
          record,
          fieldset,
        );
        syncScreen();
      });
    });
    fieldset
      .querySelector("[data-current-employed]")
      ?.addEventListener("change", (event) => {
        record.current = event.currentTarget.checked;
        if (record.current) {
          record.endMonth = "";
          record.endYear = "";
          ensureRecordError(index).endDate = "";
        }
        saveState();
        renderEducationEmploymentRegistration();
      });
  });
}

function bindEmployment() {
  card.querySelectorAll('input[name="hasEmployment"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      state.employment.hasHistory = radio.value === "yes";
      state.errors.employmentRecords = [];
      if (state.employment.hasHistory && state.employment.records.length === 0)
        ensureEmploymentRecord(0);
      saveState();
      renderEducationEmploymentRegistration();
    });
  });

  bindEmploymentRecords();

  card.querySelector("[data-add-employment]")?.addEventListener("click", () => {
    const record = addEmploymentRecord();
    if (!record) return;
    state.errors.employmentRecords.push({ startDate: "", endDate: "" });
    saveState();
    renderEducationEmploymentRegistration();
    card
      .querySelector(
        `.employment-record[data-record-index="${state.employment.records.length - 1}"] input`,
      )
      ?.focus();
  });

  card.querySelectorAll("[data-remove-employment]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.removeEmployment);
      if (
        !Number.isInteger(index) ||
        index <= 0 ||
        index >= state.employment.records.length
      )
        return;
      state.employment.records.splice(index, 1);
      state.errors.employmentRecords.splice(index, 1);
      saveState();
      renderEducationEmploymentRegistration();
      card.querySelector("[data-add-employment]")?.focus();
    });
  });

  card
    .querySelector(".registration-back-button")
    .addEventListener("click", () => navigateTo("education"));
  card
    .querySelector(".employment-form")
    .addEventListener("submit", submitFinalRegistration);
}

function validateWholeRegistration() {
  const messages = [
    validateNationalId(state.identity.nationalId),
    validateBirthDate(state.identity.birthDate),
    validateRequiredText(state.identity.firstName, registrationCopy("first-name-label")),
    validateRequiredText(state.identity.lastName, registrationCopy("last-name-label")),
    isIranProvince(state.contact.province) ? "" : registrationCopy("province-required"),
    isIranCity(state.contact.province, state.contact.city)
      ? ""
      : registrationCopy("city-required"),
    validatePostalCode(state.contact.postalCode),
    validateLandline(state.contact.landline),
    state.education.degree ? "" : registrationCopy("degree-required"),
    validateEducationYear(state.education.graduationYear),
    state.referral.hasReferral === true && !hasValidatedReferral()
      ? readTextTemplate('[data-validation-copy="referral-invalid"]', document)
      : "",
  ].filter(Boolean);
  return messages;
}

function normalizedBirthDatePayload() {
  const parsed = parseJalaliDate(state.identity.birthDate);
  if (!parsed) return null;
  return {
    jalali: state.identity.birthDate,
    year: parsed.year,
    month: parsed.month,
    day: parsed.day,
    iso:
      state.identity.birthDateIso ||
      jalaliToIso(parsed.year, parsed.month, parsed.day) ||
      null,
  };
}

function monthNumber(value) {
  const index = monthOptions.indexOf(value);
  return index >= 0 ? index + 1 : null;
}

export function createRegistrationPayload() {
  return {
    identity: {
      nationalId: normalizeNumeric(state.identity.nationalId),
      birthDate: normalizedBirthDatePayload(),
      firstName: state.identity.firstName.trim(),
      lastName: state.identity.lastName.trim(),
    },
    contact: {
      mobile: normalizeNumeric(state.contact.mobile),
      province: state.contact.province,
      city: state.contact.city,
      address: state.contact.address.trim() || null,
      postalCode: normalizeNumeric(state.contact.postalCode) || null,
      landline: normalizeNumeric(state.contact.landline) || null,
    },
    education: {
      degree: state.education.degree,
      graduationYear: state.education.graduationYear
        ? Number(normalizeDigits(state.education.graduationYear))
        : null,
      field: state.education.field.trim() || null,
    },
    employment: {
      hasHistory: state.employment.hasHistory === true,
      records:
        state.employment.hasHistory === true
          ? state.employment.records
              .slice(0, MAX_EMPLOYMENT_RECORDS)
              .map((record) => ({
                companyName: record.company.trim() || null,
                jobTitle: record.title.trim() || null,
                startMonth: monthNumber(record.startMonth),
                startYear: record.startYear ? Number(record.startYear) : null,
                endMonth: record.current ? null : monthNumber(record.endMonth),
                endYear:
                  record.current || !record.endYear
                    ? null
                    : Number(record.endYear),
                currentlyWorking: record.current === true,
              }))
          : [],
    },
    // Only a backend-validated code is sent; the owner name/manager never leaves the frontend.
    referral: hasValidatedReferral()
      ? {
          hasReferral: true,
          source: state.referral.referralSource,
          code: state.referral.referralCode,
        }
      : { hasReferral: false, source: null, code: null },
  };
}

// Backend field names (e.g. "Identity.NationalId", "identity.birthDate.year") -> step + error key
// rendered inline by that step.
const FIELD_ERROR_TARGETS = [
  ["identity.nationalid", "identity", "nationalId"],
  ["identity.birthdate", "identity", "birthDate"],
  ["identity.firstname", "identity", "firstName"],
  ["identity.lastname", "identity", "lastName"],
  ["referral.code", "identity", "referralCode"],
  ["contact.province", "contact", "province"],
  ["contact.city", "contact", "city"],
  ["contact.postalcode", "contact", "postalCode"],
  ["contact.landline", "contact", "landline"],
  ["education.degree", "education", "degree"],
  ["education.graduationyear", "education", "educationYear"],
];
const STEP_ORDER = ["identity", "contact", "education", "employment"];

// Stores backend field errors for inline display; returns the earliest step that has one.
function applyFieldErrors(fieldErrors = []) {
  let step = null;
  for (const { field, message } of fieldErrors) {
    const key = String(field).toLowerCase().replace(/^(\$\.|request\.)/, "");
    const target = FIELD_ERROR_TARGETS.find(
      ([prefix]) => key === prefix || key.startsWith(`${prefix}.`),
    );
    if (!target) continue;
    const [, view, errorKey] = target;
    if (!state.errors[errorKey]) state.errors[errorKey] = message;
    if (step === null || STEP_ORDER.indexOf(view) < STEP_ORDER.indexOf(step))
      step = view;
  }
  return step;
}

// 401 / REGISTRATION_SESSION_REQUIRED: the OTP session cookie is missing or expired.
// The draft is kept; the user re-verifies the mobile and continues from identity.
function restartVerification() {
  clearVerification();
  state.errors.submission = "";
  saveState();
  showInformation(
    registrationCopy("registration-session-expired-title"),
    registrationCopy("registration-session-expired"),
  );
  navigateTo("mobile");
}

async function submitFinalRegistration(event) {
  event.preventDefault();
  if (submitting) return;

  if (!validateEmploymentRecords()) {
    saveState();
    renderEducationEmploymentRegistration();
    card.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  const errors = validateWholeRegistration();
  if (errors.length) {
    state.errors.submission = errors[0];
    saveState();
    showInformation(registrationCopy("registration-incomplete-title"), errors[0]);
    return;
  }

  submitting = true;
  renderEducationEmploymentRegistration();
  try {
    const result = await api.submitRegistration(createRegistrationPayload());
    if (!result?.success) {
      if (result?.status === 401 || ["UNAUTHORIZED", "REGISTRATION_SESSION_REQUIRED"].includes(result?.code)) {
        restartVerification();
        return;
      }
      // Field errors are shown inline on their step; the message still reaches the dialog.
      const step = applyFieldErrors(result?.fieldErrors);
      if (step) {
        saveState();
        navigateTo(step);
      }
      throw Object.assign(new Error("submission-failed"), { apiMessage: result?.message || "" });
    }
    invalidateDashboardContext();
    state.submission.completed = true;
    state.submission.submittedAt = new Date().toISOString();
    state.errors.submission = "";
    saveState();
    navigateTo("success");
    status.textContent = registrationCopy("registration-success-announcement");
  } catch (error) {
    state.errors.submission = error?.apiMessage || registrationCopy("registration-submit-failed");
    showInformation(registrationCopy("registration-submit-error-title"), state.errors.submission);
  } finally {
    submitting = false;
    if (state.view === "employment") renderEducationEmploymentRegistration();
  }
}

export function renderEducationEmploymentRegistration(focusHeading = false) {
  if (!card || !stepperMount) return;
  disposeFormControls();

  if (state.view === "success") {
    stepperMount.replaceChildren();
    renderSuccessMarkup();
    document.body.classList.add("has-success-state");
    syncScreen();
    if (focusHeading) card.querySelector("#success-title")?.focus();
    window.dispatchEvent(new CustomEvent("registration:success-rendered"));
    return;
  }

  document.body.classList.remove("has-success-state");
  const activeIndex = state.view === "education" ? 2 : 3;
  stepperMount.replaceChildren(createRegistrationStepper(activeIndex));
  if (state.view === "education") renderEducationMarkup();
  else renderEmploymentMarkup();
  syncScreen();

  if (state.view === "education") bindEducation();
  else bindEmployment();

  if (focusHeading) card.querySelector("#registration-form-title")?.focus();
}
