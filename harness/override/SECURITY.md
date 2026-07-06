# ClaudeClaw Security Override

Security boundaries — recorded from the actual code, not aspiration:

- The Anthropic API key is NOT read from the server environment: the Android app sends it in the POST body of each chat request and `server/server.py` builds the client from `data.get("api_key")`. The key therefore transits the local network in request payloads.
- `server/server.py` binds to `0.0.0.0:8765` with unrestricted CORS and no authentication, and it executes bash commands and writes files on the developer machine. Anyone who can reach the port can run shell commands. Run the server only on a trusted local network (or bind it to localhost/adb reverse), and never expose it publicly.
- Never commit API keys or chat transcripts; nothing secret is tracked in the repo today (secrets validation passes), and it must stay that way.
- Treat chat transcripts and generated app content as personal data; do not publish them with the repo.

Hardening the server (localhost binding, shared-secret auth, CORS allowlist) is desirable but out of bootstrap scope; this document records the current boundary honestly.
