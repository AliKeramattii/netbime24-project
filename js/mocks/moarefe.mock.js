import { holidayInfoForDateKey } from "../appointment-data.js";

const tehranDateFormatter = new Intl.DateTimeFormat(
  "en-CA-u-ca-gregory-nu-latn",
  {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  },
);

function tehranDateKey(value = new Date()) {
  const parts = Object.fromEntries(
    tehranDateFormatter
      .formatToParts(value)
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateKeyAtOffset(offset) {
  const [year, month, day] = tehranDateKey().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

const sessionPatterns = Object.freeze([
  [
    ["08:00", "09:00"],
    ["09:00", "10:00"],
    ["10:00", "11:00"],
    ["12:00", "13:00"],
  ],
  [
    ["08:00", "09:00"],
    ["09:00", "10:00"],
    ["12:00", "13:00"],
    ["14:00", "15:00"],
  ],
  [
    ["09:00", "10:00"],
    ["10:00", "11:00"],
    ["13:00", "14:00"],
  ],
  [
    ["09:30", "10:30"],
    ["12:30", "13:30"],
    ["14:00", "15:00"],
    ["15:00", "16:00"],
  ],
]);

function buildAvailability(prefix = "intro", horizon = 30) {
  const days = [];
  const slots = [];
  let featuredAssigned = false;
  let workingDayIndex = 0;

  for (let offset = 0; offset < horizon; offset += 1) {
    const date = dateKeyAtOffset(offset);
    const calendarHoliday = holidayInfoForDateKey(date).isHoliday;
    const isHoliday =
      calendarHoliday || offset === 2 || (offset > 5 && offset % 13 === 0);
    days.push({ date, isHoliday });
    if (isHoliday) continue;

    const ranges = sessionPatterns[workingDayIndex % sessionPatterns.length];

    ranges.forEach(([start, end], index) => {
      let status = "available";
      if (workingDayIndex === 0 && index === 1) status = "taken";
      if (workingDayIndex === 1 && index === 2) status = "unavailable";
      if (workingDayIndex > 3 && (workingDayIndex + index) % 11 === 0)
        status = "taken";
      const slot = {
        id: `${prefix}-${date}-${start.replace(":", "")}`,
        startAt: `${date}T${start}:00+03:30`,
        endAt: `${date}T${end}:00+03:30`,
        status,
        isHoliday: false,
        featured: !featuredAssigned && status === "available",
      };
      if (slot.featured) featuredAssigned = true;
      slots.push(slot);
    });
    workingDayIndex += 1;
  }

  return { days, slots };
}

export function introductionAvailability(prefix = "intro") {
  return buildAvailability(prefix);
}

export function introductionSlots(prefix = "intro") {
  return introductionAvailability(prefix).slots;
}
