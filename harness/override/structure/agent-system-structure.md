# Agent System Structure Declaration

Contract: `framework/process/agent-system-structure.md`. Validator:
`harness/scripts/validate-structure.mjs`.

## Declaration

```agent-system-structure-json
{
  "schemaVersion": "1.0.0",
  "repoType": "none",
  "systemName": "n/a",
  "conformance": "conformant",
  "notes": "repoType none is declared with the contract's residual-risk paragraph explicitly in view: ClaudeClaw ships agent-like product code (a Kotlin agent framework in app/src/main/java/com/claudeclaw/app/ and a Flask tool-execution server in server/), but it is not a member repository of any harness-governed agent-system family. There is no core repository with the canonical channels/agent/tools layout, no iOS companion, and no planned migration to that family shape — the agent behavior here is standalone Android product code, not fleet infrastructure. Declared 2026-07-06; reviewed at bootstrap by an independent codex critic per the contract's review-enforced boundary."
}
```
