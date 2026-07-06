# ClaudeClaw PR CI Loop Override

Changes land on `main` in this single-developer experiment, but hosted CI does
exist: the adoption surface installs `.github/workflows/validate.yml`, which
runs `node harness/scripts/validate-all.mjs` on every push and pull request
and re-runs the commit tier gate on the pushed diff (`harness.mjs precommit
--range`) for pull requests and default-branch pushes, with validation
artifacts uploaded per run. Local readiness is recorded from the branch state
plus harness validation; the workflow is the CI floor that holds even if
local hooks were skipped.

## Mechanism Data
```target-mechanism-json
{
  "schemaVersion": "1.0.0",
  "id": "pr-ci-loop",
  "status": "applicable",
  "linkedIntakeFields": [
    "target.environments"
  ],
  "profileCommandIds": [
    "claudeclaw-pr-readiness"
  ],
  "notApplicable": null,
  "evidence": [
    {
      "type": "profile-command",
      "ref": "override/validation/target-validation-profile.md",
      "summary": "claudeclaw-pr-readiness records the current branch."
    },
    {
      "type": "file-line",
      "ref": ".github/workflows/validate.yml",
      "summary": "GitHub Actions runs validate-all on push/PR and the range tier gate on PRs and default-branch pushes (CI floor)."
    }
  ]
}
```
