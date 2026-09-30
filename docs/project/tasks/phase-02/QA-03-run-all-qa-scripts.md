# QA-03 — Make `npm test` run every QA script and report all failures
Status: NOT_STARTED
Priority: MEDIUM
Estimate: 0.5 hours
Deadline: 2026-09-30
Dependencies:
- none

## Objective
One failing script must not hide the results of the others (on 2026-09-30 `test:flow` stopped the run).

## Acceptance Criteria
- `npm test` runs all 6 scripts and prints each result.
- Exit code is non-zero if any script fails, zero if all pass.
- No new npm dependencies; works on Windows and Linux (Node ≥ 20).

## Implementation Notes
Small runner, e.g. `qa/run-all.mjs`, that spawns each `qa/verify-*.mjs` with `process.execPath`
and aggregates exit codes; point `test`/`test:all` at it.

## Validation
Temporarily break one check → all scripts still run, exit code 1. Restore → exit code 0.

## Deployment Impact
None.
