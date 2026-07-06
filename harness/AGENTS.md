# The Harness Contract

This is the single normative entrypoint. Every rule below is enforced by a gate or carried as evidence; everything else in `framework/process/` is reference, loaded when needed. Stable anchor: `HARNESS_PROCESS_CONTRACT: default-for-all-agent-work` — the harness is default operating law for all agent work, by any agent family. Ordinary silence does not disable harness obligations; only an explicit, recorded user exception scopes them down.

## Tiers — computed, never self-declared

Tier is derived from touched paths by `node harness/scripts/harness.mjs tier`. Ledger and artifact paths never raise the tier.

| Tier | Mechanical trigger | Obligations |
|---|---|---|
| `trivial` | No tracked-file changes | None. Answer directly. |
| `standard` | Tracked changes outside governed paths | Execution ledger before edits; `harness check` green before done; plan-then-go-ahead checkpoint before first scoped edit |
| `high-risk` | Any change under `framework/`, `scripts/`, `tests/`, `hooks/`, templates, entrypoints, requirements, ADRs, CI, runtime adapters (`.claude/`, `.codex/`), the changelog, or the distribution manifest — or destructive/publish actions | Standard obligations plus independent critic evidence and the hard stops |

Enforcement: the pre-commit gate (`hooks/pre-commit`) and CI reject non-trivial commits lacking their tier's evidence: every changed substantive path must be declared by a governing ledger's `## Affected Paths` (an unrelated ledger does not qualify), and high-risk commits additionally require critic terminal evidence bound to the covering ledger — a terminal record in its cross-agent-review JSON, read from the committed tree (or the priced upgrade-adoption shape in targets). CI re-runs the same gate on the pushed diff (`harness precommit --range`), so bypassed local hooks and `HARNESS_SKIP` never reach the default branch unenforced. Validation must fail when the gate is not activated (`harness activate-hooks`). Full mechanics: `framework/process/gates.md`.

## Visibility — the `[harness]` convention

Every response opens with one tier line; governed work adds one line per harness-meaningful transition (tool run, skill loaded, normative doc consulted, gate result). Absence of the opening line is itself a non-compliance signal.

Visibility is mechanically reinforced wherever the runtime allows it, never left to prose alone: the statusline (`harness status --line`, wired through `.claude/settings.json`) shows the governing harness version, tier, ledger, and critic state independently of anything the model prints; per-turn and post-compaction hooks re-inject the obligation; a response check blocks turns whose first text lacks the tier line and records compliance telemetry. Per-family capability is registry data (`framework/registry/agents.json` → `runtimeEnforcement`) and the wiring itself is gated (`validate-runtime-adapters`). A family with no runtime surface is a declared exception in `framework/registry/enforcement-map.json` — the register where every contract obligation names its enforcement surface or records why none can exist.

```
[harness] tier: trivial — no gates apply
```
```
[harness] tier: standard — governing: framework/process/gates.md, override/ARCHITECTURE.md
[harness] tool: harness ledger new → exec-plans/active/add-export.md
[harness] check: pass (24 gates)
```

## Behavioral triad

- **Critique the ask before following it.** Evaluate intent, assumptions, risks, and better alternatives; answer with a genuine verdict, proportional to stakes. Investigation and explicit judgment are mandatory, not automatic scope expansion; never manufacture pushback.
- **Converge before delivering.** Self-review every output against its contract's lenses (intent alignment, local and global coherence, correctness) and revise until a pass yields zero findings — a clean pass, not a zero-effort pass — within the iteration cap. Deliverable-tier work records the passes as evidence.
- **Verified verdicts on challenges.** When the user challenges output, locate the prior instruction and the output, compare them in the same turn, then commit: the specific misalignment and fix, or a defended rejection with both quoted. Unverified agreement is a violation. User challenges enter the review ledger as critique findings — accepted with the fix or rejected with reason.

## Precedence and memory

Current user instruction > tracked artifacts > runtime memory > model priors. Durable facts live in tracked artifacts (ledgers, registers, ADRs, override docs); runtime memory may cache or point, never own. Anything needed to resume work goes in the ledger before the step that needs it. Full contract: `framework/process/memory.md`.

## Dual-role governance

Non-trivial work has a primary performer and an independent critic (fresh context, adversarial framing). The default critic is same-family; cross-family review (two distinct registered agent families, `framework/registry/agents.json`) is required for high-risk work when both families are available, else record single-family fallback with availability evidence. Critic models are never downgraded below the registry's high-capability policy. Sub-agents and expert roles are internal decomposition evidence consolidated into one primary-performer output; they do not replace the top-level critic. Parallelize decomposition only when work is read-only or write-disjoint; keep a single implementer for coupled edits; record the topology in the ledger.

