// Skills drift gate: generated skill adapters (.claude/skills, .codex/skills,
// framework/skills-ref) must exactly match what framework/skills-src generates.
// A stale or hand-edited adapter is a governance surface silently diverging
// from its single source — that fails validation, never ships quietly.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSkillOutputs, GENERATED_NOTE } from "./generate-skills.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

export const skillsDriftFailures = async (root) => {
  const failures = [];
  let expected;
  try {
    expected = await buildSkillOutputs(root);
  } catch (error) {
    return [`skills-src unreadable: ${error.message}`];
  }
  for (const out of expected.outputs) {
    let onDisk = null;
    try {
      onDisk = await readFile(path.join(root, out.relPath), "utf8");
    } catch {
      failures.push(`missing generated skill output: ${out.relPath}`);
      continue;
    }
    if (onDisk !== out.content) {
      failures.push(`generated skill output is stale or hand-edited: ${out.relPath}`);
    }
  }
  // Orphans: a generated output whose source was deleted keeps governing
  // silently unless it fails here.
  const expectedSet = new Set(expected.outputs.map((o) => o.relPath));
  const generatedDirs = [
    { dir: path.join(".claude", "skills"), leaf: "SKILL.md" },
    { dir: path.join(".codex", "skills"), leaf: "SKILL.md" },
  ];
  for (const { dir, leaf } of generatedDirs) {
    let entries = [];
    try {
      entries = await readdir(path.join(root, dir), { withFileTypes: true });
    } catch {
      continue; // absence is reported per-output above
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const relPath = path.join(dir, entry.name, leaf);
      if (expectedSet.has(relPath)) continue;
      // Only generator-owned files (carrying the generated-note marker) can be
      // orphans — targets may keep their own hand-written skills alongside.
      let content = null;
      try {
        content = await readFile(path.join(root, relPath), "utf8");
      } catch {
        continue; // no SKILL.md at all — not a generated artifact
      }
      if (content.includes(GENERATED_NOTE)) {
        failures.push(`orphan generated skill (source removed from skills-src): ${relPath}`);
      }
    }
  }
  let refEntries = [];
  try {
    refEntries = await readdir(path.join(root, "harness", "framework", "skills-ref"));
  } catch {
    /* absence reported per-output above */
  }
  for (const entry of refEntries) {
    if (!entry.endsWith(".md") || entry === "README.md") continue;
    const relPath = path.join("harness", "framework", "skills-ref", entry);
    if (expectedSet.has(relPath)) continue;
    let content = null;
    try {
      content = await readFile(path.join(root, relPath), "utf8");
    } catch {
      continue;
    }
    if (content.includes(GENERATED_NOTE)) {
      failures.push(`orphan generated skill reference (source removed from skills-src): ${relPath}`);
    }
  }
  return failures;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const failures = await skillsDriftFailures(repoRoot);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[validate-skills-drift] FAIL: ${failure}`);
    console.error("[validate-skills-drift] fix: node harness/scripts/generate-skills.mjs (then commit the regenerated outputs)");
    process.exit(1);
  }
  console.log("[validate-skills-drift] generated skill adapters match skills-src");
}
