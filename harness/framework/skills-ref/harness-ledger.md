# harness-ledger
<!-- generated from harness/framework/skills-src — do not edit; rerun node harness/scripts/generate-skills.mjs -->

> Create, update, and close execution ledgers. Use before any non-trivial tracked edit (standard/high-risk tier), at every phase transition, and when finishing governed work.

Default process for execution ledgers (contract: `framework/process/gates.md`).

1. Before the first scoped edit of non-trivial work: `node harness/scripts/harness.mjs ledger new <slug>` — scaffolds `exec-plans/active/<slug>.md`. Done when: Goal, Scope, Affected Paths, User Intent Discovery, Dual-Role Governance, and Runtime Mode are filled.
2. At every phase transition: `node harness/scripts/harness.mjs ledger step <slug> "<phase> — governing: <doc>"`. Done when: `harness status` shows the new step.
3. Record as you go, not retroactively: evidence, accepted/rejected findings, deviations with justification, accepted non-blocking risks with rationale. Done when: every decision made in the current phase is in the ledger before the next phase starts.
4. When validation is green with pushback-free critic evidence: `node harness/scripts/harness.mjs ledger close <slug>`. Done when: the ledger file is in the completed directory (source repo: `development/exec-plans/completed/`).
