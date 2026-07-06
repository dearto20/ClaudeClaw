# Context Collection Inspection

## Purpose
- Fill this in when a target project assembles runtime, environment, repository, memory, tool, or user preference context for an agent or automation surface.
- This template inspects what context is collected and how it is bounded. It explicitly excludes copying raw prompt text or prompt phrasing from external references.

## Context Sources
| Source | Path or provider | Included fields | Redaction or bounds | Validation path |
|---|---|---|---|---|
|  |  |  |  |  |

## Inspection Checks
- Static instructions or policy docs are identified by path, not copied from external references.
- Dynamic context such as OS, shell, git state, environment, and cwd is bounded and redacted where needed.
- Tool descriptions come from local schemas or local docs.
- Memory or project docs have precedence and scope rules.
- Missing environment variables, macros, or placeholders fail validation or degrade explicitly.
- Secrets, tokens, private paths, and credential material are excluded.

## Prompt Boundary
- Prompt wording, prompt sequence, and product-specific instruction phrasing are out of scope.
- If a prompt changes, record the local requirement or ADR that justifies the change.
- Validation should check local completeness, redaction, and unresolved placeholders rather than similarity to an external prompt.
