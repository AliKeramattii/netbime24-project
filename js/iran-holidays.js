// Iran official-holiday provider for the recruitment scheduler.
// Primary source: @jalali-js/holidays (IR pack), loaded as an ESM module in the browser.
// The package ships fixed Jalali rules plus year-specific lunar holiday tables.
// Offline fallback data below is intentionally isolated from UI code and exists only so
// local/mock development remains deterministic when the remote module is unavailable.

const HOLIDAY_LIBRARY_URL = "https://esm.sh/@jalali-js/holidays@0.4.2?bundle&target=es2022";

const FIXED_IRAN_HOLIDAYS = new Map([
  ["01-01", "نوروز"],
  ["01-02", "عید نوروز"],
  ["01-03", "عید نوروز"],
  ["01-04", "عید نوروز"],
  ["01-12", "روز جمهوری اسلامی ایران"],
  ["01-13", "روز طبیعت"],
  ["03-14", "رحلت امام خمینی (ره)"],
  ["03-15", "قیام پانزده خرداد"],
  ["11-22", "پیروزی انقلاب اسلامی ایران"],
  ["12-29", "روز ملی شدن صنعت نفت ایران"],
]);

// Development fallback sourced from Emrooz's 1405 Iran holiday calendar, which cites
// the University of Tehran Calendar Centre and Iran's official holiday committee.
// The primary @jalali-js/holidays source is preferred whenever it is available.
const FALLBACK_VARIABLE_1405 = new Map([
  ["01-01", "عید سعید فطر"],
  ["01-02", "تعطیل عید سعید فطر"],
  ["01-25", "شهادت امام جعفر صادق (ع)"],
  ["03-06", "عید سعید قربان"],
  ["03-14", "عید سعید غدیر خم"],
  ["04-03", "تاسوعای حسینی"],
  ["04-04", "عاشورای حسینی"],
  ["05-13", "اربعین حسینی"],
  ["05-21", "رحلت پیامبر اکرم (ص) و شهادت امام حسن مجتبی (ع)"],
  ["05-30", "شهادت امام حسن عسکری (ع)"],
  ["06-08", "میلاد پیامبر اکرم (ص) و امام جعفر صادق (ع)"],
  ["08-22", "شهادت حضرت فاطمه زهرا (س)"],
  ["10-01", "ولادت امام علی (ع)"],
  ["10-15", "مبعث پیامبر اکرم (ص)"],
  ["11-03", "ولادت امام مهدی (عج)"],
  ["12-09", "شهادت امام علی (ع)"],
  ["12-19", "عید سعید فطر"],
  ["12-20", "تعطیل عید سعید فطر"],
]);

let holidayLibrary = null;
let holidayLibraryPromise = null;

function normalizeDate(date) {
  const year = Number(date?.year);
  const month = Number(date?.month);
  const day = Number(date?.day);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function monthDayKey(month, day) {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fallbackHolidayInfo(date) {
  const normalized = normalizeDate(date);
  if (!normalized) return { isOfficialHoliday: false, names: [], source: "fallback" };
  const key = monthDayKey(normalized.month, normalized.day);
  const names = [];
  const fixed = FIXED_IRAN_HOLIDAYS.get(key);
  if (fixed) names.push(fixed);
  if (normalized.year === 1405) {
    const variable = FALLBACK_VARIABLE_1405.get(key);
    if (variable && !names.includes(variable)) names.push(variable);
  }
  return { isOfficialHoliday: names.length > 0, names, source: "fallback" };
}

function occurrenceName(occurrence) {
  if (!occurrence) return "";
  const direct = occurrence.names?.fa || occurrence.name?.fa || occurrence.name || occurrence.title?.fa || occurrence.title;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const id = occurrence.id || occurrence.holidayId || occurrence.holiday?.id;
  if (id && typeof holidayLibrary?.holidayName === "function") {
    try {
      return holidayLibrary.holidayName(id, "fa") || "";
    } catch {
      return "";
    }
  }
  return "";
}

export async function prepareIranOfficialHolidays() {
  if (holidayLibrary) return true;
  if (holidayLibraryPromise) return holidayLibraryPromise;
  if (typeof window === "undefined") return false;

  holidayLibraryPromise = import(HOLIDAY_LIBRARY_URL)
    .then(module => {
      holidayLibrary = module;
      return true;
    })
    .catch(() => false);
  return holidayLibraryPromise;
}

export function officialIranHolidayInfo(date) {
  const normalized = normalizeDate(date);
  if (!normalized) return { isOfficialHoliday: false, names: [], source: "none" };

  if (holidayLibrary?.isHoliday) {
    try {
      const isOfficialHoliday = Boolean(holidayLibrary.isHoliday(normalized, { region: "IR" }));
      const occurrences = isOfficialHoliday && typeof holidayLibrary.holidaysOn === "function"
        ? holidayLibrary.holidaysOn(normalized, { region: "IR" }) || []
        : [];
      const names = [...new Set(occurrences.map(occurrenceName).filter(Boolean))];
      return { isOfficialHoliday, names, source: "@jalali-js/holidays" };
    } catch {
      // Fall through to the deterministic local development data.
    }
  }

  return fallbackHolidayInfo(normalized);
}

export function isOfficialIranianHoliday(date) {
  return officialIranHolidayInfo(date).isOfficialHoliday;
}

export function officialIranianHolidayName(date) {
  const info = officialIranHolidayInfo(date);
  return info.names.join("، ");
}

export const IRAN_HOLIDAY_SOURCE = Object.freeze({
  library: "@jalali-js/holidays",
  libraryVersion: "0.4.2",
  region: "IR",
  remoteModule: HOLIDAY_LIBRARY_URL,
});
