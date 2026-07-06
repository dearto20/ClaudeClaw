# Observability

## Purpose
- Agents should debug from logs, metrics, and traces instead of guessing.
- The framework defines the required observability contract; target projects provide concrete commands and locations.

## Target Project Contract
Each bootstrapped project must define:
- Log location or query command.
- Metric endpoint, dashboard, or query command.
- Trace endpoint, dashboard, or query command.
- Doctor, health, status, or diagnostic command when the target has a runtime surface.
- Usage, cost, rate-limit, or quota evidence when the target consumes metered services.
- Retention and cleanup behavior for local artifacts.
- How logs/metrics/traces are scoped to the current worktree.
- failure triage steps for common runtime failures.

## Diagnostics And Status Evidence
- Runtime targets should expose a bounded health, status, doctor, or diagnostic path that agents can run without starting indefinite foreground processes.
- Diagnostics should identify missing credentials, unavailable dependencies, disconnected integrations, invalid configuration, and disabled or gated surfaces.
- Targets without runtime diagnostics must record the replacement evidence used to judge runtime readiness.
- Metered or quota-bound targets should record cost, usage, rate-limit, or quota evidence when those signals affect completion.

## Runtime Summary Evidence
- Execution plans and validation reports should include a bounded runtime summary when the work depends on runtime state.
- The summary should identify cwd, workspace roots, permission profile, sandbox posture, network posture, model/provider when applicable, and token/context budget state when available.
- Runtime summaries must be concise enough for agent use and must not expose secrets, credentials, or unbounded environment dumps.
- If a field is unavailable or not applicable, record that explicitly instead of guessing.

## Allowed Non-Applicable Cases
- Projects without runtime surfaces may mark metrics or traces `not applicable`.
- A non-applicable rationale must explain why the signal does not exist and what evidence replaces it.

## Agent Use
- Execution plans must record the observability evidence used for verification.
- Failures must cite the relevant log, metric, trace, or non-applicable rationale.

## Harness Telemetry
Tool-written, append-only JSONL under `harness/artifacts/telemetry/` (gitignored; raw counts only — interpretation belongs to pruning reviews, per the prune-by-telemetry direction):
- `gate-outcomes.jsonl` — every gate decision: `{at, command, passed, failedSteps[], durationMs}`; precommit adds `{mode, tier, reasons[], upgradeAdoption}`.
- `review-transport.jsonl` — every cross-agent review attempt: transport rung, pushback, novel-finding classification (feeds `harness review decision-gate`).
- `visibility-compliance.jsonl` — per-turn `[harness]` tier-line compliance from the Stop hook.
- `ledger-usage.jsonl` — ledger lifecycle from the `harness ledger` commands: `{at, event: new|step|annex|close, slug}`; `annex` adds the annex name; `close` adds `coreFields` (per-field `filled|pending|n/a|empty`) and the appended `annexes[]`. Evidence base for the next template pruning round: core fields habitually `n/a`/`pending` at close are sediment candidates; annexes that never trigger are pruning candidates.
