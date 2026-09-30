# SEC-05 — Rotate the backend privateKey
Status: BLOCKED (waiting on BACKEND)
Priority: CRITICAL
Estimate: 0.5 hours (our side)
Deadline: 2026-10-01
Dependencies:
- SEC-03
- EXTERNAL: BACKEND issues a new key and revokes the old one

## Objective
The key that was exposed (browser in direct mode, the source zip, earlier builds) stops working.

## Acceptance Criteria
- `POST /api/auth/token` with the old key is rejected.
- Proxy mode: new key only in the server environment (`NETBIME_PRIVATE_KEY`) / local `proxy/.env`.
- Direct mode: new key only in the deployed `js/api/private-key.js` (still public — record that).
- The key never appears in git history, logs, docs or chat.

## Implementation Notes
Never print `proxy/.env` or `private-key.js`. The source zip also contains the old key — it is
git-ignored (`*.zip`); ask the user to limit who has it.

## Validation
Token request with old key fails; full login works with the new key.

## Deployment Impact
Client sets the new key in the server environment (proxy) or uploads the new `private-key.js` (direct).
