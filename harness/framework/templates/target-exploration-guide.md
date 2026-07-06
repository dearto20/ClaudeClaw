# Target Exploration Guide

## Purpose
- Fill this in under `override/references/` or another target-owned location when a project needs a compact navigation map for agents.
- The guide should describe how to find and trace the target project's own behavior. Do not copy another project's exploration guide structure or wording when provenance is unclear.
- The guide is the target-owned map for agent legibility. It should help an agent find entrypoints, runtime surfaces, registries, validation, observability, and user-visible behavior without reading the whole repository.

## Repository Orientation
- Entrypoints:
- Primary runtime surfaces:
- Frameworks and package managers:
- Generated or ignored artifact locations:
- Source-of-truth docs:
- Diagnostics and status surfaces:

## Subsystem Inventory
| Subsystem | Purpose | Primary paths | Entry points | Runtime or validation evidence |
|---|---|---|---|---|
|  |  |  |  |  |

## Capability Map
| Capability | Kind | Primary paths | Registry or entrypoint | Validation path | Runtime evidence |
|---|---|---|---|---|---|
|  |  |  |  |  |  |

## Trace Recipes
- Trace a user-visible feature from request through state change, response, and visible outcome:
- Trace a command or job from invocation through side effects and validation:
- Trace a tool or integration from schema/input through permission check, execution, and result rendering:
- Trace an error path from log/metric through handler and user-facing message:
- Trace a disabled or gated surface from feature flag/config through safe no-op behavior and activation conditions:
- Trace diagnostics or status from command/dashboard through evidence capture and completion judgment:

## Search Hints
- Find entrypoints:
- Find command registrations:
- Find tool or capability registrations:
- Find integration surfaces:
- Find validation commands:
- Find permission or approval checks:
- Find diagnostics/status commands:
- Find observability hooks:
- Find generated artifacts:

## Disabled Or Gated Surfaces
| Surface | Gate or condition | Default behavior | Activation evidence | Safety evidence |
|---|---|---|---|---|
|  |  |  |  |  |

## Review Notes
- Known high-risk areas:
- Areas intentionally out of scope:
- Required validation before completion:
