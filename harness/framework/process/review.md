# Review

The single normative home for dual-role governance, the review loop, expert-role decomposition, review lenses, finding quality, convergence, and the review record schemas. Supersedes v1 `agentic-loop.md`, `sub-agent-coordination.md`, `critique-and-debate.md`, and `cross-agent-collaboration.md` (now redirect stubs).

## Dual-Role Governance

- Non-trivial execution-plan-backed planning and implementation require top-level dual-role governance — a top-level dual-role obligation: a `primary-performer` proposes; an `independent-critic` (fresh context, adversarial framing) challenges the consolidated plan, implementation evidence, and completion claim.
- Critic tiering: standard-tier default is a same-family critic with fresh context. High-risk work requires cross-agent review between two distinct registered agent families (`framework/registry/agents.json`) when available; with one family, record single-family dual-role fallback with missing-agent availability evidence and a distinct critic pass — same-family fallback without that evidence blocks completion. A skipped critic pass blocks non-trivial work.
- Critic models are never downgraded: critic invocations use the registry's high-capability model policy. Do not downgrade critic runs to low-cost, small, fast, or fallback models to make review pass.
- Sub-agent coordination is internal decomposition; it does not replace top-level dual-role governance. Sub-agent or Expert Bench decomposition is expected when useful, but it does not satisfy the independent critic role by itself: sub-agent findings cannot by themselves satisfy the top-level primary-performer/independent-critic separation.
- Completion requires one consolidated output owned by the primary performer: synthesis is a normalization rewrite against the artifact contract, never concatenation of sub-agent parts.
- Parallelize expert roles or sub-agents only when their work is read-only or write-disjoint; keep a single implementer for coupled edits; record the topology in the ledger.

## Readiness — pushback-free standard

- Planning, implementation, code review, validation, completion, commit, push, and publish claims use a pushback-free readiness standard: critic terminal evidence with no unresolved pushback.
- Critic `blockingFindings` block until resolved and recheck passes. Critic `nonBlockingRisks` block until each entry is resolved and rechecked, or explicitly accepted-with-rationale by the primary performer in the ledger — auditable evidence, not silence; silent omission is a violation.
- Unresolved critic pushback blocks readiness: Planning, implementation, code review, validation, completion, commit, push, and publish tasks must not be declared ready while critic pushback remains open or top-level critic pushback remains unresolved. Unresolved correctness, security, validation, user-intent discovery/alignment, or framework/override boundary findings block completion regardless of acceptance rationale.
- Style-only disagreements do not block when validation and documented quality criteria pass. Rejected critiques must include a reason.

## Review Loop

1. Primary performer proposes (plan, assumptions, scope, expected validation).
2. Independent critic reviews hidden assumptions, explicit intent, implicit or hidden intent, shallow intent interpretation, root-cause applicability and completeness, adjacent blockers, symptom-only fixes, alternatives quality, portability, validation gaps, framework/override boundary, user-intent versus existing-pattern conflicts, and plan adequacy for the discovered intent.
3. Primary performer revises; each critique maps to `accepted`, `rejected` (with reason), or `blocked`.
4. Critic rechecks. Repeat until terminal and pushback-free, or record `blocked`/`not-ready` naming the unresolved findings.
5. Primary performer records final synthesis.

`maxReviewIterations` is required and must equal `5`. It bounds the primary review loop per record; a superseding verification record (`supersedesReviewId` present) honestly enumerates as many recheck rounds as terminal convergence actually took — the cap must never force splitting or hiding real history (`recordIterationCapFailures` enforces both directions). Review is an agentic loop over plan, diff, and evidence, not keystroke-by-keystroke co-editing.

## Required Triggers

Run a critique/debate checkpoint for: Framework process or validator changes; architecture or dependency-boundary changes; security-sensitive changes; CI, runtime, worktree, logging, observability, or cleanup changes; broad refactors; conflicting sub-agent findings. Cross-family review (when two families are available) is required for: bootstrap intake or schema changes; target validation profile or override mechanism changes; framework process, validator, or CI changes; architecture, security, permission, runtime, observability, or worktree changes; ADR and requirement register changes; plan-declared `highRisk=true`.

## User Intent Discovery And Alignment Gate

