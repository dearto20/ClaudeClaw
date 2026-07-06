# Plan Continuity Evidence

## Purpose
- Fill this in for workflows where plans can survive runtime restarts, context compaction, session resume, sub-agent work, forks, or remote execution.
- The evidence proves continuity of the local plan ledger, not the behavior of any external planning implementation.

## Continuity Data
```plan-continuity-json
{
  "schemaVersion": "1.0.0",
  "planArtifact": "",
  "sessionOrRunId": "",
  "persistenceLocation": "",
  "resumeMechanism": "",
  "forkMechanism": "",
  "compactionOrSnapshotMechanism": "",
  "subAgentPlanEvidence": [],
  "recoveryEvidence": [],
  "completionEvidence": [],
  "validationPaths": []
}
```

## Required Evidence
- The active plan path is known before mutation for non-trivial work.
- Resume and fork behavior cannot clobber the original plan.
- If context is compacted, a plan summary or snapshot remains recoverable.
- Completion records validation result, dirty worktree state, new tracked or ignored files, generated artifact handling, push/publish state, and remaining risk.
