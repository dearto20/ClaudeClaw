import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";

const readText = (...parts) => readFile(getRepoPath(...parts), "utf8");
const sourceMarkerPath = getRepoPath("..", "development", "developmentharness-source.json");
const isSourceFinal = async () => {
  const marker = await readFile(sourceMarkerPath, "utf8").then(JSON.parse).catch(() => null);
  return marker?.repoKind === "DevelopmentHarnessSource" && marker?.migrationPhase === "final";
};

const parseFence = (content, fenceName) => {
  const match = content.match(new RegExp(`\`\`\`${fenceName}\\n([\\s\\S]*?)\\n\`\`\``));
  assert.ok(match, `missing ${fenceName} fence`);
  return JSON.parse(match[1]);
};

const requiredAdoptedPatterns = new Set([
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
const requiredDeferredPatterns = new Set([
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

const pathExists = async (relativePath) => {
  if ((await isSourceFinal()) && relativePath.startsWith("override/")) {
    if (relativePath === "override/validation/target-validation-profile.md") {
      await access(getRepoPath("..", "development", "validation", "source-validation-profile.md"));
      return;
    }
    await access(getRepoPath("..", "development", ...relativePath.slice("override/".length).split("/")));
    return;
  }
  const parts = relativePath.split("/");
  await access(getRepoPath(...parts));
};

test("upstream Codex portable pattern contract is pinned and executable", async () => {
  const doc = await readText("framework", "process", "upstream-codex-portable-patterns.md");
  const validator = await readText("scripts", "validate-upstream-codex-patterns.mjs");
  const contract = parseFence(doc, "upstream-codex-patterns-json");

  assert.equal(contract.schemaVersion, "1.0.0");
  assert.equal(contract.source.repo, "https://github.com/openai/codex");
  assert.equal(contract.source.verifiedCommit, "73c58011b3c2122b862a8724423976e93647f74d");
  assert.equal(contract.source.verifiedDate, "2026-06-14");

  for (const text of [
    "Do not copy raw upstream model prompts",
    "Every adopted pattern must map to at least one local artifact and one executable validation path",
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
  ]) {
    assert.ok(doc.includes(text), `upstream pattern doc must include ${text}`);
  }

  assert.ok(validator.includes("requiredAdoptedPatternIds"));
  assert.ok(validator.includes("requiredDeferredPatternIds"));
  assert.ok(validator.includes("requiredSourcePaths"));

  for (const sourcePath of contract.source.sourcePaths) {
    requiredSourcePaths.delete(sourcePath);
  }
  assert.equal(requiredSourcePaths.size, 0, "all audited upstream source paths must be represented");

  const adopted = new Set(contract.adoptedPatterns.map((pattern) => pattern.id));
  for (const pattern of contract.adoptedPatterns) {
    requiredAdoptedPatterns.delete(pattern.id);
    assert.ok(pattern.upstreamPaths.length > 0, `${pattern.id} must name upstream paths`);
    assert.ok(pattern.artifactPaths.length > 0, `${pattern.id} must name local artifacts`);
    assert.ok(pattern.validationPaths.length > 0, `${pattern.id} must name validation paths`);
    assert.ok(
      pattern.validationPaths.some((relativePath) => relativePath.startsWith("scripts/") || relativePath.startsWith("tests/")),
      `${pattern.id} must include executable validation`,
    );
    for (const relativePath of pattern.artifactPaths.concat(pattern.validationPaths)) {
      await pathExists(relativePath);
    }
  }
  assert.equal(requiredAdoptedPatterns.size, 0, "all required adopted patterns must be represented");

  for (const pattern of contract.deferredPatterns) {
    requiredDeferredPatterns.delete(pattern.id);
    assert.ok(pattern.upstreamPaths.length > 0, `${pattern.id} must name upstream paths`);
    assert.ok(pattern.reason.trim().length > 0, `${pattern.id} must explain why it is deferred`);
    assert.ok(!adopted.has(pattern.id), `${pattern.id} cannot be both adopted and deferred`);
  }
  assert.equal(requiredDeferredPatterns.size, 0, "all required deferred patterns must be represented");
});
