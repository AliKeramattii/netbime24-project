# DOC-03 — Send the backend team a written request list
Status: NOT_STARTED
Priority: HIGH
Estimate: 1 hour
Deadline: 2026-09-30
Dependencies:
- none (user sends it)

## Objective
Start the backend lead time today; most of Phase 3 waits on these items.

## Acceptance Criteria
- A Persian message (ready to paste) lists each item, why it is needed, and the task it unblocks:
  1. Fix `POST /api/registration` (REG-03).
  2. `POST /api/auth/logout` clearing the session cookie (API-07).
  3. `POST /api/recruitment/withdraw` (API-09).
  4. `GET /api/appointments/availability`, `POST /api/appointments/reservations` + approval status (APPT-02/03).
  5. Direct mode only: `Access-Control-Allow-Credentials: true` with an explicit origin (API-06).
  6. Rotate the privateKey; confirm the old one is revoked (SEC-05).
  7. Server-side OTP rate limit (OD-2).
  8. Swagger: referral 200 schema, token lifetime, error codes, Bearer security scheme.
- The user has confirmed it was sent (date recorded here).

## Implementation Notes
Do not include the key or any secret in the message.

## Validation
User confirmation.

## Deployment Impact
None.
