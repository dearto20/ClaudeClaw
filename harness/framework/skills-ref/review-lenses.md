# review-lenses
<!-- generated from harness/framework/skills-src — do not edit; rerun node harness/scripts/generate-skills.mjs -->

> Apply the specialized review lenses when reviewing changes or deliverables — breaking-change, model-visible context, testing, change-size, coherence. Required recording for high-risk and framework-affecting reviews.

Default process for lens-based review (contract: `framework/process/review.md § Specialized Review Lenses`).

For each lens, record findings or not-applicable with a reason. Done when: no lens lacks one:

- **Breaking-change**: external integration surfaces, CLI flags, configuration loading, persisted state, resume behavior, public schemas.
- **Model-visible context**: agent-visible content is incremental, bounded, redacted when needed; no cache-breaking churn.
- **Testing**: changed user-visible or agent-decision behavior has integration/contract coverage; no test-only helpers without need.
- **Change-size**: >~800 changed non-mechanical lines need a staging assessment; >~500 complex-logic lines need a smallest-first-stage plan or indivisibility rationale.
- **Coherence**: terminology consistency, structural parallelism, cross-reference integrity, no orphan concepts, single voice against the artifact contract.

Finding quality: discrete, actionable, tied to a changed artifact, with the concrete affected path/scenario/contract; severity matches impact. Speculative impact without a provable surface is not a finding.
