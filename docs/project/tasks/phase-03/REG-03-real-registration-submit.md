# REG-03 — Switch registration to the real backend
Status: BLOCKED (waiting on BACKEND)
Priority: CRITICAL
Estimate: 1 hour
Deadline: TBD (external)
Dependencies:
- EXTERNAL: BACKEND accepts `POST /api/registration`
- Session cookie reachable: proxy mode, or API-06

## Objective
Registrations are saved in the backend database; no local-only completion.

## Acceptance Criteria
- A real registration returns 200 and appears in `/api/me/context`.
- `MOCK_REGISTRATION_SUBMIT = false`; `js/api/temporary-registration.js` deleted; `js/api.js` updated.
- 400 field errors and 401 re-verify still work.
- `npm test` green (update QA scripts that reference the temporary module).

## Implementation Notes
`buildRegistrationRequest` in `real-api.js` stays the single payload builder.

## Validation
QA-04 new-user run.

## Deployment Impact
One file fewer in `js/api/`; client redeploys `js/`.
