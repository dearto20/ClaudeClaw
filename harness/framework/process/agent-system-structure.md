# Agent System Structure

Canonical repository structure for agent systems. An agent system is a family of
repositories that together deliver one agent product (examples: a scheduled
security monitor, an interactive companion). This contract defines the required
family shape and the required layout of each repository type, so every system
shares one debuggable mental model while product-essential divergence stays
explicit and declared.

## Family Shape

A conformant agent system consists of exactly these repository types:

| Repo type | Name pattern | Purpose |
|---|---|---|
| `core` | `<SystemName>` | Server/runtime: agent brain, channels, tools, deployment wiring |
| `ios` | `<SystemName>-ios` | Native client: app target, SwiftPM modules, widget |

Planning repositories are not part of the canonical family. Planning,
intake, and execution records live inside each repository's `harness/`
(execution ledgers, intake, exec-plan templates). Pre-harness planning
repositories should be archived once their live content is folded into the
owning repository's harness state.

Family completeness (both repo types existing for a system) is
review-enforced, not gate-enforced: the validator runs inside one repository
and cannot see siblings. Reviewers check family shape when a system is
created or a repository is added or retired.

## Core Repository Layout

Required at the repository root:

| Path | Role |
|---|---|
| `agent/<agentPackage>/` | The agent brain: persona, reasoning, orchestration |
| `channels/` | Delivery transports, one subdirectory per channel (`email/`, `telegram/`, ...) |
| `tools/` | Domain tools: collectors, scanners, integrations |
| `modal_app.py` | Deployment wiring: schedules, secrets, endpoints |
| `docs/` | Product documentation |
| `tests/` | Test suite |
| `harness/` | Process contract state |

Optional, allowed without declaration: `workflows/`, `knowledge/`,
`evolution/`, `data/`, `deploy/`, `scripts/`, `app/`, `memory/`, `reports/`,
`artifacts/`, `labs/`, `presentations/`, `tmp/`, root configuration files.

For conformant core repos the gate enumerates `channels/` and `agent/`:
every transport directory must be declared in `core.channels`, and `agent/`
must contain exactly the declared `core.agentPackage` — the same
divergence-is-declared rule the iOS gate applies to `Sources/`. An undeclared
channel directory or a second agent package fails validation.

Placement rules (review-enforced): the following are binding architecture
rules checked by reviewers and critics — they concern code content, which the
structure gate cannot verify by path existence:

- Channel transports live under `channels/<channel>/` and nowhere else. Agent
  modules and tools import delivery from `channels/`; they do not open SMTP or
  bot connections themselves.
- The agent package under `agent/` owns reasoning and orchestration; it does
  not contain scanners/collectors (those are `tools/`) or transports (those
  are `channels/`).
- `modal_app.py` wires schedules, secrets, and endpoints; business logic lives
  in the packages it imports.

## Core Toolchain Conventions

A conformant core repo shares one toolchain surface so `make test`,
`make lint`, and dependency inspection land in the same place regardless of
which system you opened.

Required at the repository root for conformant core repos (gate-enforced):

| Path | Role |
|---|---|
| `pyproject.toml` | Single dependency + tooling source of truth (deps, ruff, pytest config) |
| `Makefile` | Uniform verb set — must define the baseline targets below |

Baseline `Makefile` targets (gate-enforced by name — real rules count,
including `::` double-colon rules and grouped `test lint:` multi-target rules;
`:=`/`::=`/`:::=` variable assignments, `define`…`endef` bodies, and indented
recipe lines do not):

| Target | Contract |
|---|---|
| `test` | Run the Python test suite (pytest) |
| `lint` | Run the linter (ruff) — the declared linter, not an ad-hoc alternative |
| `validate` | Aggregate gate: runs `node harness/scripts/validate-all.mjs` **and** the Python suite |
| `dry-run` | Exercise the deployment/pipeline path without live side effects |

Toolchain placement rules (review-enforced — content, not path existence):

- `pyproject.toml` is the dependency source of truth. A `requirements.txt` may
  exist for the Modal image build, but it must be derived from / consistent
  with `pyproject` dependencies, never a divergent hand-maintained second list.
- Runtime dependencies are declared in `pyproject` (or a file generated from
  it), not buried only inside `modal_app.py`'s image builder — deps must be
  inspectable without reading deployment code.
- Python behavior is tested with `pytest` under `tests/`; harness process
  contracts are tested with Node's test runner under `harness/tests/`. The two
  suites stay separate and both run green before completion.

## Generated Artifact Policy

Generated output (validation reports, run logs, image caches, `__pycache__`,
scratch state) is not source structure and is not committed. It lives in
gitignored directories (`artifacts/`, `reports/`, `output/`, `tmp/`, `.tmp/`
as used by the repo). The structure gate already exempts gitignored
directories from divergence enumeration and refuses to launder force-added
tracked files inside them; the "keep it gitignored" rule itself is
review-enforced, because whether a given `reports/` file is a committed
fixture or accumulated output is a content judgment the path gate cannot make.

