# Governance

The single normative home for requirement lifecycle, requirement tiers, and ADR rules. Supersedes v1 `requirement-lifecycle.md`, `tier-definitions.md`, and `adr-governance.md` (now redirect stubs). The enforcement lives in `tests/contracts/requirement-traceability.test.mjs` and `tests/contracts/decision-enforcement.test.mjs`; this document states the rules those gates check.

## Requirements

Register: `override/requirements/requirement-register.json` (source repo: `development/requirements/requirement-register.json`). Adding, removing, or modifying a requirement updates the register in the same change scope, together with its source doc, artifact surface, and validation surface.

Required fields per requirement: `id` (unique, never reused), `title`, `tier`, `category`, `sourceDocs`, `guidanceDocs`, `artifactPaths`, `validationPaths` (all paths must exist on disk, harness-root-relative), `validationMode`.

### Tiers

| Tier | Meaning | Allowed validation modes |
|---|---|---|
| `hard` | Release/completion blocking; MUST have validation and an enforcement surface. If validation is lost the requirement is broken, not demoted. | `automated`, `artifact-review`, `content-check` |
| `review` | Requires human judgment; MUST have guidance documentation; exceptions allowed with documented rationale. | `manual-review` |
| `future` | Aspirational; never a completion criterion; promoted to hard/review only when enforcement and validation are ready. | `planned` |

A requirement without a tier is not a requirement. Promoting `future → hard` adds BOTH enforcement AND validation; demoting `hard → review` documents why validation was removed. Every tier change is a requirement modification.

### Change lifecycle

Every requirement change passes these gates in order (formerly the 10-step lifecycle; the gates enforce what the prose described). Each gate's clause is its done-bar: the gate passes only when every listed item verifiably exists.

1. **Refine** — testable assertion, acceptance test, tier chosen.
2. **Check conflicts** — against existing requirements and quality attributes; user intent outranks existing patterns.
3. **Register** — entry added/updated; `node harness/scripts/validate-all.mjs` confirms schema and traceability.
4. **Design & ADR** — structural changes get an ADR (below); artifact and validation enforcement points planned.
5. **Implement** — artifact surfaces updated in the same scope.
6. **Validate** — validation paths exist and pass; tier-to-mode rules hold.
7. **Review** — per `framework/process/review.md` triggers.
8. **Complete** — ledger closes with evidence.

`mandatorySourceDocs` in the register lists docs that must be referenced by at least one requirement.

### Operational constants

Operational constants that gate behavior — timeouts, iteration caps, thresholds — live in registry or profile data with a recorded basis (a calibration artifact or a dated rationale), never as bare literals in scripts. Reviews of framework changes check this as a required lens item: a magic number in a gate or transport path is a finding.

### Enforcement coverage

Every contract obligation records its enforcement surface in `framework/registry/enforcement-map.json`: a mechanical surface (commit gate, CI step, validator, contract test, runtime adapter) referenced by an existing path, or a declared exception (`review-lens` / `prose-declared`) with a substantive recorded basis — why no mechanical surface can exist and what bounds the risk. `validate-enforcement-map.mjs` enforces the shape, the referenced paths, and a required-obligation floor pinned to the contract anchors. Unenforced rules must be visible, chosen, and reviewed — never silent. Runtime-enforcement capability per agent family lives in `framework/registry/agents.json` (`runtimeEnforcement`, dated basis), and the declared wiring is itself gated by `validate-runtime-adapters.mjs`.

### Legacy plan acceptance

History is never rewritten to satisfy newer gates. A target upgraded from an older harness version records its pre-upgrade completed plans in `harness/override/governance/legacy-plan-acceptance.json` (`rationale`, `acceptedBy`, `acceptedDate`, `upgradeBaseCommit`, `plans`). Listed plans — `exec-plans/completed/*.md` only — are exempt from completed-plan requirements they predate; everything newer meets the current gates in full. Acceptance is git-anchored: every listed plan must exist in the git tree at `upgradeBaseCommit` (the pre-upgrade commit), so new work cannot be laundered through the list. A malformed acceptance file, a listing outside the completed-plans prefix, a listed plan that does not exist, or a plan absent at the base commit fails validation — acceptance is explicit and reviewable, never a silent skip. The source repository uses the same git-anchored mechanism for its own history: `development/governance/legacy-plan-acceptance.json` lists the source completed plans that predate source-mode plan scanning (added in 2.4.0); every source ledger closed after that boundary meets the current gates in full.

## ADRs

Record decisions that affect system structure, module boundaries, or component contracts. An ADR without enforcement is documentation, not a decision.

- Status lifecycle: `Pending` → `Accepted` | `Rejected`; `Accepted` → `Superseded by ADR-NNN`.
- Format: `framework/design-docs/adr-template.md`; real ADRs live under `override/design-docs/adr/` (source repo: `development/design-docs/adr/`), indexed in `adr/index.md`.
- Accepted ADRs MUST have an `## Artifact Enforcement` section and a `## Verification Enforcement` section, each with at least one existing path; the ADR ID appears in the architecture doc and `framework/RELIABILITY.md` (or its override).
- Superseding an ADR updates ALL enforcement points. ADRs reference the architecture doc and vice versa.
- Body format: a title plus one to three sentences stating the decision and the trade-off it resolved — an ADR can be a single paragraph; the enforcement sections carry the rest. Record an ADR only when the decision is hard to reverse, surprising without context, or the result of a real trade-off — never to rubber-stamp reversible choices.
- Shared domain vocabulary lives in `CONTEXT.md` (template: `framework/templates/context-glossary.md`), not in ADRs: glossary entries name concepts; ADRs record decisions.
