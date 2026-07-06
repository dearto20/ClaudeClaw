# Gates

The single normative home for execution ledgers, executable target validation, cleanup guardrails, and entropy control. Supersedes v1 `execution-plans.md`, `target-validation-profile.md` (policy portion), `cleanup-guardrails.md`, and `entropy-garbage-collection.md` (now redirect stubs).

## Execution Ledgers

Plans convert user intent into auditable work ledgers: bounded, resumable, reviewable, tied to validation evidence. Planning obligations apply in both planning-only and mutation-capable runtimes. Scaffold with `harness ledger new`; append conditional annexes with `harness ledger annex`; update the pointer with `harness ledger step`; close with `harness ledger close`.

- Locations: `exec-plans/templates/` (portable), `exec-plans/active/` (underway), `exec-plans/completed/` (done, with evidence), `exec-plans/tech-debt/` (deferred). In the DevelopmentHarness source repository, completed source plans live under root `development/exec-plans/completed/`.
- States: `draft`, `active`, `blocked`, `completed`, `abandoned`.
- Required core sections are defined by `exec-plans/templates/implementation-plan.md`; conditional annexes by `implementation-plan-annexes.md`; validators enforce core-always and annex-when-triggered.
- The `Current Step` pointer (`- Current step: <phase> — governing: <doc>`) is updated at every phase transition; it feeds `harness status` and the statusline.
- Decompose non-trivial work into vertical slices — each implementation step cuts through every integration layer end-to-end (a tracer bullet), never one horizontal layer at a time; order steps by dependency with the riskiest integration first; classify steps needing human judgment as HITL, the rest as agent-autonomous. GOOD: "step 1: one command flows CLI→parser→executor→output". BAD: "step 1: write all parsers; step 2: write all executors".
- Non-trivial work must have an active plan before edits when the active runtime allows repository mutation. The pre-commit gate enforces this; in a mutation-capable runtime, agents convert accepted proposals into `exec-plans/active/` and then execute. In a planning-only runtime, agents produce a proposed plan without editing tracked files or creating execution-plan artifacts; a resumed mutation-capable session converts the accepted proposal into the active ledger and records the transition. Mutation-capable planning is done when: the active ledger's Affected Paths cover the intended edits and no scoped artifact has been touched. Planning-only planning is done when: the proposed plan is decision-complete with no tracked-file or execution-plan mutation.
- A plan may close as `completed` only when it records: Runtime Mode, mutation authority, validation evidence, completion evidence, dirty worktree status, required new files tracked or intentionally ignored, generated-artifact handling by policy, push/publish state when publishing was requested, critic pushback-free status (with any accepted-with-rationale entries), and remaining risk. Closed plans move to the completed directory (or record why not).
- Blocked plans name the blocking condition and required external input. Active plans keep the Expert Bench open; completed, blocked, and abandoned plans close it.
- Non-trivial work references a `ready` intake artifact. Not-applicable decisions include rationale, reviewer role, timestamp, linked intake field, and replacement evidence.

## Commit And CI Floor

The commit gate (`harness precommit`, invoked by `hooks/pre-commit`) and its CI twin enforce the tier table mechanically:

- Ledger coverage: every changed substantive path must be declared — exactly or by directory prefix — in a governing ledger's `## Affected Paths` (active ledgers plus plan files in the change). Existence of an unrelated ledger satisfies nothing; uncovered paths are rejected by name. Gate evidence (ledger text, adoption record, CHANGELOG version) is read from the staged index or HEAD, never the dirty worktree — an unstaged edit cannot satisfy a gate for a commit that will not contain it.
- High-risk critic evidence: a high-risk commit is a commit claim and requires critic terminal evidence at commit time, bound to the governing ledger and to the committed tree — every high-risk path must be covered by a ledger, read from the staged index (HEAD in range mode), whose cross-agent-review JSON carries a terminal record. Coverage from one ledger cannot borrow evidence from another; a plain-text terminal-status line is never evidence; review report files are gitignored audit artifacts and status-display inputs, never commit-gate evidence — they are not part of any committed tree.
- Upgrade adoption (targets only): a commit whose substantive paths all lie on the framework-owned upgrade surface (`harness/scripts/upgrade-surface.mjs`) and that carries a freshly written `harness/override/governance/harness-upgrade-adoption.json` matching the incoming CHANGELOG version is accepted without a per-target critic pass — the change was critic-reviewed in the source repository, and the adoption record prices the adoption visibly. Hand-writing a false adoption record is deliberate laundering through a reviewable governance artifact, the same trust boundary as legacy-plan acceptance.
- CI floor: git hooks do not clone and `HARNESS_SKIP=1` is a loud local escape only. CI re-runs the same gate on the pushed diff (`harness precommit --range <base>...<head>`) for pull requests and default-branch pushes; work-in-progress branch pushes run validate-all only. Publish claims fail closed on any unusable diff base (`ci-diff-base.mjs`, contract-tested) — a forced ref must be gated against its true base, never just its tip; the only ungated exit is repo genesis (a single parentless commit — the human-reviewed bootstrap push). Local hook activation cannot be verified in CI (`validate-hooks` self-skips there by design) — the range gate is what makes bypassed hooks unable to land unenforced.
- Telemetry: every gate decision appends to `harness/artifacts/telemetry/gate-outcomes.jsonl`; visibility-hook compliance appends to `visibility-compliance.jsonl`.

