import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { introductionAvailability } from "../js/mocks/moarefe.mock.js";
import { interviewAvailability } from "../js/mocks/interview.mock.js";
import { appointmentView, isFridayDateKey } from "../js/appointment-data.js";
import { resolveRecruitmentStageRoute } from "../shared/dashboard/app-routes.js";
import { mockApi } from "../js/api/mock-api.js";
import { resetMockServerState } from "../js/mocks/server-state.js";

const root = fileURLToPath(new URL("..", import.meta.url));
let checks = 0;
const failures = [];
const check = (name, condition, detail = "") => {
  checks += 1;
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
};
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const exists = async relative => { try { await fs.access(path.join(root, relative)); return true; } catch { return false; } };

const moarefe = introductionAvailability();
const interview = interviewAvailability();
check("Moarefe has a future date set", moarefe.days.length > 5 && moarefe.slots.length > 0);
check("Interview has a future date set", interview.days.length > 5 && interview.slots.length > 0);
check("Every Friday is marked holiday", moarefe.days.filter(day => isFridayDateKey(day.date)).every(day => day.isHoliday === true));
check("No Friday appointment slots are generated", moarefe.slots.every(slot => !isFridayDateKey(slot.startAt.slice(0, 10))));
check("Holiday dates expose no selectable slots", moarefe.days.filter(day => day.isHoliday).every(day => !moarefe.slots.some(slot => slot.startAt.startsWith(day.date) && slot.status === "available")));
const sessionsPerDate = Object.groupBy(moarefe.slots, slot => slot.startAt.slice(0, 10));
check("mock keeps roughly 3-4 slots per working day", Object.values(sessionsPerDate).every(slots => slots.length >= 3 && slots.length <= 4));
check("past appointments are identified", appointmentView({ id: "past", startAt: "2020-01-01T08:00:00+03:30", endAt: "2020-01-01T09:00:00+03:30", status: "available" })?.isPast === true);

resetMockServerState();
globalThis.location = { search: "?mockScenario=slot-unavailable" };
await mockApi.submitRegistration({ identity: { firstName: "سارا", lastName: "کریمی" }, contact: { mobile: "09121112222" }, education: { degree: "mock" }, employment: { hasHistory: false, records: [] } });
const availability = await mockApi.getAvailableAppointments();
const selected = availability.slots.find(slot => slot.status === "available" && new Date(slot.startAt) > new Date());
const conflict = await mockApi.submitAppointmentRequest({ recruitmentStage: "moarefe", slotId: selected?.id, termsAccepted: true });
check("SLOT_UNAVAILABLE conflict remains supported", conflict.code === "SLOT_UNAVAILABLE");
const refreshed = await mockApi.getAvailableAppointments();
check("conflicted slot refreshes as taken", refreshed.slots.find(slot => slot.id === selected?.id)?.status === "taken");
globalThis.location = { search: "" };
resetMockServerState();

const schedulerJs = await read("shared/recruitment/appointment-scheduler.js");
const schedulerCss = await read("shared/recruitment/appointment-scheduler.css");
const moarefeJs = await read("pages/moarefe/moarefe.js");
const interviewJs = await read("pages/interview/interview.js");
const moarefeHtml = await read("pages/moarefe/moarefe.html");
const interviewHtml = await read("pages/interview/interview.html");
const typography = await read("css/typography.css");
const variables = await read("css/variables.css");

check("Moarefe route is registered", resolveRecruitmentStageRoute("moarefe")?.endsWith("/pages/moarefe/moarefe.html"));
check("Interview route is registered", resolveRecruitmentStageRoute("interview")?.endsWith("/pages/interview/interview.html"));
check("future recruitment routes are disabled", resolveRecruitmentStageRoute("documents") === null && resolveRecruitmentStageRoute("contract") === null);
check("scheduler exposes exactly three suggestion cards", (moarefeHtml.match(/data-suggestion-index=/g) || []).length === 3 && (interviewHtml.match(/data-suggestion-index=/g) || []).length === 3);
check("popup does not truncate day slots", !schedulerJs.includes("daySlots.slice") && schedulerJs.includes("daySlots.forEach"));
check("scheduler consumes holiday metadata", schedulerJs.includes("day.isHoliday") && schedulerJs.includes("slot.isHoliday"));
check("scheduler blocks unavailable dates", schedulerJs.includes("button.disabled = !selectable") && schedulerJs.includes("isSelectableDay(day)"));
check("scheduler blocks past selections", schedulerJs.includes("slot.isPast") && schedulerJs.includes("day.isPast"));
check("main scheduling UI remains four-card layout", schedulerCss.includes("grid-template-columns: repeat(4"));
check("popup slot grid wraps arbitrary counts", schedulerCss.includes("repeat(auto-fit, minmax(150px, 1fr))") && schedulerJs.includes("daySlots.forEach"));
check("holiday styling remains red", schedulerCss.includes(".appointment-date-button.is-holiday") && schedulerCss.includes("var(--color-danger)"));
check("Moarefe and Interview share AppointmentScheduler", moarefeJs.includes("new AppointmentScheduler") && interviewJs.includes("new AppointmentScheduler"));
check("both pages preserve SLOT_UNAVAILABLE recovery", moarefeJs.includes('response.code === "SLOT_UNAVAILABLE"') && interviewJs.includes('response.code === "SLOT_UNAVAILABLE"'));

const fontFiles = [
  ["IRANSansX-Thin.ttf", 100], ["IRANSansX-UltraLight.ttf", 200], ["IRANSansX-Light.ttf", 300],
  ["IRANSansX-Regular.ttf", 400], ["IRANSansX-Medium.ttf", 500], ["IRANSansX-DemiBold.ttf", 600],
  ["IRANSansX-Bold.ttf", 700], ["IRANSansX-ExtraBold.ttf", 800], ["IRANSansX-Black.ttf", 900],
];
for (const [file, weight] of fontFiles) {
  check(`${file} exists`, await exists(`assets/fonts/${file}`));
  check(`${file} maps to weight ${weight}`, typography.includes(`url("../assets/fonts/${file}")`) && typography.includes(`font-weight: ${weight};`));
}
check("global font variable remains IRANSansX", variables.includes('--font-body: "IRANSansX", Tahoma, sans-serif;'));
check("typography globally applies application font", typography.includes("font-family: var(--font-body)") && typography.includes("button,") && typography.includes("textarea"));
for (const html of [await read("index.html"), await read("pages/moarefe/moarefe.html"), await read("pages/interview/interview.html")]) {
  check("Regular font preload remains", html.includes("IRANSansX-Regular.ttf"));
}

if (failures.length) {
  console.error(`FAIL: ${failures.length}/${checks} scheduling/navigation/font checks failed`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}
console.log(`PASS: ${checks} scheduling/navigation/font checks.`);
