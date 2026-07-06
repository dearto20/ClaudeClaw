# Changelog

> Retained harness release notes. This file records the DevelopmentHarness distributable-surface releases adopted by this installed target (ClaudeClaw); it is not a changelog of ClaudeClaw itself, and this repository is not the harness source.

All notable changes to the DevelopmentHarness distributable surface are recorded here.
Versioning follows semver via `harnessVersion` in the DevelopmentHarness source repository's `development/distribution-manifest.json` (source-only path, not present in this target).
Target projects use `harness upgrade` (path-scoped, diff-reviewed) to take framework updates.

## [2.10.0] — 2026-07-06

Durable-artifact layer for targets + the parked skills-tier spec (R7, R8-spec).

### Added
- `framework/templates/context-glossary.md`: opinionated CONTEXT.md glossary
  template — one term per concept, one to three sentences, rejected synonyms
  under _Avoid_, lazy creation, no file paths in durable narrative docs.
  Registered in the doc map; distributed via the framework glob.
- `framework/seeds/CONTEXT.md`: starter file targets copy manually to their
  repository root (bootstrap does not materialize it; the upgrade surface
  never writes target-owned files — stated in the seed header and template).
- governance.md § ADRs: terse body format (title + one to three sentences;
  an ADR can be a single paragraph) and the three-part recording bar (hard to
  reverse / surprising without context / real trade-off); CONTEXT.md vs ADR
  split stated (glossary names concepts, ADRs record decisions).
- `development/design-docs/skills-only-distribution-tier-spec.md` (R8, SPEC
  ONLY): manifest `subsets` block + `bootstrap --tier skills` as the primary
  path, tool-independent-skills-first caveat, done-when bounds, and the build
  trigger — first concrete consumer commits. Zero code by user decision.

## [2.9.0] — 2026-07-06

Sediment pass + vertical-slice planning rules (R4, R9). Honest outcome up
front: R4's ≥25% aggregate reduction target was miscalibrated and is recorded
as a deviation — the v2 redesign already consolidated these docs, and a
programmatic pin census (130+ validator/test needles across the four docs)
proved most remaining sentences are load-bearing obligations. Obligation
preservation outranked the quota, per the harness's own Goodhart warning.

### Added
- Vertical-slice decomposition rules (gates.md § Execution Ledgers): every
  implementation step is a tracer bullet through all integration layers,
  dependency-ordered, riskiest integration first, HITL vs agent-autonomous
  classified — with a GOOD/BAD example pair.

### Changed
- review.md single-sourcing (2947 → 2729 words): the intent-decomposition
  checklist and the readiness rule are each stated ONCE (were 3× each); the
  self-referential dual-role definition doubling and rationale tails removed;
  the third sub-agent restatement folded into the remaining two pinned
  sentences. Validator needles moved in lockstep (validate-agentic-loop,
  validate-critique-synthesis, validate-cross-agent-review + one contract-test
  pin) — obligation-preserving needle surgery per the 2.7.0 precedent.
- gates.md now names `ledger annex` in the lifecycle and the core/annex
  template split; entropy-control and empty-directory prose trimmed.
- governance.md and agent-system-structure.md rationale tails trimmed
  (why-this-exists section, laundering-mechanics explanation).
- Word deltas (baseline → final): review 2947→2729, gates 1287→1340 (+R9
  rules), governance 795→759, structure 1581→1495; aggregate 6610→6323.

## [2.8.0] — 2026-07-06

Ledger telemetry + interactive alignment (R5, R6): measure the diet so the
next pruning round is evidence-based, and interview instead of form-fill.

### Added
- `harness/artifacts/telemetry/ledger-usage.jsonl`: tool-written lifecycle
  telemetry from the `harness ledger` commands — new/step/annex events plus a
  close-time snapshot of per-core-field fill state (filled/pending/n-a/empty)
  and appended annexes. Raw counts only; interpretation belongs to pruning
  reviews. Documented in `framework/process/observability.md § Harness
  Telemetry` alongside the existing telemetry files.
