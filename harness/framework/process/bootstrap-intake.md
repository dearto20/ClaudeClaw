# Bootstrap Intake

## Purpose
- Bootstrap intake turns the user's project request into durable target-project facts before feature work begins.
- The intake artifact is the source of truth for platform, audience, domain, runtime surfaces, risk, validation expectations, success criteria, and non-goals.
- Agents must not rely on chat history when an intake field is required.

## Canonical Artifact
- Framework template: `framework/templates/bootstrap-intake.md`
- Schema reference: `framework/schemas/bootstrap-intake.schema.json`
- Filled target artifact: `override/intake/project-intake.md`

## Intake States
- `draft` — feature implementation is blocked.
- `incomplete` — feature implementation is blocked when any critical field is missing or unknown.
- `ready` — planning and implementation may proceed.

## Critical Fields
The filled intake must identify:
- Project identity and summary.
- Target platform and deployment model.
- Audience, user roles, and domain or vertical.
- Runtime surfaces.
- Data sensitivity, security posture, regulatory posture, and operational criticality.
- Success criteria, non-goals, validation expectations, and constraints.

## Deferred Noncritical Fields
- Noncritical unknowns may be deferred only with rationale, owner role, reviewer role, timestamp, replacement evidence, and follow-up.
- Critical fields cannot be deferred while the intake is `ready`.

## Agent Rules
- Bootstrap must ask enough concrete questions to fill the critical fields.
- If the user request conflicts with the intake, update the intake or block the work.
- Every non-trivial execution plan must reference the current intake artifact and state.
