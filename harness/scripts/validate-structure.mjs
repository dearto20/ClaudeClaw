// validate-structure — enforce the agent-system structure contract
// (framework/process/agent-system-structure.md). Every harness target
// declares its structure role in override/structure/agent-system-structure.md;
// conformant declarations are checked path-by-path against the layout for the
// declared repo type; migration-planned declarations pass with the plan
// surfaced; repoType none records the exemption and passes.

import { readdir, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  finishValidation,
  isMeaningful,
  parseJsonFence,
  pathExists,
  readHarnessFile,
  readWorkspaceFile,
  workspaceRoot,
} from "./validation-helpers.mjs";
import { getValidationMode } from "./validation-mode.mjs";

const failures = [];
const mode = await getValidationMode();
const declarationPath = "override/structure/agent-system-structure.md";
const repoTypes = new Set(["core", "ios", "none"]);
const conformanceStates = new Set(["conformant", "migration-planned"]);

// Toolchain conventions a conformant core repo must share so the same command
// finds the same concern in every sibling: pyproject.toml is the single
// dependency + tooling source of truth, and the Makefile exposes one uniform
// verb set. A repo that cannot yet comply declares migration-planned (which
// passes with a surfaced plan) rather than silently diverging.
const REQUIRED_MAKE_TARGETS = ["test", "lint", "validate", "dry-run"];

// Generated caches (__pycache__, .build, …) regenerate on every run and are
// not source structure: a gitignored directory is exempt from divergence
// enumeration — but only while nothing inside it is tracked. Git ignores
// paths, not content: a force-added file inside an ignored directory is
// committed structure and must not be laundered past the gate.
const isGitIgnored = (relativePath) => {
  const ignored =
    spawnSync("git", ["check-ignore", "-q", relativePath], { cwd: workspaceRoot, encoding: "utf8" }).status === 0;
  if (!ignored) return false;
  const tracked = spawnSync("git", ["ls-files", "--", `${relativePath}/`], { cwd: workspaceRoot, encoding: "utf8" });
  return tracked.status === 0 && tracked.stdout.trim() === "";
};

// Declaration-controlled path components must be safe single segments —
// no separators, traversal, absolute paths, or empty names — so a
// declaration can never satisfy the layout gate outside canonical locations.
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

if (mode.isSourceFinal) {
  finishValidation("validate-structure", failures, {
    mode: mode.mode,
    notApplicable: "DevelopmentHarness source-final mode is not an agent-system target.",
  });
  process.exit(0);
}

const content = await readHarnessFile(declarationPath).catch(() => null);
if (!content) {
  failures.push(
    `missing harness/${declarationPath} — every harness target must declare its structure role (repoType core|ios|none); template: framework/templates/agent-system-structure.md`,
  );
  finishValidation("validate-structure", failures, { mode: mode.mode });
  process.exit(failures.length ? 1 : 0);
}

const declaration = parseJsonFence(content, "agent-system-structure-json", declarationPath, failures);

const details = { mode: mode.mode };

if (declaration) {
  if (!repoTypes.has(declaration.repoType)) {
    failures.push(`${declarationPath} repoType must be one of: core, ios, none`);
  }
  details.repoType = declaration.repoType;

  if (declaration.repoType === "none") {
    details.exempt = "declared not part of an agent system";
  } else {
    if (!isMeaningful(declaration.systemName)) {
      failures.push(`${declarationPath} systemName must be meaningful for agent-system repos`);
    }
    details.systemName = declaration.systemName;

    if (!conformanceStates.has(declaration.conformance)) {
      failures.push(`${declarationPath} conformance must be conformant or migration-planned`);
    } else if (declaration.conformance === "migration-planned") {
      if (!isMeaningful(declaration.migrationPlan)) {
        failures.push(
          `${declarationPath} migration-planned requires a meaningful migrationPlan (exec-plan path or dated rationale) — divergence must be a recorded, owned state`,
        );
      }
      details.conformance = "migration-planned";
      details.migrationPlan = declaration.migrationPlan;
    } else {
      details.conformance = "conformant";
      if (declaration.repoType === "core") {
        await checkCoreLayout(declaration);
      }
      if (declaration.repoType === "ios") {
        await checkIosLayout(declaration);
      }
    }
  }
}

function safeSegment(value, field) {
  if (typeof value !== "string" || !SAFE_SEGMENT.test(value)) {
    failures.push(`${declarationPath} ${field} must be a safe path segment (letters, digits, _ , - ; got ${JSON.stringify(value)})`);
    return false;
  }
  return true;
}

// Existence is not structure: a plain file named `tools` is not the tools/
// directory, and a directory named modal_app.py is not the deployment module.
// Every required path is checked with its expected kind.
async function requireWorkspacePath(relativePath, role, kind = "dir") {
  let stats = null;
  try {
    stats = await stat(path.join(workspaceRoot, relativePath));
  } catch {
    failures.push(`conformant layout requires ${relativePath} (${role})`);
    return;
  }
  if (kind === "dir" && !stats.isDirectory()) {
    failures.push(`conformant layout requires ${relativePath} to be a directory (${role}); found a non-directory entry`);
  }
  if (kind === "file" && !stats.isFile()) {
    failures.push(`conformant layout requires ${relativePath} to be a file (${role}); found a non-file entry`);
  }
}

