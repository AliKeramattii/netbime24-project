# CLAUDE.md — NetBime24 Sales Organization Portal (سامانه سازمان فروش نت بیمه ۲۴)

## 0. Session start (every new session — avoid repeating work)

1. Run `git pull origin main` and `git log --oneline -15` to see what changed since the last session.
2. Read `docs/project/PROGRESS.md` and the current task file.
3. Do not redo tasks marked COMPLETE; verify one only if the code contradicts its status.
4. Unfinished, IN_PROGRESS or BLOCKED tasks from earlier sessions come first, before new work.
5. At the end of every task, update PROGRESS.md and commit the code and planning files together
   (the approval rule in §9 still applies).

## 1. Project overview

Persian (RTL) web frontend for NetBime24 sales-agent recruitment (package
`netbime24-registration-recruitment-core`): mobile + OTP login → multi-step registration
(identity, contact, education, employment, optional referral) → recruitment dashboard (Moarefe and
Interview scheduling; Documents and Contract are «بزودی»). Existing users skip registration.
Backend: `https://api.ramatest.ir`. **Swagger (https://api.ramatest.ir/swagger/index.html) is the
source of truth** for endpoints, methods, schemas and auth. The client (کارفرما) deploys and runs
the project on their own server. Deadline: **2026-10-03**.

Talk to the user (Atefe) in **Persian**. Code, comments and docs are in English; UI text is Persian.

## 2. Architecture

- **HTML-first.** Page structure and Persian copy live in HTML `<template>` elements; JS clones
  them via `js/html.js` (`cloneTemplate`, `mountTemplate`, `readTextTemplate`, `escapeHtml`,
  `safeHref`). No `innerHTML =`, no `insertAdjacentHTML`, no large HTML template literals in JS
  (enforced by `qa/verify-html-first-architecture.mjs`).
- **Pages.** `index.html` + `js/app.js` = login and registration (view state in `js/state.js`,
  persisted to sessionStorage). `pages/moarefe/` and `pages/interview/` = dashboard pages (html, js,
  css, `*-state.js` each). Routes: `shared/dashboard/app-routes.js`.
- **Web Components** for the shell: `<netbime-header>` (`shared/dashboard/header.js`),
  `<netbime-sidebar>` (`shared/dashboard/sidebar.js`).
- **API layer.** `js/api.js` chooses the implementation from `js/api/config.js`:
  `API_MODE = "mock"` → `js/api/mock-api.js` (datasets in `js/mocks/`); `"real"` →
  `js/api/real-api.js`, wrapped by the **TEMPORARY** browser simulations
  `temporary-registration.js` / `temporary-session.js` / `temporary-appointments.js`, switched by
  `MOCK_REGISTRATION_SUBMIT` / `MOCK_SESSION` / `MOCK_APPOINTMENT_FLOW`. Missing backend methods in
  `real-api.js` return `API_NOT_CONFIGURED` (`unconfigured`). The only transport is
  `js/api/http.js`; errors are normalized in `js/api/errors.js`. API functions resolve to
  `{ success: true, … }` or `{ success: false, code, message, status, details, fieldErrors }` and
  never throw.
- **Backend auth — two modes** (the comments in `config.js` and `proxy/*` are authoritative):
  - *Direct mode* — **current, decided** (D-017, 2026-09-30: the client's server cannot run the
    Node proxy yet): `BROWSER_TOKEN = true`, `API_BASE_URL = "https://api.ramatest.ir/api"`; the
    browser requests tokens (`js/api/auth-token.js`) with the key in git-ignored
    `js/api/private-key.js`, which anyone can read — accepted risk, so key rotation (SEC-05) stays
    top priority. Server-side OTP limiting is a backend/IIS item (OD-2).
  - *Proxy mode*: `API_BASE_URL = "/api"`, `BROWSER_TOKEN = false`; `proxy/server.js` adds the
    token server-side from `NETBIME_PRIVATE_KEY`, blocks `/api/auth/token`, serves allow-listed
    static files; IIS/iisnode via `proxy/iis-web.config` + `proxy/iisnode-entry.cjs`.
  - Either way: **one fresh Bearer token per request** (tokens are single-use), never cached,
    stored or logged.
- **User session** = backend HttpOnly cookie set by OTP verify. The frontend never reads or stores
  cookies. `CROSS_ORIGIN_COOKIES = false` because the backend sends no
  `Access-Control-Allow-Credentials`; `http.js` retries once without cookies if blocked.
- **Storage keys** are centralized in `js/storage-keys.js`. Keep existing key names so live
  sessions stay valid.

## 3. Repository structure

| Path | Responsibility |
| --- | --- |
| `index.html`, `js/app.js`, `js/register.js`, `js/registration-*.js` | Login, OTP, registration steps |
| `js/api.js`, `js/api/` | API selection, config flags, transport, real/mock/temporary implementations |
| `js/validation.js`, `js/otp-limit.js`, `js/jalali.js`, `js/persian-date-picker.js`, `js/iran-locations.js`, `js/iran-holidays.js`, `js/searchable-combobox.js` | Form logic, OTP limit, Jalali calendar, provinces/cities, holidays (runtime import from `https://esm.sh`) |
| `js/mocks/` | Offline datasets for `API_MODE = "mock"` and QA |
| `pages/moarefe/`, `pages/interview/` | Dashboard pages |
| `shared/dashboard/` | Shell, header, sidebar, access control, `/me/context` loading, routes |
| `shared/recruitment/` | Stages, appointment scheduler/approval, page state and feedback |
| `shared/i18n/fa-format.js`, `shared/notifications/` | Persian number/date formatting, notification text |
| `css/`, `assets/` (fonts, icons, images), `shared/assets/` | Styles and static assets |
| `proxy/` | Optional Node proxy + IIS/iisnode config; `.env.example` is the env template |
| `qa/` | Static QA scripts (`npm test`) |
| `design/` | SVG design references (`Login Design.svg`, `مراحل.svg`, `هدر.svg`); not deployed |
| `docs/project/` | Planning system (see §10–11); not deployed |

## 4. Technology stack

Plain HTML + vanilla JavaScript ES modules (`"type": "module"`) + plain CSS. No framework,
bundler, TypeScript or npm runtime dependencies (`package-lock.json` has none). IRANSansX TTF
fonts (`css/typography.css`). Node.js ≥ 20 only for `qa/*.mjs` and the zero-dependency proxy.

## 5. Commands (all exist in `package.json`)

| Purpose | Command |
| --- | --- |
| Dev server (proxy mode) | `npm run dev` → `node proxy/server.js` on http://127.0.0.1:5510. Refuses to start without `NETBIME_PRIVATE_KEY` (env or git-ignored `proxy/.env`). Live Server on :5500 cannot reach the API in proxy mode. |
| Direct mode locally | Any static server on the repo root (no script exists). |
| All tests | `npm test` (= `test:all`) |
| Single suites | `npm run test:flow`, `test:enhancements`, `test:assets`, `test:modules`, `test:architecture`, `test:syntax` |
| Lint / format | **None configured.** Match the surrounding style by hand; do not add tools without approval. |
| Type check | **None** (plain JS). `npm run test:syntax` checks syntax. |
| Build | **None** — files are served as-is. |
| Deploy | **No deploy script.** Copy the deployable files (§8) to the server; IIS notes in `proxy/iis-web.config`. |

Note: `test:all` chains with `&&`, so it stops at the first failing script — run the remaining
`test:*` scripts individually to see every result (task QA-03 fixes this).

## 6. Coding rules

- ES modules, named exports, relative imports **with `.js`**, no globals.
- 2-space indentation, double quotes, semicolons, `const` and arrow functions, `Object.freeze` for
  constant maps/objects.
- Small focused modules. Comments only where behavior is non-obvious (TEMPORARY code, backend
  quirks, Swagger mismatches).
- New UI markup and Persian copy go into HTML `<template>`s, not JS strings.
- Persian digits/dates via `shared/i18n/fa-format.js`, not ad hoc.
- Map Swagger DTOs explicitly in `real-api.js` (DTOs are `additionalProperties: false` — pick
  fields, never spread unknown objects into request bodies).
- Accessibility: semantic HTML, `aria-*`, `role="status"` live regions, keyboard support, RTL.
- Responsive: no overflow at 80–200 % zoom, 1920×1080, 1366×768, mobile portrait/landscape.
- Do not rewrite working code unnecessarily; prefer small, reversible changes that follow
  existing patterns. Inspect unfamiliar files before changing them.

## 7. Testing rules

- Tests live in `qa/` as plain Node `.mjs` static checks using the existing pattern:
  `check(name, condition, detail)` collecting failures, printing `PASS: N …` or `FAIL: x/N …` and
  exiting non-zero on failure. No test framework.
- New behavior gets a check in the matching `qa/verify-*.mjs`, or a new script wired into
  `test:all` in `package.json`.
- Baseline (2026-09-30): everything passes except 2 known failures in `test:flow`
  (`sidebar keeps Moarefe/Interview navigable`, task QA-02). Never add new failures.
- Before calling a task complete: `npm test` (+ individual scripts while `&&` hides later ones),
  the task's acceptance criteria, a manual browser check for UI changes at the sizes in §6, and
  for API changes a check against Swagger and — when possible — the real backend.

## 8. Important constraints

- **Secrets.** Never print, log, commit or copy `proxy/.env`, `js/api/private-key.js` or the
  source `*.zip` (it contains both). Never log tokens, cookies or request bodies. No new secret
  may enter a browser-served file; direct mode is the only, documented, temporary exception.
- **`js/api/config.js`**: ask the user before editing it (mode and `MOCK_*` flags change
  production behavior).
- **TEMPORARY code** (`MOCK_*` flags, `js/api/temporary-*.js`): remove only after the real
  endpoint is verified against the backend; then delete the module and update QA.
- **Swagger contract** first. Observed backend behavior that Swagger does not document goes into
  §12 below, not only into code comments.
- **No new dependencies**, framework, bundler, TypeScript, linter or formatter without a decision
  in `docs/project/DECISIONS.md` and the user's approval.
- **Client deployment.** Every change must stay deployable by the client on their own server: no
  environment values hidden in code, every config change documented, deployment impact (files, env
  vars, web.config) noted in the task file.
- **Deployable files only:** `index.html`, `assets/`, `css/`, `js/`, `pages/`, `shared/`, and in
  proxy mode `proxy/` without `.env` (details per mode: DECISIONS.md D-015). Never deploy
  `design/`, `qa/`, `docs/`, Markdown files, `package*.json`, `.env` or `*.zip`.
- Production needs HTTPS, a rate limit on `/api/auth/otp/request` (the client-side limit in
  `js/otp-limit.js` is bypassable), and a CSP that allows `https://esm.sh`.

## 9. Git and change management

- Remote: `origin` = https://github.com/AliKeramattii/netbime24-project (empty as of 2026-09-30;
  source came from a zip). Local repo on `main`, nothing committed yet.
