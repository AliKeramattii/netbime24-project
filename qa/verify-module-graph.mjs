import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [];
const failures = [];
let checks = 0;

async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".git"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith(".js")) files.push(full);
  }
}
await walk(root);

async function assertLocal(from, specifier, kind) {
  if (!specifier.startsWith(".")) return;
  checks += 1;
  let target = path.resolve(path.dirname(from), specifier);
  if (kind === "module" && !path.extname(target)) target += ".js";
  try { await fs.access(target); }
  catch { failures.push(`${path.relative(root, from)} -> ${specifier}`); }
}

for (const file of files) {
  const source = await fs.readFile(file, "utf8");
  for (const match of source.matchAll(/(?:import\s+(?:[^'";]+?\s+from\s+)?|import\()\s*["']([^"']+)["']/g)) {
    await assertLocal(file, match[1], "module");
  }
  for (const match of source.matchAll(/new URL\(["']([^"']+)["'],\s*import\.meta\.url\)/g)) {
    await assertLocal(file, match[1], "asset");
  }
}

if (failures.length) {
  console.error(`FAIL: ${failures.length}/${checks} local JS imports/assets are missing`);
  failures.forEach(item => console.error(`- ${item}`));
  process.exit(1);
}
console.log(`PASS: ${checks} local JS module/asset references resolve.`);
