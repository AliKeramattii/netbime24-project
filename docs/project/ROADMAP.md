# Roadmap — NetBime24 Sales Organization Portal

Project deadline: **2026-10-03** (set by the user on 2026-09-30). Details per task: PLAN.md.
Current position: PROGRESS.md.

**Progress method:** completed tasks ÷ planned tasks (task count). Effort-weighting is not used
because the Phase 1 tasks were done before the planning system existed and have no recorded
estimates. Remaining effort is still tracked in estimated hours.

| # | Phase | Status | Deadline | Est. remaining | Progress |
| --- | --- | --- | --- | --- | --- |
| 1 | Foundation & Core Frontend | COMPLETE | ≤ 2026-09-30 | 0 h | 100 % (17/17) |
| 2 | Security & Deployment Architecture | IN_PROGRESS | 2026-10-01 | 4.75 h | 22 % (2/9) |
| 3 | Backend Integration & End-to-End | BLOCKED | 2026-10-02 (internal) / TBD (backend) | 13.5 h | 10 % (1/10) |
| 4 | Production Hardening | NOT_STARTED | 2026-10-02 | 5.5 h | 0 % (0/3; SEC-07 cancelled) |
| 5 | Client Handover & Deployment | NOT_STARTED | 2026-10-03 | 10 h | 0 % (0/6) |
| 6 | Remaining Recruitment Stages | NOT_STARTED | TBD (after 2026-10-03) | TBD | 0 % (0/3) |

Overall: **20 / 48 tasks = 42 %**. Deadline scope (phases 1–5): **20 / 45 = 44 %**.
CANCELLED tasks stay listed in PLAN.md but are not counted as planned.

---

## Phase 1 — Foundation & Core Frontend
- Objective: working Persian frontend with real OTP, registration, referral, dashboard and scheduling UI.
- Status: COMPLETE · Deadline: ≤ 2026-09-30 · Effort: not recorded · Progress: 100 %
- Dependencies: Swagger contract.
- Deliverables: API layer, proxy + direct mode, OTP flow, registration, referral, dashboard shell,
  Moarefe/Interview UI on simulation, UI design pass, QA scripts.

## Phase 2 — Security & Deployment Architecture
- Objective: pick the backend-auth mode for the client's server, stop exposing the key, get QA green.
- Status: IN_PROGRESS · Deadline: 2026-10-01 · Estimate: 4.75 h · Progress: 22 %
- Dependencies: CLIENT server details, BACKEND key rotation. (Mode decided: direct, D-017.)
- Deliverables: recorded mode decision, rotated key, `config.js` in the chosen mode, `npm test` green,
  backend request list sent.

## Phase 3 — Backend Integration & End-to-End
- Objective: prove the real flow with a real phone and replace the `MOCK_*` simulations.
- Status: BLOCKED (7 of 10 tasks wait on the backend; AUTH-LOGOUT-LOCAL done) · Deadline: 2026-10-02 for QA-04; TBD for backend items · Estimate: 13.5 h (12 h backend-dependent) · Progress: 10 %
- Dependencies: BACKEND (registration fix, logout, withdraw, appointments, CORS credentials), USER phone number.
- Deliverables: E2E report; real registration, logout, withdraw, appointments; temporary modules deleted.

## Phase 4 — Production Hardening
- Objective: server-side OTP limit, CSP/security headers, lighter fonts, release regression.
- Status: NOT_STARTED · Deadline: 2026-10-02 (QA-05: 2026-10-03) · Estimate: 5.5 h · Progress: 0 %
- Dependencies: Phase 2 decision (SEC-03, done: direct), OD-2. SEC-07 cancelled (no proxy).
- Deliverables: rate limit (proxy mode), `web.config` headers, WOFF2 fonts, recorded QA pass.

## Phase 5 — Client Handover & Deployment
- Objective: the client can install, configure and run the project on their own server.
- Status: NOT_STARTED · Deadline: 2026-10-03 · Estimate: 10 h · Progress: 0 %
- Dependencies: SEC-03, SEC-06; CLIENT server access; OD-3.
- Deliverables: deploy file list, `npm run package`, deployment guide, configuration reference,
  smoke test on the client's server, signed-off handover with known limitations.

## Phase 6 — Remaining Recruitment Stages
- Objective: Documents, Contract and other dashboard sections.
- Status: NOT_STARTED · Deadline: TBD · Estimate: TBD · Progress: 0 %
- Dependencies: CLIENT designs, BACKEND endpoints. Out of the 2026-10-03 scope.
- Deliverables: to be planned when designs exist.