- Decompose every request from the raw request into explicit intent, implicit or hidden intent, desired outcome, acceptance criteria, constraints, risks, and implementation strategy before choosing an implementation frame. Critique the ask itself and answer with a genuine verdict; disagreement with the user's framing is expected when warranted.
- Use every reasonably available capability — tools, source documents, code inspection, runtime signals, validation results, reviewer critique, current external references — to discover that intent; do not stop at a literal keyword interpretation when the broader outcome is clear. Intent discovery includes root-cause investigation, hidden constraints, adjacent blockers, related failure modes; for greenfield or no-prior-defect work, record a concise not-applicable rationale instead of fabricating a defect frame.
- A plan maps the discovered intent to the best available path for the end-to-end outcome, not a local symptom or the nearest literal fix. High-impact or uncertain plans compare practical alternatives and record why the selected approach is best under current constraints.
- User-visible capabilities are complete only when the user-observable outcome succeeds or the user is clearly told why it cannot. Internal milestones such as `queued`, `stored`, or `API returned OK` are evidence, not completion, unless the downstream consumer uses them. Cross-boundary work records an intent-to-outcome trace across each handoff: user request, model or tool decision, backend state, endpoint response, client decode, client execution, user-visible result; non-applicable hops require rationale.
- Defect fixes include a regression check from the failing user prompt or journey when feasible; otherwise the replacement test covers the same user-observable outcome and boundary that failed.
- The role must show its work: investigation, decomposition, applicability decisions, alternatives, and selection rationale explicit enough for a reviewer to tell the agent figured out the request instead of guessing. The mandatory act is investigation and explicit judgment, not automatic scope expansion; exceeding the requested minimum is valid only when it directly serves the discovered intent, and trivial or bounded changes may stay exact-scope with beyond-minimum recorded as not applicable.
- User intent, accepted intake facts, requirements, and ADRs outrank existing implementation patterns: existing code, tests, architecture, prompts, and conventions are evidence to inspect, not acceptance criteria. When the goal conflicts with existing behavior, mark the conflict and revise the source-of-truth contract; preserving a pattern requires citing a current requirement, ADR, security rule, or explicit user decision. Passing a role while silently optimizing for existing-pattern consistency, symptom-only repair, narrow literal interpretation, or partial coverage is a harness failure.
- If intent stays materially ambiguous after available evidence is checked, ask for clarification or record the assumption and its risk before implementation.

## Expert Roles — internal decomposition

Glossary: Expert role = the persona/responsibility; its row in the plan ledger is the durable record. Expert Bench = the set of required expert roles kept logically continuous until final synthesis, blocked, or abandoned.

| Role | Responsibility and pass criteria |
|---|---|
| `planner` | Discovers detailed user intent per the gate above — raw request through explicit/implicit or hidden intent, user-observable outcome contract, applicable root cause or not-applicable rationale, hidden constraints, adjacent blockers, beyond-minimum opportunities or not-applicable rationale, acceptance criteria, alternatives, selected strategy, required expert roles; existing implementation is not treated as the default baseline when it conflicts with the goal. |
| `architect` | Framework/override placement, ADR need, dependency direction, module boundaries, runtime impact, and discovered-intent versus existing-architecture conflict are checked. |
| `implementer` | Scoped artifacts changed, unrelated refactors absent, requirement surfaces updated, implementation evidence recorded. |
| `test-engineer` | Validation paths exist; root cause and adjacent failure modes covered; intent-to-outcome trace coverage and user-observable completion covered, deferred, or marked not applicable with rationale; edge cases covered or explicitly deferred. |
| `security-reviewer` | Permissions, secrets, destructive actions, external writes, credential handling, and threat impact are checked. |
| `code-reviewer` | Correctness, regressions, maintainability, missing tests, command drift, framework boundary risk, internal milestone masquerading as completion, and tests that preserve obsolete behavior against user intent are checked. |
| `documentation-steward` | Docs, source links, stale text, requirements, ADRs, and override/framework placement are checked. |
| `verifier` | Canonical validation, runtime evidence, downstream consumer evidence, cleanup status, and completion evidence are recorded. |
| `critic` | Assumptions, shallow intent interpretation, missed hidden intent, symptom-only fixes, root-cause completeness, root cause, hidden constraints, adjacent blockers, related failure modes, alternatives quality, internal milestones treated as completion, and unresolved findings are challenged. |

The table is the Role Pass Criteria: each row states what must be checked for that role to pass.

Required use — small change: `single-agent execution` may be recorded. Non-trivial: `planner`, `implementer`, `test-engineer`, `verifier`. High-risk: all standard roles plus `critic`.

### Role Outcomes

Every required expert role runs `DO` → `CHECK` → `REVISE` → `RECHECK` → `SYNTHESIZE` until `passed`, `blocked`, or justified `not-applicable`. Non-terminal outcomes are `pending`, `in-progress`, `failed`. Completed plans cannot contain required expert roles with `pending`, `in-progress`, or `failed` outcomes. A `blocked` role is valid only when the whole plan is `blocked`.

Handoff format — each delegated expert role records: Goal, Scope, Files or artifacts, Constraints, Expected output, Validation command, Risks, Evidence.