- Before **every** commit (especially the first): `git status --ignored` and confirm
  `proxy/.env`, `js/api/private-key.js` and `*.zip` are ignored and not staged.
- Work on feature branches (e.g. `fix/qa-02-sidebar-checks`); small focused commits with clear
  messages referencing the task ID.
- **No commit, push, merge or PR without the user's approval.**
- Update the planning files in the same change as the code they describe.

## 10. Project planning workflow (non-trivial tasks)

1. Read this file. 2. Read `docs/project/PROGRESS.md` (and ROADMAP.md). 3. Identify the current
phase. 4. Identify the current task and open its task file + dependencies. 5. Inspect the relevant
code before proposing changes. 6. Plan complex work (flag ambiguities before irreversible
changes). 7. Implement the smallest appropriate change. 8. Run tests and validation (§7).
9. Update progress: task status in PLAN.md **and** the task file, PROGRESS.md, phase/overall
progress, ROADMAP.md if a phase changes, DECISIONS.md for decisions, deployment impact in the task
file. 10. Identify the next task. 11. Report in Persian: انجام‌شده، باقی‌مانده، موانع، اثر روی
استقرار، اقدام پیشنهادی بعدی.

Never mark a task COMPLETE because code was written — only after its acceptance criteria and
tests pass. Keep the planning files consistent with the actual repository state.

