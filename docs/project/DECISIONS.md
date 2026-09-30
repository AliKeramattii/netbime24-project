# Decisions

Dated architectural decisions, open decisions, and the plan change log. Never delete an entry;
mark it SUPERSEDED and link the replacement. "Date unknown" = taken before the planning system
existed and not dated in `plan.md` (migrated 2026-09-30).

## Open decisions (waiting on the user / client)

| ID | Question | Options | Needed by | Blocks |
| --- | --- | --- | --- | --- |
| OD-2 | Where is the OTP send limit enforced server-side? | Backend · Web server (IIS dynamic IP restrictions). (Proxy option dropped with SEC-07, D-017.) | 2026-10-01 | SEC-07 |
| OD-3 | May the client go live with `MOCK_*` simulations still on? With `MOCK_REGISTRATION_SUBMIT = true`, registrations the backend rejects are completed in the browser and **not saved**. | Go live only after REG-03 · Deliver on 2026-10-03 as "staging", production after backend endpoints | 2026-10-02 | DEPLOY-06 |
| OD-4 | Development pace and hours per day for 2026-09-30 → 2026-10-03 | Assumed: 1 developer + Claude Code, ~8 h/day | 2026-10-01 | schedule |

## Decision log

### D-001 — Swagger is the API source of truth (date unknown)
Endpoints, methods, schemas and auth follow Swagger. If Swagger changes, update PLAN.md before
coding. Observed behavior where Swagger is silent is recorded in CLAUDE.md.

### D-002 — No framework, no build step (date unknown)
Plain HTML, vanilla ES modules, CSS; RTL Persian UI; HTML-first templates (checked by
`qa/verify-html-first-architecture.mjs`). Changing this requires a new decision here.

### D-003 — Backend-managed cookie session (date unknown, Phase 2.5)
User sessions are the HttpOnly cookie set by OTP verify. The frontend never reads or stores
cookies; `registrationSessionKey` / `marketerSessionToken` from OTP verify are deliberately
dropped. The marketer-ID dependency was removed. Consequence: logout needs a backend endpoint.

### D-004 — One Bearer token per request (confirmed behavior, date unknown)
The backend accepts each token for exactly one request. Token handling is centralized (proxy, or
`js/api/auth-token.js` in direct mode); tokens are never cached, stored or logged.

### D-005 — Backend proxy / BFF (2026-09-30) — IMPLEMENTED, NOT ACTIVE
`proxy/server.js` holds `NETBIME_PRIVATE_KEY` (env or git-ignored `proxy/.env`), issues a token per
forwarded `/api/*` request, blocks `/api/auth/token`, rewrites cookies to the site host, serves
allow-listed static files. IIS/Plesk: `proxy/iis-web.config` + `proxy/iisnode-entry.cjs`.
Same-origin also solves the missing CORS. Superseded in `config.js` by D-007 the same day; the
choice between them was OD-1, closed by D-017 (direct mode).

### D-006 — Temporary browser simulations behind flags (2026-09-30)
In `js/api/config.js`, each wrapper is removed when its backend part works:
- `MOCK_APPOINTMENT_FLOW = true` → `temporary-appointments.js` (no appointment endpoints). Flow:
  registration → Moarefe time → auto-approved → Interview time → pending. Must allow a real
  approval workflow later without major frontend changes.
- `MOCK_REGISTRATION_SUBMIT = true` → `temporary-registration.js`: always tries the real
  `POST /api/registration` first; on 401/5xx/network it completes locally (**not saved**).
- `MOCK_SESSION = true` → `temporary-session.js`: existing user's dashboard built from the OTP
  verify `user`; logout clears browser session storage.
- `CROSS_ORIGIN_COOKIES = false`: the backend sends no `Access-Control-Allow-Credentials`;
  `http.js` retries once without cookies if a credentialed request is blocked.

### D-007 — Direct mode on ramatest.ir (2026-09-30, owner's decision per `config.js`)
The ramatest.ir host (Plesk on Windows/IIS) reportedly cannot run the Node proxy, so the browser
requests its own tokens with the key in `js/api/private-key.js` (git-ignored, but it must be
uploaded and is public in DevTools). **Discrepancy:** `plan.md` still described proxy mode as live
and "no privateKey in frontend". Code wins; recorded as blocker + OD-1. Confirmed by D-017.

### D-008 — UI follows the SVG references; heavy assets as WebP (2026-09-29)
`design/Login Design.svg` → `.brand-panel`; `design/مراحل.svg` → `.stepper`; `design/هدر.svg` →
`.app-header__brand`. Wave/illustration as WebP (~235 KB instead of 2.3 MB of embedded PNG);
header logo 23 KB WebP instead of a 1.9 MB SVG. Real text, not outlines.

### D-009 — `isNewUser` must be a boolean; never guessed (date unknown)
A verified OTP response without boolean `isNewUser` is rejected (`INVALID_RESPONSE`).

