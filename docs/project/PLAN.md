# Plan — phases, milestones, tasks

Project deadline: **2026-10-03**. Statuses: NOT_STARTED · IN_PROGRESS · BLOCKED · COMPLETE ·
CANCELLED. Estimates are **estimates** (hours of focused work), not actuals. `EXTERNAL:` marks a
dependency on someone outside the dev team (BACKEND team, USER, CLIENT). Tasks with a detail file
link to it; the detail file and this table must show the same status.

---

## Phase 1 — Foundation & Core Frontend (COMPLETE)

Migrated from `plan.md` (phases 0–4, 2.5, 2.6, 3.5, 1.5, UI phases 1–3, UI testing) and verified
against the code on 2026-09-30. Completion dates before 2026-09-30 were not recorded
("≤ 2026-09-30"). No effort was recorded for these tasks.

### M1.1 — API & authentication foundation — COMPLETE

| ID | Title | Done | Evidence / definition of done met |
| --- | --- | --- | --- |
| API-01 | Inspect Swagger and map frontend methods to endpoints | ≤ 2026-09-30 | 6 endpoints mapped; missing endpoints listed (CLAUDE.md) |
| API-02 | Central HTTP client, error normalization, request timeout | ≤ 2026-09-30 | `js/api/http.js`, `js/api/errors.js`; timeout 30 s (D-013) |
| SEC-01 | Backend proxy with server-side tokens (`proxy/server.js`, IIS/iisnode files) | 2026-09-30 | Code present; not the active mode (D-005, D-017) |
| SEC-02 | Direct mode: browser-issued single-use tokens (`auth-token.js`, `BROWSER_TOKEN`) | 2026-09-30 | Active in `config.js` (D-007); key exposure is a blocker |
| API-03 | OTP request/verify and `isNewUser` routing | ≤ 2026-09-30 | `real-api.js`, `js/register.js`; D-009 |
| API-04 | OTP limit (5 per 15 min) and resend timer | ≤ 2026-09-30 | `js/otp-limit.js`; server-side limit open (SEC-07/OD-2) |
| API-05 | Temporary simulations + cookie fallback (`MOCK_*`, `CROSS_ORIGIN_COOKIES`) | 2026-09-30 | `js/api/temporary-*.js`, `http.js` (D-006) |

### M1.2 — Registration & dashboard — COMPLETE

| ID | Title | Done | Evidence / definition of done met |
| --- | --- | --- | --- |
| REG-01 | Registration form + Swagger `RegistrationRequest` payload + inline 400 errors + 401 re-verify | ≤ 2026-09-30 | `buildRegistrationRequest` in `real-api.js`; backend acceptance is REG-03 |
| REG-02 | Referral code validation (manual + `?ref=`) | ≤ 2026-09-30 | `getReferralManager`; D-012 |
| DASH-01 | Existing users skip registration; routing by stage from `/api/me/context` | ≤ 2026-09-30 | `real-api.js`, `shared/dashboard/app-routes.js` |
| DASH-02 | Dashboard shell: header, sidebar, notifications, profile menu, access control | ≤ 2026-09-30 | `shared/dashboard/*` |
| APPT-01 | Moarefe & Interview scheduling UI (runs on the temporary simulation) | ≤ 2026-09-30 | `pages/moarefe`, `pages/interview`, `shared/recruitment/*` |
| QA-01 | Registration QA: OTP, new/existing flows, success/400/401, payload, no secrets in storage | ≤ 2026-09-30 | Per plan.md Phase 4 (browser + controlled responses; not re-run). Manual real-phone E2E → QA-04 |

### M1.3 — UI design pass — COMPLETE

| ID | Title | Done | Evidence / definition of done met |
| --- | --- | --- | --- |
| UI-01 | Brand panel per `Login Design.svg` (WebP assets) | 2026-09-29 | `assets/images/*.webp`, `css/layout.css` |
| UI-02 | Stepper per `مراحل.svg` (vertical ≥1100px, compact below) | ≤ 2026-09-30 | `css/registration-identity-contact.css` |
| UI-03 | Header brand per `هدر.svg` (190×45 WebP logo) | ≤ 2026-09-30 | `shared/assets/header/netbime-dashboard-logo.webp` |
| UI-04 | Viewport testing: zoom 80–200 %, 1920×1080, 1366×768, mobile portrait/landscape | ≤ 2026-09-30 | Per plan.md (manual; not re-verifiable from the repo) |

---

## Phase 2 — Security & Deployment Architecture (deadline 2026-10-01)

### M2.1 — Architecture decision & backend requests — deadline 2026-10-01

