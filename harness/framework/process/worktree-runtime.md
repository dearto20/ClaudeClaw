# Worktree Runtime

## Purpose
- Agents need application instances that are isolated, reproducible, and tied to the current change.
- The framework requires target projects to document worktree runtime behavior in `override/`.

## Target Project Contract
Each bootstrapped project must define:
- How to create or select a git worktree for a change.
- How to install dependencies for that worktree.
- How to start the app or service for that worktree.
- How ports, env files, databases, caches, and temp dirs are isolated.
- How to reset or tear down the runtime.
- Where runtime artifacts are written.
- Which validation command proves the runtime is usable.

## Evidence
- Runtime validation must produce command output, logs, screenshots, videos, traces, or a stated non-applicable rationale.
- Worktree-specific artifacts must be easy for agents to locate from the execution plan.