### D-010 — `/api/me/context` loaded twice at login, on purpose (date unknown)
Once to verify the session and choose the page, once by the dashboard page after navigation.

### D-011 — Client-side OTP limit (date unknown, Phase 2.6)
Max 5 codes per mobile, then a 15-minute block (`js/otp-limit.js`, localStorage, hashed mobiles).
Bypassable; server-side enforcement is OD-2.

### D-012 — Referral payload (date unknown, Phase 3.5)
Only a backend-validated code is sent as `{ hasReferral, source, code }`; `manager` is never sent.
No referral → `{ hasReferral:false, source:null, code:null }`. `?ref=` codes are validated the same
way. Network/401/5xx errors are retryable, not "invalid".

### D-013 — Request timeout 30 s (2026-09-30)
`plan.md` said 10 s; the code uses 30 s because the backend's first request after idle takes ~20 s.
Code wins.

### D-014 — Postal code required (date unknown)
The backend requires `contact.postalCode`; the form requires it too (comment in `js/validation.js`).

### D-015 — Deploy package contents (from plan.md Phase 10; updated 2026-09-30)
Deploy: `index.html`, `assets/`, `css/`, `js/`, `pages/`, `shared/`, plus
- proxy mode: `proxy/` **without** `.env`, and `web.config`; **not** `js/api/private-key.js`;
- direct mode: `js/api/private-key.js` (git-ignored — a git-based deploy will miss it).
Never deploy: `docs/`, `design/`, `qa/`, `*.md`, `package*.json`, `.gitignore`, `proxy/.env`,
`*.zip`. (`docs/` added 2026-09-30.) `proxy/server.js` already serves only the allow-listed dirs.

### D-016 — Planning system replaces plan.md (2026-09-30)
`plan.md` was migrated into `docs/project/` (ROADMAP, PLAN, PROGRESS, DECISIONS, tasks/) and
CLAUDE.md, then deleted. Completed phases → Phase 1 COMPLETE tasks; open items → tasks; blockers →
PROGRESS.md; decisions → this file; undocumented backend behavior → CLAUDE.md. Nothing in the code
or QA scripts referenced `plan.md`. Progress method: task count (completed tasks carry no recorded
estimates). `docs/` is excluded from the deploy package (D-015).

### D-017 — Direct mode ships for now; OD-1 closed (2026-09-30, decided by the user, Atefe)
Direct mode (`BROWSER_TOKEN = true`, `API_BASE_URL = "https://api.ramatest.ir/api"`) is the mode
for the client's server for now. **Reason:** the client's server cannot run the Node proxy yet.
**Accepted risk (explicit, by the user):** the backend privateKey stays readable by anyone in the
browser (`js/api/private-key.js`), so key rotation (SEC-05) stays a high-priority task (kept at
CRITICAL). Consequences:
- SEC-03 COMPLETE; `config.js` already matches, no code change.
- SEC-07 (proxy OTP limit) CANCELLED → server-side OTP limit is a backend/IIS item (OD-2, DOC-03).
- API-06 (backend CORS credentials) is required for real session features (REG-03, logout).
- SEC-09 CSP must allow `https://api.ramatest.ir`; deploy package includes `private-key.js` (D-015).
- The proxy (D-005) stays in the repo; switching later = SEC-06 proxy branch + a new decision.
  SEC-04 (client server details) is still needed for the deployment guide and a later switch.

## Discrepancies found during migration (2026-09-30)

| plan.md said | Repository shows | Handling |
| --- | --- | --- |
| Proxy mode live, "no privateKey in frontend", "frontend has no token handling" | Direct mode, `private-key.js`, `auth-token.js` | D-007, D-017 (OD-1 closed), blocker |
| Registration ✅ | Backend rejects it; `MOCK_REGISTRATION_SUBMIT` completes locally without saving | REG-03, OD-3 |
| Timeout 10 s | 30 s | D-013 |
| "README updated" | No README in the repository | DEPLOY-03 writes the client guide |
| — | `MOCK_SESSION`, `CROSS_ORIGIN_COOKIES` not in plan.md | D-006 |
| — | `js/validation.js` cites `Netbime24.md`, which is not in the repository | DOC-02 |
| — | Source zip contains `proxy/.env` and `private-key.js` (key distributed further) | SEC-05 urgency |

## Plan change log

- 2026-09-30 — Planning system created from `plan.md` + repository analysis. Deadline
  2026-10-03 set by the user; backend-dependent work kept off the critical path.
- 2026-09-30 — OD-1 closed by D-017 (direct mode). SEC-03 → COMPLETE; SEC-07 → CANCELLED (3 h
  removed; server-side OTP limit moves to backend/IIS, OD-2); API-06 no longer conditional.
  Planned tasks 48 → 47. CLAUDE.md gained the "Session start" rules (§0).
