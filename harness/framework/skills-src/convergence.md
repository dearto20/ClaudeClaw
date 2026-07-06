---
name: convergence
description: Converge any deliverable (code, document, slide, story, analysis) before delivering it — iterate self-review against the artifact contract until a clean pass. Mandatory for deliverable-tier work.
---

Default process for the convergence gate (contract: `framework/process/review.md § Artifact Contracts and Convergence`).

1. Before generating, write the artifact contract (one page max): audience, purpose, outline/structure, terminology, style constraints, acceptance checks. Done when: every field is filled and acceptance checks are checkable.
2. Generate against the contract, then self-review with named lenses: intent alignment, local coherence, global coherence, correctness, plus the contract's acceptance checks. Done when: every lens was applied adversarially ("any misalignment or room for improvement?") with findings listed.
3. Revise every finding and run another pass (iteration cap 5). Done when: a pass yields zero findings against the lenses — a clean pass, not a zero-effort pass.
4. Done when: each pass's lenses and findings appear in the ledger's Artifact Contract And Convergence section.

An empty pass means "checked these lenses, found nothing" — never "no room for improvement." When sub-agents produced parts, synthesis is a normalization rewrite against the contract, never concatenation.
