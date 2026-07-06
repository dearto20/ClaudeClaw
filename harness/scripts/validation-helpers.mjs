import { readdir, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const harnessRoot = path.resolve(__dirname, "..");
export const workspaceRoot = path.resolve(harnessRoot, "..");

export const readHarnessFile = (relativePath) =>
  readFile(path.join(harnessRoot, relativePath), "utf8");

export const readWorkspaceFile = (relativePath) =>
  readFile(path.join(workspaceRoot, relativePath), "utf8");

export const toRepoSlashPath = (value) => String(value).replace(/\\/g, "/");

export const fallbackDiscoverySkippedDirs = new Set([
  ".git",
  "node_modules",
  "tmp",
  ".claude",
  ".venv",
  "venv",
  ".tox",
  "__pycache__",
]);

export const shouldSkipFallbackDiscoveryDirectory = (name) => fallbackDiscoverySkippedDirs.has(name);

const isInsideSlashPath = (file, scope) => {
  const normalizedFile = toRepoSlashPath(file).replace(/^\.\//, "");
  const normalizedScope = toRepoSlashPath(scope).replace(/^\.\//, "").replace(/\/+$/, "");

  if (!normalizedScope || normalizedScope === ".") {
    return true;
  }

  return normalizedFile === normalizedScope || normalizedFile.startsWith(`${normalizedScope}/`);
};

const tryGitDiscovery = (base, { gitCommand = "git" } = {}) => {
  const rootResult = spawnSync(gitCommand, ["rev-parse", "--show-toplevel"], {
    cwd: base,
    encoding: "utf8",
  });

  if (rootResult.status !== 0 || !rootResult.stdout.trim()) {
    return null;
  }

  const gitRoot = path.resolve(rootResult.stdout.trim());
  const filesResult = spawnSync(gitCommand, ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: gitRoot,
    encoding: "utf8",
  });

  if (filesResult.status !== 0) {
    return null;
  }

  return {
    root: gitRoot,
    files: filesResult.stdout
      .split("\n")
      .map((line) => toRepoSlashPath(line.trim()))
      .filter(Boolean)
      .sort(),
  };
};

const listFilesystemFiles = async (base, relativeDir = ".") => {
  const root = path.join(base, relativeDir);
  const results = [];

  const walk = async (dir) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipFallbackDiscoveryDirectory(entry.name)) {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile()) {
        results.push(toRepoSlashPath(path.relative(base, fullPath)));
      }
    }
  };

  await walk(root);
  return results.sort();
};

export const discoverRepoFiles = async (repoRoot = workspaceRoot, options = {}) => {
  const root = path.resolve(repoRoot);
  const gitDiscovery = tryGitDiscovery(root, options);
  if (gitDiscovery && path.resolve(gitDiscovery.root) === root) {
    return gitDiscovery.files;
  }

  return listFilesystemFiles(root, ".");
};

const listDiscoveredFiles = async (base, relativeDir = ".", options = {}) => {
  const normalizedBase = path.resolve(base);
  const scopedRoot = path.resolve(normalizedBase, relativeDir);
  const gitDiscovery = tryGitDiscovery(normalizedBase, options);

  if (gitDiscovery && isPathWithin(scopedRoot, gitDiscovery.root)) {
    const scopeFromGitRoot = toRepoSlashPath(path.relative(gitDiscovery.root, scopedRoot)) || ".";
    const candidates = gitDiscovery.files
      .filter((file) => isInsideSlashPath(file, scopeFromGitRoot))
      .map((file) => toRepoSlashPath(path.relative(normalizedBase, path.join(gitDiscovery.root, file))))
      .sort();
    // The index can list files deleted from the worktree (a mid-close ledger
    // move, an in-flight rename). There is nothing on disk to scan — readers
    // must not crash on a normal working state, so existence-filter here, once,
    // for every discovery consumer.
    const existing = [];
    for (const file of candidates) {
      if (await pathExists(normalizedBase, file)) {
        existing.push(file);
      }
    }
    return existing;
  }

  return listFilesystemFiles(normalizedBase, relativeDir);
};

const isPathWithin = (child, parent) => {
  const relativePath = path.relative(parent, child);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
};

export const pathExists = async (base, relativePath) => {
  try {
    await stat(path.join(base, relativePath));
    return true;
  } catch {
    return false;
  }
};

export const listMarkdownFiles = async (base, relativeDir, options = {}) =>
  (await listDiscoveredFiles(base, relativeDir, options)).filter((file) => file.endsWith(".md")).sort();

export const requireIncludes = (content, needles, label, failures) => {
  for (const needle of needles) {
    if (!content.includes(needle)) {
      failures.push(`${label} missing required text: ${needle}`);
    }
  }
};

export const parseJsonFence = (content, fenceName, label, failures) => {
  const matches = [...content.matchAll(new RegExp(`\`\`\`${fenceName}\\n([\\s\\S]*?)\\n\`\`\``, "g"))];
  if (matches.length !== 1) {
    failures.push(`${label} must contain exactly one ${fenceName} block`);
    return null;
  }

  try {
    return JSON.parse(matches[0][1]);
  } catch (error) {
    failures.push(`${label} ${fenceName} block is invalid JSON: ${error.message}`);
    return null;
  }
};

export const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

