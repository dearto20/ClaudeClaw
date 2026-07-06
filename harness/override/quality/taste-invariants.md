# ClaudeClaw Taste Invariants Override

Kotlin sources stay in the single `com.claudeclaw.app` package; skills and
tool schemas stay declarative under `app/src/main/assets/`.

## Mechanism Data
```target-mechanism-json
{
  "schemaVersion": "1.0.0",
  "id": "taste-invariants",
  "status": "applicable",
  "linkedIntakeFields": [
    "users.audiences",
    "project.successCriteria"
  ],
  "profileCommandIds": [
    "claudeclaw-app-entrypoint"
  ],
  "notApplicable": null,
  "evidence": [
    {
      "type": "profile-command",
      "ref": "override/validation/target-validation-profile.md",
      "summary": "claudeclaw-app-entrypoint checks the app entry class stays in place."
    }
  ]
}
```
