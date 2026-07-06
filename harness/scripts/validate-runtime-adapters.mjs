// validate-runtime-adapters — guard the guards. The registry declares which
// visibility surfaces each agent family's runtime can mechanically enforce
// (framework/registry/agents.json → runtimeEnforcement); this validator fails
// when the declared wiring is missing or stripped, so removing a hook from
// .claude/settings.json is a validation failure, not a silent loss of
// enforcement. Families with no capability carry a recorded basis — that is a
// declared exception (enforcement-map: visibility-tier-line), checked by the
// registry integrity rules, not here.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { finishValidation, pathExists } from "./validation-helpers.mjs";
import { getValidationMode } from "./validation-mode.mjs";
import { HOOK_EVENTS, runtimeSettingsFailures } from "./runtime-hooks/settings-template.mjs";

const failures = [];
const mode = await getValidationMode();
const workspaceRoot = mode.workspaceRoot;
const harnessRoot = mode.harnessRoot;

const registry = JSON.parse(
  await readFile(path.join(harnessRoot, "framework", "registry", "agents.json"), "utf8"),
);

// Wiring definitions are per-family adapters. A family declaring a capability
// this validator has no wiring definition for is a contract error — the
// declaration would be unverifiable.
const wiringChecks = {
  "claude-code": async (enforcement) => {
    const anyCapability = enforcement.statusline || enforcement.promptReinjection || enforcement.responseCheck;
    if (!anyCapability) return;
    const settingsRel = ".claude/settings.json";
    const settingsAbs = path.join(workspaceRoot, settingsRel);
    if (!(await pathExists(workspaceRoot, settingsRel))) {
      failures.push(`claude-code declares runtime enforcement but ${settingsRel} is missing (run bootstrap/upgrade to merge the wiring)`);
      return;
    }
    let settings;
    try {
      settings = JSON.parse(await readFile(settingsAbs, "utf8"));
    } catch {
      failures.push(`${settingsRel} is not valid JSON — runtime enforcement wiring unverifiable`);
      return;
    }
    for (const failure of runtimeSettingsFailures(settings)) {
      failures.push(`${settingsRel}: ${failure}`);
    }
    for (const command of Object.values(HOOK_EVENTS)) {
      const scriptRel = command.replace(/^node\s+/, "");
      if (!(await pathExists(workspaceRoot, scriptRel))) {
        failures.push(`runtime hook script missing: ${scriptRel}`);
      }
    }
  },
};

for (const [family, spec] of Object.entries(registry.families ?? {})) {
  const enforcement = spec?.runtimeEnforcement;
  if (!enforcement || typeof enforcement !== "object") continue; // registry integrity rules report this
  const anyCapability = ["statusline", "promptReinjection", "responseCheck"].some((c) => enforcement[c] === true);
  if (!anyCapability) continue;
  const check = wiringChecks[family];
  if (!check) {
    failures.push(`registry family ${family} declares runtime enforcement capabilities but no wiring check exists for it — the declaration is unverifiable`);
    continue;
  }
  await check(enforcement);
}

// Targets must carry the version-adoption record: it is the statusline's
// version source and the upgrade-adoption commit-gate anchor.
if (!mode.isSource) {
  const adoptionRel = "harness/override/governance/harness-upgrade-adoption.json";
  const adoptionAbs = path.join(workspaceRoot, adoptionRel);
  if (!(await pathExists(workspaceRoot, adoptionRel))) {
    failures.push(`missing ${adoptionRel} — targets record the governing harness version (written by bootstrap/upgrade)`);
  } else {
    try {
      const adoption = JSON.parse(await readFile(adoptionAbs, "utf8"));
      if (typeof adoption.harnessVersion !== "string" || adoption.harnessVersion.trim() === "") {
        failures.push(`${adoptionRel} must record harnessVersion`);
      }
      if (typeof adoption.appliedAt !== "string" || Number.isNaN(Date.parse(adoption.appliedAt))) {
        failures.push(`${adoptionRel} must record an ISO-8601 appliedAt`);
      }
    } catch {
      failures.push(`${adoptionRel} is not valid JSON`);
    }
  }
}

finishValidation("validate-runtime-adapters", failures, { mode: mode.mode });
