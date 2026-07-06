# ClaudeClaw Quality Override

Local quality gates:

- `rg -n "class MainActivity" app/src/main/java/com/claudeclaw/app/MainActivity.kt`
- `rg -n anthropic server/server.py`
- `node harness/scripts/validate-all.mjs`

Gradle build (`./gradlew assembleDebug`) and on-device checks are manual quality gates outside the unattended profile.
