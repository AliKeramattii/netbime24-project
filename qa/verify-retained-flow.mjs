import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_ROUTES,
  resolveRecruitmentStageRoute,
} from "../shared/dashboard/app-routes.js";
import { initialRecruitment } from "../js/mocks/recruitment.mock.js";
import { simulateRecruitmentAdminEvent } from "../js/mocks/recruitment-workflow.mock.js";
import { resetMockServerState } from "../js/mocks/server-state.js";
import { mockApi } from "../js/api/mock-api.js";
import {
  APPOINTMENT_CONFIG,
  reservationStatus,
} from "../shared/recruitment/appointment-approval.js";

const root = fileURLToPath(new URL("..", import.meta.url));
let checks = 0;
const failures = [];
const check = (name, condition, detail = "") => {
  checks += 1;
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
};
const read = (relative) => fs.readFile(path.join(root, relative), "utf8");
const exists = async (relative) => {
  try {
    await fs.access(path.join(root, relative));
    return true;
  } catch {
    return false;
  }
};

for (const file of [
  "index.html",
  "pages/moarefe/moarefe.html",
  "pages/moarefe/moarefe.js",
  "pages/interview/interview.html",
  "pages/interview/interview.js",
  "shared/dashboard/sidebar.js",
  "shared/recruitment/appointment-scheduler.js",
  "js/jalali.js",
  "js/iran-holidays.js",
])
  check(`retained file exists: ${file}`, await exists(file));

for (const removed of [
  "pages/dashboard",
  "pages/documents",
  "pages/contract",
  "pages/leads",
  "pages/notifications",
  "pages/profile",
  "pages/steps",
  "shared/leads",
  "shared/steps",
])
  check(`removed feature is absent: ${removed}`, !(await exists(removed)));

check(
  "only supported app routes remain",
  Object.keys(APP_ROUTES).join(",") === "auth,moarefe,interview",
);
check(
  "Moarefe route resolves",
  resolveRecruitmentStageRoute("moarefe")?.endsWith(
    "/pages/moarefe/moarefe.html",
  ),
);
check(
  "Interview route resolves",
  resolveRecruitmentStageRoute("interview")?.endsWith(
    "/pages/interview/interview.html",
  ),
);
check(
  "Documents have no route",
  resolveRecruitmentStageRoute("documents") === null,
);
check(
  "Contract has no route",
  resolveRecruitmentStageRoute("contract") === null,
);

const indexHtml = await read("index.html");
const sidebarJs = await read("shared/dashboard/sidebar.js");
const moarefeJs = await read("pages/moarefe/moarefe.js");
const interviewJs = await read("pages/interview/interview.js");
const appShellJs = await read("shared/dashboard/app-shell.js");
const dashboardLayoutJs = await read("shared/dashboard/dashboard-layout.js");
const dashboardCss = await read("shared/dashboard/dashboard.css");
const moarefeHtml = await read("pages/moarefe/moarefe.html");
const interviewHtml = await read("pages/interview/interview.html");
const recruitmentHtml = `${moarefeHtml}
${interviewHtml}`;

check(
  "all supported pages preserve Persian RTL markup",
  [indexHtml, moarefeHtml, interviewHtml].every(
    (html) => html.includes('lang="fa"') && html.includes('dir="rtl"'),
  ),
);
check(
  "mobile sidebar behavior remains wired",
  dashboardLayoutJs.includes("const mobileBreakpoint = 1024") &&
    dashboardLayoutJs.includes("netbime:toggle-sidebar") &&
    dashboardCss.includes("@media (max-width: 1024px)"),
);

check(
  "registration success enters Moarefe",
  indexHtml.includes('href="pages/moarefe/moarefe.html"') &&
    indexHtml.includes("ادامه فرایند جذب"),
);
check(
  "sidebar keeps Moarefe navigable",
  recruitmentHtml.includes('href="../moarefe/moarefe.html">جلسه معارفه</a>'),
);
check(
  "sidebar keeps Interview navigable",
  recruitmentHtml.includes('href="../interview/interview.html">مصاحبه</a>'),
);
for (const label of [
  "مدارک",
  "قرارداد",
  "سرنخ‌ها",
  "دوازده گام",
  "ارزیابی عملکرد",
  "گزارشات",
  "CRM",
  "برنامه‌های من",
  "کارمزد",
  "پشتیبانی",
]) {
  check(
    `${label} is represented as disabled/planned`,
    recruitmentHtml.includes(label) &&
      recruitmentHtml.includes("sidebar-link--disabled"),
  );
}
check(
  "sidebar renders exact coming-soon label",
  recruitmentHtml.includes(">بزودی<") &&
    !sidebarJs.includes("APP_ROUTES.documents") &&
    !sidebarJs.includes("APP_ROUTES.contract"),
);
check(
  "Moarefe has no deleted-stage navigation",
  !moarefeJs.includes("APP_ROUTES.documents") &&
    !moarefeJs.includes("APP_ROUTES.contract"),
);
check(
  "Interview has no deleted-stage navigation",
  !interviewJs.includes("APP_ROUTES.documents") &&
    !interviewJs.includes("APP_ROUTES.contract"),
);
check(
  "header shell no longer routes to deleted profile/notifications pages",
  !appShellJs.includes("APP_ROUTES.profile") &&
    !appShellJs.includes("APP_ROUTES.notifications"),
);

