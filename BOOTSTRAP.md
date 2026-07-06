# Bootstrap Guide

> Retained harness documentation. This file describes how the DevelopmentHarness is installed into projects. ClaudeClaw is an installed target of that harness (v2.10.0); this document is reference material for future upgrades and re-bootstraps, not a claim that this repository is the harness source.

How to install this governance harness in a new project.

## Pattern

DevelopmentHarness is a portable harness designed to live as a `harness/` subdirectory inside another project. Your project's root holds your code, README, and project-level entrypoint (e.g., `CLAUDE.md`, `AGENTS.md`). The manifest-approved distributable surface of the `harness/` subtree provides the governance machinery: requirement register, ADR enforcement, lifecycle process docs, validation pipeline.

`development/` is source-only state for the DevelopmentHarness repository. It is not copied into installed targets.

If your bootstrap automation fetches the whole DevelopmentHarness repository, do not leave that raw checkout as the target repository layout. Use it as a source archive, then copy only the manifest-approved distributable files. A target project must not keep root `development/`; the concrete validation-mode trigger is a valid `development/developmentharness-source.json` marker, which switches validation into DevelopmentHarness source mode. A target project must create its own `harness/override/` from the framework templates.

Stable bootstrap layout contract:
- `BOOTSTRAP_LAYOUT_CONTRACT: manifest-distributable-only`
- `BOOTSTRAP_LAYOUT_CONTRACT: no-target-development-root`
- `BOOTSTRAP_LAYOUT_CONTRACT: target-override-owned`
- `BOOTSTRAP_LAYOUT_CONTRACT: preserve-target-owned-harness-state`

## Harness Is Default Operating Law

Stable harness process contract:
- `HARNESS_PROCESS_CONTRACT: default-for-all-agent-work`

The harness process applies to all Codex, Claude Code, and other agent work by default. Ordinary silence does not disable harness obligations. A user may explicitly request a bounded exception, but the exception must be recorded when harness evidence rules apply.

Plan Mode still performs harness planning obligations but does not mutate tracked files. Mutation-capable mode creates or updates execution ledgers before non-trivial edits, then runs the required expert-role, validation, and review loops.

```
YourProject/
├── README.md             # your project's README
├── AGENTS.md             # cross-agent entrypoint, delegates to harness/AGENTS.md
├── CLAUDE.md             # Claude Code shim, delegates to AGENTS.md and harness/AGENTS.md
├── src/                  # your code
├── tests/                # your project tests (separate from harness tests)
└── harness/              # ← manifest-approved distributable harness surface
    ├── AGENTS.md         # governance entrypoint — start here
    ├── framework/        # portable templates and process — DON'T fill in project content here
    │   └── seeds/        # copy-if-missing README defaults for live target directories
    ├── exec-plans/       # execution-plan templates and ledgers
    ├── override/         # project-specific filled-in content — created by the target project
    │   └── ARCHITECTURE.md  # target project's architecture doc lives in override/
    ├── tests/
    ├── scripts/
    └── artifacts/
```

## Framework vs Override

The single most important rule: **`framework/` is portable, `override/` is project-specific.**

For DevelopmentHarness itself, source-maintenance state lives in root `development/`. For installed targets, filled-in project content goes in `harness/override/`.

## Harness Ownership And Overwrite Policy

Bootstrap and update flows must preserve target-owned harness state. The harness has four ownership classes:

| Ownership class | Paths | Bootstrap/update policy |
|---|---|---|
| **Framework-owned** | `harness/framework/`, `harness/scripts/`, `harness/tests/`, `harness/exec-plans/templates/` | May be installed from the manifest-approved distributable surface. Framework updates must be explicit, path-scoped, and diff-reviewed. |
| **Target-owned live state** | `harness/override/`, `harness/exec-plans/active/`, `harness/exec-plans/completed/`, `harness/exec-plans/tech-debt/` | Created and maintained by the target project. Preserve these paths during bootstrap and updates. |
| **Generated evidence** | `harness/artifacts/` | Runtime validation and review output. Preserve existing evidence unless the target project explicitly requests cleanup under its cleanup policy. |
| **Seed defaults** | `harness/framework/seeds/` | Copy-if-missing only. Seeds provide starter README anchors for fresh bootstrap, not replacement content for existing live directories. |

