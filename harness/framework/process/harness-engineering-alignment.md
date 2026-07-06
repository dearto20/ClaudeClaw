# Harness Engineering Alignment — Adoption Ledger

This is the adoption ledger for the OpenAI harness-engineering article. Policy lives in `framework/process/references.md`; this file carries the data: what was adopted (locally restated, locally enforced) and what was deliberately not.

- The article is an external source; validation is offline. Local docs, ADRs, plans, schemas, validators, and reports are the system of record.
- Each adopted pattern is owned locally: later changes to the article do not obligate updates. Re-audits are deliberate, recorded events that update `lastVerified`.
- There is no per-heading or per-section coverage requirement (retired in v2 — see `deferredPatterns`).

```harness-engineering-alignment-json
{
  "schemaVersion": "2.0.0",
  "source": {
    "title": "Harness engineering: leveraging Codex in an agent-first world",
    "url": "https://openai.com/index/harness-engineering/",
    "published": "2026-02-11",
    "lastVerified": "2026-06-13"
  },
  "adoptedPatterns": [
    {
      "id": "AGENTS_MAP",
      "title": "AGENTS.md remains a map",
      "localContract": "AGENTS.md stays a concise map to deeper source-of-truth documents.",
      "artifactPaths": [
        "AGENTS.md"
      ],
      "validationPaths": [
        "scripts/validate-entrypoints.mjs",
        "scripts/validate-doc-map.mjs"
      ]
    },
    {
      "id": "REPO_LOCAL_SOR",
      "title": "Repository-local system of record",
      "localContract": "Repository-local docs, ADRs, schemas, validators, reports, and override artifacts are the durable knowledge base.",
      "artifactPaths": [
        "override/ARCHITECTURE.md",
        "override/requirements/requirement-register.json",
        "override/design-docs/adr/index.md"
      ],
      "validationPaths": [
        "tests/contracts/requirement-traceability.test.mjs",
        "tests/contracts/decision-enforcement.test.mjs"
      ]
    },
    {
      "id": "EXECUTION_PLANS",
      "title": "Execution plans are first-class artifacts",
      "localContract": "Complex work is captured in active, completed, or technical-debt execution-plan ledgers.",
      "artifactPaths": [
        "framework/process/execution-plans.md",
        "exec-plans/templates/implementation-plan.md",
        "exec-plans/active",
        "exec-plans/completed",
        "exec-plans/tech-debt"
      ],
      "validationPaths": [
        "scripts/validate-exec-plans.mjs"
      ]
    },
    {
      "id": "CAPABILITY_SCAFFOLDING",
      "title": "Failures become enforceable capabilities",
      "localContract": "When agents fail, the harness records the missing capability and turns it into legible process, tooling, validation, or guardrails.",
      "artifactPaths": [
        "framework/process/agentic-loop.md",
        "framework/process/sub-agent-coordination.md",
        "framework/process/permission-profiles.md"
      ],
      "validationPaths": [
        "scripts/validate-agentic-loop.mjs",
        "scripts/validate-sub-agent-ledger.mjs",
        "scripts/validate-permission-profiles.mjs"
      ]
    },
    {
      "id": "MECHANICAL_ARCH_TASTE",
      "title": "Architecture and taste are mechanically enforced",
      "localContract": "Architecture and taste invariants are target-owned and enforced by validators or contract tests.",
      "artifactPaths": [
        "override/quality/architecture-invariants.md",
        "override/quality/taste-invariants.md",
        "scripts/validate-target-overrides.mjs"
      ],
      "validationPaths": [
        "scripts/validate-target-overrides.mjs",
        "scripts/validate-framework-boundary.mjs",
        "tests/contracts/target-concreteness-contract.test.mjs"
      ]
    },
    {
      "id": "AGENT_LEGIBLE_RUNTIME_OBS",
      "title": "Runtime and observability are agent-legible",
      "localContract": "Runtime, logs, metrics, traces, browser, and worktree hooks are represented through filled override mechanisms.",
      "artifactPaths": [
        "override/runtime/worktree-runtime.md",
        "override/observability/observability.md",
        "override/browser/browser-validation.md"
      ],
      "validationPaths": [
        "scripts/validate-worktree-runtime-docs.mjs",
        "scripts/validate-observability-docs.mjs",
        "scripts/validate-browser-validation-docs.mjs"
      ]
    },
    {
      "id": "REVIEW_VALIDATION_LOOPS",
      "title": "Review and validation loops reach terminal evidence",
      "localContract": "Agentic loops, critique/debate, cross-agent review, and target validation run until passed, blocked, or justified not applicable.",
      "artifactPaths": [
        "framework/process/agentic-loop.md",
        "framework/process/critique-and-debate.md",
        "framework/process/cross-agent-collaboration.md",
        "framework/templates/cross-agent-review-packet.md",
        "scripts/run-agent-review.mjs",
        "scripts/run-claude-review.mjs",
        "override/validation/target-validation-profile.md"
      ],
      "validationPaths": [
        "scripts/validate-agentic-loop.mjs",
        "scripts/validate-critique-synthesis.mjs",
        "scripts/validate-cross-agent-review.mjs",
        "scripts/validate-target-profile.mjs"
      ]
    },
    {
      "id": "THROUGHPUT_FEEDBACK",
      "title": "Throughput is governed by feedback loops",
      "localContract": "High throughput is supported by bounded PR/CI, review, validation, and follow-up loops with recorded terminal evidence.",
      "artifactPaths": [
        "framework/process/pr-review-loop.md",
        "override/pr/pr-ci-loop.md",
        "framework/process/cross-agent-collaboration.md"
      ],
      "validationPaths": [
        "scripts/validate-pr-review-loop-docs.mjs",
        "scripts/validate-cross-agent-review.mjs",
        "scripts/validate-target-profile.mjs"
      ]
    },
    {
      "id": "AGENT_GENERATED_REPO_OPS",
      "title": "Agents maintain the repository system",
      "localContract": "Agents maintain not only product code but also tests, CI, docs, tooling, validation harnesses, and repository-management scripts.",
      "artifactPaths": [
        "scripts/validate-all.mjs",
        "framework/process/target-validation-profile.md",
        "override/validation/target-validation-profile.md"
      ],
      "validationPaths": [
        "scripts/validate-target-profile.mjs",
        "scripts/validate-doc-map.mjs",
        "tests/contracts/target-concreteness-contract.test.mjs"
      ]
    },
    {
      "id": "ENTROPY_CLEANUP",
      "title": "Entropy control and cleanup are normal operation",
      "localContract": "Recurring cleanup, entropy checks, cleanup prevention, and artifact side-effect hygiene are enforced locally.",
      "artifactPaths": [
        "framework/process/entropy-garbage-collection.md",
        "framework/process/cleanup-guardrails.md",
        "override/cleanup/recurring-cleanup.md",
        "scripts/validate-entropy.mjs"
      ],
      "validationPaths": [
        "scripts/validate-entropy.mjs",
        "scripts/validate-cleanup-guardrails.mjs",
        "tests/contracts/target-concreteness-contract.test.mjs"
      ]
    },
    {
      "id": "CONTINUOUS_LEARNING",
      "title": "Human judgment is encoded back into the harness",
      "localContract": "New lessons, open questions, and human judgment are captured in requirements, ADRs, process docs, validators, and recurring cleanup.",
      "artifactPaths": [
        "framework/process/requirement-lifecycle.md",
        "framework/process/adr-governance.md",
        "override/requirements/requirement-register.json",
        "override/design-docs/adr/index.md"
      ],
      "validationPaths": [
        "scripts/validate-harness-engineering-alignment.mjs",
        "tests/contracts/requirement-traceability.test.mjs",
        "tests/contracts/decision-enforcement.test.mjs"
      ]
    }
  ],
  "deferredPatterns": [
    {
      "id": "PER_HEADING_COVERAGE",
      "reason": "Retired in harness v2: a per-heading coverage obligation against a live external article is mechanically unverifiable offline and generates adoption-for-coverage's-sake. Adoption is incident-driven per framework/process/references.md."
    }
  ]
}
```