Expert Bench persistence: Repo-persistent role state is mandatory and is the source of truth; runtime persistence is preferred when a tool supports it but optional. The framework never validates runtime persistence; validators inspect repository artifacts only. Roles are reconstructed from the framework role definitions plus the active plan after restart, tool change, or handoff. The bench closes only when the plan reaches `completed`, `blocked`, or `abandoned`.

### Synthesis

Role synthesis records: what was checked; evidence used; the request breakdown; discovered intent and acceptance criteria; alternatives and why the selected path is best available; whether existing patterns were accepted, revised, or rejected against user intent; accepted findings; rejected findings with rationale; remaining blockers; final role outcome.

## Artifact Contracts and Convergence — deliverable quality

- Deliverable-producing work (code modules, documents, decks, stories, use cases) requires an artifact contract before generation: audience, purpose, outline/structure, terminology, style constraints, acceptance checks. Local coherence = each unit conforms; global coherence = all units conform to the same contract.
- Convergence gate: before delivery, self-review the output against the contract's lenses and revise until a pass yields zero findings — a clean pass against named lenses, not a zero-effort pass — bounded by the iteration cap. Deliverable-tier work records passes as evidence. Never report "no room for improvement" as compliance; findings must stay honest.
- User challenges to delivered output enter the ledger as critique findings: verify against the prior instruction and the output in the same turn, then accept with the specific fix or reject with quoted evidence.

## Finding Quality Rules

- Findings must be discrete, actionable, and tied to a changed artifact or newly introduced behavior, identifying the concrete affected path, scenario, or contract; speculative impact without a provable affected surface is not enough.
- Severity must match impact on correctness, security, validation, maintainability, or user-visible behavior. Review comments stay concise; broad rewrites only when a small concrete replacement aids clarity.

## Specialized Review Lenses

- Breaking-change lens: external integration surfaces, command-line flags, configuration loading, persisted state, resume behavior, public schemas.
- Model-visible context lens: agent-visible context is incremental, bounded, redacted when needed, protected against unbounded fragments or cache-breaking churn.
- Testing lens: changed user-visible or agent decision behavior has integration or contract coverage; no test-only helpers without clear need.
- Change-size lens: broad or complex changes are staged into reviewable units or carry an indivisibility rationale tied to the actual diff.
- Coherence lens: terminology consistency, structural parallelism, cross-reference integrity, no orphan concepts, single voice against the artifact contract.
- High-risk and framework-affecting reviews must record which lenses were applied, which were not applicable, and why.

## Explicit Review Target

- Review packets and critique ledgers identify the reviewed target as one of: `uncommitted changes`, `base branch diff`, `commit`, or `custom instructions`; record `inline` or `detached` and what evidence the critic can inspect. A target too broad to inspect must be narrowed or split before the critic can pass.

## Change Size Check

- Non-mechanical changes over roughly 800 changed lines require a staging assessment in the plan or review record; complex logic changes over roughly 500 changed lines require the reviewer to identify the smallest coherent stage that can land first, or explain why the change is indivisible. Advisory for generated ledgers and mechanical migrations; reviewers record that rationale.

## Transport — Agent Review Transport Protocol

When cross-family review is required and the critic CLI is available, use the portable runner (`harness review` / `node harness/scripts/run-agent-review.mjs`) before hand-writing new prompt variants:

```bash
node harness/scripts/run-agent-review.mjs --primary <family> --critic <family> --packet harness/artifacts/cross-agent-review/<review-id>-packet.md --out harness/artifacts/cross-agent-review/<review-id>-report.json
```

Families, CLI invocations, default critic models, and high-capability model policies come from `framework/registry/agents.json`. Critic invocations require explicit high-capability model selection: hidden CLI defaults are not valid critic model evidence, and per-family overrides (for example `--claude-model` / `HARNESS_CLAUDE_CRITIC_MODEL`, `--codex-model` / `HARNESS_CODEX_CRITIC_MODEL`) are valid only for an equal-or-better current high-capability model of that family. The legacy wrapper `node harness/scripts/run-claude-review.mjs` remains available for existing callers.

The packet (from `framework/templates/cross-agent-review-packet.md`) is bounded evidence: user intent, scope, changed paths, validation result, specific questions — not broad repository exploration. The runner ladder: Critic liveness probe → packet-file review prompt → Evidence-summary fallback prompt → minimal blocking-only fallback; every attempt has a ceiling, stdout/stderr capture, and status in the JSON report. Do not keep changing prompt styles without recording attempts. Record the report path as `review-output` evidence. The JSON report exposes `pushbackFree`, `criticModel`, `rungDepth`, and `subPacketFallback`; readiness follows the pushback-free standard above.

