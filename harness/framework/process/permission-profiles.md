# Permission Profiles

## Purpose
- Permission profiles let teams reduce approval friction while preserving hard safety rules.
- The framework documents expected behavior; each agent runtime enforces permissions in its own way.

## Profiles
| Profile | Use | Behavior |
|---|---|---|
| `guarded` | Default for unknown or shared environments. | Approvals required for network, external writes, destructive commands, credential use, and privileged actions. |
| `trusted-local` | User explicitly trusts the local repo and wants minimal approval prompts. | Agents may run local validation, tests, builds, dev servers, browser checks, logs, and non-destructive repo tooling without repeated prompts. |
| `restricted-sandbox` | Read/plan/test-only environments. | Agents collect evidence, run allowed checks, and record blockers for unavailable actions. |

## Approval Avoidance Ladder
Before requesting approval, agents must try the first applicable non-destructive option:
1. Use an existing approved command path that satisfies the same validation or inspection goal.
2. Redirect build, test, runtime, browser, observability, and validation outputs to declared temp, cache, or ignored artifact paths.
3. Run non-destructive inspection that identifies the side effect, target path, tracked state, and remaining risk.
4. Record an infra blocker with evidence when the runtime cannot perform the safe route.

Approval prompts are a last resort after this ladder is exhausted. In `trusted-local`, repeated approval prompts for validation/build artifacts or cleanup are treated as a workflow defect unless a hard stop applies.

## Trusted-Local Hard Stops
Even in `trusted-local`, agents must checkpoint before:
- Destructive source cleanup, including deleting source files or directories.
- Resetting git state.
- Force pushing.
- Dropping databases or caches outside declared temp paths.
- Modifying secrets or credentials.
- Reading, printing, copying, or rewriting secrets and credentials outside explicit scope.
- Writing outside configured workspace roots when the path is undeclared.
- Running cleanup that targets databases, external services, or undeclared outside-workspace paths.

## Audit Requirements
- Execution plans record the active permission profile.
- Validation reports record skipped gates and blockers.
- Cleanup actions must validate target paths before execution.
- Target validation profiles declare command artifact side effects before execution.

## Command Policy Discipline
- Command allow, prompt, and forbidden decisions should be expressed as the narrowest practical ordered prefix.
- Policy entries should include a short rationale; forbidden decisions should name a safer alternative when one exists.
- New reusable command policy rules should include at least one positive example and one negative example in the source artifact or validator fixture when practical.
- Absolute executable paths must not silently bypass basename policy; when a target depends on host executable paths, record the allowed paths or require approval.
