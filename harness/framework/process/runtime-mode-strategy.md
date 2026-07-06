# Runtime Mode Strategy

## Purpose
- Runtime mode strategy keeps harness planning obligations consistent while adapting mutation authority to the active agent runtime.
- The same framework must work in planning-only runtimes, mutation-capable runtimes, and resumed sessions that move from one runtime class to another.
- Runtime mode names are tool-specific; the portable contract is whether the runtime may mutate repository-tracked artifacts.

## Runtime Classes

| Runtime class | Codex example | Repository mutation | Harness obligation |
|---|---|---|---|
| Planning-only runtime | Plan Mode | `no` | Inspect, decompose intent, gather evidence, design a proposed execution plan, identify expert roles, and run non-mutating validation where useful. |
| Mutation-capable runtime | Default/non-plan mode | `yes` | Perform the same planning discipline, then create or update execution ledgers, modify artifacts, run validators, close expert-role loops, and record completion evidence. |

## Planning-Only Runtime Rules
- Planning obligations still apply: read required docs, verify intake state when possible, decompose explicit and implicit user intent, identify acceptance criteria, compare practical alternatives, and select the best available path.
- Agents may inspect repository files, gather evidence, and run non-mutating commands when the runtime permits.
- Agents produce a decision-complete proposed plan in conversation or another non-mutating channel.
- Agents must not edit tracked files, create execution-plan artifacts, update requirement registers, create ADRs, or write validation evidence into the repository.
- If a required harness step needs repository mutation, record it as planned work, not completed work.
- Pure Plan Mode sessions do not need active or completed execution-plan files, because the runtime cannot create tracked artifacts.

## Mutation-Capable Runtime Rules
- The same planning obligations apply before implementation.
- For non-trivial work, create or update an execution plan under `exec-plans/active/` before editing scoped artifacts.
- Default mode must create or update execution ledgers before edits for non-trivial work.
- Implementation may then update framework docs, override state, validators, tests, requirements, ADRs, and completion evidence as allowed by the permission profile.
- Completed execution plans must record Runtime Mode, mutation authority, completion evidence, validation evidence, and any Plan Mode source used to start the work.

## Resume Rule
- If a mutation-capable runtime resumes from a planning-only proposal, convert the accepted proposal into `exec-plans/active/` before implementation edits.
- The active plan records the Plan Mode source as a link, transcript reference, or concise summary.
- Mode transition evidence records how the proposal became the active execution plan, including the runtime class that performed the conversion.
- The accepted proposal is evidence for planning, but completion requires the mutation-capable runtime to run validators and close the repo-backed ledger.

## Blocked Rule
- If a required harness step needs mutation but the current runtime is planning-only, mark that step as blocked by runtime mode or planned for the later mutation-capable session.
- Do not mark mutation-dependent work as completed from a planning-only runtime.
- If a mutation-capable runtime cannot perform a required mutation because of permissions, classify the blocker under the active permission profile and record the external input needed.

## Execution Plan Fields
Every execution plan template includes a `Runtime Mode` section:
- Current mode: `plan` | `default`
- Mutation allowed: `yes` | `no`
- Plan Mode source: link or summary if execution came from a prior proposed plan, or a rationale when not applicable.
- Mode transition evidence: how the accepted plan became an active execution plan, or a rationale when no transition occurred.

## Validation Expectations
- Validators check that the implementation-plan template contains the `Runtime Mode` section and fields.
- Validators check completed execution plans for recorded mutation mode and completion evidence.
- Validators do not require active or completed execution-plan files to exist for pure Plan Mode sessions.
- Contract tests cover the planning-only no-mutation rule and the Default-mode active-ledger-before-edits rule.