Transport policy is per-family registry data (`framework/registry/agents.json` → `transport`), never bare literals in scripts: rung ceilings (`rungCeilingsMs`) and `retriesPerRung`, each with a recorded `ceilingBasis`. The runner retries once at the same rung before degrading. Ceilings are measured, not guessed: `harness review calibrate` records recommended ceilings under `artifacts/telemetry/critic-calibration-<family>.json`; validation fails when a registry ceiling undercuts the calibrated recommendation, and calibration goes stale when the critic CLI version changes.

Degradation is priced, never silent: every complete review below the packet-file rung reviewed the primary performer's evidence summary rather than the artifacts. Such reports record `subPacketFallback: true`, and the plan must carry a meaningful `Transport degradation acceptance` rationale — validation fails otherwise. Reports predating schema 1.1.0 lack the field and are exempt; history is never rewritten.

Cross-family review carries a pre-committed decision gate with a durable tracking surface: every runner invocation appends to `artifacts/telemetry/review-transport.jsonl` (rung depth, sub-packet fallback, blocking-finding counts), critics mark each blocking finding `novel: true` when the packet did not already flag it, and `harness review decision-gate` aggregates the last ten cross-family reviews against the criterion: if packet-file completion stays below seventy percent or the novel-finding count stays at zero despite calibrated ceilings, cross-family review demotes to optional — the same-family fresh-context critic becomes the high-risk default and cross-family is reserved for contract and security changes.

Critic output is one fenced `agent-review-json` block: `status` (`NO_BLOCKING_ISSUES` | `BLOCKING_FINDINGS`), `blockingFindings`, `nonBlockingRisks`, `reviewedEvidence`, `summary`. Legacy `claude-review-json` output remains accepted.

## Review Record Schema

Execution plans record review in a fenced `cross-agent-review-json` block under `## Cross-Agent Review` with top-level `required`, `highRisk`, `triggerSignals`, `affectedPaths`, `maxReviewIterations`, `records`.

Record statuses: `non-terminal`, `complete`, `blocked`, `fallback-accepted`. Dual-role terminal statuses: `pending`, `cross-agent-complete`, `single-family-dual-role-complete`, `blocked`, `fallback-accepted`. Dual-role modes: `cross-agent` (primary and critic from distinct families) and the `single-family-dual-role` fallback described above.

Schema v2 (current): final agreement uses role-named fields `finalAgreement.primaryPerformerAgreement` and `finalAgreement.independentCriticAgreement` for both modes. Schema v1 (historical): vendor-named `finalAgreement.codexAgreement` / `finalAgreement.claudeAgreement` remain accepted in pre-v2 completed plans; history is evidence and is never rewritten.

Terminal rules:
- `complete` (cross-agent): one to five iterations, both role agreements true, `dualRoleGovernance.terminalStatus=cross-agent-complete`, non-empty evidence, no unresolved explicit/hidden-intent gap, no unresolved user-intent versus existing-pattern conflict, no unresolved root-cause applicability or completeness gap, no unresolved alternatives-quality gap, and no unresolved plan-adequacy gap against the discovered user intent.
- `complete` (single-family): one to five iterations, both role agreements true, `terminalStatus=single-family-dual-role-complete`, missing-agent availability evidence, role-separation evidence, non-empty critic findings or explicit no-blockers evidence, primary-performer synthesis.
- `complete` readiness additionally requires the pushback-free standard: no unresolved `blockingFindings`, every `nonBlockingRisks` entry resolved or accepted-with-rationale in the plan, and `pushbackFree=true` or equivalent plan evidence.
- `blocked`: non-empty `reason`, `blockedBy`, ISO-8601 `blockedAt`, `unresolvedFindings`, evidence.
- `fallback-accepted`: supersedes only `blocked`; requires `unavailableAgent`, `acceptedBy` (≠ `unavailableAgent`), ISO-8601 `acceptedAt`, `reason`, `triggerSignals`, `waivedTriggers` (non-empty subset of `triggerSignals`), evidence.

### Supersession Rules

`reviewId` unique; `supersedesReviewId` unique, resolves to an earlier record in the same plan; allowed pairs are `non-terminal → complete` and `blocked → fallback-accepted`; exactly one authoritative terminal record when review is required for a completed plan.

### Evidence Shape

Array of `{type, ref, summary}` with `type` ∈ `file-line` (`path:line`), `validation-report` / `log-path` (repo-relative), `commit-sha` (hex), `review-output` (repo-relative transcript path or plan section id).

## Ledger Fields

Debate trigger; Proposer summary; Critic findings; Resolution for each finding (`accepted`/`rejected`/`blocked`); Final synthesis; Validation evidence.