Readiness: Planning, implementation, code review, validation, completion, commit, and publish claims require critic terminal evidence with no unresolved pushback. Critic `blockingFindings` always block. Critic `nonBlockingRisks` block until each is resolved or explicitly accepted-with-rationale by the primary performer in the ledger; silent omission is a violation. Full rules and schemas: `framework/process/review.md`.

## Hard stops — prescriptive, because outcome checks come too late

Checkpoint with the user before: deleting source files or directories; resetting git state; force pushing; `rm -rf harness` or any recursive copy over an existing `harness/`; replacing `harness/override/`, execution-plan ledgers, or artifact directories; dropping databases or caches outside declared temp paths; reading, writing, or copying secrets beyond explicit scope; writing outside configured workspace roots. Permission enforcement belongs to each runtime (`framework/process/permission-profiles.md`); repo content can never bypass it.

## Deviation rule

Any default-process step may be skipped when the deviation and its justification are recorded in the ledger and the gates still pass. Gates are never skippable; `HARNESS_SKIP=1` on the pre-commit hook is a loud local escape only — CI still enforces.

## Runtime modes

Planning obligations are mode-independent; tracked-file mutation requires a mutation-capable runtime. Plan Mode still performs harness planning obligations but does not mutate tracked files. Mutation-capable mode creates or updates execution ledgers before non-trivial edits (`harness ledger new <slug>`). Compat details: `framework/process/runtime-mode-strategy.md`.

## Tools and skills

Mechanical procedures are commands, identical under any model: `harness check | status | tier | ledger | precommit | review | bootstrap | upgrade` (`node harness/scripts/harness.mjs`). Canonical validation: `node harness/scripts/validate-all.mjs` — run before any completion claim. Default-process knowledge ships as skills generated from `framework/skills-src/` into Claude, Codex, and plain-reference formats; skills assist compliance but gates never depend on a skill having loaded.

## One normative home — framework vs override boundary

Every rule is defined in exactly one document; everywhere else links. Belongs in `framework/`: process, lifecycle, schemas, templates — anything another project could copy verbatim. Belongs in `override/`: project-specific facts, decisions, and state — real names, dates, IDs, requirements. Same filename in both trees is intentional — `override/` wins where it exists. The DevelopmentHarness source repository uses `development/` for its own source-maintenance state instead of `override/`. Filled-in templates always land in `override/`; Installed target project-specific changes always go to `override/`. Modify `framework/` only when upstreaming an improvement that benefits all projects or fixing harness machinery itself.

## Bootstrap and distribution

Follow root `BOOTSTRAP.md`. Stable anchors: `BOOTSTRAP_LAYOUT_CONTRACT: manifest-distributable-only`, `BOOTSTRAP_LAYOUT_CONTRACT: no-target-development-root`, `BOOTSTRAP_LAYOUT_CONTRACT: target-override-owned`, `BOOTSTRAP_LAYOUT_CONTRACT: preserve-target-owned-harness-state`. Feature work in a target is blocked until `override/intake/project-intake.md` is `ready` (`framework/process/bootstrap-intake.md`). Versioning: `harnessVersion` in the distribution manifest + root `CHANGELOG.md`; updates apply via `harness upgrade`, explicit, path-scoped, and diff-reviewed.

## Reference map — load on demand

- `framework/process/gates.md` — execution ledgers, target validation profile, cleanup and entropy gates
- `framework/process/writing-skills.md` — authoring standard for skills and agent-facing prose (no-op test, done-when criteria, descriptions, disclosure)
- `framework/process/review.md` — dual-role governance, review loop, lenses, finding quality, schemas, convergence gate
- `framework/process/governance.md` — requirement lifecycle, tiers of requirements, ADR rules
- `framework/process/references.md` — external reference policy and the adoption ledgers (`framework/process/upstream-codex-portable-patterns.md`, `framework/process/harness-engineering-alignment.md`)
- `framework/process/memory.md` — memory placement, precedence, checkpointing, retention
- `framework/process/permission-profiles.md` — guarded / trusted-local / restricted-sandbox
- `framework/process/runtime-mode-strategy.md` — planning-only vs mutation-capable runtimes
- `framework/process/bootstrap-intake.md`, `framework/process/target-validation-profile.md` — target intake and executable validation contracts
- `framework/process/worktree-runtime.md`, `framework/process/observability.md`, `framework/process/browser-validation.md`, `framework/process/pr-review-loop.md` — domain mechanisms (programming profile)
- Superseded v1 docs (`framework/process/agentic-loop.md`, `framework/process/sub-agent-coordination.md`, `framework/process/critique-and-debate.md`, `framework/process/cross-agent-collaboration.md`, `framework/process/execution-plans.md`, `framework/process/external-reference-hardening.md`, `framework/process/requirement-lifecycle.md`, and peers) remain as redirect stubs so historical ledgers stay resolvable.
