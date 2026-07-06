// harness bootstrap — install the manifest-approved distributable surface into a
// target project. Honors the bootstrap layout contract:
//   BOOTSTRAP_LAYOUT_CONTRACT: manifest-distributable-only
//   BOOTSTRAP_LAYOUT_CONTRACT: no-target-development-root
//   BOOTSTRAP_LAYOUT_CONTRACT: target-override-owned
//   BOOTSTRAP_LAYOUT_CONTRACT: preserve-target-owned-harness-state
// Usage:
//   node harness/scripts/harness-bootstrap.mjs --target <dir> [--profile programming|research|document|investigation]
// The source is the DevelopmentHarness checkout containing this script.

import { cp, mkdir, readFile, writeFile, access } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mergeHarnessRuntimeSettings } from "./runtime-hooks/settings-template.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(__dirname, "..", "..");

const args = process.argv.slice(2);
const readArg = (flag, fallback = null) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};
const targetRoot = readArg("--target");
const profileName = readArg("--profile", "programming");
if (!targetRoot) {
  console.error("usage: harness bootstrap --target <dir> [--profile <name>]");
  process.exit(1);
}
const target = path.resolve(targetRoot);

const manifest = JSON.parse(
  await readFile(path.join(sourceRoot, "development", "distribution-manifest.json"), "utf8"),
);

// Preserve target-owned harness state: never overwrite these if present.
const targetOwnedPrefixes = [
  "harness/override/",
  "harness/exec-plans/active/",
  "harness/exec-plans/completed/",
  "harness/exec-plans/tech-debt/",
  "harness/artifacts/",
];
const isTargetOwnedLive = (rel) =>
  targetOwnedPrefixes.some((p) => rel.startsWith(p)) && !rel.startsWith("harness/exec-plans/templates/");

// Expand manifest include globs against the source tree.
const expand = (pattern) => {
  if (!pattern.includes("*")) return existsSync(path.join(sourceRoot, pattern)) ? [pattern] : [];
  const base = pattern.replace(/\/\*\*$/, "");
  const out = [];
  const walk = (dir) => {
    const result = spawnSync("find", [path.join(sourceRoot, base), "-type", "f"], { encoding: "utf8" });
    for (const abs of result.stdout.split("\n").filter(Boolean)) {
      out.push(path.relative(sourceRoot, abs));
    }
  };
  walk(base);
  return out;
};

const excluded = (rel) =>
  (manifest.distribution.exclude ?? []).some((pattern) => {
    if (pattern.endsWith("/**")) return rel.startsWith(pattern.slice(0, -2));
    if (pattern.includes("*")) {
      const re = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);
      return re.test(rel);
    }
    return rel === pattern;
  });

let copied = 0;
let preserved = 0;
for (const pattern of manifest.distribution.include) {
  for (const rel of expand(pattern)) {
    if (excluded(rel)) continue;
    const dest = path.join(target, rel);
    // Runtime settings are merged additively below, never blind-copied — a
    // target's own settings keys must survive re-bootstrap.
    if (rel === ".claude/settings.json") continue;
    if (isTargetOwnedLive(rel) && existsSync(dest)) {
      preserved += 1;
      continue;
    }
    // Seed defaults are copy-if-missing only.
    if (rel.startsWith("harness/framework/seeds/") && existsSync(dest)) {
      preserved += 1;
      continue;
    }
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(path.join(sourceRoot, rel), dest);
    copied += 1;
  }
}

// no-target-development-root: never materialize development/ in a target.
if (existsSync(path.join(target, "development", "developmentharness-source.json"))) {
  console.error("[bootstrap] WARNING: target contains development/developmentharness-source.json — a target must not keep the source marker; remove development/ from the target.");
}

// Materialize target-owned override skeleton per the selected domain profile.
const profilePath = path.join(sourceRoot, "harness", "framework", "profiles", `${profileName}.json`);
const profile = JSON.parse(await readFile(profilePath, "utf8"));
let scaffolded = 0;
for (const mech of profile.mechanisms) {
  const dest = path.join(target, "harness", mech.override);
  if (existsSync(dest)) continue;
  const templateAbs = path.join(sourceRoot, "harness", mech.template.startsWith("harness/") ? mech.template.slice(8) : mech.template);
  await mkdir(path.dirname(dest), { recursive: true });
  let content;
  try {
    content = await readFile(templateAbs, "utf8");
  } catch {
    content = `# ${mech.id}\n\nTODO: fill this ${profile.profile}-profile mechanism. ${mech.note ?? ""}\n`;
  }
  await writeFile(dest, content);
  scaffolded += 1;
}

// Intake scaffold (feature work is blocked until state: ready).
const intakeDest = path.join(target, "harness", "override", "intake", "project-intake.md");
if (!existsSync(intakeDest)) {
  await mkdir(path.dirname(intakeDest), { recursive: true });
  await cp(path.join(sourceRoot, "harness", "framework", "templates", "bootstrap-intake.md"), intakeDest);
  scaffolded += 1;
}

// Activate enforcement — hooks do not clone; validation fails until this ran.
const hookResult = spawnSync("git", ["config", "core.hooksPath", "harness/hooks"], { cwd: target, encoding: "utf8" });
const hooksActivated = hookResult.status === 0;

// Runtime-adapter wiring: statusline + visibility hooks, merged additively so
// target-owned settings keys are never overwritten.
const settingsPath = path.join(target, ".claude", "settings.json");
let existingSettings = null;
if (existsSync(settingsPath)) {
  try {
    existingSettings = JSON.parse(await readFile(settingsPath, "utf8"));
  } catch {
    console.error(`[bootstrap] WARNING: ${path.relative(target, settingsPath)} is not valid JSON — left untouched; runtime-adapter validation will fail until fixed.`);
    existingSettings = undefined; // sentinel: skip merge entirely
  }
}
if (existingSettings !== undefined) {
  const { settings, changed } = mergeHarnessRuntimeSettings(existingSettings);
  if (changed || !existsSync(settingsPath)) {
    await mkdir(path.dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  }
}

// Version-adoption record: target-owned marker of which harness version governs
// this repo. Feeds the statusline and the upgrade-adoption commit gate shape.
const adoptionPath = path.join(target, "harness", "override", "governance", "harness-upgrade-adoption.json");
if (!existsSync(adoptionPath)) {
  await mkdir(path.dirname(adoptionPath), { recursive: true });
  await writeFile(
    adoptionPath,
    `${JSON.stringify({ harnessVersion: manifest.harnessVersion, appliedAt: new Date().toISOString(), mechanism: "bootstrap" }, null, 2)}\n`,
  );
}

console.log(`[bootstrap] profile: ${profile.profile}`);
console.log(`[bootstrap] harness version: ${manifest.harnessVersion} (recorded in harness/override/governance/harness-upgrade-adoption.json)`);
console.log("[bootstrap] runtime adapters: .claude/settings.json merged (statusline + visibility hooks; target keys preserved)");
console.log(`[bootstrap] copied ${copied} distributable file(s); preserved ${preserved} target-owned path(s); scaffolded ${scaffolded} override file(s)`);
console.log(`[bootstrap] hooks ${hooksActivated ? "activated (core.hooksPath → harness/hooks)" : "NOT activated — run inside a git repo, then: node harness/scripts/harness.mjs activate-hooks"}`);
console.log("[bootstrap] next: fill harness/override/intake/project-intake.md to state: ready, fill the profile mechanisms, adapt root AGENTS.md/CLAUDE.md, then run: node harness/scripts/validate-all.mjs");