- `harness-grill` skill (6th): user-invoked relentless one-question-at-a-time
  interview with a recommended answer per question; repository-answerable
  questions get explored, not asked; output lands in the slim ledger's
  alignment section; AFK degradation = self-interview with flagged
  assumptions.
- Telemetry writes are failure-tolerant by contract (`appendTelemetry`) —
  observability never breaks the command writing it.

## [2.7.0] — 2026-07-06

Ledger diet (R1): the execution-plan template shrinks from 228 lines / 28
sections to an 80-line core whose every field earns its place; conditional
material moves to per-trigger annexes. Root cause: fields habitually filled
"n/a" or with boilerplate are paid-for noise that trains agents to treat the
ledger as ceremony.

### Added
- `exec-plans/templates/implementation-plan-annexes.md`: nine conditional
  annex blocks (deep-alignment, expert-bench, critique-and-debate,
  intake-alignment, target-profile, worktree-runtime, observability,
  browser-validation, artifact-contract), each with an explicit trigger.
- `harness ledger annex <slug> <name>`: appends a named annex block to an
  active ledger; rejects unknown and duplicate annexes. Designed as the
  telemetry write-point for 2.8.0.
- Triggered-annex gate: a high-risk plan without the Critique And Debate
  annex fails validate-cross-agent-review — annexes are conditional, but a
  declared trigger still requires its annex.
- `ledger-diet-contract.test.mjs`: executable negative tests that RUN the
  validators against fixture ledgers in a scratch workspace (gutted fields,
  missing sections, triggered-but-absent annexes, ghost report pricing,
  packet-vs-report traceability, pending-evidence-on-completed, traversal
  slugs) plus annex CLI behavior and load-bearing-literal pins.

### Fixed (found by the critic loop + the executable negative tests)
- Latent `valueAfterLabel` line-crossing bug: `:\s*(.*)$` consumed the newline
  on empty values and captured the NEXT line as the value — masked for years
  by instructional filler; fixed to `[ \t]*` in validate-exec-plans,
  validate-sub-agent-ledger, validate-source-repository, and
  dual-role-governance-rules.
- `hasPlanEvidence` accepted `pending` as meaningful even on completed plans;
  now `pending` is valid only where allowPending holds (active plans).
- `ledger annex` regex injection (a name like `.*` matched the first block)
  and ledger-slug path traversal (`../…` escaping exec-plans/active) — slugs
  are now basename-only validated in new/step/annex/close; annex names are
  proven against the declared slug list before indexOf-based extraction.
- `reviewReportRefs` recognizes the merged evidence label, prices every
  harness/-relative `.json` token, and never JSON-parses the packet `.md`.

### Changed
- Core template scaffolds valid-by-default: dual-role fields prefill working
  values (`cross-agent`, `claude-code`/`codex`, `pending`) so a fresh
  `ledger new` draft validates green; enum menus live in review.md, the
  normative home. The core fence omits `dualRoleGovernance` (structurally
  required only when a review is triggered).
- Validators relaxed in lockstep to core-subset + validated-if-present +
  required-when-triggered: validate-exec-plans (core/annex needle split;
  dual-label compatibility keeps pre-diet superset plans green),
  validate-agentic-loop, validate-sub-agent-ledger (bench checks run when the
  annex is present), validate-cross-agent-review, validate-critique-synthesis.
- No template-version mechanism: subset semantics grandfather every existing
  completed plan; the 26 pre-scan plans stay git-anchored.

## [2.6.0] — 2026-07-06

Skill-authoring doctrine + done-when discipline (R3, R2 of the skills-doctrine
roadmap, `development/design-docs/skills-doctrine-and-curriculum-plan.md`).
Instructions are a budget: every sentence must change agent behavior, and every
step needs a checkable completion criterion — the primary defense against
premature completion.

