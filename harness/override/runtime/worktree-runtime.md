# ClaudeClaw Worktree Runtime Override

The product runtime (Android app + local Flask server) needs a connected
device/emulator and an Anthropic API key, so it cannot run unattended in
harness validation.

## Mechanism Data
```target-mechanism-json
{
  "schemaVersion": "1.0.0",
  "id": "worktree-runtime",
  "status": "not-applicable",
  "linkedIntakeFields": [
    "validation.runtimeRequired",
    "target.runtimeSurfaces"
  ],
  "profileCommandIds": [],
  "notApplicable": {
    "rationale": "Runtime validation requires an Android emulator/device and a live Anthropic API key; neither is available unattended. Runtime checks are manual per intake constraints; static source checks stand in.",
    "reviewerRole": "architect",
    "approvedAt": "2026-07-06T09:00:00+09:00",
    "linkedIntakeField": "validation.runtimeRequired",
    "highRisk": false,
    "crossAgentReviewRef": "",
    "replacementEvidence": [
      {
        "type": "intake",
        "ref": "override/intake/project-intake.md",
        "summary": "runtimeRequired is false; runtime checks are declared manual in constraints."
      }
    ]
  },
  "evidence": []
}
```
