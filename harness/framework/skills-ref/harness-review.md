# harness-review
<!-- generated from harness/framework/skills-src — do not edit; rerun node harness/scripts/generate-skills.mjs -->

> Run independent critic review for non-trivial work — same-family critic by default, cross-family transport for high-risk work. Use before declaring planning, implementation, or completion ready.

Default process for critic review (contract: `framework/process/review.md`).

1. Standard tier: run a same-family critic with fresh context and adversarial framing — the critic's job is to refute readiness, not confirm it. Done when: findings are recorded in the ledger's Critique And Debate section.
2. High-risk tier with two families available: create a packet from `framework/templates/cross-agent-review-packet.md`, then:
   `node harness/scripts/run-agent-review.mjs --primary <family> --critic <family> --packet <packet> --out harness/artifacts/cross-agent-review/<id>-report.json`
   Critic-model policy comes from `framework/registry/agents.json`; never downgrade the critic model. Done when: the report exists.
3. Act on the report: `blockingFindings` → revise and rerun. `nonBlockingRisks` → resolve and rerun, or accept-with-rationale in the ledger (silent omission is a violation). Done when: `pushbackFree=true` or the acceptance rationale is recorded.
4. Map every finding to `accepted` (with the fix), `rejected` (with reason), or `blocked`; after 5 iterations record `blocked`/`not-ready` naming the unresolved findings. Done when: no finding lacks a disposition.