export const isMeaningful = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "n/a" && normalized !== "none" && normalized !== "unknown";
};

export const isIsoDateTime = (value) =>
  isMeaningful(value) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  !Number.isNaN(Date.parse(value));

export const getByPath = (object, dottedPath) =>
  dottedPath.split(".").reduce((current, key) => {
    if (!isObject(current) && !Array.isArray(current)) {
      return undefined;
    }

    return current[key];
  }, object);

export const hasMeaningfulValue = (value) => {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every((item) => hasMeaningfulValue(item));
  }

  if (isObject(value)) {
    return Object.keys(value).length > 0;
  }

  if (typeof value === "boolean") {
    return true;
  }

  return isMeaningful(value);
};

export const finishValidation = (name, failures, details = {}) => {
  const report = {
    validator: name,
    status: failures.length === 0 ? "passed" : "failed",
    failures,
    ...details,
  };

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`[${name}] ${failure}`);
    }
    console.log(JSON.stringify(report));
    process.exit(1);
  }

  console.log(JSON.stringify(report));
};

// Legacy plan acceptance: a target upgraded from harness v1 lists its pre-v2
// completed plans in harness/override/governance/legacy-plan-acceptance.json.
// Validators exempt listed completed plans from requirements those plans
// predate — history is never rewritten to satisfy newer gates. The file is
// target-owned and absent in the source repository; a malformed file or a
// listing outside exec-plans/completed/ is a validation failure, never a
// silent skip.
//
// Acceptance is git-anchored: `upgradeBaseCommit` names the pre-upgrade
// commit, and every listed plan must exist in the git tree AT that commit.
// New work cannot be laundered through the list — a non-compliant completed
// plan is rejected by the gates at commit time, so it never exists at any
// committed base.
export const legacyPlanAcceptancePath = "override/governance/legacy-plan-acceptance.json";

const isMeaningfulAcceptanceValue = (value) => typeof value === "string" && value.trim().length > 0;

export const loadLegacyPlanAcceptance = async ({
  root = harnessRoot,
  acceptancePath = legacyPlanAcceptancePath,
  planPrefix = "exec-plans/completed/",
} = {}) => {
  const absolutePath = path.join(root, acceptancePath);
  let raw;
  try {
    raw = await readFile(absolutePath, "utf8");
  } catch {
    return { plans: new Set(), failures: [] };
  }

  const failures = [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { plans: new Set(), failures: [`${acceptancePath} is not valid JSON`] };
  }

  for (const field of ["rationale", "acceptedBy", "acceptedDate", "upgradeBaseCommit"]) {
    if (!isMeaningfulAcceptanceValue(parsed[field])) {
      failures.push(`${acceptancePath} missing meaningful field: ${field}`);
    }
  }
  if (isMeaningfulAcceptanceValue(parsed.acceptedDate) && !/^\d{4}-\d{2}-\d{2}$/.test(parsed.acceptedDate.trim())) {
    failures.push(`${acceptancePath} acceptedDate must be YYYY-MM-DD`);
  }
  if (isMeaningfulAcceptanceValue(parsed.upgradeBaseCommit) && !/^[0-9a-f]{7,40}$/.test(parsed.upgradeBaseCommit.trim())) {
    failures.push(`${acceptancePath} upgradeBaseCommit must be a git commit hash`);
  }
  if (!Array.isArray(parsed.plans) || parsed.plans.length === 0) {
    failures.push(`${acceptancePath} plans must be a non-empty array of completed-plan paths`);
    return { plans: new Set(), failures };
  }
  if (failures.length > 0) {
    return { plans: new Set(), failures };
  }

  const baseCommit = parsed.upgradeBaseCommit.trim();
  const gitRootResult = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8" });
  if (gitRootResult.status !== 0 || !gitRootResult.stdout.trim()) {
    return { plans: new Set(), failures: [`${acceptancePath} requires a git repository to verify upgradeBaseCommit`] };
  }
  const gitRoot = path.resolve(gitRootResult.stdout.trim());
  if (spawnSync("git", ["cat-file", "-e", `${baseCommit}^{commit}`], { cwd: gitRoot, encoding: "utf8" }).status !== 0) {
    return { plans: new Set(), failures: [`${acceptancePath} upgradeBaseCommit ${baseCommit} is not a commit in this repository`] };
  }

  const plans = new Set();
  for (const entry of parsed.plans) {
    if (typeof entry !== "string" || !entry.startsWith(planPrefix) || !entry.endsWith(".md")) {
      failures.push(`${acceptancePath} may only list ${planPrefix}*.md paths: ${JSON.stringify(entry)}`);
      continue;
    }
    try {
      await stat(path.join(root, entry));
    } catch {
      failures.push(`${acceptancePath} lists a plan that does not exist: ${entry}`);
      continue;
    }
    const treePath = toRepoSlashPath(path.relative(gitRoot, path.join(root, entry)));
    const existedAtBase = spawnSync("git", ["cat-file", "-e", `${baseCommit}:${treePath}`], { cwd: gitRoot, encoding: "utf8" });
    if (existedAtBase.status !== 0) {
      failures.push(`${acceptancePath} lists a plan that did not exist at upgradeBaseCommit ${baseCommit}: ${entry}`);
      continue;
    }
    plans.add(entry);
  }

  return { plans, failures };
};