## Executable Target Validation

A profile that only declares command strings without execution is invalid. Framework template: `framework/templates/target-validation-profile.md`; filled artifact: `override/validation/target-validation-profile.md`; runner: `scripts/validate-target-profile.mjs`, discovered by `validate-all.mjs`.

- The runner executes every enabled command; non-zero exit fails validation unless the command is an infra blocker with evidence (blocker reason, evidence path, reviewer role, timestamp, follow-up action). Validation is done when: every enabled command has a recorded exit status and every non-zero exit carries blocker evidence.
- Every enabled command declares artifact side effects before execution: `writesTo` (`repo` | `temp` | `external` | `none`), `artifactPolicy` (`tracked` | `ignored` | `temp-routed` | `manual-cleanup` | `none`), `approvalRisk` (`none` | `cleanup` | `external-write` | `destructive`).
- Default rule: build, test, runtime, browser, observability, and validation commands use `temp-routed` or `ignored` artifacts; `manual-cleanup` is valid only with `artifactRationale` explaining why routing cannot prevent the artifact.
- Command groups (`build`, `lint`, `unit-test`, `integration-test`, `runtime`, `browser`, `observability`, `cleanup`) each provide at least one executable command or a reviewer-gated not-applicable decision in the relevant override mechanism doc; each applicable mechanism links to executable profile command IDs.
- Long-running startup commands use smoke checks or bounded probes, not indefinite foreground servers. Evidence paths are repo-relative and cited from ledgers; evidence distinguishes command output from generated artifacts and their policy handling.

## Cleanup Guardrails

Cleanup is the last resort for generated artifacts, not the normal fix for validation/build side effects.

### Cleanup Prevention Contract
- If a command can route outputs to temp, cache, or ignored artifact paths, update the target validation profile instead of deleting output afterward.
- `manual-cleanup` is valid only with rationale explaining why routing cannot prevent the artifact.
- Cleanup evidence must distinguish tracked, ignored, and untracked artifacts.
- Prefer non-destructive inspection and profile changes before requesting cleanup approval.

### Required Checks
- Inspect the dirty worktree before cleanup; confirm cleanup targets are generated artifacts, caches, temp dirs, or explicitly listed files; validate target paths are inside allowed workspace or artifact directories; never remove user-authored content without explicit instruction. Done when: every cleanup target is classified as tracked, ignored, or untracked and lies inside an allowed path.

### Hard Stops
- No `git reset --hard` unless explicitly requested.
- No broad recursive deletion without path validation and checkpoint.
- No secret, credential, or environment file rewrite without explicit scope.
- No destructive source cleanup without explicit user instruction.

## Entropy Control

- Recurring checks: stale active plans; unresolved TODO markers outside allowed templates; broken doc links and command drift; oversized docs or scripts; generated artifacts that should be ignored or documented; placeholder-only directories; artifact directories missing README anchors; requirements without validation evidence; tech-debt items without owner or next action.
- Intentionally empty directories use a tracked README manifest stating why they exist. Generated artifact directories keep routine outputs ignored and commit only stable manifests or promoted evidence. Validators ignore directory README manifests when scanning plans.
- Deferred work goes in `exec-plans/tech-debt/`; each item records reason, risk, owner, and next validation step. Stale debt is reviewed before broad framework changes.
- Gate telemetry (`harness/artifacts/telemetry/gate-outcomes.jsonl`) accumulates gate outcomes; gates that never fire are pruning candidates at review time.
