# Cross-Agent Review Packet

## Purpose
- Prepare this packet before invoking an independent critic through `node harness/scripts/run-agent-review.mjs`.
- Keep the packet bounded and evidence-focused so the secondary reviewer does not need broad repository exploration.
- Store filled packets under an ignored artifact path such as `harness/artifacts/cross-agent-review/<review-id>-packet.md`.

## Review Metadata
- Review ID:
- Primary agent:
- Critic agent:
- Critic model:
- Execution plan:
- Target branch:
- Base branch:
- Runtime mode:

## User Intent
- Raw request:
- Explicit intent:
- Implicit or hidden intent:
- Desired user-observable outcome:
- Acceptance criteria:
- Constraints:
- Risks:
- Alternatives considered:
- Selected path:

## Scope
- In scope:
- Out of scope:
- Framework/override boundary decisions:

## Evidence
- Key changed files:
- Validation command:
- Validation result:
- Relevant report paths:
- Critic model evidence:
- Runtime or observability evidence:
- Security or permission notes:

## Review Questions
Ask the independent critic to check:
- Hidden assumptions or shallow intent interpretation.
- User-intent versus existing-pattern conflicts.
- Root-cause and adjacent failure-mode coverage.
- Framework/override boundary mistakes.
- Validator, test, ADR, and requirement traceability gaps.
- Security, destructive-operation, or external-write risk.
- Simpler alternatives that preserve the desired outcome.
- Whether the work is pushback-free for readiness: no `blockingFindings` and no `nonBlockingRisks`.

## Required Agent Output
The critic must return exactly one fenced JSON block:

```agent-review-json
{
  "status": "NO_BLOCKING_ISSUES",
  "blockingFindings": [],
  "nonBlockingRisks": [],
  "reviewedEvidence": [],
  "summary": ""
}
```

Allowed `status` values:
- `NO_BLOCKING_ISSUES`
- `BLOCKING_FINDINGS`

Each `blockingFindings` item is an object: `{"id": "<kebab-slug>", "novel": <true when the packet did not already flag the issue, false when it did>, "severity": "blocking", "finding": "<concise, grounded in the packet evidence>", "recommendation": "<actionable fix>"}`. The `novel` boolean is required — it feeds the cross-family decision-gate telemetry. Each `nonBlockingRisks` item may be a concise string or an object of the same shape.

For readiness, commit, push, publish, and completion claims, `nonBlockingRisks` is still pushback. Return an empty `nonBlockingRisks` array only when no residual critic concern remains; otherwise the primary performer must revise and rerun or report not-ready.
