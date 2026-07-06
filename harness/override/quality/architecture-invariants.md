# ClaudeClaw Architecture Invariants Override

The app keeps its chat entrypoint and the backend keeps its Anthropic client;
the agent framework lives in `app/src/main/java/com/claudeclaw/app/`.

## Mechanism Data
```target-mechanism-json
{
  "schemaVersion": "1.0.0",
  "id": "architecture-invariants",
  "status": "applicable",
  "linkedIntakeFields": [
    "target.platforms",
    "domain.workflows"
  ],
  "profileCommandIds": [
    "claudeclaw-app-entrypoint",
    "claudeclaw-server-anthropic-client"
  ],
  "notApplicable": null,
  "evidence": [
    {
      "type": "source-doc",
      "ref": "override/ARCHITECTURE.md",
      "summary": "Architecture override records the app/server split and agent framework layout."
    }
  ]
}
```
