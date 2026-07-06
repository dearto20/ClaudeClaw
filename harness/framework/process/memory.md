# Memory

The portable memory contract. Memory mechanisms are runtime-specific; this contract binds all of them. The repository is the only memory that exists identically in every environment, for every agent family, in every session.

## Placement

Durable facts live in tracked artifacts: decisions → ADRs; requirements → the register; work state → ledgers; project facts → override docs. Agent-local runtime memory (session memory, per-user memory directories, tool caches) may cache or point to tracked artifacts, never own facts. Anything harness-relevant that exists only in one agent's memory is invisible to every other environment — a placement violation.

## Precedence

When sources disagree: **current user instruction > tracked artifacts > runtime memory > model priors.** A recalled memory that contradicts current repository state is presumed stale, not authoritative.

## Checkpoint timing

Session context is volatile (compaction, crashes, handoffs). Anything required to resume work must be in the ledger before the step that needs it — the ledger-before-edits rule and the `Current step` pointer are the structural enforcement of this.

## Retention

Stale memory is worse than none. Update rather than duplicate; delete when wrong; verify recalled facts about the repository against the current repository before acting on them. Runtime memories join the recurring entropy checks in `framework/process/gates.md`.
