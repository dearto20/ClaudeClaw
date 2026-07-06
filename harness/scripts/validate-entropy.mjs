import { readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  finishValidation,
  listMarkdownFiles,
  pathExists,
  readHarnessFile,
  readWorkspaceFile,
  shouldSkipFallbackDiscoveryDirectory,
  toRepoSlashPath,
  harnessRoot,
  workspaceRoot,
} from "./validation-helpers.mjs";
import { getValidationMode } from "./validation-mode.mjs";

const failures = [];
const mode = await getValidationMode();
const markdownFiles = await listMarkdownFiles(workspaceRoot, ".");
const directoryManifestName = "README.md";

const allowedTodoPatterns = [
  /^harness\/AGENTS\.md$/,
  /^harness\/framework\//,
  /^harness\/override\//,
  /^BOOTSTRAP\.md$/,
  /^harness\/exec-plans\/templates\//,
];

for (const file of markdownFiles) {
  const content = await readWorkspaceFile(file);
  if (content.includes("<!-- TODO") && !allowedTodoPatterns.some((pattern) => pattern.test(file))) {
    failures.push(`${file} has unresolved TODO outside allowed template locations`);
  }

  const info = await stat(path.join(workspaceRoot, file));
  if (info.size > 80_000) {
    failures.push(`${file} exceeds framework markdown size limit`);
  }
}

const staleRoleTerminologyTargets = [
  ...(await listMarkdownFiles(harnessRoot, "framework")),
  "exec-plans/templates/implementation-plan.md",
];
const staleRoleTerminologyPatterns = [
  /\bLane\b/,
  /\blane\b/,
  /\bLanes\b/,
  /\blanes\b/,
  /Sub-Agent Lanes/,
  /Lane Synthesis/,
];

for (const file of staleRoleTerminologyTargets) {
  const content = await readHarnessFile(file);
  for (const pattern of staleRoleTerminologyPatterns) {
    if (pattern.test(content)) {
      failures.push(`${file} has stale lane terminology; use expert role terminology`);
      break;
    }
  }
}

const activeDir = path.join(harnessRoot, "exec-plans", "active");
const activeEntries = await readdir(activeDir, { withFileTypes: true }).catch(() => []);
const activePlans = activeEntries.filter(
  (entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== directoryManifestName,
);
for (const plan of activePlans) {
  const content = await readHarnessFile(`exec-plans/active/${plan.name}`);
  if (!content.includes("## State")) {
    failures.push(`active plan missing state section: ${plan.name}`);
  }
  if (!content.includes("## Completion Evidence")) {
    failures.push(`active plan missing completion evidence section: ${plan.name}`);
  }
}

const gitResult = spawnSync("git", ["ls-files"], {
  cwd: workspaceRoot,
  encoding: "utf8",
});
const trackedFilesFromIndex = gitResult.status === 0
  ? gitResult.stdout.split("\n").map((line) => toRepoSlashPath(line.trim())).filter(Boolean)
  : [];
const trackedFiles = [];

for (const file of trackedFilesFromIndex) {
  if (await pathExists(workspaceRoot, file)) {
    trackedFiles.push(file);
  }
}

if (gitResult.status !== 0) {
  failures.push("unable to inspect tracked files with git ls-files");
}

for (const file of trackedFiles) {
  if (path.basename(file) === ".gitkeep") {
    failures.push(`${file} uses .gitkeep; replace placeholder-only tracking with a README or manifest`);
  }
}

const placeholderNames = new Set([".gitignore", ".gitkeep"]);
const directTrackedFilesByDir = new Map();
for (const file of trackedFiles) {
  const dir = path.dirname(file);
  if (!directTrackedFilesByDir.has(dir)) {
    directTrackedFilesByDir.set(dir, []);
  }
  directTrackedFilesByDir.get(dir).push(path.basename(file));
}

for (const [dir, files] of directTrackedFilesByDir.entries()) {
  if (files.length > 0 && files.every((file) => placeholderNames.has(file))) {
    failures.push(`${dir} is tracked only by placeholder files; add a manifest or remove the directory`);
  }
}

const gitignore = await readWorkspaceFile(".gitignore").catch(() => "");
const artifactReadmeAnchors = gitignore
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("!harness/artifacts/") && line.endsWith("/README.md"))
  .map((line) => line.slice(1));

for (const readmePath of artifactReadmeAnchors) {
  if (!(await pathExists(workspaceRoot, readmePath))) {
    failures.push(`artifact README anchor is allowed by .gitignore but missing: ${readmePath}`);
  }
}

if (mode.isSourceFinal) {
  for (const file of trackedFiles) {
    if (file.startsWith("harness/override/")) {
      failures.push(`source-final mode must not track target-owned source state: ${file}`);
    }
    if (
      file.startsWith("harness/exec-plans/completed/") &&
      file.endsWith(".md") &&
      file !== "harness/exec-plans/completed/README.md"
    ) {
      failures.push(`source-final mode must not track DevelopmentHarness completed plan history in distributable harness: ${file}`);
    }
  }
}

const emptyDirs = [];
const scanEmptyDirs = async (dir) => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const visibleEntries = entries.filter((entry) => !shouldSkipFallbackDiscoveryDirectory(entry.name));
  for (const entry of visibleEntries) {
    if (entry.isDirectory()) {
      await scanEmptyDirs(path.join(dir, entry.name));
    }
  }

  if (visibleEntries.length === 0) {
    const relativePath = toRepoSlashPath(path.relative(workspaceRoot, dir)) || ".";
    if (relativePath !== ".") {
      emptyDirs.push(relativePath);
    }
  }
};

await scanEmptyDirs(mode.isSource ? workspaceRoot : harnessRoot);
for (const dir of emptyDirs) {
  failures.push(`${dir} is an empty directory without a tracked purpose manifest`);
}

finishValidation("validate-entropy", failures, {
  markdownFiles: markdownFiles.length,
  activePlans: activePlans.length,
  trackedFiles: trackedFiles.length,
  artifactReadmeAnchors: artifactReadmeAnchors.length,
  emptyDirs: emptyDirs.length,
});
