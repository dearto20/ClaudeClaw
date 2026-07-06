# ClaudeClaw Architecture Override

Two cooperating local surfaces:

- `app/` — Kotlin Android app (Gradle). `MainActivity` hosts a chat UI; an
  ADK-inspired agent framework (`AgentTool`, `FunctionTool`, `ToolExecutor`,
  `SkillRegistry`, `SkillToolSet`) auto-discovers skills from
  `app/src/main/assets/skills/` and tool schemas from
  `app/src/main/assets/tools/`. `MiniAppActivity` renders generated mini-apps.
- `server/` — Flask backend (`server/server.py`) that streams Anthropic API
  responses and executes bash/file tools against a local work directory.

`harness/` provides governance, validation, intake, and traceability.
Exploratory notes and exports at the root (numbered markdown, PDF/PPTX, HTML
overviews) are working material, not architecture sources.
