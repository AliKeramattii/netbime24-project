import { isFridayJalaliDate } from "./jalali.js";
import { officialIranHolidayInfo } from "./iran-holidays.js";

// API/storage dates remain Gregorian ISO values, but every presentation field exposed
// by this module is Persian/Jalali. Holiday status is resolved from Jalali date fields.
const TEHRAN_TIME_ZONE = "Asia/Tehran";
const persianDateFormatter = new Intl.DateTimeFormat(
  "en-US-u-ca-persian-nu-latn",
  {
    timeZone: TEHRAN_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  },
);
const gregorianDateFormatter = new Intl.DateTimeFormat(
  "en-CA-u-ca-gregory-nu-latn",
  {
    timeZone: TEHRAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  },
);
const weekdayFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: TEHRAN_TIME_ZONE,
  weekday: "long",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TEHRAN_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function dateParts(formatter, date) {
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .map((part) => [part.type, part.value]),
  );
}

export function getTehranDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(+date)) return "";
  const parts = dateParts(gregorianDateFormatter, date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateFromDayValue(value) {
  if (value instanceof Date) return value;
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text))
    return new Date(`${text}T12:00:00+03:30`);
  return new Date(text);
}

export function addDaysToTehranDateKey(dateKey, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return "";
  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]) + Number(days || 0),
      12,
    ),
  );
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function jalaliPartsForDate(date) {
  const persian = dateParts(persianDateFormatter, date);
  return {
    year: Number(persian.year),
    month: Number(persian.month),
    day: Number(persian.day),
  };
}

export function isFridayDateKey(dateKey) {
  const date = dateFromDayValue(dateKey);
  if (!Number.isFinite(+date)) return false;
  const jalali = jalaliPartsForDate(date);
  return isFridayJalaliDate(jalali.year, jalali.month, jalali.day);
}

export function holidayInfoForDateKey(
  dateKey,
  backendMarksDateAsHoliday = false,
) {
  const date = dateFromDayValue(dateKey);
  if (!Number.isFinite(+date))
    return {
      isHoliday: Boolean(backendMarksDateAsHoliday),
      isFriday: false,
      isOfficialHoliday: false,
      backendHoliday: Boolean(backendMarksDateAsHoliday),
      holidayName: "",
    };
  const jalali = jalaliPartsForDate(date);
  const isFriday = isFridayJalaliDate(jalali.year, jalali.month, jalali.day);
  const official = officialIranHolidayInfo(jalali);
  const backendHoliday = backendMarksDateAsHoliday === true;
  const names = [];
  if (isFriday) names.push("جمعه");
  names.push(...official.names);
  if (backendHoliday && !official.isOfficialHoliday)
    names.push("تعطیل اعلام‌شده");
  return {
    ...jalali,
    isFriday,
    isOfficialHoliday: official.isOfficialHoliday,
    backendHoliday,
    isHoliday: isFriday || official.isOfficialHoliday || backendHoliday,
    holidayName: [...new Set(names.filter(Boolean))].join("، "),
    holidaySource: official.source,
  };
}

export function calendarDayView(day) {
  if (!day) return null;
  const date = dateFromDayValue(day.date || day.dateKey || day.startAt);
  if (!Number.isFinite(+date)) return null;
  const dateKey = getTehranDateKey(date);
  const holiday = holidayInfoForDateKey(dateKey, day.isHoliday === true);
  return {
    ...day,
    dateKey,
    year: holiday.year,
    month: holiday.month,
    day: holiday.day,
    weekday: weekdayFormatter.format(date),
    isFriday: holiday.isFriday,
    isOfficialHoliday: holiday.isOfficialHoliday,
    backendHoliday: holiday.backendHoliday,
    isHoliday: holiday.isHoliday,
    holidayName: holiday.holidayName,
    holidaySource: holiday.holidaySource,
    isPast: dateKey < getTehranDateKey(new Date()),
  };
}

export function appointmentView(slot) {
  if (!slot) return null;
  const start = new Date(slot.startAt);
  const end = new Date(slot.endAt);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start)
    return null;
  const dateKey = getTehranDateKey(start);
  const holiday = holidayInfoForDateKey(dateKey, slot.isHoliday === true);
  const status =
    slot.status === "booked"
      ? "taken"
      : ["available", "taken", "unavailable"].includes(slot.status)
        ? slot.status
        : "unavailable";
  return {
    ...slot,
    status,
    dateKey,
    year: holiday.year,
    month: holiday.month,
    day: holiday.day,
    weekday: weekdayFormatter.format(start),
    startTime: timeFormatter.format(start),
    endTime: timeFormatter.format(end),
    isFriday: holiday.isFriday,
    isOfficialHoliday: holiday.isOfficialHoliday,
    backendHoliday: holiday.backendHoliday,
    isHoliday: holiday.isHoliday,
    holidayName: holiday.holidayName,
    holidaySource: holiday.holidaySource,
    isPast: +start <= Date.now(),
  };
}
