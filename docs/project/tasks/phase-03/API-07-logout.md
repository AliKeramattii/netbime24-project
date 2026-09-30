# API-07 — Implement `logout` in `js/api/real-api.js`
Status: BLOCKED (waiting on BACKEND)
Priority: HIGH
Estimate: 1.5 hours
Deadline: TBD (external)
Dependencies:
- EXTERNAL: BACKEND `POST /api/auth/logout` in Swagger

## Objective
Real logout: the HttpOnly session cookie is cleared by the backend (JavaScript cannot clear it).

## Acceptance Criteria
- `logout` calls `POST /api/auth/logout` with credentials, then `clearLocalSession()`; replaces the
  TEMPORARY `localLogout` from AUTH-LOGOUT-LOCAL (D-018) and removes its TEMPORARY comments.
- After logout `/api/me/context` → 401 and the UI returns to login (`app-shell.js`, `js/app.js`).
- Failure shows the existing Persian error; `npm test` green.
- Follow-up API-08 (remove `MOCK_SESSION`) unblocked.

## Validation
Browser: login → logout → reload dashboard URL → redirected to login.

## Deployment Impact
Redeploy `js/`. None on server config.
