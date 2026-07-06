# Writing Skills

Authoring standard for every agent-facing instruction surface in this harness: skills (`framework/skills-src/`), process docs, templates, and entrypoint prose. A skill exists to wrangle predictability out of a stochastic system — same process every run, not same output. Instructions are a budget, not insurance: every sentence in context dilutes attention on every other sentence.

## The no-op test

For each sentence ask: does it change agent behavior versus the default? If not, delete the whole sentence — do not trim it. Whether a line is a no-op is model-relative and empirical: settle it by running the skill, not by debate.

Named failure modes:
- **No-op** — an instruction the model already obeys by default; you pay load to say nothing.
- **Sediment** — stale layers accumulated by reactive edits; delete on sight.
- **Sprawl** — too long even though every line is live; fix by disclosure, not deletion.
- **Duplication** — the same rule stated in two homes; keep one normative home, point the rest at it.
- **Premature completion** — the agent ends a step early because visible later steps pull attention toward being done.

## Steps and completion criteria

A skill body is ordered **steps** first, **reference** second. Every step ends with a checkable, exhaustive completion criterion — `Done when: <predicate the agent can evaluate>`. Sharp done-bars are the primary defense against premature completion and the main driver of within-step legwork; add them before adding more step detail. Gate steps (the step everything else depends on) get disproportionate wording; middle steps the model's priors already cover get deleted, not written. If a criterion is irreducibly fuzzy AND the rush is observed, split later steps across a real context boundary (sub-agent or handoff) — an inline mention leaves them in context and clears nothing.

## Descriptions and invocation

The description is the one line a model-invoked skill keeps loaded on every turn — it does the invocation work.
- Front-load the skill's **leading word**: a compact concept already in model pretraining that anchors the behavior (*converge*, *ledger*, *critic*, *lens*). A made-up word recruits no priors — you pay in definition tokens what a pretrained word gives free.
- One explicit trigger per distinct branch ("Use when …, when …, or before …"); collapse synonyms that rename the same branch.
- Cut identity restated in the body. Keep descriptions to one physical line (generator constraint).

Two invocation tiers with different costs: model-invoked pays permanent context load and needs rich triggers; user-invoked pays human recall and needs only a one-line identity. When user-invoked skills exceed recall, add one router skill that names the others — never a second overlapping orchestrator.

## Disclosure and placement

Inline what every path through the skill needs; push what only some paths reach behind a pointer (reference section, sibling doc, or the contract's reference map). A must-have target behind a weakly worded pointer is a variance bug — fix the pointer's wording first. Placement rule for any new rule: deterministic and forbiddable → validator/hook, then delete the prose; discoverable from repo state → nothing; rare or rationale-heavy → skill or on-demand process doc; relevant to every request and undiscoverable → one entrypoint line (the most expensive real estate in the system).

## Durability

Agent-written **narrative** artifacts (glossaries, ADR rationale, briefs, PRDs) state behavior, not procedure, and avoid file paths and line numbers — they rot with every refactor; create files lazily; be opinionated — pick one term, list rejected synonyms under *Avoid*. **Evidence records are the opposite case**: ledgers' Affected Paths, validation/report paths, and file-line review findings must cite exact paths — that precision is their contract (`gates.md`, `review.md`), and this rule never overrides it.

## Example

BAD step:
> 3. Review the findings thoroughly and make sure everything is addressed properly before moving on.

This is bad because: "thoroughly"/"properly" are unfalsifiable (no done-bar); "review the findings" is a no-op (the model already does it); "before moving on" names the next step and invites premature completion.

GOOD step:
> 3. Map every finding to `accepted` (with the fix), `rejected` (with reason), or `blocked`. Done when: no finding lacks a disposition.