### Added
- `framework/process/writing-skills.md`: the authoring standard for skills and
  agent-facing prose — the no-op test, named failure modes (no-op, sediment,
  sprawl, duplication, premature completion), steps-vs-reference hierarchy with
  "Done when:" criteria, description formula (leading word, one trigger per
  branch), invocation-tier economics, disclosure/placement rules, durability
  rules, and one GOOD/BAD example. Registered in the doc map, the contract's
  reference map, and the enforcement map (`writing-skills-authoring-standard`:
  drift gate + review-lens + prose-declared surfaces — sentence-level no-op
  judgments are model-relative and stay critic-enforced).

### Changed
- All 5 skills (`framework/skills-src/`): every ordered step now ends with a
  checkable "Done when:" criterion; per-sentence no-op audit applied. Net
  result: 836 → 816 words total with no skill above its prior count —
  criteria were funded by deleting no-ops (gate-enforced consequences restated
  as prose, packet-template field lists restated inline, visibility rules
  duplicated from the contract).
- `framework/process/gates.md`: ledger lifecycle now states explicit done-bars
  (planning done-when; close-gate recast as "may close only when"); executable
  target validation and cleanup checks carry done-when lines.
- `framework/process/governance.md`: change-lifecycle gates declared
  self-describing done-bars ("the gate passes only when every listed item
  verifiably exists").

## [2.5.0] — 2026-07-05

Toolchain conformance: the structure contract now covers how a core repo is
built, tested, and run, not only where its code lives. Trigger: a fleet
architecture sweep found the three sibling core repos structurally aligned on
`agent/`/`channels/`/`tools/` but diverging on toolchain — one had no
`pyproject.toml` (deps only inside `modal_app.py`), Makefile verbs differed or
were absent, one Makefile still called `flake8` after the project moved to
`ruff`, and generated validation reports were accumulating in git.

### Added
- Core toolchain clause (`framework/process/agent-system-structure.md` →
  Core Toolchain Conventions): conformant core repos must ship `pyproject.toml`
  as the single dependency + tooling source of truth and a `Makefile` defining
  the baseline verb set `test` / `lint` / `validate` / `dry-run`. Gate-enforced
  by `validate-structure.mjs` (file existence by kind + Makefile target-name
  parse that ignores `:=` assignments and dot targets). A repo that cannot yet
  comply declares `migration-planned` — the same recorded-divergence escape the
  path layout already uses.
- Generated Artifact Policy section: generated output (validation reports, run
  logs, caches, scratch state) stays in gitignored directories; the existing
  gitignore-divergence exemption already refuses to launder force-added tracked
  files, and the keep-it-gitignored rule is review-enforced (content judgment).
- Enforcement-map register entries `core-structure-conformance` and
  `core-toolchain-conventions` (`framework/registry/enforcement-map.json`),
  closing a pre-existing gap: the 2.3.0 structure contract predated the 2.4.0
  register and its obligations were never listed. Both name
  `validate-structure.mjs` as the mechanical gate plus a review-lens for the
  content-judgment residue (transport placement; requirements.txt-derived-from-
  pyproject honesty).
- Contract-test coverage (`tests/contracts/agent-system-structure-contract.test.mjs`):
  the toolchain surface is required for conformant core, missing `pyproject.toml`
  / `Makefile` / any baseline target fails, and a `:=` assignment resembling a
  target does not satisfy the verb.

### Migration
- Consumer adoption of 2.5.0 flips any core repo that lacks the toolchain
  surface to `migration-planned` at upgrade time (pointing at its packaging
  exec-plan), then back to `conformant` once `pyproject.toml` + the baseline
  Makefile land. Structural `agent/`/`channels/`/`tools/` migrations remain
  separate ledgered work.

## [2.4.2] — 2026-07-03

Second fleet-discovered hotfix pair, surfaced by the AgentSecurityMonitor sync.

### Fixed
- File discovery (`listDiscoveredFiles`) crashed with unhandled ENOENT on tracked-but-worktree-deleted files, turning a normal mid-close ledger state into a hard validation outage; discovery now existence-filters once for every consumer (command-drift, entropy, and peers).
- The structure gate's divergence enumeration counted gitignored generated caches (`__pycache__/`) as undeclared divergence, so the canonical core repo could not declare conformant; gitignored directories are exempt (`git check-ignore` exit-0-only — non-repos and unignored directories still enumerate).

## [2.4.1] — 2026-07-03

Hotfix, found by the fleet sync within minutes of 2.4.0: the skills-drift orphan rule used location as the ownership signal and flagged target-owned skills as orphans.

### Fixed
- `validate-skills-drift.mjs` orphan detection keys on the generated-note marker (`GENERATED_NOTE`, now exported): only generator-owned files can be orphans; targets keep their own hand-written skills alongside the generated ones (regression covers both directions).

## [2.4.0] — 2026-07-03

Enforcement coverage: every contract obligation gets a mechanical surface or a declared, validated exception. Trigger incident: the `[harness]` tier line silently dropped in a target session — the one obligation with zero mechanical backing; the audit that followed found the same prose-only pattern in the commit gate, the CI floor, the skills adapters, and the runtime wiring.

### Added
- Visibility enforcement (Claude Code family): statusline now shows the governing harness version (`[harness v2.4.0] tier:… | ledger:… | critic:…`) independent of model output; `UserPromptSubmit` hook re-injects the obligation plus the mechanical tier every turn; `SessionStart` hook re-arms obligations after startup/resume/compaction (the observed drift trigger); `Stop` hook blocks turns whose first text lacks the tier line (loop-guarded, fail-open) and appends compliance telemetry (`visibility-compliance.jsonl`). Wiring lives in `.claude/settings.json`, merged additively by bootstrap/upgrade — target-owned keys are never overwritten.
- Registry `runtimeEnforcement` per family (schema 1.2.0): which visibility surfaces each family's runtime can mechanically enforce, with a dated basis. Codex CLI has no hook surface — recorded as a declared exception, not a silent gap.
- `validate-runtime-adapters.mjs`: fails when the declared wiring is missing or stripped (guard-the-guards), and requires the target version-adoption record.
- Enforcement map register (`framework/registry/enforcement-map.json` + `validate-enforcement-map.mjs`): every contract obligation names its enforcement surface (commit-gate/ci/gate/contract-test/runtime-adapter) with an existing ref, or a review-lens/prose-declared exception with a substantive basis; a required-obligation floor pins the contract anchors. Normative rule: `framework/process/governance.md` → Enforcement coverage.
- Commit gate scoping: every changed substantive path must be declared in a governing ledger's `## Affected Paths` (an unrelated ledger no longer satisfies the gate); high-risk commits require critic terminal evidence at commit time; gate decisions append telemetry.
- Upgrade-adoption commit shape: targets adopt reviewed framework versions without a redundant per-target critic pass — accepted only when all substantive paths lie on the shared upgrade surface (`upgrade-surface.mjs`) and a freshly written `harness/override/governance/harness-upgrade-adoption.json` matches the incoming CHANGELOG version.
- CI floor: `harness precommit --range <base>...<head>` re-runs the same gate on the pushed diff for PRs and default-branch pushes — bypassed local hooks and `HARNESS_SKIP` can no longer land unenforced (the `validate-hooks` CI self-skip is inherent; the range gate is the closure).
- `validate-skills-drift.mjs`: generated skill adapters must exactly match `skills-src`; stale, hand-edited, missing, and orphaned outputs fail.
- Bootstrap/upgrade: both write the version-adoption record; upgrade re-activates git hooks (`core.hooksPath`) instead of assuming a v1 target ever ran activation; `.claude/settings.json` joins the distribution manifest (merge-not-overwrite).
- Contract suite `enforcement-coverage-contract.test.mjs` (23 tests): settings-merge additivity/idempotence, stripped-wiring detection and command-spoof rejection, Stop-hook tier-line shape/block/loop-guard/fail-open, skills-drift negatives, enforcement-map negatives, registry rule, upgrade-adoption acceptance and laundering rejection, range-mode CI floor, evidence binding and index/worktree consistency, staged-deletion and worktree-report negatives, governed-surface tier checks, loud skip telemetry.

### Changed
- `harness.mjs` no longer treats ledger existence as ledger evidence (rehearsal contract updated to prove the stricter gate); plan-parsing rules moved to dependency-free `ledger-rules.mjs` so the CLI and statusline survive a broken registry; Affected-Paths parsing tolerates backtick-wrapped entries.
- Commit-gate evidence model: review report files are gitignored audit artifacts and are never commit-gate inputs — high-risk evidence is exclusively the terminal record inside the covering ledger's cross-agent-review JSON, read from the staged index (HEAD in range mode), so local and CI gates judge one evidence source: the committed tree.
- Entrypoint validators now pin the `[harness]` tier-line obligation and the visibility-mechanics sentences; permission-profile validator pins the two previously unpinned hard stops (secret reading/printing scope, cleanup targeting external services).
- `harness upgrade` also ships `CHANGELOG.md` and `.github/workflows/validate.yml` (without them a target's adoption record could never match the incoming version and the CI floor never reached the fleet).

### Fixed (found by the cross-family review of this very change, five capped iterations plus verification rounds)
- Staged gate read ledger/adoption/changelog evidence from the dirty worktree; now index-only in staged mode (HEAD in range mode), with staged deletions correctly yielding no evidence.
- Stop hook accepted a bare `[harness]` prefix; now requires the full tier-line shape with the tier enum.
- CI range gate failed open on unusable bases even for publish claims; now fail-closed with a tip-commit fallback for forced refs and a single bounded genesis exception.
- A plain-text terminal-status line in a ledger counted as critic evidence (self-attestable); only the structured terminal record inside the review fence counts.
- Report-scope slug matching accepted prefix collisions (`foo` matched `foobar-report.json`); delimiter-exact now (status display).
- Runtime-adapter wiring checks accepted substring spoofs (`echo '<cmd>'`, suffix chains); exact normalized command equality now.
- High-risk paths could borrow critic evidence from an unrelated ledger; evidence now binds to the covering ledger per path.
- `.claude/`, `.codex/`, `CHANGELOG.md`, and the distribution manifest computed standard tier despite being enforcement/version surfaces; all governed (high-risk) now.
- A staged minimal record could ride a diverging worktree ledger past validate-all; governing ledgers must be identical in index and worktree.
- The CI fallback gated only the tip commit of a forced multi-commit default-branch push; base resolution moved to `ci-diff-base.mjs` — fail-closed on any unusable publish base except single-commit genesis, contract-tested.
- The adoption waiver's surface included target-adapted files the upgrade tool never writes; narrowed to exactly the tooling-written set, with a piggyback regression.
- Transition narration was falsely accounted as mechanically enforced; it is now its own enforcement-map obligation, honestly prose-declared with recorded bounds.
- The source repository's own ledgers under `development/exec-plans/` were outside the schema validators' scan path; source mode now scans them with the same rules, pre-scan history exempt only via the git-anchored `development/governance/legacy-plan-acceptance.json` (same mechanism targets use).
- Iteration-cap semantics codified and enforced as a shared pure rule: `maxReviewIterations` bounds the primary review loop; a superseding verification record honestly enumerates as many recheck rounds as convergence took (`recordIterationCapFailures`, fixture-tested both directions).
- Completed plans citing gitignored review reports no longer fail in fresh checkouts: an absent report is acceptable only when the plan carries a meaningful (or explicit n/a) Transport degradation acceptance line — deleting a report cannot silently drop the pricing question.
- A cross-agent-review-json fence outside the validated `## Cross-Agent Review` section could forge commit-gate evidence; the gate and validator now share one section-scoped parser and out-of-section fences are rejected outright.
- Review-requiredness used an independent trigger list that had drifted from the tier model; it now derives from the shared governed-path predicate (`ledger-rules.mjs`), which also gained exact-match semantics for file entries.

## [2.3.0] — 2026-07-03

Agent-system structure contract: repo-family shape and per-repo-type layout become declared, validated state instead of imitated precedent.

### Added
- `framework/process/agent-system-structure.md`: canonical agent-system family (`core` + `ios` repos) and required layout per repo type — core repos split `agent/<pkg>/` (brain), `channels/` (transports), `tools/` (domain work), `modal_app.py` (wiring); iOS repos share the `App/ + Sources/<Prefix>{AppCore,Presence,Sync} + Tests` skeleton with declared divergence (`hasWidget`, `usesXcodeproj`, `extraModules`). Motivated by a live incident: a silent email-delivery outage was diagnosable in minutes only in the repo whose transports were isolated under `channels/`.
- `framework/templates/agent-system-structure.md`: per-target declaration template (`agent-system-structure-json` fence) — every harness target declares `repoType` (`core`/`ios`/`none`), `systemName`, and `conformance` (`conformant` | `migration-planned` with a required meaningful plan, mirroring the infra-blocker policy: divergence is a recorded, owned state).
- `validate-structure.mjs`: enforces the contract in `validate-all` — missing declaration fails; conformant declarations are checked path-by-path per repo type; migration-planned passes with the plan surfaced; source-final mode exempt.
- Contract suite `agent-system-structure-contract.test.mjs` proving rejection of undeclared targets, path-by-path core/iOS layout enforcement, plan-gated divergence, and the `none` exemption in scratch targets.
- Doc-map registration: the process doc and template join the portable surface; `override/structure/agent-system-structure.md` joins the required target docs.

## [2.2.0] — 2026-07-02

Stable review transport: constants become measured data, degradation becomes priced, mechanics become self-tested.

### Added
- Per-family transport policy in `framework/registry/agents.json` (`transport.rungCeilingsMs`, `retriesPerRung`, `ceilingBasis`) — rung ceilings are registry data with a recorded basis, never bare literals in scripts.
- `harness review calibrate` (`calibrate-critic-transport.mjs`): measures real critic latency per family, records recommended ceilings under `artifacts/telemetry/critic-calibration-<family>.json`; validation fails when a registry ceiling undercuts the recorded recommendation.
- Priced degradation: review reports (schema 1.1.0) record `rungDepth` and `subPacketFallback`; a high-tier review completed below the packet-file rung requires a meaningful `Transport degradation acceptance` rationale in the plan (pre-1.1.0 reports exempt — history never rewritten).
- Retry-at-rung: one retry at the same rung before degrading, so a transient stall never permanently costs a rung of review depth.
- Stub-CLI contract suite `review-transport-contract.test.mjs` proving ceilings, retry, and pricing deterministically without network.
- Pre-committed cross-family decision gate in `framework/process/review.md`: demotion criterion (packet-file completion < 70% or unique-finding rate 0 over ten high-risk reviews) fixed in advance.
- Governance rule: operational constants live in registry/profile data with a recorded basis (`framework/process/governance.md`).

### Changed
- Default substantive-rung ceilings raised from 45s to 120–300s (measured floor recorded by live calibration); `--timeout-ms` remains an explicit override, now accepting up to 600000.

### Fixed (found by the cross-family review of this very change, 8 iterations at the packet-file rung)
- Priced-degradation rule was bypassable by citing a report only as record evidence; all `review-output` refs are now checked and a required review citing a missing report fails.
- Requiredness could be lost by leaving the payload at template defaults; plans' declared Affected Paths are cross-checked against the trigger list (active and completed).
- Prompt-echoed sample blocks and unstructured `NO_BLOCKING_ISSUES` text could clear readiness; last accepted fence across all fence names wins, and unstructured output can only block.
- Legacy `run-claude-review.mjs` exited 0 on blocking findings; success now requires `pushbackFree=true`.
- The template's own placeholder prose satisfied the degradation-acceptance check; the value is now an angle-bracket placeholder rejected by construction.
- Documented calibration staleness (CLI version change) was unenforced; the validator now compares recorded vs live CLI version (absence is not staleness).
- Script fallback transport constants violated the new operational-constants rule; removed — registry completeness is enforced at both the validation and runtime boundaries.
- Zero `novel` counts from legacy string-shaped findings could corrupt the decision gate; unclassified findings record null, the gate surfaces them and returns inconclusive on the novel criterion (completion-rate demotion is never masked).
- Latent `extractSection` bug in two validators: JS regex `\Z` matched a literal "Z", truncating any section containing one (e.g. an ISO-8601 timestamp); replaced with a true end-of-input lookahead.

## [2.1.0] — 2026-07-02

v1→v2 target migration support, driven by upgrading the first real fleet of bootstrapped targets.

### Added
- Legacy plan acceptance: a target upgraded from v1 lists pre-upgrade completed plans in `harness/override/governance/legacy-plan-acceptance.json`; `validate-exec-plans` and `validate-cross-agent-review` exempt exactly the listed completed plans. Acceptance is git-anchored (`upgradeBaseCommit`): listed plans must exist at the pre-upgrade commit, so new work cannot be laundered through the list. Malformed files, non-completed paths, missing plans, and plans absent at the base commit fail validation. Normative home: `framework/process/governance.md`.
- `harness upgrade` regenerates skill adapters in the target after `--apply`.
- Contract test `legacy-plan-acceptance-contract.test.mjs` (loader fixtures + upgrade-tool missing-path behavior).

### Fixed
- `harness upgrade` silently skipped framework-owned paths entirely missing from the target (a v1 install has no `harness/hooks`, so the pre-commit gate never arrived). Missing paths are now copied whole.
- `harness/AGENTS.md` (the normative contract) is now framework-owned in `harness upgrade`; previously upgrades left targets on the v1 contract.

## [2.0.0] — 2026-07-02

Contract/tools/gates redesign. Governance moves from prose-followed to gate-enforced.

### Added
- `harness` CLI (`harness/scripts/harness.mjs`): `check`, `status`, `tier`, `ledger`, `review`, `bootstrap`, `upgrade`.
- Pre-commit hook (`harness/hooks/pre-commit`) with self-activation check — validation fails when hooks are not active.
- Mechanical tier system (trivial/standard/high-risk) computed from touched paths, never self-declared.
- `[harness]` visibility convention: opening tier line on every response, tool/skill/ref transition lines on governed work.
- Agent registry (`harness/framework/registry/agents.json`) — families, transports, critic model policies as data.
- Review record schema v2 with role-named agreement fields; v1 vendor-named fields accepted for historical ledgers.
- Domain profiles (`harness/framework/profiles/`): programming, research, document, investigation.
- Single-source skills (`harness/framework/skills-src/`) generated to Claude, Codex, and reference formats.
- Memory contract (`framework/process/memory.md`): placement, precedence, checkpoint timing, retention.
- Rehearsal contract test: gates must reject fabricated non-compliant work and accept compliant work.
- Secret-scan gate over ledgers and override state.
- Gate telemetry (`harness/artifacts/telemetry/`).

### Changed
- `harness/AGENTS.md` rewritten as the single normative contract (~100 lines).
- Root `AGENTS.md` / `CLAUDE.md` slimmed to delegation shims.
- 23 process docs consolidated to 7 (`gates.md`, `review.md`, `governance.md`, `references.md`, `memory.md`, `permission-profiles.md`, plus contract); merged docs replaced by redirect stubs so historical references stay resolvable.
- `nonBlockingRisks` readiness policy: accepted-with-rationale by the primary performer replaces the empty-array requirement.
- Critic tiering: same-family fresh-context critic is the default; cross-family review reserved for the narrow high-risk trigger list. Never-downgrade-critic-model retained as registry data.
- OpenAI harness-engineering article demoted from coverage contract to adoption-ledger entry; per-heading coverage validator retired.

### Unchanged by design
- Historical completed plans (evidence; schema v1 accepted, paths kept resolvable via stubs).
- Hard stops for destructive operations.
- Framework/override boundary and bootstrap layout contract anchors.

## [1.0.0] — 2026-07-02

Baseline tag of the v1 harness: 23 process docs, 25 validators, 11 contract-test suites,
cross-agent review transport, distribution manifest, bootstrap guide.