async function checkCoreLayout(decl) {
  const core = decl.core;
  if (!core || typeof core !== "object") {
    failures.push(`${declarationPath} core section is required for repoType core`);
    return;
  }
  if (!safeSegment(core.agentPackage, "core.agentPackage")) {
    return;
  }
  if (!Array.isArray(core.channels) || core.channels.length === 0) {
    failures.push(`${declarationPath} core.channels must be a non-empty array of channel directory names`);
    return;
  }
  if (!core.channels.every((channel) => safeSegment(channel, "core.channels entry"))) {
    return;
  }

  await requireWorkspacePath(`agent/${core.agentPackage}`, "agent brain package");
  await requireWorkspacePath("channels", "delivery transports");
  for (const channel of core.channels) {
    await requireWorkspacePath(`channels/${channel}`, `declared channel transport`);
  }
  // Divergence is declared, never discovered — same rule as Sources/ on iOS:
  // every transport directory under channels/ must be declared, and agent/
  // holds exactly the declared brain package.
  const declaredChannels = new Set(core.channels);
  const channelEntries = await readdir(path.join(workspaceRoot, "channels"), { withFileTypes: true }).catch(() => []);
  for (const entry of channelEntries) {
    if (entry.isDirectory() && !declaredChannels.has(entry.name) && !isGitIgnored(`channels/${entry.name}`)) {
      failures.push(
        `channels/${entry.name} is not declared in core.channels — declare the transport or remove the directory`,
      );
    }
  }
  const agentEntries = await readdir(path.join(workspaceRoot, "agent"), { withFileTypes: true }).catch(() => []);
  for (const entry of agentEntries) {
    if (entry.isDirectory() && entry.name !== core.agentPackage && !isGitIgnored(`agent/${entry.name}`)) {
      failures.push(
        `agent/${entry.name} is not the declared core.agentPackage (${core.agentPackage}) — the agent brain is a single declared package; move or remove the extra directory`,
      );
    }
  }
  await requireWorkspacePath("tools", "domain tools");
  await requireWorkspacePath("modal_app.py", "deployment wiring", "file");
  await requireWorkspacePath("docs", "product documentation");
  await requireWorkspacePath("tests", "test suite");
  await requireWorkspacePath("harness", "process contract state");
  await checkCoreToolchain();
}

