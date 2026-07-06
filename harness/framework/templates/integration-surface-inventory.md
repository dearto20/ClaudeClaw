# Integration Surface Inventory

## Purpose
- Fill this in when a target exposes MCP servers or clients, IDE bridges, browser hooks, plugin or skill loaders, remote-control channels, transports, auth boundaries, or explorer interfaces.
- The inventory complements the target exploration guide and capability catalog by making cross-boundary runtime surfaces agent-legible.

## Inventory Data
```integration-surface-inventory-json
{
  "schemaVersion": "1.0.0",
  "surfaces": [
    {
      "id": "",
      "kind": "mcp-server",
      "status": "applicable",
      "entrypoints": [],
      "protocols": [],
      "transports": [],
      "authBoundaries": [],
      "sessionBoundaries": [],
      "exposedCapabilities": [],
      "dataFlows": [],
      "permissionChecks": [],
      "gated": false,
      "activationConditions": [],
      "disabledBehavior": "",
      "safeFallback": "",
      "runtimeEvidence": [],
      "validationPaths": [],
      "notApplicable": null
    }
  ]
}
```

## Surface Kinds
- `mcp-server`
- `mcp-client`
- `mcp-resource`
- `mcp-prompt`
- `ide-bridge`
- `browser-hook`
- `plugin-loader`
- `skill-loader`
- `remote-control`
- `transport`
- `auth-boundary`
- `explorer-interface`
- `other`

## Required Review Questions
- What external or cross-process boundary does this surface cross?
- What authentication, authorization, or permission check protects it?
- What user-visible capability depends on it?
- What happens when it is disabled, gated, disconnected, or unauthenticated?
- What runtime evidence proves the integration is healthy or intentionally unavailable?
- What validation path fails if the integration contract drifts?
