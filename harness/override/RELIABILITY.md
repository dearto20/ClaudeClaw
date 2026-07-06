# ClaudeClaw Reliability Override

## Completion Criteria
- `node harness/scripts/validate-all.mjs` exits successfully.
- Target validation commands in `override/validation/target-validation-profile.md` pass or carry audited infra blockers.

## Infra Blocker Classification
- Gradle builds, emulator/device runs, and live Anthropic API calls require an Android toolchain, a device, and an API key; they are manual checks and must be recorded as infra blockers if ever added to the profile without unattended support.