// Parse GNU Make target names. A rule target list starts at column 0 (recipe
// lines are indented) and is followed by `:`; grouped rules (`test lint:`)
// declare several targets at once, so the whole target side is captured and
// split on whitespace. Excluded: variable assignments — `?=`/`+=` have no
// colon, and the `(?!:*=)` lookahead rejects `:=`, `::=`, and `:::=` while
// still accepting `::` double-colon rules; `define`…`endef` variable bodies
// (whose text can resemble rules); and `.PHONY`/`%`-pattern lines, which don't
// begin with a letter.
function makefileTargets(content) {
  const targets = new Set();
  let inDefine = false;
  // Join backslash line-continuations first so a target list or an assignment
  // body split across physical lines is analyzed as the single logical line
  // GNU Make sees — otherwise `test lint \`↵`validate:` loses the first verbs
  // and `FOO = x \`↵`test: y` (an assignment body) is misread as a rule.
  const logical = content.replace(/\\\r?\n/g, " ");
  for (const line of logical.split(/\r?\n/)) {
    // Recipe lines start with a tab; they are never directives or rule targets,
    // so they can neither open/close a define block nor declare a target. (A
    // recipe like `\tdefine=1 cmd` must not flip define-block state.)
    if (/^\t/.test(line)) continue;
    // `define`/`override define` open a multi-line variable body whose text can
    // resemble rules; skip until `endef`.
    if (/^ *(?:override\s+)?define\b/.test(line)) {
      inDefine = true;
      continue;
    }
    if (/^ *endef\b/.test(line)) {
      inDefine = false;
      continue;
    }
    if (inDefine) continue;
    const match = /^([A-Za-z][A-Za-z0-9_.\- ]*?)\s*:(?!:*=)(.*)$/.exec(line);
    if (!match) continue;
    // Target-specific variable assignment (`test: VAR = value`) references a
    // target but defines no runnable recipe — it is not a usable verb, so it
    // does not satisfy the baseline. Detect it by shape rather than by
    // enumerating variable-name characters (GNU Make names allow `-`, `.`,
    // etc.): after optional `private`/`override`/`export`/`unexport` modifiers,
    // a single non-separator token followed by an assignment operator
    // (`=`/`:=`/`::=`/`?=`/`+=`/`!=`). A `; recipe` tail means the target IS
    // runnable, so only the pre-`;` head is inspected.
    const rhsHead = match[2].split(";")[0];
    if (/^\s*(?:(?:private|override|export|unexport)\s+)*[^\s:#=]+\s*[:+?!]*=/.test(rhsHead)) continue;
    for (const name of match[1].split(/\s+/)) {
      if (name && /^[A-Za-z][A-Za-z0-9_.-]*$/.test(name)) targets.add(name);
    }
  }
  return targets;
}

async function checkCoreToolchain() {
  await requireWorkspacePath("pyproject.toml", "dependency + tooling source of truth", "file");

  const makefile = await readWorkspaceFile("Makefile").catch(() => null);
  if (makefile === null) {
    failures.push(
      `conformant layout requires Makefile (uniform verb set: ${REQUIRED_MAKE_TARGETS.join(", ")})`,
    );
    return;
  }
  const targets = makefileTargets(makefile);
  const missing = REQUIRED_MAKE_TARGETS.filter((target) => !targets.has(target));
  if (missing.length) {
    failures.push(
      `Makefile is missing required target(s): ${missing.join(", ")} — every conformant core repo exposes the same verb set (${REQUIRED_MAKE_TARGETS.join(", ")})`,
    );
  }
}

async function checkIosLayout(decl) {
  const ios = decl.ios;
  if (!ios || typeof ios !== "object") {
    failures.push(`${declarationPath} ios section is required for repoType ios`);
    return;
  }
  if (!safeSegment(ios.modulePrefix, "ios.modulePrefix")) {
    return;
  }
  const appDir = ios.appDir === undefined ? "App" : ios.appDir;
  if (!safeSegment(appDir, "ios.appDir")) {
    return;
  }
  const extraModules = ios.extraModules ?? [];
  if (!Array.isArray(extraModules) || !extraModules.every((extra) => safeSegment(extra, "ios.extraModules entry"))) {
    if (!Array.isArray(extraModules)) {
      failures.push(`${declarationPath} ios.extraModules must be an array of module directory names`);
    }
    return;
  }

  await requireWorkspacePath(appDir, "app target");
  const requiredModules = ["AppCore", "Presence", "Sync"].map((module) => `${ios.modulePrefix}${module}`);
  for (const module of requiredModules) {
    await requireWorkspacePath(`Sources/${module}`, "required module");
  }
  for (const extra of extraModules) {
    await requireWorkspacePath(`Sources/${extra}`, "declared extra module");
  }

  // Divergence is declared, never discovered: every module directory under
  // Sources/ must be required or listed in extraModules.
  const allowedModules = new Set([...requiredModules, ...extraModules]);
  const sourceEntries = await readdir(path.join(workspaceRoot, "Sources"), { withFileTypes: true }).catch(() => []);
  for (const entry of sourceEntries) {
    if (entry.isDirectory() && !allowedModules.has(entry.name) && !isGitIgnored(`Sources/${entry.name}`)) {
      failures.push(
        `Sources/${entry.name} is not a required module and is not declared in ios.extraModules — declare it or remove it`,
      );
    }
  }

  await requireWorkspacePath("Tests", "test suite");
  await requireWorkspacePath("Package.swift", "SwiftPM manifest", "file");
  await requireWorkspacePath("harness", "process contract state");
  // Widget divergence is declared in both directions, never silent: the
  // declaration must state hasWidget explicitly, and the filesystem must match.
  if (typeof ios.hasWidget !== "boolean") {
    failures.push(`${declarationPath} ios.hasWidget must be an explicit boolean — widget divergence is declared, never defaulted`);
  } else if (ios.hasWidget === true) {
    await requireWorkspacePath("Widget", "declared widget target");
  } else if (await pathExists(workspaceRoot, "Widget")) {
    failures.push("Widget/ exists but ios.hasWidget is false — declare the widget or remove the directory");
  }
  if (ios.usesXcodeproj !== undefined && typeof ios.usesXcodeproj !== "boolean") {
    failures.push(`${declarationPath} ios.usesXcodeproj must be a boolean when present (documented default: true)`);
  } else {
    // Bidirectional, same as hasWidget: the declaration and the filesystem
    // must agree in both directions.
    const entries = await readdir(path.join(workspaceRoot), { withFileTypes: true }).catch(() => []);
    const hasProject = entries.some((entry) => entry.isDirectory() && entry.name.endsWith(".xcodeproj"));
    if (ios.usesXcodeproj !== false && !hasProject) {
      failures.push(
        "conformant iOS layout requires an .xcodeproj directory at the repo root (declare ios.usesXcodeproj=false for SwiftPM-only repos)",
      );
    }
    if (ios.usesXcodeproj === false && hasProject) {
      failures.push(
        "an .xcodeproj directory exists but ios.usesXcodeproj is false — declare it or remove the project directory",
      );
    }
  }
}

finishValidation("validate-structure", failures, details);
