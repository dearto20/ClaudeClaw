# Agent System Structure Declaration

Copy this template to `harness/override/structure/agent-system-structure.md`
in the target repository and fill the fence. Contract:
`framework/process/agent-system-structure.md`. Validator:
`harness/scripts/validate-structure.mjs`.

## Declaration

```agent-system-structure-json
{
  "schemaVersion": "1.0.0",
  "repoType": "core",
  "systemName": "example-system",
  "conformance": "migration-planned",
  "migrationPlan": "harness/exec-plans/active/<slug>.md or a dated rationale",
  "core": {
    "agentPackage": "examplepkg",
    "channels": ["email", "telegram"]
  },
  "ios": {
    "modulePrefix": "Example",
    "appDir": "App",
    "hasWidget": true,
    "usesXcodeproj": true,
    "extraModules": []
  },
  "notes": ""
}
```

Field notes:

- `repoType`: `core` | `ios` | `none`. Use `none` for harness targets that are
  not part of an agent system; the validator records it and passes.
- Keep only the section matching `repoType` filled (`core` for core repos,
  `ios` for iOS repos); the other section may be omitted.
- `conformance: "conformant"` turns on path-by-path layout checks. For core
  repos this now also requires the toolchain surface (`pyproject.toml` plus a
  `Makefile` defining `test`, `lint`, `validate`, `dry-run`). A repo that does
  not yet meet the toolchain clause declares `"migration-planned"` until it
  does. `"migration-planned"` requires a meaningful `migrationPlan` and passes
  with the plan surfaced in validator output.
- `ios.extraModules` lists product-specific SwiftPM modules beyond the
  required `<prefix>AppCore`/`<prefix>Presence`/`<prefix>Sync` so the
  divergence is declared, not discovered.
