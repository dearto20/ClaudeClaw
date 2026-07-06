import {
  finishValidation,
  harnessRoot,
  isMeaningful,
  isObject,
  parseJsonFence,
  pathExists,
  readHarnessFile,
  requireIncludes,
} from "./validation-helpers.mjs";
import { getValidationMode } from "./validation-mode.mjs";

const failures = [];
const mode = await getValidationMode();
const docPath = "framework/process/upstream-codex-portable-patterns.md";
const requiredSourcePaths = new Set([
  "AGENTS.md",
  "codex-rs/prompts/templates/agents/hierarchical.md",
  "codex-rs/prompts/templates/review/rubric.md",
  ".codex/skills/code-review-breaking-changes/SKILL.md",
  ".codex/skills/code-review-change-size/SKILL.md",
  ".codex/skills/code-review-context/SKILL.md",
  ".codex/skills/code-review-testing/SKILL.md",
  ".codex/skills/babysit-pr/SKILL.md",
  "codex-rs/execpolicy/README.md",
  "codex-rs/collaboration-mode-templates/templates/plan.md",
  "codex-rs/prompts/src/permissions_instructions.rs",
  "codex-rs/app-server-protocol/src/protocol/v2/review.rs",
  "codex-rs/utils/sandbox-summary/src/sandbox_summary.rs",
  "codex-rs/utils/sandbox-summary/src/config_summary.rs",
  "codex-rs/core/src/tools/registry.rs",
  "codex-rs/core/src/tools/tool_dispatch_trace.rs",
  ".codex/environments/setup.py",
  "codex-rs/app-server-protocol/src/export.rs",
  "codex-rs/core/src/session/rollout_reconstruction.rs",
]);
const requiredAdoptedPatternIds = new Set([
  "UPSTREAM_SOURCE_TRACEABILITY",
  "HIERARCHICAL_AGENTS_PRECEDENCE",
  "BOUNDED_MODEL_CONTEXT",
  "REVIEW_FINDING_QUALITY",
  "CHANGE_SIZE_STAGING",
  "COMMAND_POLICY_DISCIPLINE",
  "MODE_MUTATION_BOUNDARY",
  "SPECIALIZED_REVIEW_LENSES",
  "EXPLICIT_REVIEW_TARGETS",
  "RUNTIME_SUMMARY_EVIDENCE",
  "PR_WATCH_UNTIL_TERMINAL",
]);
const requiredDeferredPatternIds = new Set([
  "RAW_MODEL_PROMPTS",
  "FULL_EXEC_POLICY_ENGINE",
  "RUST_CRATE_ARCHITECTURE",
  "TUI_SNAPSHOT_DISCIPLINE",
  "TOOL_REGISTRY_INTERNALS",
  "SCHEMA_GENERATED_APP_SERVER_PROTOCOL",
  "WORKTREE_IGNORED_FILE_SETUP",
  "ROLLOUT_RECONSTRUCTION_INTERNALS",
  "PRODUCT_SPECIFIC_IMPLEMENTATION",
]);

const doc = await readHarnessFile(docPath).catch(() => null);

if (!doc) {
  failures.push(`missing ${docPath}`);
} else {
  requireIncludes(
    doc,
    [
      "https://github.com/openai/codex",
      "73c58011b3c2122b862a8724423976e93647f74d",
      "Do not copy raw upstream model prompts",
      "Every adopted pattern must map to at least one local artifact and one executable validation path",
      "upstream-codex-patterns-json",
      "HIERARCHICAL_AGENTS_PRECEDENCE",
      "BOUNDED_MODEL_CONTEXT",
      "REVIEW_FINDING_QUALITY",
      "CHANGE_SIZE_STAGING",
      "COMMAND_POLICY_DISCIPLINE",
      "MODE_MUTATION_BOUNDARY",
      "SPECIALIZED_REVIEW_LENSES",
      "EXPLICIT_REVIEW_TARGETS",
      "RUNTIME_SUMMARY_EVIDENCE",
      "PR_WATCH_UNTIL_TERMINAL",
      "RAW_MODEL_PROMPTS",
      "FULL_EXEC_POLICY_ENGINE",
      "TOOL_REGISTRY_INTERNALS",
      "SCHEMA_GENERATED_APP_SERVER_PROTOCOL",
      "WORKTREE_IGNORED_FILE_SETUP",
      "ROLLOUT_RECONSTRUCTION_INTERNALS",
      "PRODUCT_SPECIFIC_IMPLEMENTATION",
    ],
    docPath,
    failures,
  );
}

const isUpstreamPath = (value) =>
  typeof value === "string" && value.length > 0 && !value.startsWith("/") && !value.split("/").includes("..");

const isLocalPath = (value) => {
  if (typeof value !== "string" || value.length === 0 || value.startsWith("/") || value.includes("\\")) {
    return false;
  }
  const parts = value.split("/");
  const parentSegments = parts.filter((part) => part === "..");
  return parentSegments.length === 0 || (parentSegments.length === 1 && parts[0] === "..");
};