Everything in the required-paths tables above, the core toolchain table, and
the iOS module rules below is gate-enforced by `validate-structure.mjs`.

## iOS Repository Layout

Required at the repository root:

| Path | Role |
|---|---|
| `<appDir>/` | The app target (canonically `App/`) |
| `Sources/<modulePrefix>AppCore/` | App core module |
| `Sources/<modulePrefix>Presence/` | Presence module |
| `Sources/<modulePrefix>Sync/` | Sync module |
| `Tests/` | Test suite |
| `Package.swift` | SwiftPM manifest |
| `harness/` | Process contract state |

Declared in the structure declaration: `hasWidget` is a required explicit
boolean for conformant iOS repos and the filesystem must match in both
directions — `hasWidget: true` requires `Widget/`, `hasWidget: false` forbids
it; widget divergence is declared, never defaulted or discovered. An
`.xcodeproj` is governed by `usesXcodeproj` (boolean when present, default
`true`) with the same bidirectional filesystem match: `false` fails when a
root `.xcodeproj` directory exists. Extra SwiftPM modules under `Sources/`
are declared in
`extraModules` — product-essential richness such as persistence, registry,
or edge modules is allowed and encouraged when real.

For conformant iOS repos the gate enumerates `Sources/`: every module
directory must be either a required module or listed in `extraModules`.
An undeclared module directory fails validation — divergence is declared,
never discovered.

## Required vs Allowed Divergence

The contract names what must match and what may differ:

- Must match: the family shape, the required paths above, and the placement
  rules (transports in `channels/`, brain in `agent/`, domain work in
  `tools/`).
- May differ, without ceremony: optional directories, extra modules, product
  domain content, schedule cadence, secret names.
- May differ, with declaration: missing widget, missing xcodeproj, extra iOS
  modules — all recorded in the structure declaration so divergence is
  visible, not discovered.

## Structure Declaration

Every harness target declares its structure role in
`harness/override/structure/agent-system-structure.md` (template:
`framework/templates/agent-system-structure.md`) inside an
`agent-system-structure-json` fence:

- `repoType`: `core`, `ios`, or `none` (`none` = this repository is not part
  of an agent system; the validator records it and passes).
- `systemName`: the agent system this repository belongs to.
- `conformance`: `conformant` or `migration-planned`.
- `migrationPlan`: required when `migration-planned` — a meaningful pointer to
  the execution plan or a dated rationale. Migration-planned status passes
  validation but is reported, mirroring the infra-blocker policy: divergence
  is allowed only as a recorded, owned state, never as a silent one.
- `core.agentPackage`, `core.channels`: the agent package name and the list of
  channel subdirectories the validator must find.
- `ios.modulePrefix`, `ios.appDir`, `ios.hasWidget`, `ios.usesXcodeproj`,
  `ios.extraModules`: the iOS skeleton parameters.
- All path-bearing fields are validated as safe single path segments
  (letters, digits, `_`, `-`; module names and prefixes alphanumeric-first).
  Traversal sequences, separators, absolute paths, and empty segments are
  rejected before any filesystem check, so a declaration cannot satisfy the
  layout gate with paths outside the canonical locations.

## Validation

`harness/scripts/validate-structure.mjs` enforces this contract as part of
`validate-all`:

- Missing declaration fails (targets must state their role, even if `none`).
- `conformant` declarations are checked path-by-path against the layout for
  the declared repo type.
- `migration-planned` declarations pass with the plan reference surfaced in
  the validator output.
- DevelopmentHarness source-final mode is exempt (the source repository is not
  an agent system target).

Residual risk — review-enforced, deliberately not gate-enforced: a target can
declare `repoType: none` on a repo that is plainly an agent system, and a
`migration-planned` declaration can sit unexecuted indefinitely. The gate runs
in one repository at a time and has no reliable mechanical test for "is an
agent system" or "is the migration overdue" — heuristic markers would produce
false gates in exactly the heterogeneous targets this contract must tolerate.
Both states are visible, owned artifacts (`override/structure/` declaration,
surfaced in every validator run), and reviewers of harness upgrades and
structure declarations check them the same way family-shape completeness is
checked: at review time, against the cross-repo view only humans and critics
hold. This paragraph is the recorded acceptance of that boundary
(enforcement-map pattern: a declared exception, never a silent gap).

## Adoption And Migration

Adopt in this order per system: declare current state (usually
`migration-planned`) at the next harness upgrade, then migrate under an
execution ledger, then flip the declaration to `conformant`. A structure
migration that moves code between `agent/`, `channels/`, and `tools/` is
non-trivial work: it requires a ledger, dual-role governance, and green
validation before completion, like any other governed change.
