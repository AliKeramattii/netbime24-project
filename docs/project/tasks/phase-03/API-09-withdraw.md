# API-09 — Implement `withdrawRecruitment` in `js/api/real-api.js`
Status: BLOCKED (waiting on BACKEND)
Priority: MEDIUM
Estimate: 1.5 hours
Deadline: TBD (external)
Dependencies:
- EXTERNAL: BACKEND `POST /api/recruitment/withdraw` in Swagger

## Objective
The withdraw button on Moarefe/Interview pages (`[data-process-withdraw]`) works for real.

## Acceptance Criteria
- Replaces `unconfigured`; sent with credentials.
- `/api/me/context` reflects the withdrawal; UI shows the Persian confirmation.
- `npm test` green.

## Validation
Browser run with a test user.

## Deployment Impact
Redeploy `js/`.
