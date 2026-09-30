# APPT-02 — Implement Moarefe appointment methods in `js/api/real-api.js`
Status: BLOCKED (waiting on BACKEND)
Priority: HIGH
Estimate: 3 hours
Deadline: TBD (external)
Dependencies:
- EXTERNAL: BACKEND `GET /api/appointments/availability`, `POST /api/appointments/reservations` (+ approval status) in Swagger

## Objective
Moarefe scheduling uses real availability and reservations instead of `temporary-appointments.js`.

## Acceptance Criteria
- `getAvailableAppointments` and `submitAppointmentRequest` implemented per Swagger.
- Reservation persists (visible from another browser); approval status read from the backend
  (auto-approve today, admin approval later without major frontend change — D-006).
- Persian errors for taken slot, network, 401.
- `npm test` green.

## Implementation Notes
Keep the frontend contract used by `shared/recruitment/appointment-scheduler.js`; map in real-api.js.

## Validation
Browser run on the Moarefe page; QA scripts.

## Deployment Impact
Redeploy `js/`.
