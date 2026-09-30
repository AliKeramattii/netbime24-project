import { isValidJalaliDate } from "./jalali.js";
import { readTextTemplate } from "./html.js";

function validationCopy(key, values = {}) {
  if (typeof document === "undefined") return key;
  return readTextTemplate(`[data-validation-copy="${key}"]`, document, values) || key;
}

export function normalizeDigits(value) {
  return String(value)
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));
}

export function normalizeMobile(value) {
  return normalizeDigits(value).replace(/[\s\-()\u200e\u200f]/g, "");
}

export function normalizeNumeric(value) {
  return normalizeDigits(value).replace(/\D/g, "");
}

export function toPersianDigits(value) {
  return String(value).replace(
    /[0-9]/g,
    (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)],
  );
}

export function validateMobile(value) {
  if (!value) return validationCopy("mobile-required");
  return /^09\d{9}$/.test(normalizeMobile(value))
    ? ""
    : validationCopy("mobile-invalid");
}

export function validateVerificationCode(digits) {
  return digits.length === 6 && digits.every((digit) => /^\d$/.test(digit))
    ? ""
    : validationCopy("code-incomplete");
}

export function validateNationalId(value) {
  if (!String(value).trim()) return validationCopy("national-id-required");
  const normalized = normalizeNumeric(value);
  if (!/^\d{10}$/.test(normalized)) return validationCopy("national-id-length");
  if (/^(\d)\1{9}$/.test(normalized)) return validationCopy("national-id-invalid");
  return "";
}

export function normalizeBirthDate(value) {
  return normalizeDigits(value)
    .replace(/[^0-9/]/g, "")
    .slice(0, 10);
}

export function validateBirthDate(value) {
  if (!String(value).trim()) return validationCopy("birth-date-required");
  const normalized = normalizeBirthDate(value);
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(normalized);
  if (!match) return validationCopy("birth-date-format");
  return isValidJalaliDate(Number(match[1]), Number(match[2]), Number(match[3]))
    ? ""
    : validationCopy("birth-date-invalid");
}

export function validateRequiredText(value, label) {
  return String(value).trim() ? "" : validationCopy("required-text", { label });
}

export function validateReferralCode(value) {
  if (!String(value).trim()) return validationCopy("referral-required");
  return /^\d+$/.test(normalizeNumeric(value))
    ? ""
    : validationCopy("referral-invalid");
}

// Required: the backend rejects registration without it («کد پستی الزامی است.»),
// although Netbime24.md lists it as optional.
export function validatePostalCode(value) {
  if (!String(value).trim()) return validationCopy("postal-code-required");
  return /^\d{10}$/.test(normalizeNumeric(value))
    ? ""
    : validationCopy("postal-code-invalid");
}

export function validateLandline(value) {
  if (!String(value).trim()) return "";
  const digits = normalizeNumeric(value);
  return /^\d{8,12}$/.test(digits) ? "" : validationCopy("landline-invalid");
}

export function validateEducationYear(value) {
  if (!String(value).trim()) return "";
  return /^\d{4}$/.test(normalizeDigits(value).trim())
    ? ""
    : validationCopy("education-year-invalid");
}

export function validateOptionalDatePair(month, year, label) {
  const hasMonth = Boolean(month);
  const hasYear = Boolean(year);
  if (hasMonth === hasYear) return "";
  return validationCopy("date-pair-incomplete", { label });
}
