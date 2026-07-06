# ClaudeClaw

An experimental AI coding assistant for Android. A Kotlin/Gradle app hosts a chat UI and an ADK-inspired agent framework with skill auto-discovery; a local Flask backend drives the Anthropic API with tool execution to generate and deploy mini-apps on device.

## Layout

- `app/` — Android app (Kotlin, `com.claudeclaw.app`): chat UI (`MainActivity`), generated mini-app host (`MiniAppActivity`), agent framework (`AgentTool`, `FunctionTool`, `ToolExecutor`, `SkillRegistry`, `SkillToolSet`), declarative skills and tool schemas under `app/src/main/assets/`.
- `server/` — local Flask backend (`server.py`): streams Anthropic responses and executes bash/file tools against a local work directory. Development use on a trusted local network only — see `harness/override/SECURITY.md` for the recorded boundary.
- `harness/` — installed DevelopmentHarness (v2.10.0): governance, validation, intake, and traceability. Project-specific harness state lives under `harness/override/`.

## Running

- App: open in Android Studio or `./gradlew assembleDebug`, sideload to a device/emulator.
- Server: `pip install -r server/requirements.txt`, then `python3 server/server.py` (binds `0.0.0.0:8765`; the app supplies the Anthropic API key per request).

## Governance

This repository is an installed DevelopmentHarness target, not the harness source. Agents start at `AGENTS.md` / `CLAUDE.md`, which delegate to `harness/AGENTS.md`. Validation: `node harness/scripts/validate-all.mjs`.
