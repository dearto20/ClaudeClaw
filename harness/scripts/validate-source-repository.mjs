import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  finishValidation,
  isMeaningful,
  pathExists as harnessPathExists,
  readWorkspaceFile,
  workspaceRoot,
} from "./validation-helpers.mjs";
import { getValidationMode } from "./validation-mode.mjs";

const failures = [];
const mode = await getValidationMode();

const toRelative = (absolutePath) => path.relative(workspaceRoot, absolutePath).replaceAll(path.sep, "/");
const workspacePath = (relativePath) => path.join(workspaceRoot, relativePath);
const normalizeLf = (content) => content.replace(/\r\n/g, "\n");
const hashContent = (content) => crypto.createHash("sha256").update(normalizeLf(content)).digest("hex");
const readText = (relativePath) => readFile(workspacePath(relativePath), "utf8");

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const isRepoRelative = (value) =>
  typeof value === "string" && value.length > 0 && !value.startsWith("/") && !value.includes("\\") && !value.split("/").includes("..");

const listFiles = async (relativeDir) => {
  const root = workspacePath(relativeDir);
  const files = [];
  const walk = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(toRelative(fullPath));
      }
    }
  };
  await walk(root);
  return files.sort();
};

const extractSection = (content, heading) => {
  const marker = `## ${heading}\n`;
  const start = content.indexOf(marker);
  if (start === -1) {
    return "";
  }
  const sectionStart = start + marker.length;
  const rest = content.slice(sectionStart);
  const nextHeading = rest.search(/\n## /);
  return (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim();
};

const valueAfterLabel = (section, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = section.match(new RegExp(`^[- ]*${escapedLabel}:[ \\t]*(.*)$`, "im"));
  return match ? match[1].trim().replace(/^`|`$/g, "") : "";
};

const gitFiles = () => {
  const result = spawnSync("git", ["ls-files"], { cwd: workspaceRoot, encoding: "utf8" });
  if (result.status !== 0) {
    failures.push("unable to inspect tracked files with git ls-files");
    return new Set();
  }
  return new Set(
    result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((file) => file && existsSync(workspacePath(file))),
  );
};

const pathExists = async (relativePath) => {
  try {
    await stat(workspacePath(relativePath));
    return true;
  } catch {
    return false;
  }
};

if (!mode.isSource) {
  finishValidation("validate-source-repository", failures, {
    mode: mode.mode,
    notApplicable: true,
  });
  process.exit(0);
}

const markerPath = "development/developmentharness-source.json";
const manifestPath = "development/distribution-manifest.json";
const evidencePath = "development/migration-evidence.json";

for (const requiredPath of [markerPath, manifestPath, evidencePath]) {
  if (!(await pathExists(requiredPath))) {
    failures.push(`missing source repository file: ${requiredPath}`);
  }
}

const marker = await readText(markerPath).then(JSON.parse).catch((error) => {
  failures.push(`${markerPath} is invalid JSON: ${error.message}`);
  return null;
});
const manifest = await readText(manifestPath).then(JSON.parse).catch((error) => {
  failures.push(`${manifestPath} is invalid JSON: ${error.message}`);
  return null;
});
const migrationEvidence = await readText(evidencePath).then(JSON.parse).catch((error) => {
  failures.push(`${evidencePath} is invalid JSON: ${error.message}`);
  return null;
});

if (marker) {
  for (const [field, expected] of [
    ["schemaVersion", "1.0.0"],
    ["repoKind", "DevelopmentHarnessSource"],
    ["sourceRoot", "development"],
  ]) {
    if (marker[field] !== expected) {
      failures.push(`${markerPath} ${field} must equal ${expected}`);
    }
  }
  if (!["coexistence", "final"].includes(marker.migrationPhase)) {
    failures.push(`${markerPath} migrationPhase must be coexistence or final`);
  }
}

const trackedFiles = gitFiles();
const pendingIncludes = new Set(manifest?.distribution?.pendingIncludes ?? []);
const candidateFiles = new Set([...trackedFiles, ...pendingIncludes].filter((file) => !file.endsWith("/")));

const matchesGlob = (file, pattern) => {
  if (pattern.endsWith("/**")) {
    return file === pattern.slice(0, -3) || file.startsWith(pattern.slice(0, -2));
  }
  if (pattern.endsWith("*.md")) {
    return file.startsWith(pattern.slice(0, -"*.md".length)) && file.endsWith(".md");
  }
  if (pattern.endsWith("*.json")) {
    return file.startsWith(pattern.slice(0, -"*.json".length)) && file.endsWith(".json");
  }
  return file === pattern;
};

if (manifest) {
  if (manifest.schemaVersion !== "1.0.0") {
    failures.push(`${manifestPath} schemaVersion must equal 1.0.0`);
  }
  if (manifest.repoKind !== "DevelopmentHarnessSource") {
    failures.push(`${manifestPath} repoKind must equal DevelopmentHarnessSource`);
  }
  if (!Array.isArray(manifest.distribution?.include) || manifest.distribution.include.length === 0) {
    failures.push(`${manifestPath} distribution.include must be non-empty`);
  }
  if (!Array.isArray(manifest.distribution?.exclude) || manifest.distribution.exclude.length === 0) {
    failures.push(`${manifestPath} distribution.exclude must be non-empty`);
  }
  if (!Array.isArray(manifest.migrationInventory) || manifest.migrationInventory.length === 0) {
    failures.push(`${manifestPath} migrationInventory must be non-empty`);
  }

  for (const requiredInclude of [
    "harness/exec-plans/active/README.md",
    "harness/exec-plans/completed/README.md",
    "harness/exec-plans/tech-debt/README.md",
    "harness/artifacts/validation/README.md",
    "harness/artifacts/cross-agent-review/README.md",
  ]) {
    if (!(manifest.distribution?.include ?? []).includes(requiredInclude)) {
      failures.push(`${manifestPath} distribution.include must keep README-only seed anchor: ${requiredInclude}`);
    }
  }

  for (const requiredExclude of [
    "development/**",
    "harness/override/**",
    "harness/exec-plans/completed/*.md",
    "harness/exec-plans/active/*.md",
    "harness/exec-plans/tech-debt/*.md",
    "harness/artifacts/validation/*.json",
    "harness/artifacts/validation/*.md",
    "harness/artifacts/cross-agent-review/*.json",
    "harness/artifacts/cross-agent-review/*.md",
  ]) {
    if (!(manifest.distribution?.exclude ?? []).includes(requiredExclude)) {
      failures.push(`${manifestPath} distribution.exclude must block source-owned or generated target state: ${requiredExclude}`);
    }
  }

  for (const relativePath of manifest.distribution?.include ?? []) {
    if (relativePath.includes("*")) {
      continue;
    }
    if (!(await pathExists(relativePath))) {
      failures.push(`${manifestPath} includes missing distributable path: ${relativePath}`);
    }
  }

  const packagedExcluded = [];
  const distributableFiles = [...candidateFiles].filter((file) =>
    (manifest.distribution?.include ?? []).some((pattern) => matchesGlob(file, pattern)),
  );
  for (const file of distributableFiles) {
    if ((manifest.distribution?.exclude ?? []).some((pattern) => matchesGlob(file, pattern))) {
      if (!file.endsWith("/README.md")) {
        packagedExcluded.push(file);
      }
    }
  }
  for (const file of packagedExcluded) {
    failures.push(`${manifestPath} would package excluded path: ${file}`);
  }
}

const inventory = manifest?.migrationInventory ?? [];
const evidenceByPath = new Map((migrationEvidence?.entries ?? []).map((entry) => [entry.newPath, entry]));
const allowedClasses = new Set(["verbatim-copy", "rewritten-reanchored", "net-new"]);
for (const item of inventory) {
  if (!isObject(item)) {
    failures.push(`${manifestPath} migrationInventory entry must be an object`);
    continue;
  }
  if (!allowedClasses.has(item.class)) {
    failures.push(`${manifestPath} migrationInventory invalid class for ${item.newPath}: ${item.class}`);
  }
  if (!isRepoRelative(item.newPath) || !item.newPath.startsWith("development/")) {
    failures.push(`${manifestPath} migrationInventory newPath must be under development/: ${item.newPath}`);
  } else if (!(await pathExists(item.newPath))) {
    failures.push(`${manifestPath} migrationInventory newPath is missing: ${item.newPath}`);
  }
  if (item.class !== "net-new" && !isRepoRelative(item.oldPath)) {
    failures.push(`${manifestPath} ${item.newPath} must declare repo-relative oldPath`);
  }
  if (item.class === "verbatim-copy") {
    const evidence = evidenceByPath.get(item.newPath);
    if (!evidence) {
      failures.push(`${evidencePath} missing verbatim-copy evidence for ${item.newPath}`);
      continue;
    }
    const newContent = await readText(item.newPath).catch(() => null);
    if (newContent && hashContent(newContent) !== evidence.newHash) {
      failures.push(`${evidencePath} newHash mismatch for ${item.newPath}`);
    }
    if (mode.isSourceCoexistence && item.oldPath && (await pathExists(item.oldPath))) {
      const oldContent = await readText(item.oldPath);
      if (hashContent(oldContent) !== evidence.oldHash) {
        failures.push(`${evidencePath} oldHash mismatch for ${item.oldPath}`);
      }
      if (hashContent(oldContent) !== hashContent(newContent ?? "")) {
        failures.push(`${evidencePath} verbatim-copy mismatch: ${item.oldPath} -> ${item.newPath}`);
      }
    }
  }
}

const developmentFiles = await listFiles("development");
for (const file of developmentFiles) {
  if (file === evidencePath) {
    continue;
  }
  if (!inventory.some((item) => item.newPath === file)) {
    failures.push(`${file} is not classified in ${manifestPath} migrationInventory`);
  }
}

const sourceArchitecture = await readText("development/ARCHITECTURE.md").catch(() => "");
const sourceReliability = await readText("development/RELIABILITY.md").catch(() => "");
const sourceAdrs = (await listFiles("development/design-docs/adr")).filter((file) => /^development\/design-docs\/adr\/adr-\d+.*\.md$/.test(file));
for (const adrPath of sourceAdrs) {
  const content = await readText(adrPath);
  if (!content.includes("- `Accepted`")) {
    continue;
  }
  const decisionId = content.match(/^# (ADR-\d+)/m)?.[1];
  if (!decisionId) {
    failures.push(`${adrPath} must declare an ADR id in the title`);
    continue;
  }
  if (!sourceArchitecture.includes(decisionId)) {
    failures.push(`${adrPath} ${decisionId} must be referenced by development/ARCHITECTURE.md`);
  }
  if (!sourceReliability.includes(decisionId)) {
    failures.push(`${adrPath} ${decisionId} must be referenced by development/RELIABILITY.md`);
  }
}

const sourceRegister = await readText("development/requirements/requirement-register.json").then(JSON.parse).catch((error) => {
  failures.push(`development/requirements/requirement-register.json is invalid JSON: ${error.message}`);
  return null;
});
if (sourceRegister) {
  for (const requirement of sourceRegister.requirements ?? []) {
    const artifactPaths = requirement.artifactPaths ?? requirement.implementationPaths ?? [];
    for (const relativePath of [
      ...(requirement.sourceDocs ?? []),
      ...(requirement.guidanceDocs ?? []),
      ...artifactPaths,
      ...(requirement.validationPaths ?? []),
    ]) {
      if (!isRepoRelative(relativePath)) {
        failures.push(`${requirement.id} references invalid source path: ${relativePath}`);
      } else if (!(await pathExists(relativePath))) {
        failures.push(`${requirement.id} references missing source path: ${relativePath}`);
      }
    }
  }
}

const legacyGovernanceExemptions = new Set(manifest?.legacyPlanGovernanceExemptions ?? []);
const completedPlanFiles = (await listFiles("development/exec-plans/completed")).filter((file) => file.endsWith(".md"));
for (const planPath of completedPlanFiles) {
  const content = await readText(planPath);
  const runtimeSection = extractSection(content, "Runtime Mode");
  const completionSection = extractSection(content, "Completion Evidence");
  if (!runtimeSection) {
    failures.push(`${planPath} completed source plan missing Runtime Mode section`);
  }
  if (!completionSection) {
    failures.push(`${planPath} completed source plan missing Completion Evidence section`);
  }
  for (const label of ["Current mode", "Mutation allowed", "Plan Mode source", "Mode transition evidence"]) {
    if (runtimeSection && !isMeaningful(valueAfterLabel(runtimeSection, label))) {
      failures.push(`${planPath} missing Runtime Mode field: ${label}`);
    }
  }
  for (const label of ["Summary", "Validation report", "Dirty worktree status", "Required new files tracked or intentionally ignored", "Generated artifacts handled by policy", "Push/publish state when publishing was requested", "Remaining risk"]) {
    if (completionSection && !isMeaningful(valueAfterLabel(completionSection, label))) {
      failures.push(`${planPath} missing Completion Evidence field: ${label}`);
    }
  }
  if (!legacyGovernanceExemptions.has(planPath)) {
    const dualRoleSection = extractSection(content, "Dual-Role Governance");
    if (!dualRoleSection) {
      failures.push(`${planPath} missing Dual-Role Governance section`);
    } else if (valueAfterLabel(dualRoleSection, "Terminal status") === "pending") {
      failures.push(`${planPath} completed source plan leaves Dual-Role Governance terminal status pending`);
    }
  }
}

const templatePaths = [
  "harness/framework/templates/worktree-runtime.md",
  "harness/framework/templates/observability.md",
  "harness/framework/templates/browser-validation.md",
  "harness/framework/templates/recurring-cleanup.md",
  "harness/framework/templates/architecture-invariants.md",
  "harness/framework/templates/taste-invariants.md",
  "harness/framework/templates/pr-ci-loop.md",
  "harness/framework/templates/bootstrap-intake.md",
  "harness/framework/templates/target-validation-profile.md",
  "harness/framework/design-docs/adr-template.md",
  "harness/framework/requirements/index.md",
  "harness/framework/templates/external-reference-audit.md",
  "harness/framework/templates/target-exploration-guide.md",
];
for (const templatePath of templatePaths) {
  if (!(await pathExists(templatePath))) {
    failures.push(`missing reusable framework template/guidance: ${templatePath}`);
    continue;
  }
  const content = await readText(templatePath);
  if (content.trim().length < 40) {
    failures.push(`${templatePath} is too small to seed target-owned override content`);
  }
}

const gitignore = await readWorkspaceFile(".gitignore").catch(() => "");
for (const pattern of [
  "harness/artifacts/validation/*.json",
  "harness/artifacts/validation/*.md",
  "!harness/artifacts/validation/README.md",
  "harness/artifacts/cross-agent-review/*.json",
  "harness/artifacts/cross-agent-review/*.md",
  "!harness/artifacts/cross-agent-review/README.md",
  "tmp/",
]) {
  if (!gitignore.includes(pattern)) {
    failures.push(`.gitignore missing expected pattern: ${pattern}`);
  }
}

for (const readmePath of [
  "harness/exec-plans/active/README.md",
  "harness/exec-plans/completed/README.md",
  "harness/exec-plans/tech-debt/README.md",
  "harness/artifacts/validation/README.md",
  "harness/artifacts/cross-agent-review/README.md",
]) {
  if (!(await harnessPathExists(workspaceRoot, readmePath))) {
    failures.push(`missing seed README anchor: ${readmePath}`);
  }
}

if (mode.isSourceFinal) {
  if (await pathExists("harness/override")) {
    failures.push("source-final mode must not keep target-owned harness/override");
  }
  const harnessCompletedPlans = (await listFiles("harness/exec-plans/completed")).filter((file) => file.endsWith(".md") && !file.endsWith("/README.md"));
  for (const file of harnessCompletedPlans) {
    failures.push(`source-final mode must not keep source completed plan in distributable harness: ${file}`);
  }
}

finishValidation("validate-source-repository", failures, {
  mode: mode.mode,
  migrationInventory: inventory.length,
  sourceCompletedPlans: completedPlanFiles.length,
});
