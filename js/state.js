import { STORAGE_KEYS } from "./storage-keys.js";
import { validateMobile, validateVerificationCode } from "./validation.js";

const STORAGE_KEY = STORAGE_KEYS.registration;
export const MAX_EMPLOYMENT_RECORDS = 3;
const ALLOWED_VIEWS = new Set([
  "mobile",
  "code",
  "identity",
  "contact",
  "education",
  "employment",
  "success",
]);

export const createEmploymentRecord = () => ({
  company: "",
  title: "",
  startMonth: "",
  startYear: "",
  endMonth: "",
  endYear: "",
  current: false,
});

const emptyState = () => ({
  version: 4,
  currentScreen: 1,
  view: "mobile",
  identity: {
    nationalId: "",
    birthDate: "",
    birthDateIso: "",
    firstName: "",
    lastName: "",
  },
  contact: {
    mobile: "",
    province: "",
    city: "",
    address: "",
    postalCode: "",
    landline: "",
  },
  education: {
    degree: "",
    graduationYear: "",
    field: "",
  },
  employment: {
    hasHistory: false,
    records: [],
  },
  referral: {
    hasReferral: null,
    referralSource: null,
    referralCode: "",
    managerName: "",
    managerCode: "",
  },
  verification: {
    digits: Array(6).fill(""),
    requestedMobile: "",
    resendAt: 0,
    verified: false,
  },
  submission: {
    completed: false,
    submittedAt: "",
  },
  errors: {
    mobile: "",
    code: "",
    nationalId: "",
    birthDate: "",
    firstName: "",
    lastName: "",
    referralCode: "",
    province: "",
    city: "",
    postalCode: "",
    landline: "",
    degree: "",
    educationYear: "",
    employmentRecords: [],
    submission: "",
  },
});

function copyString(target, source, key, maxLength = 250) {
  if (typeof source?.[key] === "string")
    target[key] = source[key].slice(0, maxLength);
}

function restoreState() {
  const initial = emptyState();
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (![1, 2, 3, 4].includes(saved?.version)) return initial;

    for (const field of [
      "mobile",
      "province",
      "city",
      "address",
      "postalCode",
      "landline",
    ])
      copyString(
        initial.contact,
        saved.contact,
        field,
        field === "address" ? 500 : 120,
      );

    for (const field of [
      "nationalId",
      "birthDate",
      "birthDateIso",
      "firstName",
      "lastName",
    ])
      copyString(initial.identity, saved.identity, field, 120);

    if (
      saved.referral?.hasReferral === true ||
      saved.referral?.hasReferral === false
    )
      initial.referral.hasReferral = saved.referral.hasReferral;
    if (["link", "manual"].includes(saved.referral?.referralSource))
      initial.referral.referralSource = saved.referral.referralSource;
    for (const field of ["referralCode", "managerName", "managerCode"])
      copyString(initial.referral, saved.referral, field, 120);

    const savedEducation = saved.education || {};
    if (Array.isArray(savedEducation.records) && savedEducation.records[0]) {
      const record = savedEducation.records[0];
      copyString(
        initial.education,
        { degree: record.degree || record.level },
        "degree",
        120,
      );
      copyString(
        initial.education,
        { graduationYear: record.graduationYear || record.year },
        "graduationYear",
        10,
      );
      copyString(
        initial.education,
        { field: record.field || record.major },
        "field",
        160,
      );
    } else {
      for (const field of ["degree", "graduationYear", "field"])
        copyString(initial.education, savedEducation, field, 160);
    }

    if (
      saved.employment?.hasHistory === true ||
      saved.employment?.hasHistory === false
    )
      initial.employment.hasHistory = saved.employment.hasHistory;
    if (Array.isArray(saved.employment?.records)) {
      initial.employment.records = saved.employment.records
        .slice(0, MAX_EMPLOYMENT_RECORDS)
        .map((record) => {
          const clean = createEmploymentRecord();
          for (const field of [
            "company",
            "title",
            "startMonth",
            "startYear",
            "endMonth",
            "endYear",
          ])
            copyString(clean, record, field, 160);
          clean.current = record?.current === true;
          if (clean.current) {
            clean.endMonth = "";
            clean.endYear = "";
          }
          return clean;
        });
    }

    const verification = saved.verification;
    if (
      verification?.requestedMobile === initial.contact.mobile &&
      !validateMobile(initial.contact.mobile)
    ) {
      initial.verification.requestedMobile = initial.contact.mobile;
      if (
        Array.isArray(verification.digits) &&
        verification.digits.length === 6
      ) {
        initial.verification.digits = verification.digits.map((value) =>
          /^\d$/.test(value) ? String(value) : "",
        );
      }
      if (Number.isFinite(verification.resendAt)) {
        initial.verification.resendAt = Math.min(
          verification.resendAt,
          Date.now() + 120000,
        );
      }
      initial.verification.verified = verification.verified === true;
    }

    initial.submission.completed = saved.submission?.completed === true;
    copyString(initial.submission, saved.submission, "submittedAt", 40);

    if (ALLOWED_VIEWS.has(saved.view)) {
      if (saved.view === "code" && !validateMobile(initial.contact.mobile)) {
        initial.view = "code";
      } else if (
        ["identity", "contact", "education", "employment", "success"].includes(
          saved.view,
        ) &&
        initial.verification.verified
      ) {
        initial.view =
          saved.view === "success" && !initial.submission.completed
            ? "employment"
            : saved.view;
      }
    }
    return initial;
  } catch {
    return initial;
  }
}

