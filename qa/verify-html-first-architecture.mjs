import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let checks = 0;
const check = (name, condition, detail = "") => {
  checks += 1;
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
};
const read = relative => fs.readFile(path.join(root, relative), "utf8");

const jsFiles = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".git"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith(".js")) jsFiles.push(full);
  }
}
for (const dir of ["js", "shared", "pages"]) await walk(path.join(root, dir));

for (const file of jsFiles) {
  const source = await fs.readFile(file, "utf8");
  const relative = path.relative(root, file);
  check(`${relative} does not assign application markup through innerHTML`, !/\.innerHTML\s*=/.test(source));
  check(`${relative} does not use insertAdjacentHTML`, !/insertAdjacentHTML\s*\(/.test(source));
  const templateLiterals = [...source.matchAll(/`([^`]*)`/gs)].map(match => match[1]);
  const largeHtmlLiteral = templateLiterals.some(literal =>
    literal.length >= 80
    && /<\/?(?:div|section|header|nav|form|button|ul|li|dialog|template)\b/i.test(literal)
  );
  check(`${relative} has no large static HTML template literal`, !largeHtmlLiteral);
}

const index = await read("index.html");
const moarefe = await read("pages/moarefe/moarefe.html");
const interview = await read("pages/interview/interview.html");
const headerJs = await read("shared/dashboard/header.js");
const sidebarJs = await read("shared/dashboard/sidebar.js");
const accessJs = await read("shared/dashboard/access-control.js");
const processJs = await read("shared/recruitment/recruitment-process.js");
const datePickerJs = await read("js/persian-date-picker.js");
const schedulerJs = await read("shared/recruitment/appointment-scheduler.js");

for (const [name, html] of [["index", index], ["moarefe", moarefe], ["interview", interview]]) {
  check(`${name} owns header template`, html.includes('id="netbime-header-template"'));
}
for (const [name, html] of [["moarefe", moarefe], ["interview", interview]]) {
  check(`${name} owns sidebar template`, html.includes('id="netbime-sidebar-template"'));
  check(`${name} owns recruitment step template`, html.includes('id="recruitment-step-template"'));
  check(`${name} owns access-control templates`, html.includes('id="recruitment-stage-locked-template"') && html.includes('id="dashboard-context-error-template"'));
  check(`${name} owns appointment calendar templates`, html.includes('id="appointment-calendar-day-template"') && html.includes('id="appointment-time-slot-template"'));
  check(`${name} owns known page-state copy`, html.includes("data-page-copy-bank"));
}
check("registration owns Jalali picker shell", index.includes('id="persian-date-picker-template"') && index.includes('id="persian-calendar-day-template"'));
check("registration owns validation and behavior copy", index.includes('id="registration-copy-bank"') && index.includes('data-validation-copy="mobile-required"'));

for (const label of ["پروفایل", "اعلان‌ها", "خروج", "تلاش دوباره", "خواندن همه"]) {
  check(`header label ${label} lives in HTML, not header.js`, (index.includes(label) || moarefe.includes(label)) && !headerJs.includes(`>${label}<`));
}
for (const label of ["فرایند جذب", "جلسه معارفه", "مصاحبه", "مدارک", "قرارداد", "سرنخ‌ها", "گزارشات", "CRM", "بزودی"]) {
  check(`sidebar label ${label} lives in HTML`, moarefe.includes(label) && !sidebarJs.includes(`label: "${label}"`));
}
check("access controller clones templates rather than rendering cards", accessJs.includes("cloneTemplate") && !accessJs.includes("dashboard-access-denied__icon\""));
check("recruitment process clones a step template", processJs.includes('cloneTemplate("recruitment-step-template"') && !processJs.includes('createElement("span")'));
check("Jalali picker clones its HTML shell", datePickerJs.includes('cloneTemplate("persian-date-picker-template"') && !datePickerJs.includes('createElement("div")'));
check("scheduler clones runtime calendar/slot templates", schedulerJs.includes('cloneTemplate("appointment-calendar-day-template"') && schedulerJs.includes('cloneTemplate("appointment-time-slot-template"'));

if (failures.length) {
  console.error(`FAIL: ${failures.length}/${checks} HTML-first architecture checks failed`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}
console.log(`PASS: ${checks} HTML-first architecture checks.`);
