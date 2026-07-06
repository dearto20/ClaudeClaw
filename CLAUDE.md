# ClaudeClaw For Claude Code

ClaudeClaw is an experimental AI coding assistant for Android (Kotlin app + local Flask backend). This repository is an installed DevelopmentHarness target, not the harness source.

Read `AGENTS.md`, then the normative contract `harness/AGENTS.md`. This file is a shim; the contract is the law.

- `HARNESS_PROCESS_CONTRACT: default-for-all-agent-work` — harness process applies to every request by default. Ordinary silence does not disable harness obligations.
- Plan Mode still performs harness planning obligations but does not mutate tracked files. Mutation-capable mode creates or updates execution ledgers before non-trivial edits.
- Non-trivial work records top-level dual-role governance with an independent critic; readiness requires pushback-free critic evidence (`nonBlockingRisks` resolved or accepted-with-rationale in the ledger). Sub-agent coordination is internal decomposition evidence; it does not replace the top-level critic.
- Open every response with the `[harness]` tier line.
- Run `node harness/scripts/validate-all.mjs` before completion.
