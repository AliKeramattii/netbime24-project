# SEC-04 — Confirm whether the client's server can run Node.js
Status: BLOCKED (waiting on CLIENT server details)
Priority: CRITICAL
Estimate: 1 hour
Deadline: 2026-10-01
Dependencies:
- EXTERNAL: CLIENT

## Objective
Know the target server well enough to write the guide (DEPLOY-03) and to plan a later switch to
proxy mode. (The mode itself was decided without it: direct for now, D-017.)

## Acceptance Criteria
Recorded here: OS; web server (IIS/Plesk, Nginx, Apache); Node.js ≥ 20 available (Plesk Node.js
extension or iisnode + URL Rewrite); HTTPS certificate; can environment variables be set; domain;
who deploys and how (FTP, Plesk file manager, git).

## Implementation Notes
Use `proxy/iis-web.config` + `proxy/iisnode-entry.cjs` for IIS; `STATIC_ROOT=` empty when IIS
serves static files. ramatest.ir (Plesk/IIS) reportedly could not run the proxy — ask why.

## Validation
Answers from the client/user, recorded with date.

## Deployment Impact
Input for DEPLOY-03.
