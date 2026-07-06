# ClaudeClaw Browser Validation Override

The product surface is a native Android app; the HTML files at the repo root
are exploratory notes, not a browser-delivered product.

## Mechanism Data
```target-mechanism-json
{
  "schemaVersion": "1.0.0",
  "id": "browser-validation",
  "status": "not-applicable",
  "linkedIntakeFields": [
    "validation.browserRequired",
    "target.runtimeSurfaces"
  ],
  "profileCommandIds": [],
  "notApplicable": {
    "rationale": "No browser-rendered product surface; the app is native Android and the backend is a local API server.",
    "reviewerRole": "architect",
    "approvedAt": "2026-07-06T09:00:00+09:00",
    "linkedIntakeField": "validation.browserRequired",
    "highRisk": false,
    "crossAgentReviewRef": "",
    "replacementEvidence": [
      {
        "type": "intake",
        "ref": "override/intake/project-intake.md",
        "summary": "browserRequired is false; runtime surfaces are the Android app and Flask server."
      }
    ]
  },
  "evidence": []
}
```
