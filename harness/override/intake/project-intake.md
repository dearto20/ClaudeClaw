# ClaudeClaw Project Intake

## Intake Data
```intake-json
{
  "schemaVersion": "1.0.0",
  "state": "ready",
  "project": {
    "name": "ClaudeClaw",
    "summary": "Experimental AI coding assistant for Android: a Kotlin app with an ADK-inspired agent framework and skill auto-discovery, backed by a local Flask server that drives the Anthropic API with tool execution.",
    "primaryGoal": "Explore agentic app generation on Android — the app composes mini-apps from skills and tools while the backend executes bash/file tools against a local workspace.",
    "successCriteria": [
      "App sources and agent framework classes remain present and coherent.",
      "Backend server keeps its Anthropic client and tool-execution entrypoint.",
      "Harness validation passes locally."
    ],
    "nonGoals": [
      "Production distribution via app stores.",
      "Multi-user or hosted backend deployment.",
      "Governing the exploratory notes and slide exports stored alongside the code."
    ]
  },
  "target": {
    "platforms": [
      "Android (Kotlin/Gradle app)",
      "local Python backend"
    ],
    "deploymentModel": "local development only: app sideloaded to a device/emulator, Flask server run on the developer machine",
    "runtimeSurfaces": [
      "Android app (MainActivity, MiniAppActivity)",
      "Flask server (server/server.py)"
    ],
    "environments": [
      "local development"
    ]
  },
  "users": {
    "audiences": [
      "developer operator"
    ],
    "roles": [
      "developer",
      "experimenter"
    ],
    "primaryUser": "developer operator"
  },
  "domain": {
    "verticals": [
      "AI developer tooling",
      "agentic app generation"
    ],
    "workflows": [
      "chat-driven app generation on device",
      "skill and tool authoring",
      "local backend tool execution"
    ],
    "criticality": "Personal experiment; failures cost developer time only, but the backend executes shell commands so local misuse could damage the developer workspace."
  },
  "risk": {
    "dataSensitivity": "Medium: chat content and generated code are personal, and the Anthropic API key is sent by the app in each POST body to the local server, so the key transits the local network in request payloads.",
    "securityPosture": "Weak by design of the experiment and recorded honestly: server/server.py binds to 0.0.0.0:8765 with unrestricted CORS and no authentication while exposing bash and file-write tools, so any host that can reach the port can execute shell commands. It must run only on a trusted local network; hardening (localhost binding, auth, CORS allowlist) is tracked in override/SECURITY.md as out of bootstrap scope. No keys or secrets are committed to the repo.",
    "regulatoryPosture": "Private experimental repository with no compliance claims.",
    "operationalImpact": "Confined to the developer machine and local network; the server's bash/file tools default to a local work directory but are not sandboxed."
  },
  "validation": {
    "expectedCommandGroups": [
      "architecture",
      "cleanup",
      "pr-ci"
    ],
    "browserRequired": false,
    "observabilityRequired": false,
    "runtimeRequired": false
  },
  "constraints": [
    "No Anthropic API keys or other secrets committed to the repository.",
    "Gradle builds and device runtime checks are manual; harness validation stays static and unattended.",
    "Pre-existing untracked notes and exports (numbered markdown, PDF/PPTX, HTML overviews) are left unstaged by harness work; the claudeclaw-preexisting-untracked profile command fails if any of them ever becomes tracked.",
    "Android build outputs stay git-ignored after the bootstrap .gitignore union; the claudeclaw-ignore-regression profile command fails on regression."
  ],
  "deferredNoncriticalFields": []
}
```