const hasExecutableValidationPath = (paths) =>
  paths.some((relativePath) => relativePath.startsWith("scripts/") || relativePath.startsWith("tests/"));

const validateLocalPaths = async (record, label) => {
  for (const field of ["artifactPaths", "validationPaths"]) {
    if (!Array.isArray(record[field]) || record[field].length === 0) {
      failures.push(`${label} ${field} must be a non-empty array`);
      continue;
    }

    for (const relativePath of record[field]) {
      if (!isLocalPath(relativePath)) {
        failures.push(`${label} references invalid local path: ${relativePath}`);
        continue;
      }

      if (mode.isSourceFinal && relativePath.startsWith("override/")) {
        continue;
      }
      if (!(await pathExists(harnessRoot, relativePath))) {
        failures.push(`${label} references missing local path: ${relativePath}`);
      }
    }
  }

  if (!hasExecutableValidationPath(record.validationPaths ?? [])) {
    failures.push(`${label} must have at least one executable validation path under scripts/ or tests/`);
  }
};

const contract = doc ? parseJsonFence(doc, "upstream-codex-patterns-json", docPath, failures) : null;

if (contract) {
  if (contract.schemaVersion !== "1.0.0") {
    failures.push(`${docPath} schemaVersion must equal 1.0.0`);
  }
  if (contract.source?.repo !== "https://github.com/openai/codex") {
    failures.push(`${docPath} source.repo must reference openai/codex`);
  }
  if (!/^[0-9a-f]{40}$/.test(contract.source?.verifiedCommit ?? "")) {
    failures.push(`${docPath} source.verifiedCommit must be a 40-character commit SHA`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contract.source?.verifiedDate ?? "")) {
    failures.push(`${docPath} source.verifiedDate must be YYYY-MM-DD`);
  }

  const seenSourcePaths = new Set(contract.source?.sourcePaths ?? []);
  for (const sourcePath of requiredSourcePaths) {
    if (!seenSourcePaths.has(sourcePath)) {
      failures.push(`${docPath} missing required upstream source path: ${sourcePath}`);
    }
  }

  const seenAdopted = new Set();
  for (const [index, pattern] of (contract.adoptedPatterns ?? []).entries()) {
    const label = `${docPath} adoptedPatterns[${index}]`;
    if (!isObject(pattern)) {
      failures.push(`${label} must be an object`);
      continue;
    }
    if (!requiredAdoptedPatternIds.has(pattern.id)) {
      failures.push(`${label} has unexpected id: ${pattern.id}`);
    }
    if (seenAdopted.has(pattern.id)) {
      failures.push(`${label} duplicate id: ${pattern.id}`);
    }
    seenAdopted.add(pattern.id);

    for (const field of ["title", "localContract"]) {
      if (!isMeaningful(pattern[field])) {
        failures.push(`${label} missing meaningful ${field}`);
      }
    }
    if (!Array.isArray(pattern.upstreamPaths) || pattern.upstreamPaths.length === 0) {
      failures.push(`${label} upstreamPaths must be a non-empty array`);
    } else {
      for (const upstreamPath of pattern.upstreamPaths) {
        if (!isUpstreamPath(upstreamPath)) {
          failures.push(`${label} references invalid upstream path: ${upstreamPath}`);
        }
      }
    }

    await validateLocalPaths(pattern, label);
  }

  for (const id of requiredAdoptedPatternIds) {
    if (!seenAdopted.has(id)) {
      failures.push(`${docPath} missing adopted pattern: ${id}`);
    }
  }

  const seenDeferred = new Set();
  for (const [index, pattern] of (contract.deferredPatterns ?? []).entries()) {
    const label = `${docPath} deferredPatterns[${index}]`;
    if (!isObject(pattern)) {
      failures.push(`${label} must be an object`);
      continue;
    }
    if (!requiredDeferredPatternIds.has(pattern.id)) {
      failures.push(`${label} has unexpected id: ${pattern.id}`);
    }
    if (seenDeferred.has(pattern.id)) {
      failures.push(`${label} duplicate id: ${pattern.id}`);
    }
    seenDeferred.add(pattern.id);

    for (const field of ["title", "reason"]) {
      if (!isMeaningful(pattern[field])) {
        failures.push(`${label} missing meaningful ${field}`);
      }
    }
    if (!Array.isArray(pattern.upstreamPaths) || pattern.upstreamPaths.length === 0) {
      failures.push(`${label} upstreamPaths must be a non-empty array`);
    }
  }

  for (const id of requiredDeferredPatternIds) {
    if (!seenDeferred.has(id)) {
      failures.push(`${docPath} missing deferred pattern: ${id}`);
    }
  }
}

finishValidation("validate-upstream-codex-patterns", failures, {
  adoptedPatterns: contract?.adoptedPatterns?.length ?? 0,
  deferredPatterns: contract?.deferredPatterns?.length ?? 0,
  sourcePaths: contract?.source?.sourcePaths?.length ?? 0,
});
