# Reliability and Validation

## Purpose
- Defines the validation layer and execution gates.
- Agents and CI repeat the same validation flow — not just human checklists.

## Completion Criteria
- Work is not complete until `node harness/scripts/validate-all.mjs` exits successfully.
- When validation fails, fix within the current work scope and re-run.
- When some gates cannot run, classify as infra blocker.

## Definitions
- `compatible environment` — meets the `local-full` or `ci-target` profile.
- `infra blocker` — cannot be resolved by modifying repository code alone.
- `protected` — at least one hard gate exists and runs.
- `partially protected` — only review or partial gates.
- `unprotected` — no explicit hard gate.

## Gate Levels

### Universal Gates (apply to all project types)

#### Level 0. Requirement and Architectural Decision Enforcement
- Purpose: verify hard requirements and accepted ADRs are connected to docs, artifacts, and validation.
- Nature: `Must-pass`
- Entry points:
  - `tests/contracts/requirement-traceability.test.mjs`
  - `tests/contracts/decision-enforcement.test.mjs`

#### Level 1. Agent Entrypoint and Documentation Map Enforcement
- Purpose: verify Codex-compatible and Claude Code entrypoints delegate to the same harness map, and required framework docs exist.
- Nature: `Must-pass`
- Entry points:
  - `scripts/validate-entrypoints.mjs`
  - `scripts/validate-doc-map.mjs`

#### Level 2. Framework Boundary and Command Drift Enforcement
- Purpose: preserve the portable framework versus project override boundary and keep validation commands consistent.
- Nature: `Must-pass`
- Entry points:
  - `scripts/validate-framework-boundary.mjs`
  - `scripts/validate-command-drift.mjs`

#### Level 3. Execution Plan and Sub-Agent Enforcement
- Purpose: verify execution plans, agentic loops, sub-agent expert roles, Expert Bench continuity, critique/debate synthesis, cross-agent review, and completion evidence contracts.
- Nature: `Must-pass`
- Entry points:
  - `scripts/validate-exec-plans.mjs`
  - `scripts/validate-agentic-loop.mjs`
  - `scripts/validate-sub-agent-ledger.mjs`
  - `scripts/validate-critique-synthesis.mjs`
  - `scripts/validate-cross-agent-review.mjs`
  - `scripts/run-agent-review.mjs` (bounded bidirectional runtime transport with explicit high-capability critic model selection and `pushbackFree` readiness evidence; validated offline by contract tests)
  - `scripts/run-claude-review.mjs` (legacy Claude wrapper over the generic transport)

#### Level 3a. Bootstrap Intake and Target Validation Enforcement
- Purpose: verify target intent is ready, target validation commands execute, and target mechanisms are filled in `override/`.
- Nature: `Must-pass`
- Entry points:
  - `scripts/validate-intake.mjs`
  - `scripts/validate-target-profile.mjs`
  - `scripts/validate-target-overrides.mjs`

#### Level 4. Runtime, Observability, Browser, and Permission Enforcement
- Purpose: verify target-project contracts exist for worktree runtime, logs, metrics, traces, browser evidence, permission profiles, and cleanup safety.
- Nature: `Must-pass`
- Entry points:
  - `scripts/validate-worktree-runtime-docs.mjs`
  - `scripts/validate-observability-docs.mjs`
  - `scripts/validate-browser-validation-docs.mjs`
  - `scripts/validate-permission-profiles.mjs`
  - `scripts/validate-cleanup-guardrails.mjs`
  - `scripts/validate-harness-engineering-alignment.mjs`
  - `scripts/validate-upstream-codex-patterns.mjs`
  - `scripts/validate-external-reference-hardening.mjs`

#### Level 5. PR Loop and Entropy Enforcement
- Purpose: verify review loops, stale plan controls, TODO rules, command consistency, and repository legibility.
- Nature: `Must-pass`
- Entry points:
  - `scripts/validate-pr-review-loop-docs.mjs`
  - `scripts/validate-entropy.mjs`

## Accepted Decision Anchors
- Installed targets record accepted ADRs under `override/design-docs/adr/` and anchor them to target architecture and reliability evidence.
- The DevelopmentHarness source repository records its own source-maintenance ADR history under `development/design-docs/adr/`; that history is not part of the portable framework template.

### Project-Specific Gates
<!-- TODO: Add gates for your project. Examples:

#### Level 1. Fixture/Data Integrity
- Validate canonical fixtures and source metadata.

#### Level 2. Domain Contract Integrity
- Lock down core function contracts.

#### Level 3. Regression Integrity
- Run full fixture set as golden regression.

#### Level 4. UI/Artifact Integrity
- Static analysis, import checks, render checks.

#### Level 5. Integration/Smoke
- End-to-end happy path and error paths.

#### Level 6. Non-Functional
- Accessibility, performance, design token compliance.
-->

### Gate Examples for Non-Implementation Projects
| Gate | What it validates | How |
|------|-------------------|-----|
| Artifact existence | Declared artifacts exist | File existence check |
| Content completeness | Citations, decision log, required sections | content-check script or review |
| Diagram validity | SVG/PNG renderable, no overflow | Validator script |
| Decision log integrity | All decisions recorded as ADRs | decision-enforcement test |

## Requirement Traceability
- Register: `override/requirements/requirement-register.json`
- Rules: `framework/requirements/index.md`
- Hard requirements must have both artifact surface and automated, artifact-review, or content-check validation.

## Execution Entry Point
- `node harness/scripts/validate-all.mjs`
- Fully discovery-driven: scans `scripts/validate-*.mjs` for validation scripts, `tests/` for test files. No hardcoded steps.

## Environment Profiles

### `local-full`
- Purpose: development completion judgment.
- Requirements: `node`, plus any project-specific dependencies.

### `ci-target`
- Purpose: unattended continuous validation.
- Entry: `.github/workflows/validate.yml`

### `restricted-sandbox`
- Purpose: constrained agent execution.
- Some gates may fail due to environment — classify as infra blocker, not code bug.

## Autonomous Loop
1. Read the failure cause.
2. Fix within current work scope.
3. Re-run `node harness/scripts/validate-all.mjs`.
4. Repeat until it passes.
