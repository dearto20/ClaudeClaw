---
name: harness-grill
description: Grill the user about a plan before non-trivial work — a relentless one-question-at-a-time interview that fills the ledger's alignment section.
---

Interview the user relentlessly about the plan until you reach a shared understanding, walking each branch of the design tree and resolving dependencies between decisions one by one.

1. Ask exactly one question per turn, with your recommended answer so the user can just accept it. If a question can be answered by exploring the repository, explore instead of asking. Done when: no unresolved decision remains that would change the Affected Paths, the acceptance criteria, or the selected strategy.
2. Write the results into the active ledger's `## User Intent Discovery And Alignment` section (and a glossary or ADR when a decision is durable), then read it back to the user as bullets. Done when: the user confirms the section and `Decision: aligned` is recorded.

Do not start implementation until the user confirms. Running unattended (AFK): self-interview instead — record each question, your recommended answer, and the assumption taken, then flag the section `assumptions pending user review`.
