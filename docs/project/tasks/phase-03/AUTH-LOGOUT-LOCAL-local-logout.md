# AUTH-LOGOUT-LOCAL — Logout without a backend endpoint (local session clear)
Status: COMPLETE (2026-09-30)
Priority: HIGH
Estimate: 1.5 hours
Deadline: 2026-09-30
Dependencies:
- none (replaced by API-07 when `POST /api/auth/logout` exists)

## Objective
The logout buttons (dashboard header profile menu, dashboard sidebar, profile menu on the
registration success screen) work without any API call, in every `MOCK_SESSION` setting.

## Acceptance Criteria
- Logout removes every session key from sessionStorage (`temporarySession`,
  `temporaryAppointments`, `registration`, `moarefe`, `interview` in `js/storage-keys.js`), clears
  the cached dashboard context and leaves with `location.replace` to `index.html`.
- `logout` in `js/api/real-api.js` is no longer `unconfigured`; it is the TEMPORARY local clear.
- The OTP send limit (localStorage) is kept.
- After logout, opening `pages/moarefe/moarefe.html` or `pages/interview/interview.html` directly
  (or pressing Back) shows the login page, not the previous user.
- QA check in `qa/`; `npm test` has no new failures.

## Implementation
- `js/local-session.js` (new, TEMPORARY): `LOCAL_SESSION_KEYS`, `clearLocalSession()`,
  `localLogout()`. No network.
- `js/api/real-api.js`: `logout: localLogout`. `temporary-session.js` no longer overrides `logout`.
- `shared/dashboard/app-shell.js` and `js/app.js`: after `api.logout()` → `invalidateDashboardContext()`,
  `clearLocalSession()` (also covers mock mode), `location.replace(APP_ROUTES.auth)`.
- `js/api/temporary-session.js`: without cross-origin cookies and without a session user the
  context is "signed out" immediately (previously a real `/me/context` call that can only fail;
  on origins the backend CORS does not allow, it showed a network error instead of the login page).
- `shared/dashboard/dashboard-context.js`: a dashboard page restored from the back-forward cache
  reloads, so Back after logout goes through the session check again.
- Limitation: the backend HttpOnly cookie (proxy mode / after API-06) is not cleared → API-07.

## Validation (2026-09-30)
- `npm run test:logout` PASS 37 (new `qa/verify-local-logout.mjs`, also chained in `test:all`);
  confirmed it fails when `logout: unconfigured` is restored or the signed-out shortcut is removed.
- Other suites: enhancements 45, assets 102, modules 159, architecture 204, syntax 65 PASS;
  `test:flow` still only the 2 known QA-02 failures.
- Browser (headless Chrome 152, 1366×768, static server, real mode as in `config.js`):
  - Moarefe → sidebar «خروج» → `index.html`, session keys removed, OTP limit kept, login form shown;
    direct open of `moarefe.html` → login; previous name not shown.
  - Interview → header profile menu «خروج» → same results; direct open of `interview.html` → login.
  - Back after logout → login, previous user not shown.
  - Registration success screen → profile menu «خروج» → login view; OTP limit kept. (The login
    page then saves its own empty state under `registration` — expected, no previous-user data.)
- No UI/CSS change, so the viewport matrix (CLAUDE.md §6) was not re-run.

## Deployment Impact
Redeploy `js/` and `shared/` (new file `js/local-session.js`). No server, env or web.config change.
