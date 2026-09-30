import { STORAGE_KEYS } from "./storage-keys.js";

// Client-side OTP send limit. This is a UX guard only: the backend (or the proxy in front of it)
// must enforce its own limit, because anything in the browser can be cleared or bypassed.
// At most OTP_MAX_SENDS codes per mobile; after that, new requests are blocked for OTP_BLOCK_MS
// from the last send. A quiet period of OTP_BLOCK_MS, or a successful verification, resets it.
// Kept in localStorage so the limit holds across tabs; mobiles are stored hashed, not in clear.
export const OTP_MAX_SENDS = 5;
export const OTP_BLOCK_MS = 15 * 60 * 1000;

const KEY = STORAGE_KEYS.otpLimit;

// FNV-1a: a stable, non-reversible-at-a-glance key; not a security measure.
function mobileKey(mobile) {
  let hash = 0x811c9dc5;
  for (const char of String(mobile)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function readAll() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeAll(entries) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* Storage unavailable: the limit then applies to this page only. */
  }
}

const isActive = (entry, now) =>
  Number.isFinite(entry?.lastSentAt) && now - entry.lastSentAt < OTP_BLOCK_MS;

function currentEntry(mobile, now) {
  const entry = readAll()[mobileKey(mobile)];
  return isActive(entry, now)
    ? { count: Math.max(0, Math.floor(Number(entry.count)) || 0), lastSentAt: entry.lastSentAt }
    : { count: 0, lastSentAt: 0 };
}

// Timestamp (ms) until which new codes are blocked for this mobile, or 0 when allowed.
export function otpBlockedUntil(mobile, now = Date.now()) {
  const entry = currentEntry(mobile, now);
  return entry.count >= OTP_MAX_SENDS ? entry.lastSentAt + OTP_BLOCK_MS : 0;
}

export function recordOtpSend(mobile, now = Date.now()) {
  const entries = readAll();
  for (const [key, entry] of Object.entries(entries)) {
    if (!isActive(entry, now)) delete entries[key];
  }
  entries[mobileKey(mobile)] = { count: currentEntry(mobile, now).count + 1, lastSentAt: now };
  writeAll(entries);
}

export function clearOtpSends(mobile) {
  const entries = readAll();
  delete entries[mobileKey(mobile)];
  writeAll(entries);
}
