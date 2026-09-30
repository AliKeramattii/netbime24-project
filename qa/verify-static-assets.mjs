import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const roots = ["index.html", "pages/moarefe/moarefe.html", "pages/interview/interview.html"];
const failures = [];
let checks = 0;

const normalizeRef = (from, ref) => {
  if (!ref || /^(?:data:|https?:|#|mailto:|tel:)/.test(ref)) return null;
  const clean = ref.split(/[?#]/)[0];
  return path.normalize(path.join(path.dirname(from), clean));
};

for (const htmlFile of roots) {
  const html = await fs.readFile(path.join(root, htmlFile), "utf8");
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  for (const ref of refs) {
    const target = normalizeRef(htmlFile, ref);
    if (!target) continue;
    checks += 1;
    try { await fs.access(path.join(root, target)); }
    catch { failures.push(`${htmlFile} -> ${ref}`); }
  }
}

// Validate local CSS url(...) assets used by retained stylesheets.
const cssFiles = [
  "css/reset.css", "css/variables.css", "css/typography.css", "css/base.css", "css/layout.css", "css/components.css",
  "css/register.css", "css/registration-identity-contact.css", "css/registration-education-employment.css", "css/responsive.css",
  "shared/dashboard/dashboard.css", "shared/recruitment/recruitment.css", "shared/recruitment/appointment-scheduler.css",
  "pages/moarefe/moarefe.css", "pages/interview/interview.css",
];
for (const cssFile of cssFiles) {
  const css = await fs.readFile(path.join(root, cssFile), "utf8");
  const refs = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match => match[1]);
  for (const ref of refs) {
    const target = normalizeRef(cssFile, ref);
    if (!target) continue;
    checks += 1;
    try { await fs.access(path.join(root, target)); }
    catch { failures.push(`${cssFile} -> ${ref}`); }
  }
}

if (failures.length) {
  console.error(`FAIL: ${failures.length}/${checks} local asset references are missing`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}
console.log(`PASS: ${checks} retained HTML/CSS local asset references resolve.`);
