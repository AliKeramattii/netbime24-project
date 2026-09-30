# API-06 — Enable cross-origin cookies (direct mode only)
Status: BLOCKED (waiting on BACKEND)
Priority: HIGH
Estimate: 0.5 hours
Deadline: TBD (external)
Dependencies:
- SEC-03 = direct mode (decided 2026-09-30, D-017) — this task is required
- EXTERNAL: BACKEND answers with `Access-Control-Allow-Credentials: true` and an explicit `Access-Control-Allow-Origin` (not `*`); cookie `SameSite=None; Secure`

## Objective
Let the browser send the session cookie so `/api/me/context`, registration and logout work for real.

## Acceptance Criteria
- Preflight and response headers verified (date recorded here).
- `CROSS_ORIGIN_COOKIES = true` in `js/api/config.js`; `/api/me/context` answers 200 after OTP verify.
- No CORS errors in the console; `npm test` green.

## Implementation Notes
`http.js` already retries once without cookies if a credentialed request is blocked.

## Validation
Browser DevTools network tab on the deployed origin (HTTPS).

## Deployment Impact
The client's exact origin must be allow-listed by the backend.
