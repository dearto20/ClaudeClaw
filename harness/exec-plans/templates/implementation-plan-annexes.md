# Implementation Plan Annexes

Conditional blocks appended to an active ledger via `node harness/scripts/harness.mjs ledger annex <slug> <name>`. Append an annex when its trigger holds; validators check annex sections when present (and require them when the plan's own declarations trigger them).

<!-- annex:deep-alignment -->
## Deep Alignment
Append at performer judgment — when intent decomposition beyond the core is needed (typically cross-boundary or investigative work). Deliberately not mechanically required for high-risk work: forcing it there would reinstate the pre-diet intent catechism; the core intent section plus critic review carry high-risk alignment.
- Intent-to-outcome trace for cross-boundary work:
- Failing prompt or journey regression check:
- Root cause or full-investigation findings, or not-applicable rationale:
- Adjacent blockers or related failure modes, or not-applicable rationale:
- Evidence that the request was fully decomposed before implementation:
- Existing implementation patterns reviewed (conflicts / preserved / revised):
<!-- /annex -->

<!-- annex:expert-bench -->
## Expert Bench
Append when sub-agent or expert-role decomposition is actually used. (Statuses: bench `open`/`closed`; persistence `runtime-persistent`/`repo-persistent-only`.)
- Bench Status: `open`
- Persistence Mode: `repo-persistent-only`
- Roles Reconstructable From: framework role definitions plus this plan's role table.
- Continuity Log: Initialized when this annex was appended; No restart.

## Sub-Agent Expert Roles
| Role | Owner | Task | Loop Status | Check Result | Iterations | Blocker | Evidence |
|---|---|---|---|---|---|---|---|
| planner | primary | Clarify goal and acceptance criteria. | pending | n/a | 0 | n/a | n/a |
| architect | primary | Check boundaries, ADR need, and dependency direction. | pending | n/a | 0 | n/a | n/a |
| implementer | primary | Implement scoped artifacts. | pending | n/a | 0 | n/a | n/a |
| test-engineer | primary | Define and run validation. | pending | n/a | 0 | n/a | n/a |
| security-reviewer | primary | Check permission, secret, and destructive-operation risk. | pending | n/a | 0 | n/a | n/a |
| code-reviewer | primary | Review correctness, regressions, and missing tests. | pending | n/a | 0 | n/a | n/a |
| documentation-steward | primary | Check docs, source links, and bootstrap clarity. | pending | n/a | 0 | n/a | n/a |
| verifier | primary | Record completion evidence. | pending | n/a | 0 | n/a | n/a |

Allowed loop statuses: `pending`, `in-progress`, `passed`, `failed`, `blocked`, `not-applicable`.

Completion rule: completed plans must have every required expert role marked `passed` or `not-applicable` with rationale. `blocked` roles are valid only when the plan state is `blocked`.

## Role Synthesis
- Accepted findings:
- Rejected findings with rationale:
- Blockers:
- Final decision:
<!-- /annex -->

<!-- annex:critique-and-debate -->
## Critique And Debate
Append for high-risk, framework-change, security, runtime, or conflict work (set the Trigger value below accordingly).
- Trigger: `high-risk`
- Proposer summary:
- Critic findings:
- Resolutions:
- Final synthesis:
<!-- /annex -->

<!-- annex:intake-alignment -->
## Intake Alignment
Append for target feature work governed by a bootstrap intake.
- Intake artifact:
- Intake state:
- Critical unknowns:
- Deferred noncritical fields:
<!-- /annex -->

<!-- annex:target-profile -->
## Target Validation Profile
Append for target-repo work with an executable validation profile.
- Profile artifact:
- Executable runner:
- Required command groups:
- Infra blocker policy:

## Target Mechanism Evidence
- Architecture invariants:
- Taste invariants:
- Worktree runtime:
- Observability:
- Browser validation:
- PR/CI loop:
- Recurring cleanup:

## Not-Applicable Decisions
- Decisions:
- Reviewer approvals:
- Replacement evidence:
<!-- /annex -->

<!-- annex:worktree-runtime -->
## Worktree Runtime
Append for parallel or isolated worktree execution.
- Worktree:
- Workspace roots:
- Permission profile / sandbox / network:
- Runtime summary:
- Startup command:
- Teardown command:
- Runtime artifact directory:
<!-- /annex -->

<!-- annex:observability -->
## Observability
Append when runtime behavior changes need logs/metrics/traces evidence.
- Logs:
- Metrics:
- Traces:
- Query commands:
<!-- /annex -->

<!-- annex:browser-validation -->
## Browser Validation
Append for user-facing UI changes.
- URL:
- Journeys:
- Screenshot/video artifacts:
<!-- /annex -->

<!-- annex:artifact-contract -->
## Artifact Contract And Convergence
Append for deliverable-tier work (documents, designs, analyses).
- Artifact contract: audience, purpose, outline/structure, terminology, style constraints, acceptance checks.
- Convergence evidence: review passes against the contract's lenses until a clean pass, bounded by the iteration cap.
<!-- /annex -->
