---
name: harness-status
description: Show artifact-derived harness state (tier, ledger, step, validation freshness, critic state). Use when starting work, when asked what the agent is doing, or to verify alignment claims.
---
<!-- generated from harness/framework/skills-src — do not edit; rerun node harness/scripts/generate-skills.mjs -->

`node harness/scripts/harness.mjs status` prints one line derived entirely from artifacts — never from model claims:

```
[harness] tier:standard | ledger:add-export | step:implementation — governing: gates.md | check:fresh | critic:pending
```

- `tier` is computed from touched paths (`harness tier` shows the trigger paths). Never self-declare a tier.
- `check:stale` means tracked files changed after the last validation run — run `node harness/scripts/harness.mjs check` before any completion claim.
- `critic` is scoped to the active ledger; a previous plan's report is never evidence for current work.
- Visibility rules live in the contract (`harness/AGENTS.md § Visibility`); the status output is the trusted layer that cross-checks the narration.
