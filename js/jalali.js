const persianDateFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

export const PERSIAN_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

export const PERSIAN_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
export const PERSIAN_WEEKDAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

function formatToParts(date) {
  const parts = persianDateFormatter.formatToParts(date);
  const result = {};
  for (const part of parts) {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      result[part.type] = Number(part.value);
    }
  }
  return result;
}

export function getCurrentJalaliYear(now = new Date()) {
  return formatToParts(now).year;
}

export function jalaliToIso(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return "";
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";

  // Farvardin begins around March 20/21. Scanning one Gregorian year keeps the
  // conversion small, dependency-free and aligned with the browser's Persian calendar.
  const approximateGregorianYear = y + 621;
  const start = Date.UTC(approximateGregorianYear, 2, 15);
  const end = Date.UTC(approximateGregorianYear + 1, 3, 5);

  for (let timestamp = start; timestamp <= end; timestamp += 86400000) {
    const candidate = formatToParts(new Date(timestamp));
    if (candidate.year === y && candidate.month === m && candidate.day === d) {
      return new Date(timestamp).toISOString().slice(0, 10);
    }
  }
  return "";
}

export function getJalaliMonthLength(year, month) {
  const m = Number(month);
  if (m >= 1 && m <= 6) return 31;
  if (m >= 7 && m <= 11) return 30;
  if (m === 12) return jalaliToIso(Number(year), 12, 30) ? 30 : 29;
  return 0;
}

export function isValidJalaliDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  const maxDay = getJalaliMonthLength(y, m);
  return maxDay > 0 && d >= 1 && d <= maxDay && Boolean(jalaliToIso(y, m, d));
}

export function parseJalaliDate(value) {
  const normalized = String(value || "").trim();
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(normalized);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return isValidJalaliDate(year, month, day) ? { year, month, day } : null;
}

export function formatJalaliDate(year, month, day) {
  return `${String(year).padStart(4, "0")}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}


export function jalaliWeekdayIndex(year, month, day) {
  const iso = jalaliToIso(year, month, day);
  if (!iso) return -1;
  const sundayBased = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return (sundayBased + 1) % 7; // Saturday = 0, Friday = 6.
}

export function isFridayJalaliDate(year, month, day) {
  return jalaliWeekdayIndex(year, month, day) === 6;
}

export function getPersianWeekdayOffset(year, month) {
  const iso = jalaliToIso(year, month, 1);
  if (!iso) return 0;
  const sundayBased = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return (sundayBased + 1) % 7; // Saturday = first column.
}
