# CONTEXT.md — Domain Glossary Template

Copy to the target repository root as `CONTEXT.md` — a manual, target-owned step (start from `framework/seeds/CONTEXT.md`; bootstrap does not materialize it and upgrades never write it). One glossary per bounded context; a monorepo with several contexts keeps one `CONTEXT.md` per context root plus a short context map at the top level.

Rules (from `framework/process/writing-skills.md § Durability`):

- **Be opinionated.** When multiple words exist for one concept, pick the best and list the others under *Avoid* — agents use language to think, and one shared term cuts tokens and ambiguity in every downstream conversation.
- **Create entries lazily** — only when a real ambiguity or a real decision produced the term. An empty glossary is healthier than a speculative one.
- **Behavior, not procedure; no file paths or line numbers** — they rot with every refactor. Name the concept, not its current implementation location.
- Entries are one term plus one to three sentences. If an entry needs more, it is probably an ADR (see `framework/process/governance.md § ADRs`).

Format per entry:

```markdown
## <Term>
<One to three sentences: what it means in this system, and the one distinction that matters.>
_Avoid:_ <rejected synonyms, comma-separated — these words are banned for this concept>
```

Example:

```markdown
## Issue
A tracked unit of work in the issue tracker, whatever the backend calls it.
_Avoid:_ ticket, task, card, story
```
