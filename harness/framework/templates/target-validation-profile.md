# Target Validation Profile

## Purpose
- Fill this in under `override/validation/target-validation-profile.md`.
- Commands must be concrete and executable from this repository.

## Profile Data
```target-validation-json
{
  "schemaVersion": "1.0.0",
  "profileId": "target-validation",
  "intakeRef": "override/intake/project-intake.md",
  "commands": [
    {
      "id": "example-test",
      "group": "unit-test",
      "cwd": "harness",
      "command": ["node", "--test"],
      "enabled": true,
      "timeoutSeconds": 120,
      "evidence": "harness/artifacts/validation/latest-report.json",
      "writesTo": "repo",
      "artifactPolicy": "ignored",
      "approvalRisk": "none"
    }
  ],
  "infraBlockers": []
}
```
