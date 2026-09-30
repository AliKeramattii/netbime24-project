import { STORAGE_KEYS } from "../storage-keys.js";
// Development-only persistence. Real adapters never import this module.
const memory = new Map();
const volatileKeys = new Set();

export function readServer(key) {
  if (volatileKeys.has(key)) return structuredClone(memory.get(key) || null);
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEYS.mockServerPrefix}${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return structuredClone(memory.get(key) || null);
  }
}

export function writeServer(key, value) {
  memory.set(key, structuredClone(value));
  try {
    sessionStorage.setItem(`${STORAGE_KEYS.mockServerPrefix}${key}`, JSON.stringify(value));
    volatileKeys.delete(key);
  } catch {
    volatileKeys.add(key);
  }
}

// QA/development helper only. Feature pages never call this function.
export function resetMockServerState() {
  memory.clear();
  volatileKeys.clear();
  try {
    const keys = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(STORAGE_KEYS.mockServerPrefix)) keys.push(key);
    }
    keys.forEach(key => sessionStorage.removeItem(key));
  } catch { /* Storage is optional in non-browser QA. */ }
}
