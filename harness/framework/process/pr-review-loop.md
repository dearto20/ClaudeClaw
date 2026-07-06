# PR Review Loop

## Purpose
- Short-lived change loops keep agent work reviewable.
- The framework defines how agents handle CI, review comments, and merge readiness.

## Rules
- Prefer small, focused PRs.
- Keep each PR tied to an execution plan or requirement change.
- Do not mix unrelated refactors with feature work.
- CI failures must be investigated, fixed, and re-run before completion.
- Review comments are classified as accepted, rejected with reason, duplicate, or blocked.
- Merge readiness requires passing validation and recorded completion evidence.
- PR monitoring must watch until a terminal state: merged, closed, or blocked on user help.
- Green CI is a progress milestone, not a terminal state, while review feedback or mergeability can still change.
- Failed CI must be classified before action: branch-related failures may be fixed, flaky or infrastructure failures may be rerun only when the evidence supports a retry, and ambiguous failures require one diagnosis pass before choosing.
- Review feedback, CI status, and mergeability must be checked together before declaring a PR ready.

## Agent Loop
1. Create or update the execution plan.
2. Implement a focused change.
3. Run validation.
4. Address CI and review feedback.
5. Record synthesis and evidence.

## PR Watch Evidence
- Record the watched target: PR number or URL, branch, base branch, and current head SHA when available.
- Record the latest CI summary, review-feedback state, and mergeability or conflict state.
- If the PR is green but still open, record that green is a milestone and continue watching when the user requested monitoring.
- Stop only when the PR is merged or closed, or when a user-help blocker is recorded with evidence.
