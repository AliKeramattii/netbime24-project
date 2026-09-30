# QA-04 — Manual E2E with a real phone number
Status: BLOCKED (waiting on USER: real phone number; SEC-06)
Priority: CRITICAL
Estimate: 2 hours
Deadline: 2026-10-02
Dependencies:
- SEC-06
- EXTERNAL: USER provides a phone that receives the OTP (one new, one existing user)

## Objective
Prove the real chain OTP request → verify → session → registration / dashboard in the chosen mode.

## Acceptance Criteria
- New-user run and existing-user run recorded below: date, mode, each step's HTTP status and result.
- Recorded whether the registration was really saved or completed locally (`MOCK_REGISTRATION_SUBMIT`).
- No token or key in localStorage, sessionStorage, URLs or console (proxy mode: no `/api/auth/token` call from the browser).
- Every failure becomes a new task in PLAN.md.

## Implementation Notes
Proxy: `npm run dev` → http://127.0.0.1:5510 (Live Server on :5500 cannot reach the API).
curl: fresh token per request; keep cookies with `-c`/`-b cookies.txt`. First call may take ~20 s.
Never paste the phone number or OTP into committed files — record masked (09xx…xx12).

## Validation
Results table in this file.

## Deployment Impact
None directly; findings may add tasks.
