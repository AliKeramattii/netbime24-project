# QA-02 — Fix the 2 failing sidebar checks in `qa/verify-retained-flow.mjs`
Status: NOT_STARTED
Priority: HIGH
Estimate: 0.5 hours
Deadline: 2026-09-30
Dependencies:
- none

## Objective
`npm run test:flow` passes 63/63 so `npm test` is a trustworthy gate again.

## Acceptance Criteria
- `npm run test:flow` prints `PASS` with 63 checks.
- The check still fails if the Moarefe/Interview sublinks are removed or disabled (verify by a temporary edit).
- Sidebar links still navigate between the two pages in the browser.
- All other QA scripts still pass.

## Implementation Notes
Failing checks (lines 116–121) look for the literal string
`href="../moarefe/moarefe.html">جلسه معارفه</a>`, but the pages (moarefe.html:664, interview.html:670)
are formatted as `href="../moarefe/moarefe.html"\n  >جلسه معارفه</a\n>`. The links are fine; the
check is brittle. Prefer a whitespace-tolerant regex in the test over reformatting the HTML
(other formatting tools would re-break it).

## Validation
`npm run test:flow`, then run every other `test:*` script.

## Deployment Impact
None (QA script only; `qa/` is not deployed).