## 11. Planning files (`docs/project/`)

| File | Use |
| --- | --- |
| `PROGRESS.md` | **Single source of truth for the current position**: current phase/milestone/task, progress, blockers (internal / backend / user-client), deployment readiness, next action, last updated. |
| `ROADMAP.md` | Phases with status, deadline, estimate, progress (method: completed ÷ planned tasks). |
| `PLAN.md` | All milestones and tasks (ID, status, priority, estimate, deadline, dependencies incl. `EXTERNAL:`, acceptance criteria). |
| `DECISIONS.md` | Dated decisions (D-xxx), open decisions (OD-x), migration discrepancies, plan change log. |
| `tasks/phase-XX/<ID>-*.md` | Detail for in-progress, blocked and next-up tasks: notes, validation, deployment impact. |

Requests:
- «کجای کار هستیم؟» / "Where are we?" / "Continue" → read CLAUDE.md, ROADMAP.md, PROGRESS.md, the
  current task file and its dependencies; answer in Persian with: current phase, milestone, task,
  completed, remaining, blockers, deadline (days left), estimated remaining effort, next action.
- «قدم بعدی چیست؟» / "What's next?" → PROGRESS.md › Next Action (must be concrete).
- "What's blocking us?" → PROGRESS.md › Blockers. "How much remains?" → progress + remaining hours.
- "Mark this task complete" → validate first (§7), then do step 9 of §10.
- "Are we ready to deploy?" → PROGRESS.md › Deployment Readiness, checked against the repo.
- "Break this feature into tasks" / "Plan the next phase" → add one-session tasks to PLAN.md.
- Requirement changes → never rewrite history: update/add/cancel tasks (CANCELLED stays listed)
  and add a dated entry to the plan change log in DECISIONS.md.

