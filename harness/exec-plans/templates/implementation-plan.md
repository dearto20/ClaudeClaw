# Implementation Plan Template

## State
- `draft`

## Goal
- Objective and success criteria. Done when: each criterion is checkable.

## User Intent Discovery And Alignment
- Raw user intent:
- Discovered intent (explicit, implicit, hidden constraints):
- Sources consulted (docs, code paths, runtime evidence, external references):
- Alternatives considered and selected strategy:
- Acceptance criteria (checkable done-when bounds):
- Beyond-minimum opportunities and scope guardrails, or n/a:
- Decision: `aligned` | `blocked`

## Scope
- In scope:
- Out of scope:

## Affected Paths
- n/a

## Runtime Mode
- Current mode: `plan` | `default`
- Mutation allowed: `yes` | `no`
- Plan Mode source:
- Mode transition evidence:
- Permission profile: `guarded` | `trusted-local` | `restricted-sandbox`

## Dual-Role Governance
- Mode: `cross-agent`
- Primary performer agent: `claude-code`
- Independent critic agent: `codex`
- Agent-family separation: `yes`
- Internal decomposition summary: pending
- Consolidated output owner: `primary-performer`
- Critic findings (accepted / rejected-with-rationale / blocking): pending
- Accepted non-blocking risks with rationale: pending
- No-pushback terminal evidence: pending
- Unresolved critic pushback: pending
- Terminal status: `pending`

## Cross-Agent Review
```cross-agent-review-json
{
  "required": false,
  "highRisk": false,
  "triggerSignals": [],
  "affectedPaths": [],
  "maxReviewIterations": 5,
  "records": []
}
```
- Agent review packet and report:
- Pushback-free review evidence:
- Transport degradation acceptance:

## Current Step
- Current step: planning — governing: harness/AGENTS.md

## Implementation Steps
1. Update scoped artifacts. Done when: acceptance criteria hold, validation green, evidence recorded.

## Validation
- Command: `node harness/scripts/validate-all.mjs`
- Result and evidence:

## Completion Evidence
- Summary:
- Validation report:
- Dirty worktree status:
- Required new files tracked or intentionally ignored:
- Generated artifacts handled by policy:
- Push/publish state when publishing was requested:
- Critic pushback-free status:
- Remaining risk:

Conditional annexes — append when triggered via `node harness/scripts/harness.mjs ledger annex <slug> <name>`: deep-alignment, expert-bench, critique-and-debate, intake-alignment, target-profile, worktree-runtime, observability, browser-validation, artifact-contract. Dual-role modes, fallbacks, and terminal statuses: `framework/process/review.md`.