#### DOC-01 — Create the planning system and CLAUDE.md; migrate and delete `plan.md`
Status: COMPLETE (2026-09-30) · Priority: HIGH · Estimate: 2 h · Deadline: 2026-09-30 · Depends: —
Acceptance: `docs/project/*` + `CLAUDE.md` exist; every plan.md fact migrated (D-016); plan.md deleted.

#### SEC-03 — Decide proxy mode vs direct mode for the client's server
Status: COMPLETE (2026-09-30) · Priority: CRITICAL · Estimate: 0.5 h · Deadline: 2026-10-01 · Depends: EXTERNAL: USER/CLIENT decision (OD-1, closed) · [task](tasks/phase-02/SEC-03-decide-auth-mode.md)
Result: **direct mode for now** (D-017); key-exposure risk accepted by the user.
Objective: one recorded choice that every deploy task builds on.
Acceptance: decision recorded in DECISIONS.md with date and reason; OD-1 closed; `config.js` comment matches it.

#### SEC-04 — Confirm whether the client's server can run Node.js (Plesk Node.js / iisnode)
Status: BLOCKED · Priority: CRITICAL · Estimate: 1 h · Deadline: 2026-10-01 · Depends: EXTERNAL: CLIENT server details · [task](tasks/phase-02/SEC-04-client-server-node-check.md)
Acceptance: server OS, web server, Node availability and HTTPS status recorded in the task file.
Note: no longer blocks the mode decision (D-017); still needed for DEPLOY-03 and a later switch to proxy mode.

#### DOC-03 — Send the backend team a written request list
Status: NOT_STARTED · Priority: HIGH · Estimate: 1 h · Deadline: 2026-09-30 · Depends: — · [task](tasks/phase-02/DOC-03-backend-request-list.md)
Objective: start the external lead time now (endpoints, CORS credentials, key rotation, Swagger docs).
Acceptance: one message/file listing every backend item with the frontend task it unblocks; handed to the user to send.

### M2.2 — Key hygiene — deadline 2026-10-01

#### SEC-05 — Rotate the backend privateKey
Status: BLOCKED · Priority: CRITICAL · Estimate: 0.5 h (our side) · Deadline: 2026-10-01 · Depends: EXTERNAL: BACKEND rotates the key · [task](tasks/phase-02/SEC-05-rotate-private-key.md)
Acceptance: old key rejected by `/api/auth/token`; new key only in the server environment (proxy) or only in the deployed `private-key.js` (direct); never committed.
Note: in direct mode (D-017) the key stays public in the browser, so rotation remains a top priority.

#### SEC-06 — Apply the chosen mode in `js/api/config.js` and the deploy list
Status: NOT_STARTED · Priority: HIGH · Estimate: 1 h · Deadline: 2026-10-01 · Depends: SEC-03
Objective: proxy → `API_BASE_URL = "/api"`, `BROWSER_TOKEN = false`, `private-key.js` excluded from the package; direct → risk acceptance documented.
Acceptance: `npm test` green; in proxy mode no deployed file contains the key and the browser never calls `/api/auth/token`.

### M2.3 — QA baseline green — deadline 2026-09-30

#### QA-02 — Fix the 2 failing sidebar checks in `qa/verify-retained-flow.mjs`
Status: NOT_STARTED · Priority: HIGH · Estimate: 0.5 h · Deadline: 2026-09-30 · Depends: — · [task](tasks/phase-02/QA-02-fix-sidebar-checks.md)
Acceptance: `npm run test:flow` → PASS 63/63; sidebar links still navigable in the browser.

#### QA-03 — Make `npm test` run every QA script and report all failures
Status: NOT_STARTED · Priority: MEDIUM · Estimate: 0.5 h · Deadline: 2026-09-30 · Depends: — · [task](tasks/phase-02/QA-03-run-all-qa-scripts.md)
Acceptance: one failing script no longer hides the others; exit code non-zero if any fails; no new dependencies.

#### DOC-02 — Fix the stale `Netbime24.md` reference in `js/validation.js`
Status: NOT_STARTED · Priority: LOW · Estimate: 0.25 h · Deadline: 2026-09-30 · Depends: —
Acceptance: comment points to an existing source (Swagger / CLAUDE.md) or is removed; `npm test` green.

---

## Phase 3 — Backend Integration & End-to-End (deadline 2026-10-02 for internal work; backend items: EXTERNAL)

### M3.1 — Real end-to-end test — deadline 2026-10-02

#### QA-04 — Manual E2E with a real phone number (OTP → session → registration / dashboard)
Status: BLOCKED · Priority: CRITICAL · Estimate: 2 h · Deadline: 2026-10-02 · Depends: EXTERNAL: USER real phone number; SEC-06 · [task](tasks/phase-03/QA-04-real-phone-e2e.md)
Acceptance: new-user and existing-user runs recorded (date, mode, result per step); every failure becomes a task.

