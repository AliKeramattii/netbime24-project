import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [];
async function walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".git"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(full);
  }
}
await walk(root);
for (const file of files) execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
console.log(`PASS: ${files.length} JavaScript/MJS syntax checks.`);
