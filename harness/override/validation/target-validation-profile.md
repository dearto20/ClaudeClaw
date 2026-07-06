# ClaudeClaw Target Validation Profile

Static, unattended checks only. Gradle builds and on-device runtime need a
connected Android device/emulator and an Anthropic API key, so they stay
manual (see intake constraints).

## Data
```target-validation-json
{
  "schemaVersion": "1.0.0",
  "profileId": "claudeclaw-target-validation",
  "intakeRef": "override/intake/project-intake.md",
  "commands": [
    {
      "id": "claudeclaw-app-entrypoint",
      "group": "architecture",
      "cwd": ".",
      "command": [
        "rg",
        "-n",
        "class MainActivity",
        "app/src/main/java/com/claudeclaw/app/MainActivity.kt"
      ],
      "enabled": true,
      "timeoutSeconds": 30,
      "evidence": "harness/artifacts/validation/latest-report.json",
      "writesTo": "none",
      "artifactPolicy": "none",
      "approvalRisk": "none"
    },
    {
      "id": "claudeclaw-server-anthropic-client",
      "group": "architecture",
      "cwd": ".",
      "command": [
        "rg",
        "-n",
        "anthropic",
        "server/server.py"
      ],
      "enabled": true,
      "timeoutSeconds": 30,
      "evidence": "harness/artifacts/validation/latest-report.json",
      "writesTo": "none",
      "artifactPolicy": "none",
      "approvalRisk": "none"
    },
    {
      "id": "claudeclaw-cleanup-status",
      "group": "cleanup",
      "cwd": ".",
      "command": [
        "git",
        "status",
        "--short"
      ],
      "enabled": true,
      "timeoutSeconds": 30,
      "evidence": "harness/artifacts/validation/latest-report.json",
      "writesTo": "none",
      "artifactPolicy": "none",
      "approvalRisk": "none"
    },
    {
      "id": "claudeclaw-preexisting-untracked",
      "group": "cleanup",
      "cwd": ".",
      "command": [
        "bash",
        "-c",
        "test -z \"$(git ls-files 0438.md 0445.md 0505.md 0603.md 0616.md 0754.md AgentOps-Admin-Console-Overview.pdf AgentOps-Admin-Console-Overview.pptx pm-dashboard-proposal-review.md pm-overview.html)\""
      ],
      "enabled": true,
      "timeoutSeconds": 30,
      "evidence": "harness/artifacts/validation/latest-report.json",
      "writesTo": "none",
      "artifactPolicy": "none",
      "approvalRisk": "none"
    },
    {
      "id": "claudeclaw-ignore-regression",
      "group": "cleanup",
      "cwd": ".",
      "command": [
        "bash",
        "-c",
        "git check-ignore -q app/build && git check-ignore -q .gradle && git check-ignore -q local.properties"
      ],
      "enabled": true,
      "timeoutSeconds": 30,
      "evidence": "harness/artifacts/validation/latest-report.json",
      "writesTo": "none",
      "artifactPolicy": "none",
      "approvalRisk": "none"
    },
    {
      "id": "claudeclaw-pr-readiness",
      "group": "pr-ci",
      "cwd": ".",
      "command": [
        "git",
        "branch",
        "--show-current"
      ],
      "enabled": true,
      "timeoutSeconds": 30,
      "evidence": "harness/artifacts/validation/latest-report.json",
      "writesTo": "none",
      "artifactPolicy": "none",
      "approvalRisk": "none"
    }
  ],
  "infraBlockers": []
}
```