#### API-06 — Re-check backend CORS credentials and enable `CROSS_ORIGIN_COOKIES` (direct mode only)
Status: BLOCKED · Priority: HIGH · Estimate: 0.5 h · Deadline: TBD · Depends: EXTERNAL: BACKEND sends `Access-Control-Allow-Credentials: true` + exact origin; SEC-03 = direct · [task](tasks/phase-03/API-06-cors-credentials.md)
Acceptance: `/api/me/context` answers 200 with the cookie from the browser; flag `true`; no CORS errors in the console. Required: direct mode chosen (D-017).

### M3.2 — Replace temporary simulations with real endpoints — deadline TBD (external)

#### REG-03 — Switch registration to the real backend (`MOCK_REGISTRATION_SUBMIT = false`)
Status: BLOCKED · Priority: CRITICAL · Estimate: 1 h · Deadline: TBD · Depends: EXTERNAL: BACKEND accepts `POST /api/registration`; session cookie reachable (proxy or API-06) · [task](tasks/phase-03/REG-03-real-registration-submit.md)
Acceptance: real registration saved (visible via `/api/me/context`); flag false; `temporary-registration.js` deleted; `npm test` green.

#### API-07 — Implement `logout` in `js/api/real-api.js` against `POST /api/auth/logout`
Status: BLOCKED · Priority: HIGH · Estimate: 1.5 h · Deadline: TBD · Depends: EXTERNAL: BACKEND logout endpoint · [task](tasks/phase-03/API-07-logout.md)
Acceptance: logout clears the HttpOnly cookie server-side; next `/api/me/context` → 401; UI returns to login.

#### API-08 — Remove the temporary session (`MOCK_SESSION = false`)
Status: NOT_STARTED · Priority: HIGH · Estimate: 1 h · Deadline: TBD · Depends: API-07; cookie reachable (proxy or API-06)
Acceptance: dashboard context always from `/api/me/context`; `temporary-session.js` deleted; `npm test` green.

#### APPT-02 — Implement `getAvailableAppointments` and `submitAppointmentRequest` (Moarefe) in `real-api.js`
Status: BLOCKED · Priority: HIGH · Estimate: 3 h · Deadline: TBD · Depends: EXTERNAL: BACKEND `GET /api/appointments/availability`, `POST /api/appointments/reservations` in Swagger · [task](tasks/phase-03/APPT-02-moarefe-appointments.md)
Acceptance: slots come from the backend; reservation persists across devices; errors shown in Persian; approval status read from backend.

#### APPT-03 — Implement `getInterviewAvailability` and `submitInterviewRequest` in `real-api.js`
Status: BLOCKED · Priority: HIGH · Estimate: 2 h · Deadline: TBD · Depends: EXTERNAL: same BACKEND endpoints; APPT-02
Acceptance: as APPT-02 for the Interview stage; status "pending" comes from the backend.

#### APPT-04 — Remove the appointment simulation (`MOCK_APPOINTMENT_FLOW = false`)
Status: NOT_STARTED · Priority: HIGH · Estimate: 1 h · Deadline: TBD · Depends: APPT-02, APPT-03
Acceptance: flag false; `temporary-appointments.js` deleted; QA scripts updated; `npm test` green.

#### API-09 — Implement `withdrawRecruitment` in `js/api/real-api.js`
Status: BLOCKED · Priority: MEDIUM · Estimate: 1.5 h · Deadline: TBD · Depends: EXTERNAL: BACKEND `POST /api/recruitment/withdraw` · [task](tasks/phase-03/API-09-withdraw.md)
Acceptance: withdraw persists; `/api/me/context` reflects it; confirmation and error texts in Persian.

---

## Phase 4 — Production Hardening (deadline 2026-10-02)

### M4.1 — Hardening — deadline 2026-10-02

#### SEC-07 — Server-side OTP rate limit in `proxy/server.js` (per mobile + per IP)
Status: CANCELLED (2026-09-30, D-017: direct mode, no proxy) · Priority: HIGH · Estimate: 3 h · Deadline: 2026-10-02 · Depends: SEC-03 = proxy, OD-2
Acceptance: 6th `/api/auth/otp/request` for a mobile within 15 min → 429 with Persian message, never forwarded; limits configurable by env vars; documented. CANCEL (move to backend request list) if direct mode.