Executable and runtime paths are stable: keep `harness/scripts/`, `harness/tests/`, live `harness/exec-plans/`, and live `harness/artifacts/` at their documented top-level locations. Do not move live plans or generated evidence under `harness/framework/seeds/`.

Forbidden bootstrap/update behavior:
- no `rm -rf harness`;
- no recursive copy over an existing `harness/`;
- no replacement of `harness/override/`, execution-plan ledgers, or artifact directories;
- no framework update that is not explicit, path-scoped, and diff-reviewed.

When installing into a fresh target, seed defaults under `harness/framework/seeds/` may be copied into the matching live paths only if those live paths are missing. Existing live README anchors in `harness/exec-plans/` and `harness/artifacts/` remain valid compatibility anchors; seeds are the source for fresh bootstrap copy-if-missing behavior.

Runtime adapters and version record: bootstrap and upgrade merge the statusline and visibility hooks into `.claude/settings.json` additively — target-owned settings keys are never overwritten — and write the governing harness version to `harness/override/governance/harness-upgrade-adoption.json` (target-owned; read by the statusline and the commit gate's upgrade-adoption shape). Both flows activate git hooks (`core.hooksPath → harness/hooks`); `validate-runtime-adapters` fails when the wiring is missing or stripped.

## Directory Ownership At A Glance

| Path | Ownership class | Copy to installed targets? | Owner after bootstrap | Notes |
|---|---|---:|---|---|
| `development/` | Source-only | No | DevelopmentHarness source repo only | Source ADRs, source requirements, completed source plans, migration evidence, and `development/developmentharness-source.json`. Keeping a valid source marker in a target makes validation think the target is this source repo. |
| `harness/framework/` | Framework-owned | Yes | Harness framework | Portable process, schemas, templates, and seed defaults. Keep project facts out of this tree. |
| `harness/framework/seeds/` | Seed defaults | Yes | Harness framework | Copy-if-missing README defaults for fresh target `harness/exec-plans/` and `harness/artifacts/` directories. Never overwrite live target state from seeds. |
| `harness/scripts/` | Framework-owned | Yes | Harness framework | Portable validation and review transport scripts. |
| `harness/tests/` | Framework-owned | Yes | Harness framework plus target-added tests | Contract tests are portable; target projects may add target-specific harness tests. |
| `harness/exec-plans/templates/` | Framework-owned | Yes | Harness framework | Template only. |
| `harness/exec-plans/active/` | Target-owned live state | Yes, README anchor only or seed copy-if-missing | Target project | Active target execution plans go here. Do not copy DevelopmentHarness source completed-plan history. |
| `harness/exec-plans/completed/` | Target-owned live state | Yes, README anchor only or seed copy-if-missing | Target project | Completed target execution plans go here. |
| `harness/exec-plans/tech-debt/` | Target-owned live state | Yes, README anchor only or seed copy-if-missing | Target project | Target technical debt plans go here. |
| `harness/artifacts/` | Generated evidence | Yes, README anchors only or seed copy-if-missing | Target project | Generated validation and review reports are ignored. Preserve existing evidence unless cleanup is explicitly requested. |
| `harness/override/` | Target-owned live state | Create in target | Target project | Filled target facts, ADRs, requirements, runtime, observability, validation profile, and quality mechanisms. |
| Root `AGENTS.md` and `CLAUDE.md` | Target-owned entrypoints | Use as starter guidance | Target project | Adapt to the target project while keeping delegation to `harness/AGENTS.md` and mandatory-by-default harness process. |

## Agent Bootstrap Contract

When a user tells Codex or Claude Code to fetch `github.com/dearto20/DevelopmentHarness` and bootstrap a new repository, the agent must treat the fetched repository as a source archive, not as the target layout.

Stable agent bootstrap anchors:
- `BOOTSTRAP_AGENT_CONTRACT: fetch-source-archive`
- `BOOTSTRAP_AGENT_CONTRACT: ask-intake-before-target-files`
- `BOOTSTRAP_AGENT_CONTRACT: materialize-target-override`

Required agent flow:
1. Fetch or clone `github.com/dearto20/DevelopmentHarness` into a temporary/source location.
2. Read this `BOOTSTRAP.md`, `README.md`, `harness/AGENTS.md`, and `development/distribution-manifest.json`.
3. Ask the user for the minimum target intake facts before writing target-owned files:
   - repository name and one-sentence purpose;
   - primary users and main workflows;
   - project type and runtime surfaces: web app, API, CLI, mobile, agent, library, document/artifact, or other;
   - deployment model: local-only, cloud, device, mixed, internal, public, or regulated;
   - data sensitivity, security posture, and regulatory constraints;
   - expected validation commands: build, lint, unit test, integration test, browser journey, smoke test, or other;
   - hard constraints, non-goals, and success criteria.
4. Copy only the manifest-approved distributable surface into the target. Do not copy root `development/`, DevelopmentHarness completed source plans, generated artifacts, or source-only fixtures. If the target already has a `harness/`, preserve target-owned harness state: no `rm -rf harness`, no recursive copy over an existing `harness/`, and no replacement of `harness/override/`, execution-plan ledgers, or artifact directories.
5. Create the target's own `harness/override/` files from framework templates and fill them from the user-provided intake facts. Seed defaults under `harness/framework/seeds/` are copy-if-missing only for fresh live README anchors.
6. Adapt target root `AGENTS.md` and `CLAUDE.md` so both delegate to `harness/AGENTS.md`.
7. Run `node harness/scripts/validate-all.mjs`.
8. If validation reports missing target facts, ask focused follow-up questions instead of guessing.

First validation results usually fall into two groups:
- Group A expected setup gaps: missing target-owned `harness/override/` files, incomplete intake, or unconfigured target validation commands. Fill these from templates and user intake facts.
- Group B harness portability bugs: platform path false positives, ignored virtualenv/vendor files being scanned, or generated/tooling state counted as evidence. Fix these upstream in portable harness validators and scripts; do not hide them by weakening target override requirements.

Before adding any content, read the boundary rule in `harness/AGENTS.md` ("Framework vs Override — Boundary Rule"). Quick guide:

- Filling in QUALITY_SCORE/RELIABILITY/SECURITY for your project? → create `harness/override/<file>.md` (copy from `harness/framework/<file>.md` template). Don't edit the framework version.
- Writing a real ADR? → `harness/override/design-docs/adr/adr-NNN-*.md`. The template lives at `harness/framework/design-docs/adr-template.md`.
- Adding requirement entries? → `harness/override/requirements/requirement-register.json`.
- Improving the lifecycle process or a checklist? → that's a framework upstream change; consider PRing it to DevelopmentHarness.

## What This Harness Provides

Out of the box, you get:
- **Requirement traceability**: a machine-readable register (`harness/override/requirements/requirement-register.json`) with automated schema enforcement.
- **ADR enforcement**: accepted architectural decisions must have artifact and verification enforcement points, and all referenced paths must exist.
- **Validation pipeline**: `node harness/scripts/validate-all.mjs` discovers and runs all gates automatically — scans `harness/scripts/validate-*.mjs` for validation scripts and `harness/tests/` for test files. No hardcoded steps.
- **10-step requirement lifecycle**: `harness/framework/process/requirement-lifecycle.md` — gated process for every requirement add/modify/remove.
- **Execution plans**: `harness/framework/process/execution-plans.md` and `harness/exec-plans/templates/implementation-plan.md` for durable work ledgers.
- **Bootstrap intake**: `harness/framework/process/bootstrap-intake.md`, `harness/framework/templates/bootstrap-intake.md`, and `harness/override/intake/project-intake.md` capture target platform, users, domain, runtime, risk, success criteria, and validation expectations before feature work.
- **Executable target validation profile**: `harness/framework/process/target-validation-profile.md` and `harness/override/validation/target-validation-profile.md` define commands that `node harness/scripts/validate-all.mjs` executes.
- **Agentic loop**: `harness/framework/process/agentic-loop.md` requires each expert role to repeat DO/CHECK/REVISE/RECHECK/SYNTHESIZE until terminal.
- **Sub-agent governance**: `harness/framework/process/sub-agent-coordination.md` and `harness/framework/process/critique-and-debate.md` define expert roles, handoffs, critique, debate, and synthesis as internal decomposition evidence.
- **Dual-role governance**: `harness/framework/process/cross-agent-collaboration.md` defines the top-level primary performer and independent critic model for non-trivial work, with Codex/Claude separation preferred and same-family fallback recorded when one agent family is unavailable.
- **Harness Engineering alignment**: `harness/framework/process/harness-engineering-alignment.md` encodes the OpenAI Harness Engineering baseline as local artifacts, validators, tests, ADRs, requirements, and override mechanisms.
- **External reference hardening**: `harness/framework/process/external-reference-hardening.md` classifies external sources, blocks raw copying, and requires clean independent justification before adopting reference patterns.
- **Worktree runtime and observability contracts**: target projects document startup, teardown, logs, metrics, traces, and browser evidence in `override/`.
- **Override-bound target mechanisms**: target projects fill runtime, observability, browser, cleanup, quality, and PR/CI mechanism docs under `harness/override/`; framework templates are not target evidence.
- **Permission profiles**: `guarded`, `trusted-local`, and `restricted-sandbox` modes define approval expectations and hard stops.
- **CI workflow**: GitHub Actions runs the full validation pipeline on every push.

## Step-by-Step Setup

### 1. Install the harness subtree

Copy the manifest-approved distributable harness surface into your project at `harness/`. Do not copy root `development/`, DevelopmentHarness source completed plans, generated artifacts, or target-owned source fixtures. If you are updating an existing target, preserve target-owned harness state; do not recursively replace `harness/`.

Whole-repo fetch rule:
1. Fetch or clone DevelopmentHarness into a temporary/source location.
2. Read `development/distribution-manifest.json`.
3. Copy only `distribution.include` paths and apply `distribution.exclude`. For an existing target, apply framework updates as explicit, path-scoped, diff-reviewed changes.
4. Confirm the target root does not contain `development/`.
5. Create target-owned `harness/override/` files from `harness/framework/templates/`, and copy seed README anchors from `harness/framework/seeds/` only when the matching live target path is missing.

```bash
# Option A: manifest-based copy
# Read /path/to/DevelopmentHarness/development/distribution-manifest.json
# and copy only the included distributable paths, excluding source-only paths.

# Option B: git submodule (if you want to track upstream changes)
git submodule add https://github.com/dearto20/DevelopmentHarness.git harness-upstream
ln -s harness-upstream/harness harness
```

Also copy `.github/workflows/validate.yml` if you want the CI workflow.

### 2. Create your project root entrypoints

Create or update your project's root `AGENTS.md` for Codex-compatible agents:

```markdown
# YourProject

Brief description of your project.

## Harness

This project uses a governance harness under `harness/`. Read `harness/AGENTS.md` for the framework, lifecycle, and reading order.

Stable harness process contract: `HARNESS_PROCESS_CONTRACT: default-for-all-agent-work`

**Working rules:**
- The harness is default operating law for all agent work. Ordinary silence does not disable harness obligations.
- A bounded exception applies only when the user explicitly requests it and the exception is recorded when harness evidence rules apply.
- Plan Mode still performs harness planning obligations but does not mutate tracked files.
- Mutation-capable mode creates or updates execution ledgers before non-trivial edits.
- Every change follows the 10-step lifecycle in `harness/framework/process/requirement-lifecycle.md`.
- External references follow `harness/framework/process/external-reference-hardening.md`; unclear or prohibited sources are observe-only unless independently justified.
- Validation: `node harness/scripts/validate-all.mjs` must pass before any change is complete.
```

Create or update your project's root `CLAUDE.md` for Claude Code:

```markdown
# YourProject For Claude Code

Read `AGENTS.md`, then `harness/AGENTS.md`. The canonical harness rules live there.
Harness process is default operating law for all agent work: `HARNESS_PROCESS_CONTRACT: default-for-all-agent-work`.
Ordinary silence does not disable harness obligations. Plan Mode still performs harness planning obligations but does not mutate tracked files; mutation-capable mode creates or updates execution ledgers before non-trivial edits.
Run `node harness/scripts/validate-all.mjs` before completion.
```

### 3. Fill in `harness/AGENTS.md`

Replace the `<!-- TODO -->` sections in `harness/AGENTS.md`:
- **Project Overview**: 2-3 sentences describing what this project builds or produces.
- **Project-Specific Constraints**: non-negotiable rules (e.g., "client-only", "no external APIs", "output is a PDF report").
- **Reading Order**: add project-specific docs as you create them.

### 3a. Complete bootstrap intake

Copy `harness/framework/templates/bootstrap-intake.md` to:

```
harness/override/intake/project-intake.md
```

Fill the `intake-json` block with concrete target facts:
- target platform: cloud, iOS, Android, desktop, embedded, hybrid, CLI, or other;
- deployment model: local-only, cloud-only, device-only, mixed, internal, public, regulated;
- audience and user roles: personal user, B2B buyer/admin, IT admin, frontline worker, office worker, consumer, reviewer;
- domain or vertical: rental, retail, health, hospital, finance, government, developer tooling, or other;
- runtime surfaces: browser, API, CLI, mobile, background job, device, document/artifact;
- data sensitivity, security posture, regulatory posture, operational impact;
- success criteria, non-goals, constraints, and expected validation command groups.

Set `state` to `ready` only when all critical fields are filled. `draft` and `incomplete` block feature implementation. Noncritical unknowns require rationale, reviewer role, timestamp, replacement evidence, and follow-up.

### 4. Fill in `harness/override/ARCHITECTURE.md`

Document your project's structure (the file is in `override/` because architecture is project-specific content per the boundary rule):
- **Technology Stack**: languages, frameworks, tools.
- **Constraints**: runtime limits, supported environments, input ranges.
- **Structure**: layers, modules, dependency direction.
- **Module Contracts**: for each core module — input, output, guarantees, error codes.
- **File Structure**: current directory layout.

### 4a. Configure executable target validation

Copy `harness/framework/templates/target-validation-profile.md` to:

```
harness/override/validation/target-validation-profile.md
```

Fill `target-validation-json` with concrete command arrays for the target project. Use bounded commands that can complete unattended:
- build
- lint
- unit test
- integration test
- runtime smoke
- browser journey
- observability check
- cleanup check
- PR/CI readiness check

The target profile is executed by `harness/scripts/validate-target-profile.mjs`, which is discovered by `validate-all.mjs`. A command string existing in a doc is not enough; the command must run and exit `0`, or it must be classified as an evidence-backed infra blocker.

### 4b. Fill target mechanism override docs

Copy the matching framework templates into `override/` and fill them:

| Create | Source template |
|--------|-----------------|
| `harness/override/runtime/worktree-runtime.md` | `harness/framework/templates/worktree-runtime.md` |
| `harness/override/observability/observability.md` | `harness/framework/templates/observability.md` |
| `harness/override/browser/browser-validation.md` | `harness/framework/templates/browser-validation.md` |
| `harness/override/cleanup/recurring-cleanup.md` | `harness/framework/templates/recurring-cleanup.md` |
| `harness/override/quality/architecture-invariants.md` | `harness/framework/templates/architecture-invariants.md` |
| `harness/override/quality/taste-invariants.md` | `harness/framework/templates/taste-invariants.md` |
| `harness/override/pr/pr-ci-loop.md` | `harness/framework/templates/pr-ci-loop.md` |

Each applicable mechanism must link to executable target profile command IDs. Each not-applicable mechanism must include rationale, replacement evidence, reviewer role, timestamp, and linked intake field. High-risk not-applicable decisions require cross-agent review.

### 5. Create your first requirement

Add an entry to `harness/override/requirements/requirement-register.json`:

```json
{
  "version": 2,
  "mandatorySourceDocs": ["AGENTS.md", "override/ARCHITECTURE.md"],
  "requirements": [
    {
      "id": "REQ-001",
      "title": "Short description of the requirement",
      "tier": "hard",
      "category": "scope",
      "sourceDocs": ["AGENTS.md"],
      "guidanceDocs": ["AGENTS.md"],
      "artifactPaths": ["path/to/artifact"],
      "validationPaths": ["tests/your-test.test.mjs"],
      "validationMode": "automated"
    }
  ]
}
```

Paths in `sourceDocs`/`guidanceDocs`/`artifactPaths`/`validationPaths` are resolved relative to the harness root (i.e., `harness/`). Use paths like `AGENTS.md` (harness-root entrypoint), `override/ARCHITECTURE.md`, `framework/RELIABILITY.md`, or `tests/contracts/foo.test.mjs`.

**Required fields per requirement:**
| Field | Description |
|-------|-------------|
| `id` | Unique ID, e.g., `REQ-001`. Never reuse after removal. |
| `title` | Short description. |
| `tier` | `hard` (blocking), `review` (human judgment), `future` (aspirational). |
| `category` | Domain: `scope`, `workflow`, `architecture`, `domain`, `product`, `quality`, `reliability`, `security`, `design`, `frontend`, `data-governance`, `discussion`, `diagram`, `research`, `narrative`. |
| `sourceDocs` | Docs that ground this requirement. Must exist on disk. |
| `guidanceDocs` | Docs guiding fulfillment. Must exist on disk. |
| `artifactPaths` | Paths where the requirement is realized (code, docs, diagrams, slides). Must exist. |
| `validationPaths` | Paths that validate the requirement. Must exist. |
| `validationMode` | `automated`, `artifact-review`, `content-check`, `manual-review`, or `planned`. |

**Tier-to-mode rules:**
| Tier | Allowed modes |
|------|---------------|
| `hard` | `automated`, `artifact-review`, `content-check` |
| `review` | `manual-review` |
| `future` | `planned` |

**`mandatorySourceDocs`**: lists docs that must be referenced by at least one requirement. The test enforces this once you have at least one requirement.

### 6. Create your first ADR (if needed)

Copy `harness/framework/design-docs/adr-template.md` to a new file under `harness/override/design-docs/adr/`:

```
harness/override/design-docs/adr/adr-001-your-decision.md
```

For `Accepted` ADRs, the decision-enforcement test checks:
1. The file contains `- \`Accepted\`` in the status line.
2. It has an `## Artifact Enforcement` section listing paths where the decision is realized (code, docs, diagrams, slides — any deliverable).
3. It has a `## Verification Enforcement` section listing paths that verify the decision holds (tests, scripts, review checklists, reference docs).
4. At least one path in each section.
5. All referenced paths exist on disk (resolved relative to `harness/`).
6. The ADR ID appears in `harness/override/ARCHITECTURE.md` and `harness/framework/RELIABILITY.md`.

Update the ADR index at `harness/override/design-docs/adr/index.md`.

### 7. Add project-specific tests

Place test files under `harness/tests/` (the validator scans this dir). For project-level tests outside the harness, run them via your own test runner — the harness's `validate-all.mjs` only scans `harness/tests/`.

Example contract test under `harness/tests/contracts/my-contract.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";

test("my contract holds", () => {
  assert.equal(1 + 1, 2);
});
```

### 8. Add project-specific validation steps (optional)

The pipeline auto-discovers validation steps — no configuration needed:
- **Test files**: any `.test.mjs` file under `harness/tests/` is picked up by `node --test`.
- **Validation scripts**: any `harness/scripts/validate-*.mjs` file (except `validate-all.mjs`) is auto-discovered and run before the test suite.

Examples by project type:
- **Web app**: `harness/scripts/validate-fixtures.mjs` for data integrity
- **Discussion/research**: `harness/scripts/validate-citations.mjs` for source completeness
- **Diagram/slide**: `harness/scripts/validate-render.mjs` for artifact renderability

### 9. Define runtime, observability, and browser affordances

For implementation projects, fill target-project override mechanism docs with:
- Per-worktree startup, teardown, port, env, cache, and artifact rules.
- Log locations or query commands.
- Metric and trace endpoints, dashboards, or non-applicable rationale.
- Browser automation, screenshot/video, DOM, and viewport evidence requirements for UI projects.

Use these framework references:
- `harness/framework/process/worktree-runtime.md`
- `harness/framework/process/observability.md`
- `harness/framework/process/browser-validation.md`
- `harness/framework/process/target-validation-profile.md`

### 10. Use execution plans and sub-agent expert roles

First read `harness/framework/process/runtime-mode-strategy.md`.

In a planning-only runtime, gather evidence, decompose intent, identify expert roles, and produce a proposed plan without editing repository-tracked artifacts.

In a mutation-capable runtime, for non-trivial work, copy `harness/exec-plans/templates/implementation-plan.md` into `harness/exec-plans/active/` before artifact edits. If the work resumes from a planning-only proposal, convert the accepted proposal into the active execution plan first and record the mode transition evidence.

Use `harness/framework/process/agentic-loop.md` and `harness/framework/process/sub-agent-coordination.md` to record expert roles:
- planner
- architect
- implementer
- test-engineer
- security-reviewer
- code-reviewer
- documentation-steward
- verifier

For non-trivial work, follow `harness/framework/process/cross-agent-collaboration.md` and record top-level dual-role governance in the execution plan. One role is the primary performer and the other is the independent critic. Prefer Codex plus Claude Code; if one agent family is unavailable, record single-family dual-role fallback instead of skipping critique.

For planning, implementation, code review, validation, completion, commit, and publish claims, critic evidence must be pushback-free. Treat `nonBlockingRisks` as unresolved pushback for readiness: revise and rerun critique, or report the work as blocked/not-ready.

Sub-agent expert roles are internal decomposition evidence. They must be consolidated into one primary-performer output and do not replace the top-level critic.

For high-risk or framework-affecting work, use cross-agent review between Codex and Claude Code when available and record the terminal review state in the execution plan. When invoking Claude Code from Codex, create a packet from `harness/framework/templates/cross-agent-review-packet.md` and run `node harness/scripts/run-claude-review.mjs --packet harness/artifacts/cross-agent-review/<review-id>-packet.md --out harness/artifacts/cross-agent-review/<review-id>-report.json` so liveness, retries, timeouts, and review output are recorded consistently.

### 11. Fill in remaining docs

**Important** — read `harness/AGENTS.md` "Framework vs Override — Boundary Rule" before placing project content. The short version: **filled-in project content goes in `harness/override/`, not `harness/framework/`.** The `framework/*.md` files are templates that stay portable.

For each doc below, **copy the template** from `harness/framework/X.md` to `harness/override/X.md` and fill in your project-specific content there:

| Create | When | Source template |
|--------|------|-----------------|
| `harness/override/SECURITY.md` | When your project has security-relevant constraints | `harness/framework/SECURITY.md` |
| `harness/override/QUALITY_SCORE.md` | When you have hard/review/future quality criteria | `harness/framework/QUALITY_SCORE.md` |
| `harness/override/RELIABILITY.md` | When you add project-specific gate levels | `harness/framework/RELIABILITY.md` |
| `harness/override/references/<docs>.md` | When you need source provenance or data governance | `harness/framework/references/validation-data-governance.md` |

The `framework/` versions stay untouched (they're shared with all projects using this harness). Editing them only makes sense if you're upstreaming a generally-useful improvement.

### 12. Run validation

```bash
node harness/scripts/validate-all.mjs
```

The validation pipeline discovers framework validators, contract tests, and the executable target validation profile. As you add requirements and ADRs, the tests enforce traceability. As you fill target mechanisms, the target profile must execute concrete commands or record evidence-backed infra blockers.

### 13. Push to CI

The `.github/workflows/validate.yml` runs on every push and calls `node harness/scripts/validate-all.mjs`. Adjust `runs-on` and Node version as needed.

## File Structure After Bootstrap

```
YourProject/
  README.md                              # Your project README (yours)
  AGENTS.md                              # Cross-agent entrypoint, delegates to harness/AGENTS.md
  CLAUDE.md                              # Claude Code shim, delegates to AGENTS.md and harness/AGENTS.md
  src/                                   # Your code (yours)
  tests/                                 # Your project tests (yours, separate from harness tests)
  harness/                               # ← manifest-approved distributable surface
    AGENTS.md                            # Harness governance entrypoint (fill in TODO sections)
    framework/                           # FRAMEWORK: portable across projects
      QUALITY_SCORE.md                   # Quality criteria template
      RELIABILITY.md                     # Gates and validation template
      SECURITY.md                        # Security invariants template
      process/
        requirement-lifecycle.md         # FRAMEWORK: 10-step gated change process
        execution-plans.md               # FRAMEWORK: durable plan ledger process
        bootstrap-intake.md              # FRAMEWORK: target-project intake contract
        target-validation-profile.md     # FRAMEWORK: executable target validation contract
        agentic-loop.md                  # FRAMEWORK: per-role loop and terminal outcomes
        sub-agent-coordination.md        # FRAMEWORK: sub-agent expert roles and handoff rules
        critique-and-debate.md           # FRAMEWORK: critique, debate, and synthesis rules
        cross-agent-collaboration.md     # FRAMEWORK: Codex/Claude Code review loop rules
        worktree-runtime.md              # FRAMEWORK: worktree runtime contract
        observability.md                 # FRAMEWORK: logs, metrics, traces contract
        browser-validation.md            # FRAMEWORK: browser evidence contract
        permission-profiles.md           # FRAMEWORK: guarded/trusted/restricted profiles
        tier-definitions.md              # FRAMEWORK: hard/review/future contracts
        adr-governance.md                # FRAMEWORK: ADR format and rules
        SECURITY_REVIEW.md               # FRAMEWORK: security checklists
        DESIGN_REVIEW.md                 # FRAMEWORK: design checklists
      requirements/
        index.md                         # FRAMEWORK: requirement governance rules
      templates/
        bootstrap-intake.md              # FRAMEWORK: intake template
        target-validation-profile.md     # FRAMEWORK: target validation profile template
        *.md                             # FRAMEWORK: override mechanism templates
      schemas/
        bootstrap-intake.schema.json     # FRAMEWORK: intake schema reference
      seeds/
        exec-plans/                      # FRAMEWORK: copy-if-missing README defaults
        artifacts/                       # FRAMEWORK: copy-if-missing README defaults
      design-docs/
        index.md                         # FRAMEWORK: design doc index template
        adr-template.md                  # FRAMEWORK: ADR template
      references/
        validation-data-governance.md    # FRAMEWORK: data governance template
    override/                            # PROJECT-SPECIFIC: your filled-in content (this is where YOUR work goes)
      intake/
        project-intake.md                # Target-project platform, users, domain, risk, validation expectations
      validation/
        target-validation-profile.md     # Executable target commands
      runtime/
        worktree-runtime.md              # Filled worktree runtime mechanism
      observability/
        observability.md                 # Filled logs, metrics, traces mechanism
      browser/
        browser-validation.md            # Filled browser evidence mechanism or approved not-applicable decision
      cleanup/
        recurring-cleanup.md             # Cleanup/doc-gardening cadence and evidence
      quality/
        architecture-invariants.md       # Target architecture invariant registry
        taste-invariants.md              # Target taste invariant registry
      pr/
        pr-ci-loop.md                    # PR/CI review loop commands and evidence
      ARCHITECTURE.md                    # Project's architecture doc (fill in)
      QUALITY_SCORE.md                   # Project's filled-in quality criteria (created from framework/ template)
      RELIABILITY.md                     # Project's filled-in gate definitions (created from framework/ template)
      SECURITY.md                        # Project's filled-in threat model (created from framework/ template)
      requirements/
        requirement-register.json        # Machine-readable register (fill in)
      design-docs/
        adr/
          index.md                       # ADR index for this project (fill in)
          adr-NNN-*.md                   # Real ADRs as you create them
      references/
        index.md                         # Reference doc index for this project (fill in)
    tests/
      contracts/
        requirement-traceability.test.mjs  # FRAMEWORK: register schema enforcement
        decision-enforcement.test.mjs      # FRAMEWORK: ADR traceability enforcement
      helpers/
        repo-path.mjs                      # FRAMEWORK: path utility
    scripts/
      validate-all.mjs                     # FRAMEWORK: validation orchestrator
    artifacts/
      validation/                          # Generated validation reports (gitignored)
  .github/
    workflows/
      validate.yml                         # CI pipeline (runs harness/scripts/validate-all.mjs)
```

## Adding Project-Specific Docs

Common additions by project type — place under `harness/override/`:

| Project Type | Typical Docs |
|-------------|-------------|
| Web app | `harness/override/DESIGN.md`, `harness/override/FRONTEND.md`, `harness/override/product-specs/index.md` |
| API service | `harness/override/API_SPEC.md`, `harness/override/DEPLOYMENT.md` |
| Discussion/research | `harness/override/SCOPE.md`, `harness/override/METHODOLOGY.md` |
| Diagram/slide project | `harness/override/DESIGN.md`, `harness/override/CONTENT_SPEC.md` |

Add them to `mandatorySourceDocs` in the register so the framework enforces coverage.
