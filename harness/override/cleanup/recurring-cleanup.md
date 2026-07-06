# ClaudeClaw Recurring Cleanup Override

Cleanup checks record worktree state and mechanically assert the two
bootstrap-critical invariants: pre-existing untracked notes/exports never
become tracked, and Android build outputs stay git-ignored.

## Mechanism Data
```target-mechanism-json
{
  "schemaVersion": "1.0.0",
  "id": "recurring-cleanup",
  "status": "applicable",
  "linkedIntakeFields": [
    "project.successCriteria",
    "constraints"
  ],
  "profileCommandIds": [
    "claudeclaw-cleanup-status",
    "claudeclaw-preexisting-untracked",
    "claudeclaw-ignore-regression"
  ],
  "notApplicable": null,
  "evidence": [
    {
      "type": "profile-command",
      "ref": "override/validation/target-validation-profile.md",
      "summary": "claudeclaw-cleanup-status records worktree state; claudeclaw-preexisting-untracked fails if any of the 10 pre-existing untracked paths becomes tracked; claudeclaw-ignore-regression fails if app/build, .gradle, or local.properties stops being ignored."
    }
  ]
}
```
