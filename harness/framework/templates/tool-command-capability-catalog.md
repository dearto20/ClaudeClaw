# Tool And Command Capability Catalog

## Purpose
- Fill this in when a target project exposes tools, commands, jobs, slash commands, MCP tools, scripts, or agent-callable actions.
- The catalog complements the target validation profile by describing capability boundaries and runtime evidence.

## Catalog Data
```capability-catalog-json
{
  "schemaVersion": "1.0.0",
  "capabilities": [
    {
      "id": "",
      "kind": "command",
      "capabilityType": "",
      "category": "",
      "ownerSurface": "",
      "entrypoint": "",
      "registryPath": "",
      "inputSchemaOrContract": "",
      "outputContract": "",
      "allowedToolsOrDependencies": [],
      "permissionProfile": "guarded",
      "approvalRisk": "none",
      "readOnly": false,
      "destructive": false,
      "writesTo": "none",
      "artifactPolicy": "none",
      "gated": false,
      "activationConditions": [],
      "disabledBehavior": "",
      "concurrencySafety": "unknown",
      "runtimeEvidence": [],
      "validationPaths": []
    }
  ]
}
```

## Required Review Questions
- What can this capability read?
- What can it write?
- Can it execute external commands or network calls?
- Is it safe to run concurrently?
- Is it disabled or gated by default, and what proves the disabled path is safe?
- Which user-visible surface consumes the result?
- What evidence proves the user-visible outcome happened?
- What validation path fails if the capability contract drifts?