#### SEC-09 — Content-Security-Policy and security headers for IIS (`web.config`)
Status: NOT_STARTED · Priority: MEDIUM · Estimate: 2 h · Deadline: 2026-10-02 · Depends: SEC-03
Acceptance: CSP allows only self, `https://esm.sh` (holiday library, `js/iran-holidays.js`) and — in direct mode — `https://api.ramatest.ir`; `X-Content-Type-Options`, `Referrer-Policy` set; no CSP violations in a full browser run.

#### UI-05 — Convert the 9 IRANSansX TTF fonts to WOFF2
Status: NOT_STARTED · Priority: LOW · Estimate: 1.5 h · Deadline: 2026-10-02 · Depends: —
Acceptance: `@font-face` uses `.woff2` (TTF fallback optional); fonts ~50 % smaller; `npm run test:enhancements` and `test:assets` pass; IIS serves `.woff2` (MIME type in web.config).

### M4.2 — Release QA — deadline 2026-10-03

#### QA-05 — Release regression on the final configuration
Status: NOT_STARTED · Priority: HIGH · Estimate: 2 h · Deadline: 2026-10-03 · Depends: SEC-06, QA-02, SEC-09
Acceptance: `npm test` all green; browser checklist (login, registration, referral, dashboard, scheduling, logout; mobile + desktop) passed and recorded in PROGRESS.md.

---

## Phase 5 — Client Handover & Deployment (deadline 2026-10-03)

### M5.1 — Deploy package & documentation — deadline 2026-10-03

#### DEPLOY-01 — Finalize the deploy package file list for the chosen mode
Status: NOT_STARTED · Priority: HIGH · Estimate: 1 h · Deadline: 2026-10-02 · Depends: SEC-06
Acceptance: D-015 updated for the chosen mode; list excludes `docs/`, `design/`, `qa/`, `*.md`, secrets.

#### DEPLOY-02 — Add a dependency-free packaging script (`npm run package` → `dist/`)
Status: NOT_STARTED · Priority: MEDIUM · Estimate: 2 h · Deadline: 2026-10-02 · Depends: DEPLOY-01
Acceptance: copies only D-015 files into `dist/` (git-ignored); fails if a secret file or `docs/` would be included; QA check added.

#### DEPLOY-03 — Write the client deployment guide for IIS/Plesk (`DEPLOYMENT.md`, Persian + English commands)
Status: NOT_STARTED · Priority: CRITICAL · Estimate: 3 h · Deadline: 2026-10-03 · Depends: SEC-03, DEPLOY-01
Acceptance: step-by-step install on a clean server (HTTPS, Node/iisnode if proxy, env vars, web.config, upload list, key handling, update/rollback); a person who has not seen the project can follow it.

#### DEPLOY-04 — Write the configuration reference (every `config.js` flag, proxy env var, web.config rule)
Status: NOT_STARTED · Priority: HIGH · Estimate: 1.5 h · Deadline: 2026-10-03 · Depends: SEC-06
Acceptance: each setting: purpose, allowed values, default, when the client changes it. Can be a section of the guide.

### M5.2 — Client server acceptance — deadline 2026-10-03

#### DEPLOY-05 — Smoke test on the client's server
Status: NOT_STARTED · Priority: CRITICAL · Estimate: 2 h · Deadline: 2026-10-03 · Depends: DEPLOY-03, EXTERNAL: CLIENT server access
Acceptance: checklist from the guide passes on the client's URL over HTTPS (pages load, OTP arrives, `/proxy/` and secrets not downloadable, no console errors).

#### DEPLOY-06 — Client acceptance / handover sign-off
Status: NOT_STARTED · Priority: HIGH · Estimate: 0.5 h · Deadline: 2026-10-03 · Depends: DEPLOY-05, OD-3, EXTERNAL: CLIENT
Acceptance: client confirms the deployment and the list of known limitations (remaining `MOCK_*` flags) in writing.

---

## Phase 6 — Remaining Recruitment Stages (after 2026-10-03, out of the deadline scope)

### M6.1 — Documents, Contract and other dashboard sections — deadline TBD

| ID | Title | Status | Priority | Estimate | Depends |
| --- | --- | --- | --- | --- | --- |
| UI-06 | Documents stage (مدارک) — design and implement | BLOCKED | MEDIUM | TBD | EXTERNAL: CLIENT design; BACKEND endpoints |
| UI-07 | Contract stage (قرارداد) — design and implement | BLOCKED | MEDIUM | TBD | EXTERNAL: CLIENT design; BACKEND endpoints |
| DASH-03 | Other dashboard sections now «بزودی» (leads, CRM, commission, reports …) | NOT_STARTED | LOW | TBD | Scope from CLIENT |

Break these into one-session tasks when their designs and endpoints exist.