## 12. Backend behavior not documented in Swagger (observed)

- Swagger has 6 endpoints: `POST /api/auth/token`, `POST /api/auth/otp/request`,
  `POST /api/auth/otp/verify`, `GET /api/me/context`, `GET /api/referrals/managers/{code}`,
  `POST /api/registration`. No logout, withdraw, appointment or recruitment-status endpoint.
- Every route except `/api/auth/token` needs a Bearer token; each token is valid for **one** request.
- No `Access-Control-Allow-Credentials` (checked 2026-09-30) → no session cookie cross-origin;
  `/api/me/context` then answers 401.
- Referral: `200 { success, manager: { id, firstName, lastName, displayName, referralCode } }`;
  unknown → `404 { success: false, code: "REFERRAL_NOT_FOUND", message }`. Test code `1001`.
- `POST /api/registration`: 200 with no body; without the OTP session cookie →
  `401 REGISTRATION_SESSION_REQUIRED`. Fails on the backend as of 2026-09-30.
- `contact.postalCode` is required; the backend reports one validation error at a time.
  `EmploymentRecordDto.startYear/startMonth` are non-nullable ints.
- Error formats: see `js/api/errors.js`.
- First request after idle can take ~20 s (2026-09-30) → `REQUEST_TIMEOUT_MS = 30000`.
- curl E2E: fresh token per request; keep cookies between OTP verify and later calls
  (`-c`/`-b cookies.txt`).
