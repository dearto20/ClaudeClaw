// harness upgrade — apply framework updates from a newer DevelopmentHarness
// checkout to this target, explicit, path-scoped, and diff-reviewed.
// Framework-owned paths only; target-owned live state is never touched.
// Usage:
//   node harness/scripts/harness-upgrade.mjs --source <DevelopmentHarness dir> [--apply]
// Without --apply: prints the diff summary (dry run). With --apply: copies changes.

import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetRoot = path.resolve(__dirname, "..", "..");

const args = process.argv.slice(2);
const idx = args.indexOf("--source");
const sourceRoot = idx !== -1 && args[idx + 1] ? path.resolve(args[idx + 1]) : null;
const apply = args.includes("--apply");
if (!sourceRoot || !existsSync(sourceRoot)) {
  console.error("usage: harness upgrade --source <DevelopmentHarness dir> [--apply]");
  process.exit(1);
}

const { frameworkOwnedRoots: frameworkOwned } = await import(
  pathToFileURL(path.join(sourceRoot, "harness", "scripts", "upgrade-surface.mjs")).href
);

const readVersion = async (root) => {
  try {
    const manifest = JSON.parse(await readFile(path.join(root, "development", "distribution-manifest.json"), "utf8"));
    return manifest.harnessVersion ?? "unversioned";
  } catch {
    return "unknown";
  }
};

const sourceVersion = await readVersion(sourceRoot);
console.log(`[upgrade] source version: ${sourceVersion}`);

let changed = 0;
for (const owned of frameworkOwned) {
  const sourceDir = path.join(sourceRoot, owned);
  if (!existsSync(sourceDir)) continue;
  // A framework-owned path absent from the target (e.g. harness/hooks on a
  // v1 install) never appears in diff output — copy it whole.
  if (!existsSync(path.join(targetRoot, owned))) {
    changed += 1;
    if (apply) {
      await mkdir(path.dirname(path.join(targetRoot, owned)), { recursive: true });
      await cp(sourceDir, path.join(targetRoot, owned), { recursive: true });
      console.log(`[upgrade] applied ${owned} (new to target)`);
    } else {
      console.log(`[upgrade] would add ${owned} (new to target)`);
    }
    continue;
  }
  const diff = spawnSync(
    "diff",
    ["-rq", sourceDir, path.join(targetRoot, owned)],
    { encoding: "utf8" },
  );
  const lines = (diff.stdout ?? "").split("\n").filter(Boolean);
  for (const line of lines) {
    // "Files A and B differ" | "Only in <sourceDir>...: name"
    const differ = line.match(/^Files (.+) and .+ differ$/);
    const onlyInSource = line.match(/^Only in (.+): (.+)$/);
    let sourceFile = null;
    if (differ) sourceFile = differ[1];
    else if (onlyInSource && onlyInSource[1].startsWith(sourceDir)) sourceFile = path.join(onlyInSource[1], onlyInSource[2]);
    if (!sourceFile) continue; // files only in target are target additions — preserved
    const rel = path.relative(sourceRoot, sourceFile);
    changed += 1;
    if (apply) {
      const dest = path.join(targetRoot, rel);
      await mkdir(path.dirname(dest), { recursive: true });
      await cp(sourceFile, dest, { recursive: true });
      console.log(`[upgrade] applied ${rel}`);
    } else {
      console.log(`[upgrade] would update ${rel}`);
    }
  }
}

console.log(`[upgrade] ${changed} framework-owned file(s) ${apply ? "applied" : "pending (dry run — rerun with --apply, then diff-review before committing)"}`);
if (apply && changed > 0) {
  // Skill adapters (.claude/skills, .codex/skills, framework/skills-ref) are
  // generated outputs — regenerate them in the target from the fresh source.
  const generator = path.join(targetRoot, "harness", "scripts", "generate-skills.mjs");
  if (existsSync(generator)) {
    const generated = spawnSync("node", [generator], { encoding: "utf8" });
    console.log(generated.status === 0 ? "[upgrade] skill adapters regenerated" : `[upgrade] WARNING: skill generation failed: ${generated.stderr}`);
  }

  // Runtime adapters: merge statusline + visibility hooks additively into the
  // target's .claude/settings.json (target-owned keys preserved). Dynamic
  // import so the freshly-copied helper is used, not the pre-upgrade tree.
  try {
    const helperPath = path.join(targetRoot, "harness", "scripts", "runtime-hooks", "settings-template.mjs");
    const { mergeHarnessRuntimeSettings } = await import(pathToFileURL(helperPath).href);
    const settingsPath = path.join(targetRoot, ".claude", "settings.json");
    let existing = null;
    if (existsSync(settingsPath)) existing = JSON.parse(await readFile(settingsPath, "utf8"));
    const { settings, changed: settingsChanged } = mergeHarnessRuntimeSettings(existing);
    if (settingsChanged || !existsSync(settingsPath)) {
      await mkdir(path.dirname(settingsPath), { recursive: true });
      await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
    }
    console.log("[upgrade] runtime adapters: .claude/settings.json merged (statusline + visibility hooks)");
  } catch (error) {
    console.log(`[upgrade] WARNING: runtime-adapter settings merge failed (${error.message}) — fix .claude/settings.json manually; validation will flag it`);
  }

  // Version-adoption record: which harness version now governs this target.
  const adoptionPath = path.join(targetRoot, "harness", "override", "governance", "harness-upgrade-adoption.json");
  await mkdir(path.dirname(adoptionPath), { recursive: true });
  await writeFile(
    adoptionPath,
    `${JSON.stringify({ harnessVersion: sourceVersion, appliedAt: new Date().toISOString(), mechanism: "upgrade" }, null, 2)}\n`,
  );
  console.log(`[upgrade] adoption record: harness ${sourceVersion} (harness/override/governance/harness-upgrade-adoption.json)`);

  // Hooks don't clone and a v1 target may never have activated them — an
  // upgrade re-asserts enforcement instead of assuming it.
  const hookResult = spawnSync("git", ["config", "core.hooksPath", "harness/hooks"], { cwd: targetRoot, encoding: "utf8" });
  console.log(
    hookResult.status === 0
      ? "[upgrade] hooks activated (core.hooksPath → harness/hooks)"
      : "[upgrade] WARNING: hook activation failed — run: node harness/scripts/harness.mjs activate-hooks",
  );

  console.log("[upgrade] next: git diff to review, then run node harness/scripts/validate-all.mjs");
}