export const registrationState = restoreState();

function recordHasData(record) {
  return Boolean(
    record &&
    (record.company ||
      record.title ||
      record.startMonth ||
      record.startYear ||
      record.endMonth ||
      record.endYear ||
      record.current),
  );
}

export function deriveScreen(state = registrationState) {
  if (state.view === "mobile") {
    if (state.errors.mobile) return 3;
    if (!state.contact.mobile) return 1;
    return validateMobile(state.contact.mobile) ? 4 : 2;
  }

  if (state.view === "code") {
    if (state.errors.code) return 8;
    if (state.verification.digits.every((digit) => !digit)) return 5;
    return validateVerificationCode(state.verification.digits) ? 7 : 6;
  }

  if (state.view === "identity") {
    if (
      state.referral.referralSource === "link" &&
      state.referral.hasReferral === true
    )
      return 11;
    if (state.referral.hasReferral === true) {
      if (state.errors.referralCode) return 14;
      if (state.referral.managerName) return 13;
      return 12;
    }
    if (state.referral.hasReferral === false) return 15;
    const identityEntered = Boolean(
      state.identity.nationalId &&
      state.identity.birthDate &&
      state.identity.firstName &&
      state.identity.lastName,
    );
    return identityEntered ? 10 : 9;
  }

  if (state.view === "contact") {
    return state.contact.province && state.contact.city ? 17 : 16;
  }

  if (state.view === "education") return state.education.degree ? 20 : 18;

  if (state.view === "employment") {
    if (state.employment.hasHistory !== true) return 21;
    if (state.employment.records.length > 1) return 25;
    return recordHasData(state.employment.records[0]) ? 24 : 22;
  }

  if (state.view === "success") return "last";
  return 1;
}

export function saveState() {
  registrationState.version = 4;
  registrationState.currentScreen = deriveScreen();
  registrationState.employment.records =
    registrationState.employment.records.slice(0, MAX_EMPLOYMENT_RECORDS);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(registrationState));
  } catch {
    /* Continue in memory when sessionStorage is unavailable. */
  }
}

export function clearVerification() {
  registrationState.verification = {
    digits: Array(6).fill(""),
    requestedMobile: "",
    resendAt: 0,
    verified: false,
  };
  registrationState.errors.code = "";
}

export function clearManualReferral() {
  registrationState.referral.referralCode = "";
  registrationState.referral.managerName = "";
  registrationState.referral.managerCode = "";
  registrationState.errors.referralCode = "";
}

// managerName/managerCode are filled only from a successful backend lookup, so a referral is
// validated only while they still belong to the code currently entered.
export function hasValidatedReferral(referral = registrationState.referral) {
  return Boolean(
    referral.hasReferral === true &&
    referral.referralCode &&
    referral.managerName &&
    referral.managerCode === referral.referralCode,
  );
}

export function ensureEmploymentRecord(index = 0) {
  const safeIndex = Math.max(0, Math.min(index, MAX_EMPLOYMENT_RECORDS - 1));
  while (
    registrationState.employment.records.length <= safeIndex &&
    registrationState.employment.records.length < MAX_EMPLOYMENT_RECORDS
  ) {
    registrationState.employment.records.push(createEmploymentRecord());
  }
  return registrationState.employment.records[safeIndex];
}

export function addEmploymentRecord() {
  if (registrationState.employment.records.length >= MAX_EMPLOYMENT_RECORDS)
    return null;
  const record = createEmploymentRecord();
  registrationState.employment.records.push(record);
  return record;
}

saveState();
