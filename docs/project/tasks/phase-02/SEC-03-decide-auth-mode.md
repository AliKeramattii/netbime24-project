# SEC-03 — Decide proxy mode vs direct mode for the client's server
Status: COMPLETE (2026-09-30) — direct mode for now (D-017)
Priority: CRITICAL
Estimate: 0.5 hours
Deadline: 2026-10-01
Dependencies:
- SEC-04
- EXTERNAL: USER/CLIENT decision

## Objective
One recorded auth mode that the config, security and deployment tasks all build on.

## Options
| | Proxy mode (`proxy/server.js`) | Direct mode (current `config.js`) |
| --- | --- | --- |
| Backend key | Server environment only | Public in `js/api/private-key.js` |
| Session cookie | Works (same origin) | Needs backend CORS credentials (API-06) |
| Server needs | Node ≥ 20 (Plesk Node.js or iisnode) | Static hosting only |
| OTP rate limit | Can be in the proxy (SEC-07) | Backend only |
| Registration/logout real | As soon as backend endpoints work | Also needs API-06 |

Recommendation: proxy mode if the client's server can run Node (SEC-04).

## Acceptance Criteria
- Decision + date + reason recorded as a new D-entry in DECISIONS.md; OD-1 closed.
- If direct mode: the user's explicit acceptance of the public key risk is recorded.
- Dependent tasks updated (SEC-06, SEC-07 or its cancellation, API-06 or its cancellation).

## Implementation Notes
`plan.md` described proxy mode as live; `config.js` (2026-09-30) says direct mode by the owner's
decision because ramatest.ir cannot run Node. The client's server may differ from ramatest.ir.

## Result (2026-09-30)
- The user (Atefe) chose **direct mode for now**: the client's server cannot run the Node proxy yet.
- Risk accepted explicitly by the user: the key stays readable in the browser; SEC-05 stays top priority.
- Recorded as D-017; OD-1 removed from the open decisions.
- Dependent tasks: SEC-07 CANCELLED; API-06 required; SEC-06 = verify direct config + document risk;
  SEC-09 CSP allows `https://api.ramatest.ir`; SEC-04 still needed for the guide.
- `config.js` already in direct mode with a matching comment; no code change.

## Validation
DECISIONS.md, PLAN.md and `config.js` comments agree.

## Deployment Impact
Determines the whole deploy package (D-015), env vars (`NETBIME_PRIVATE_KEY`, `BACKEND_URL`,
`HOST`, `PORT`, `STATIC_ROOT`, `UPSTREAM_TIMEOUT_MS`) and web.config.
