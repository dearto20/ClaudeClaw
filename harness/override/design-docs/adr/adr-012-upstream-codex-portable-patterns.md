# ADR-012 Upstream Codex Portable Patterns

## Status
Accepted

## Context
ClaudeClaw uses the local DevelopmentHarness under `harness/` and periodically syncs portable harness framework updates from `/Users/dearto20/Projects/DevelopmentHarness`. The harness includes a portable-pattern audit for selected OpenAI Codex process ideas, including scoped AGENTS guidance, bounded context, review quality, command policy discipline, and explicit runtime mutation boundaries.

Copying raw upstream prompts or product-specific implementation details into this project would be inappropriate. The project needs only the local harness contracts and validators that make those portable patterns executable.

## Decision
ClaudeClaw adopts the upstream Codex portable-pattern contract through the synced framework artifact `framework/process/upstream-codex-portable-patterns.md`.

The local project will keep:
- portable pattern definitions in `harness/framework/`,
- executable validation in `harness/scripts/` and `harness/tests/`,
- project-specific policy, requirement, and target evidence in `harness/override/`.

Raw upstream model prompts, Codex product internals, and DevelopmentHarness project-specific overrides are not vendored into ClaudeClaw.

## Consequences
- Future harness syncs must preserve the framework/override boundary.
- Borrowed upstream ideas count only when they are represented by local artifacts and executable validation.
- This project retains its own requirements, target validation profile, ADR history, and runtime evidence.

## Artifact Enforcement
- `framework/process/upstream-codex-portable-patterns.md`
- `framework/process/critique-and-debate.md`
- `framework/process/permission-profiles.md`
- `AGENTS.md`
- `override/requirements/requirement-register.json`

## Verification Enforcement
- `scripts/validate-upstream-codex-patterns.mjs`
- `scripts/validate-doc-map.mjs`
- `scripts/validate-entrypoints.mjs`
- `scripts/validate-critique-synthesis.mjs`
- `scripts/validate-permission-profiles.mjs`
- `tests/contracts/upstream-codex-patterns-contract.test.mjs`
- `tests/contracts/requirement-traceability.test.mjs`

## Open Questions
- Whether ClaudeClaw-specific agent-framework patterns (skill auto-discovery, tool schemas) should get their own target override document instead of being folded into the portable framework audit.
