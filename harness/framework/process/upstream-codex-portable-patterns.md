# Upstream Codex Portable Patterns

## Purpose
- This document records which portable architecture, rule, and prompt patterns DevelopmentHarness adopts from `https://github.com/openai/codex`.
- The upstream repository is a reference source, not a vendored dependency. Local framework docs, ADRs, requirements, validators, tests, and reports remain the system of record.
- Do not copy raw upstream model prompts or product-specific implementation state into this harness. Adopt only the portable contract behind a pattern.

## Source Audit
- Repository: `https://github.com/openai/codex`
- Verified commit: `73c58011b3c2122b862a8724423976e93647f74d`
- Verified date: `2026-06-14`
- Inspection method: public GitHub browse plus local checkout under `/private/tmp/openai-codex-inspect`

## Adoption Rules
- Every adopted pattern must map to at least one local artifact and one executable validation path.
- Every deferred pattern must explain the missing local need or the reason copying it would be inappropriate.
- Upstream prompt text is reference material only; local prompts and process text must be paraphrased as DevelopmentHarness contracts.
- When the upstream source changes materially, update this audit, ADR/requirement traceability, and validators together.

## Portable Pattern Contract
```upstream-codex-patterns-json
{
  "schemaVersion": "1.0.0",
  "source": {
    "repo": "https://github.com/openai/codex",
    "verifiedCommit": "73c58011b3c2122b862a8724423976e93647f74d",
    "verifiedDate": "2026-06-14",
    "sourcePaths": [
      "AGENTS.md",
      "codex-rs/prompts/templates/agents/hierarchical.md",
      "codex-rs/prompts/templates/review/rubric.md",
      ".codex/skills/code-review-breaking-changes/SKILL.md",
      ".codex/skills/code-review-change-size/SKILL.md",
      ".codex/skills/code-review-context/SKILL.md",
      ".codex/skills/code-review-testing/SKILL.md",
      ".codex/skills/babysit-pr/SKILL.md",
      "codex-rs/execpolicy/README.md",
      "codex-rs/collaboration-mode-templates/templates/plan.md",
      "codex-rs/prompts/src/permissions_instructions.rs",
      "codex-rs/app-server-protocol/src/protocol/v2/review.rs",
      "codex-rs/utils/sandbox-summary/src/sandbox_summary.rs",
      "codex-rs/utils/sandbox-summary/src/config_summary.rs",
      "codex-rs/core/src/tools/registry.rs",
      "codex-rs/core/src/tools/tool_dispatch_trace.rs",
      ".codex/environments/setup.py",
      "codex-rs/app-server-protocol/src/export.rs",
      "codex-rs/core/src/session/rollout_reconstruction.rs"
    ]
  },
  "adoptedPatterns": [
    {
      "id": "UPSTREAM_SOURCE_TRACEABILITY",
      "title": "Upstream source decisions are pinned and auditable",
      "upstreamPaths": ["AGENTS.md", "codex-rs/prompts/templates/review/rubric.md"],
      "localContract": "Borrowed patterns must name the upstream source path, verified commit, local interpretation, and validation surface.",
      "artifactPaths": ["framework/process/upstream-codex-portable-patterns.md", "override/design-docs/adr/adr-012-upstream-codex-portable-patterns.md"],
      "validationPaths": ["scripts/validate-upstream-codex-patterns.mjs", "tests/contracts/upstream-codex-patterns-contract.test.mjs"]
    },
    {
      "id": "HIERARCHICAL_AGENTS_PRECEDENCE",
      "title": "Nested AGENTS guidance has explicit scope and precedence",
      "upstreamPaths": ["codex-rs/prompts/templates/agents/hierarchical.md", "docs/agents_md.md"],
      "localContract": "Root and harness entrypoints stay concise maps; nested guidance applies by directory scope and direct user/developer instructions outrank repository guidance.",
      "artifactPaths": ["../AGENTS.md", "AGENTS.md", "framework/process/harness-engineering-alignment.md"],
      "validationPaths": ["scripts/validate-entrypoints.mjs", "scripts/validate-doc-map.mjs", "scripts/validate-harness-engineering-alignment.mjs"]
    },
    {
      "id": "BOUNDED_MODEL_CONTEXT",
      "title": "Model-visible context must be bounded",
      "upstreamPaths": ["AGENTS.md", "codex-rs/prompts/src/permissions_instructions.rs"],
      "localContract": "Agent-visible packets, summaries, permission text, and validation reports must prefer bounded fragments with hard caps over unbounded repository dumps.",
      "artifactPaths": ["framework/process/cross-agent-collaboration.md", "framework/templates/cross-agent-review-packet.md", "scripts/run-agent-review.mjs", "scripts/run-claude-review.mjs"],
      "validationPaths": ["scripts/validate-cross-agent-review.mjs", "tests/contracts/cross-agent-review-contract.test.mjs"]
    },
    {
      "id": "REVIEW_FINDING_QUALITY",
      "title": "Review findings are actionable and evidence-backed",
      "upstreamPaths": ["codex-rs/prompts/templates/review/rubric.md", ".codex/skills/code-review/SKILL.md"],
      "localContract": "Critique findings must be discrete, actionable, tied to changed behavior, severity-calibrated, and grounded in a concrete affected path or contract.",
      "artifactPaths": ["framework/process/critique-and-debate.md", "framework/process/cross-agent-collaboration.md"],
      "validationPaths": ["scripts/validate-critique-synthesis.mjs", "scripts/validate-cross-agent-review.mjs"]
    },
    {
      "id": "CHANGE_SIZE_STAGING",
      "title": "Large non-mechanical changes need staging review",
      "upstreamPaths": ["AGENTS.md", ".codex/skills/code-review-change-size/SKILL.md"],
      "localContract": "Non-mechanical changes over roughly 800 changed lines and complex logic changes over roughly 500 changed lines require staging assessment or an indivisibility rationale.",
      "artifactPaths": ["framework/process/critique-and-debate.md", "exec-plans/templates/implementation-plan.md"],
      "validationPaths": ["scripts/validate-critique-synthesis.mjs", "scripts/validate-exec-plans.mjs"]
    },
    {
      "id": "COMMAND_POLICY_DISCIPLINE",
      "title": "Command policy uses narrow prefixes, decisions, rationales, and examples",
      "upstreamPaths": ["codex-rs/execpolicy/README.md", "codex-rs/prompts/src/permissions_instructions.rs"],
      "localContract": "Command allow, prompt, and forbidden decisions should use the narrowest practical ordered prefix, include rationale, and use positive/negative examples when practical.",
      "artifactPaths": ["framework/process/permission-profiles.md", "framework/process/target-validation-profile.md", "override/validation/target-validation-profile.md"],
      "validationPaths": ["scripts/validate-permission-profiles.mjs", "scripts/validate-target-profile.mjs"]
    },
    {
      "id": "MODE_MUTATION_BOUNDARY",
      "title": "Planning and execution modes have explicit mutation boundaries",
      "upstreamPaths": ["codex-rs/collaboration-mode-templates/templates/plan.md"],
      "localContract": "Planning obligations are mode-independent, but tracked-file mutation is allowed only in mutation-capable runtime states.",
      "artifactPaths": ["framework/process/runtime-mode-strategy.md", "framework/process/execution-plans.md", "exec-plans/templates/implementation-plan.md"],
      "validationPaths": ["scripts/validate-worktree-runtime-docs.mjs", "scripts/validate-exec-plans.mjs", "tests/contracts/runtime-mode-strategy-contract.test.mjs"]
    },
    {
      "id": "SPECIALIZED_REVIEW_LENSES",
      "title": "Review uses specialized risk lenses",
      "upstreamPaths": [
        ".codex/skills/code-review-breaking-changes/SKILL.md",
        ".codex/skills/code-review-context/SKILL.md",
        ".codex/skills/code-review-testing/SKILL.md",
        ".codex/skills/code-review-change-size/SKILL.md"
      ],
      "localContract": "High-risk and framework-affecting reviews must explicitly check breaking integration changes, model-visible context bounds, test strategy, and change-size staging.",
      "artifactPaths": ["framework/process/critique-and-debate.md", "framework/process/cross-agent-collaboration.md"],
      "validationPaths": ["scripts/validate-critique-synthesis.mjs", "scripts/validate-cross-agent-review.mjs", "tests/contracts/upstream-codex-patterns-contract.test.mjs"]
    },
    {
      "id": "EXPLICIT_REVIEW_TARGETS",
      "title": "Review requests declare their target scope",
      "upstreamPaths": ["codex-rs/app-server-protocol/src/protocol/v2/review.rs"],
      "localContract": "Review packets and plans should name whether the review covers uncommitted changes, a base-branch diff, a commit, or custom instructions, and whether the review is inline or detached.",
      "artifactPaths": ["framework/process/critique-and-debate.md", "framework/templates/cross-agent-review-packet.md"],
      "validationPaths": ["scripts/validate-critique-synthesis.mjs", "scripts/validate-cross-agent-review.mjs", "tests/contracts/upstream-codex-patterns-contract.test.mjs"]
    },
    {
      "id": "RUNTIME_SUMMARY_EVIDENCE",
      "title": "Runtime summaries are bounded and agent-legible",
      "upstreamPaths": [
        "codex-rs/utils/sandbox-summary/src/sandbox_summary.rs",
        "codex-rs/utils/sandbox-summary/src/config_summary.rs"
      ],
      "localContract": "Plans and validation evidence should summarize cwd, workspace roots, permission profile, sandbox and network posture, model/provider when applicable, and token/context state when available.",
      "artifactPaths": ["framework/process/observability.md", "framework/process/worktree-runtime.md", "exec-plans/templates/implementation-plan.md"],
      "validationPaths": ["scripts/validate-observability-docs.mjs", "scripts/validate-worktree-runtime-docs.mjs", "scripts/validate-exec-plans.mjs"]
    },
    {
      "id": "PR_WATCH_UNTIL_TERMINAL",
      "title": "PR review loops watch until terminal state",
      "upstreamPaths": [".codex/skills/babysit-pr/SKILL.md"],
      "localContract": "PR and CI monitoring treats green checks as a progress milestone; agents keep watching review feedback, CI status, and mergeability until merged, closed, or blocked on user help.",
      "artifactPaths": ["framework/process/pr-review-loop.md", "override/pr/pr-ci-loop.md"],
      "validationPaths": ["scripts/validate-pr-review-loop-docs.mjs", "scripts/validate-target-overrides.mjs", "tests/contracts/upstream-codex-patterns-contract.test.mjs"]
    }
  ],
  "deferredPatterns": [
    {
      "id": "RAW_MODEL_PROMPTS",
      "title": "Raw upstream model prompts are not vendored",
      "upstreamPaths": ["codex-rs/core/gpt_5_codex_prompt.md", "codex-rs/prompts/templates/review/rubric.md"],
      "reason": "Raw prompts are product-specific and can drift quickly; DevelopmentHarness adopts local contracts and validators instead."
    },
    {
      "id": "FULL_EXEC_POLICY_ENGINE",
      "title": "Full Codex execpolicy engine is not copied",
      "upstreamPaths": ["codex-rs/execpolicy/README.md", "codex-rs/execpolicy/src"],
      "reason": "DevelopmentHarness currently needs policy discipline and metadata validation, not a second command-policy runtime."
    },
    {
      "id": "RUST_CRATE_ARCHITECTURE",
      "title": "Rust crate architecture is not portable to this Node harness",
      "upstreamPaths": ["AGENTS.md", "codex-rs/core/README.md"],
      "reason": "The local harness is Markdown/JSON/Node-based; only the boundary principles and validation habits are portable."
    },
    {
      "id": "TUI_SNAPSHOT_DISCIPLINE",
      "title": "TUI snapshot workflow is deferred until a UI target exists",
      "upstreamPaths": ["AGENTS.md", "codex-rs/tui"],
      "reason": "DevelopmentHarness has no TUI surface; browser and artifact validation remain the local equivalent for current targets."
    },
    {
      "id": "TOOL_REGISTRY_INTERNALS",
      "title": "Tool registry and dispatch internals are not imported",
      "upstreamPaths": ["codex-rs/core/src/tools/registry.rs", "codex-rs/core/src/tools/tool_dispatch_trace.rs"],
      "reason": "Tool runtime types, hook payload wiring, and streamed argument-diff consumers are Codex implementation structure; DevelopmentHarness keeps only the generic observability expectation that runtime events should have start, completion, and failure evidence."
    },
    {
      "id": "SCHEMA_GENERATED_APP_SERVER_PROTOCOL",
      "title": "Generated app-server protocol schemas are not copied",
      "upstreamPaths": ["codex-rs/app-server-protocol/src/export.rs", "codex-rs/app-server-protocol/src/protocol/v2/review.rs"],
      "reason": "The app-server protocol is product-specific. The portable idea of machine-readable integration contracts is already represented through local templates and validators."
    },
    {
      "id": "WORKTREE_IGNORED_FILE_SETUP",
      "title": "Worktree setup for shared ignored files is deferred",
      "upstreamPaths": [".codex/environments/setup.py"],
      "reason": "DevelopmentHarness has no current need to copy ignored local files between worktrees; artifact routing and cleanup prevention remain sufficient."
    },
    {
      "id": "ROLLOUT_RECONSTRUCTION_INTERNALS",
      "title": "Rollout reconstruction internals are deferred",
      "upstreamPaths": ["codex-rs/core/src/session/rollout_reconstruction.rs"],
      "reason": "The current plan-continuity evidence contract covers resume, compaction, and completion evidence without importing Codex-specific rollout replay semantics."
    },
    {
      "id": "PRODUCT_SPECIFIC_IMPLEMENTATION",
      "title": "Product-specific Codex implementation details remain reference-only",
      "upstreamPaths": ["codex-rs/core", "codex-rs/app-server-protocol", "sdk/python", "sdk/typescript"],
      "reason": "DevelopmentHarness adopts portable behavior contracts only; product APIs, SDK shapes, schemas, and internal runtime architecture are not framework content."
    }
  ]
}
```
