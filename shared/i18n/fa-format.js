const DEFAULT_TIME_ZONE = "Asia/Tehran";
const DATE_LOCALE = "fa-IR-u-ca-persian";
const NUMBER_LOCALE = "fa-IR";

// Older design fixtures/session data used Jalali display strings. Keep those
// readable during integration; new server timestamps should be ISO 8601.
export function formatLeadDate(value, { includeTime = false } = {}) {
  if (!value) return "";
  if (/^\d{4}\/\d{2}\/\d{2}(?: - \d{2}:\d{2})?$/.test(String(value))) return String(value);
  const options = { year: "numeric", month: "2-digit", day: "2-digit" };
  return includeTime ? formatPersianDateTime(value, options) : formatPersianDate(value, options);
}

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatPersianNumber(value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat(NUMBER_LOCALE, options).format(number);
}

export function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return "";
  if (size < 1024) return `${formatPersianNumber(size)} بایت`;
  if (size < 1024 * 1024) return `${formatPersianNumber(size / 1024, { maximumFractionDigits: 1 })} کیلوبایت`;
  return `${formatPersianNumber(size / (1024 * 1024), { maximumFractionDigits: 1 })} مگابایت`;
}

export function formatPersianDate(value, options = {}) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    timeZone: DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  }).format(date);
}

export function formatPersianDateTime(value, options = {}) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    timeZone: DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...options,
  }).format(date);
}

export function formatPersianTime(value, options = {}) {
  const date = toDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(NUMBER_LOCALE, {
    timeZone: DEFAULT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...options,
  }).format(date);
}

export function formatRelativeTime(value, now = new Date()) {
  const created = toDate(value);
  const reference = toDate(now);
  if (!created || !reference) return "";

  const deltaMs = created.getTime() - reference.getTime();
  const minutes = Math.round(deltaMs / 60000);
  const absMinutes = Math.abs(minutes);
  const formatter = new Intl.RelativeTimeFormat(NUMBER_LOCALE, { numeric: "always" });

  if (absMinutes < 60) return formatter.format(minutes || -1, "minute");
  const hours = Math.round(deltaMs / 3600000);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(deltaMs / 86400000);
  if (Math.abs(days) <= 7) return formatter.format(days, "day");
  return formatPersianDate(created);
}