const initial = initialRecruitment();
check(
  "initial flow starts at Moarefe",
  initial.currentStage === "moarefe" &&
    initial.moarefe.status === "available" &&
    initial.interview.status === "locked",
);
check(
  "future stages start locked",
  initial.documents.status === "locked" && initial.contract.status === "locked",
);

resetMockServerState();
globalThis.location = { search: "" };
const otpRequest = await mockApi.requestVerificationCode("09121112222");
check(
  "OTP request works in mock flow",
  otpRequest.success && otpRequest.resendAfterSeconds > 0,
);
const badOtp = await mockApi.verifyVerificationCode({
  mobile: "09121112222",
  code: "000000",
});
check("invalid OTP remains rejected", badOtp.verified === false);
const newUserOtp = await mockApi.verifyVerificationCode({
  mobile: "09121112222",
  code: "123456",
});
check(
  "valid OTP starts new-user registration",
  newUserOtp.verified === true &&
    newUserOtp.isNewUser === true &&
    newUserOtp.registrationCompleted === false,
);
await mockApi.submitRegistration({
  identity: { firstName: "سارا", lastName: "کریمی" },
  contact: { mobile: "09121112222" },
  education: { degree: "کارشناسی" },
  employment: { hasHistory: false, records: [] },
});
let context = await mockApi.getDashboardContext();
check(
  "registration produces recruitment account",
  context.success && context.account?.status === "recruitment",
);
check(
  "registration context points to Moarefe",
  context.recruitment?.currentStage === "moarefe",
);

const moarefeAvailability = await mockApi.getAvailableAppointments();
const moarefeSlot = moarefeAvailability.slots.find(
  (slot) => slot.status === "available" && new Date(slot.startAt) > new Date(),
);
const moarefeRequest = await mockApi.submitAppointmentRequest({
  recruitmentStage: "moarefe",
  slotId: moarefeSlot?.id,
  termsAccepted: true,
});
check(
  "Moarefe scheduling submission works",
  moarefeRequest.success && moarefeRequest.request?.status === reservationStatus("moarefe"),
);
if (APPOINTMENT_CONFIG.moarefeAutoApproval) {
  check(
    "auto-approved Moarefe opens Interview immediately",
    moarefeRequest.recruitment?.moarefe.status === "in_progress" &&
      moarefeRequest.recruitment?.interview.status === "available" &&
      moarefeRequest.recruitment?.currentStage === "interview",
  );
}
const moarefeDone = simulateRecruitmentAdminEvent({ type: "complete_moarefe" });
check(
  "completing Moarefe unlocks Interview",
  moarefeDone.success &&
    moarefeDone.recruitment.interview.status === "available" &&
    moarefeDone.recruitment.currentStage === "interview",
);
const interviewAvailability = await mockApi.getInterviewAvailability();
const interviewSlot = interviewAvailability.slots.find(
  (slot) => slot.status === "available" && new Date(slot.startAt) > new Date(),
);
const interviewRequest = await mockApi.submitInterviewRequest({
  recruitmentStage: "interview",
  slotId: interviewSlot?.id,
  termsAccepted: true,
});
check(
  "Interview scheduling submission works",
  interviewRequest.success && interviewRequest.request?.status === "pending",
);
const interviewDone = simulateRecruitmentAdminEvent({
  type: "complete_interview",
});
check(
  "Interview is terminal implemented stage",
  interviewDone.success &&
    interviewDone.recruitment.currentStage === "completed",
);
check(
  "future stages stay locked after Interview",
  interviewDone.recruitment.documents.status === "locked" &&
    interviewDone.recruitment.contract.status === "locked",
);
context = await mockApi.getDashboardContext();
check(
  "completed current flow is stable",
  context.recruitment?.currentStage === "completed" &&
    context.recruitment?.nextAction === null,
);

const forbiddenRoutePattern =
  /(?:pages\/(?:dashboard|documents|contract|leads|notifications|profile|steps)\/[^"'\s)]+|APP_ROUTES\.(?:dashboard|documents|contract|salesLeads|recruitmentLeads|twelveSteps|notifications|profile))/g;
for (const file of [
  "index.html",
  "pages/moarefe/moarefe.html",
  "pages/interview/interview.html",
  "pages/moarefe/moarefe.js",
  "pages/interview/interview.js",
  "shared/dashboard/app-shell.js",
  "shared/dashboard/sidebar.js",
]) {
  const source = await read(file);
  check(
    `${file} has no live reference to a deleted page`,
    !forbiddenRoutePattern.test(source),
  );
  forbiddenRoutePattern.lastIndex = 0;
}

if (failures.length) {
  console.error(
    `FAIL: ${failures.length}/${checks} retained-flow checks failed`,
  );
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}
console.log(
  `PASS: ${checks} retained Registration/Moarefe/Interview scope checks.`,
);
