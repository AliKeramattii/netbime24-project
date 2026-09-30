# Progress — current position

**Last Updated:** 2026-09-30 (first push to GitHub; OD-1 closed: direct mode, D-017; local logout, D-018)

## Current Phase
Phase 2 — Security & Deployment Architecture (IN_PROGRESS, deadline 2026-10-01)

## Current Milestone
M2.3 — QA baseline green (deadline 2026-09-30). M2.1 mode decision done (direct, D-017).

## Current Task
QA-02 — Fix the 2 failing sidebar checks → [task file](tasks/phase-02/QA-02-fix-sidebar-checks.md)

## Repository
- GitHub: https://github.com/AliKeramattii/netbime24-project (public), default branch `main`.
- First push 2026-09-30 by `atefekalamati` (collaborator): `868b873` initial import, `19d9038`
  AUTH-LOGOUT-LOCAL. Verified: remote `main` = local HEAD; `proxy/.env`, `js/api/private-key.js`
  and the source zip are not in the repository.
- Local only, never commit: `js/api/config.js` is temporarily in proxy mode for local OTP testing
  (`npm run dev`, http://127.0.0.1:5510) because the backend CORS allows only `https://ramatest.ir`.

## Current Status
Frontend feature work of Phase 1 is complete. **Direct mode** is the decided mode for now (D-017,
2026-09-30); the backend key is public in the browser (accepted risk → SEC-05 top priority), three temporary browser simulations are on (`MOCK_*`), and
`npm test` fails (2 checks). Planning system created today; nothing committed yet.

`npm test` on 2026-09-30 (Node v24.19.0):
- `test:flow` — FAIL 2/63 (`sidebar keeps Moarefe navigable`, `sidebar keeps Interview navigable`;
  the links exist but the markup wraps `>جلسه معارفه</a\n>`, which the string check misses).
- Because `test:all` chains with `&&`, the rest did not run; run separately they all PASS:
  `test:enhancements` 45, `test:assets` 102, `test:modules` 159, `test:architecture` 204, `test:syntax` 65,
  `test:logout` 37 (new, AUTH-LOGOUT-LOCAL).

## Overall Progress
Method: completed tasks ÷ planned tasks (see ROADMAP.md).
- Overall: 20 / 48 = **42 %** (SEC-07 cancelled, not counted; AUTH-LOGOUT-LOCAL added and done)
- Deadline scope (phases 1–5): 20 / 45 = **44 %**
- Estimated remaining effort (phases 2–5): **33.75 h** (estimates, not actuals), of which
  - 19.25 h internal work (needs only a phone number from the user),
  - 2.5 h needs the client (server access, sign-off),
  - 12 h waits on the backend team.

## Phase Progress
| Phase | Progress | Status |
| --- | --- | --- |
| 1 Foundation & Core Frontend | 17/17 = 100 % | COMPLETE |
| 2 Security & Deployment Architecture | 2/9 = 22 % | IN_PROGRESS |
| 3 Backend Integration & E2E | 1/10 = 10 % | BLOCKED |
| 4 Production Hardening | 0/3 = 0 % | NOT_STARTED |
| 5 Client Handover & Deployment | 0/6 = 0 % | NOT_STARTED |
| 6 Remaining Recruitment Stages | 0/3 = 0 % | NOT_STARTED (out of scope) |

## Schedule
- Today 2026-09-30; deadline 2026-10-03 → **3 days remaining**.
- Capacity (ASSUMPTION until the user confirms, OD-4): 1 developer + Claude Code, ~8 h/day →
  ~24 h for 10-01…10-03 (+ what is left of today).
- Needed for the deadline scope without backend items: 19.25 h internal + 2.5 h client = 21.75 h.
- Verdict: **AT RISK** — achievable with little slack, only if the client's server is reachable
  on 2026-10-03.

### Will be ready by 2026-10-03 (if the above holds)
Mode decision applied, QA green, real-phone E2E report, CSP/headers, WOFF2 fonts, rate limit
(proxy mode), deploy package + script, deployment guide, configuration reference, smoke test.

### Will NOT be ready by 2026-10-03 unless the backend delivers by 2026-10-01
Real registration saving (REG-03), logout (API-07/08), appointments (APPT-02..04), withdraw
(API-09), cross-origin cookies (API-06), key rotation (SEC-05). Documents/Contract (Phase 6) are
out of scope.

## Completed Recently
- 2026-09-30 — Repository pushed to GitHub (`main`, public); secrets verified absent.
- 2026-09-30 — AUTH-LOGOUT-LOCAL: logout works without an API (local session clear, D-018); QA + browser-tested.
- 2026-09-30 — SEC-03: direct mode decided by the user (D-017); OD-1 closed; SEC-07 cancelled.
- 2026-09-30 — DOC-01: planning system + CLAUDE.md created; `plan.md` migrated and deleted.
- 2026-09-30 — SEC-01 proxy, SEC-02 direct mode, API-05 temporary simulations (per code).

## Remaining Work
Phase 2: SEC-04, DOC-03, SEC-05, SEC-06, QA-02, QA-03, DOC-02.
Phase 3: QA-04, API-06, REG-03, API-07, API-08, APPT-02, APPT-03, APPT-04, API-09.
Phase 4: SEC-09, UI-05, QA-05 (SEC-07 cancelled). Phase 5: DEPLOY-01 … DEPLOY-06. Phase 6: UI-06, UI-07, DASH-03.

## Blockers

### Internal
- `npm test` red (QA-02) and it hides later failures (QA-03).
- The backend privateKey is readable by anyone in the browser (direct mode) and was also shipped
  inside the source zip → rotate (SEC-05) and prefer proxy mode.

### Waiting on backend
- `POST /api/registration` fails → registrations are completed locally and **not saved** (REG-03).
- No `Access-Control-Allow-Credentials` → no session cookie in direct mode (API-06).
- Missing endpoints: `POST /api/auth/logout` (API-07), `POST /api/recruitment/withdraw` (API-09),
  appointment availability/reservations (APPT-02/03).
- Key rotation (SEC-05); server-side OTP limit if direct mode (OD-2).
- Swagger lacks: referral 200 schema, token lifetime, error codes, Bearer security scheme.

### Waiting on user / client decision
- SEC-04: client server details (OS, web server, HTTPS, who deploys) for the guide.
- OD-3: may the client go live while `MOCK_*` simulations are on?
- OD-4: pace and hours per day.
- QA-04: a real phone number for the E2E test.

## Deployment Readiness — NOT READY
1. Direct mode (D-017): the key is public in the browser until rotated/replaced (SEC-05/06).
2. Registrations are not saved by the backend yet (REG-03, OD-3).
3. Logout is local only (backend cookie not cleared, API-07); withdraw and appointments are browser simulations (Phase 3).
4. No deployment guide, config reference or package script (DEPLOY-01…04).
5. No server-side OTP limit (backend/IIS, OD-2), no CSP (SEC-09); HTTPS on the client server unconfirmed.
6. `npm test` not green (QA-02).
7. Not yet smoke-tested or accepted on the client's server (DEPLOY-05/06).

## Next Action
Make the two sidebar checks in `qa/verify-retained-flow.mjs` (lines 116–121) whitespace-tolerant,
so they match the formatted `<a class="sidebar-sublink" href="../moarefe/moarefe.html">جلسه معارفه</a>`
markup in `pages/moarefe/moarefe.html` and `pages/interview/interview.html`, then run
`npm run test:flow` until it prints PASS 63/63 (QA-02). In parallel, send the backend request list (DOC-03), incl. key rotation and CORS credentials.
