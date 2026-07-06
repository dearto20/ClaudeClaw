# Requirements

## Purpose
- This directory tracks the repository's current requirements at the individual requirement level.
- When requirements are added, removed, or modified, documentation, artifacts, and validation move together to maintain traceability.
- To prevent drift, each requirement carries a source doc, guidance doc, artifact surface, and validation surface.

## Canonical Register
- The canonical register is [requirement-register.json](../../override/requirements/requirement-register.json) under `override/requirements/`.
- Tests check traceability against the machine-readable register.

## Register Schema (v2)
- `version`: register format version (currently 2)
- `mandatorySourceDocs`: project-specific mandatory source doc list (declared in the register, not hardcoded in tests)
- `requirements[]`: requirement array

Each requirement:
- `id`, `title`, `tier`, `category`, `validationMode`
- `sourceDocs`: documents that ground the requirement
- `guidanceDocs`: documents guiding implementation/fulfillment
- `artifactPaths`: paths to artifacts where the requirement is realized (code, docs, diagrams, slides, etc.)
- `validationPaths`: paths that validate the requirement

## Requirement Lifecycle

The authoritative gated process is `framework/process/requirement-lifecycle.md` — 10 steps with hard gates (REFINE → CHECK CONFLICTS → ADD → PLAN DESIGN → VERIFY QUALITY → PLAN ARTIFACTS → PLAN VERIFICATION → APPLY → ITERATE → UPDATE). Every requirement add/remove/modify follows it.

The five surfaces a requirement change must touch (covered across the gated steps above):
1. Add, remove, or modify the requirement in a source doc.
2. Update the corresponding entry in `requirement-register.json`.
3. Update the artifact surface.
4. Update the validation surface.
5. Pass `node harness/scripts/validate-all.mjs`.

## Tier Rules
- `hard`
  - Current release/completion blocking requirement.
  - Must have both an artifact surface and an automated, artifact-review, or content-check validation surface.
- `review`
  - Requires human judgment to evaluate.
  - Must have an artifact surface and manual-review guidance.
- `future`
  - Not yet blocking.
  - May have only planned enforcement.

## Validation Modes
- `automated`
  - Validated by `tests/` or `scripts/`.
- `artifact-review`
  - The artifact itself (document, diagram, slide) is the validation target.
  - Validation path points to the artifact to review.
- `content-check`
  - Checks content completeness: source citations, no contradictions, decision log included.
- `manual-review`
  - Validated by human review docs and review guidelines.
- `planned`
  - Not yet promoted to a gate.

## Categories
- Core: `scope`, `workflow`, `architecture`, `domain`, `product`, `quality`, `reliability`, `security`, `design`, `frontend`, `data-governance`
- Non-implementation projects: `discussion`, `diagram`, `research`, `narrative`

## Current Source Docs
- Declared in the register's `mandatorySourceDocs` field.
- Varies by project — not hardcoded in tests.

## Operating Principles
- Hard requirements are not satisfied by documentation alone.
- Review guidelines are also kept in the register so their source doc and artifact surface are not lost.
- Accepted ADRs are maintained separately from the requirement register, but architecture-impacting requirements must be traceable in both the ADR and the register.
- `artifactPaths` covers all deliverables — code, documents, diagrams, slides, etc.
