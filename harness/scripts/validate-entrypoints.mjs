import {
  finishValidation,
  pathExists,
  readHarnessFile,
  readWorkspaceFile,
  requireIncludes,
  harnessRoot,
  workspaceRoot,
} from "./validation-helpers.mjs";

const failures = [];

for (const relativePath of ["AGENTS.md", "CLAUDE.md"]) {
  if (!(await pathExists(workspaceRoot, relativePath))) {
    failures.push(`root ${relativePath} must exist`);
  }
}

if (await pathExists(workspaceRoot, "AGENTS.md")) {
  const content = await readWorkspaceFile("AGENTS.md");
  requireIncludes(
    content,
    [
      "harness/AGENTS.md",
      "node harness/scripts/validate-all.mjs",
      "top-level dual-role governance",
      "top-level dual-role governance (primary performer + independent critic)",
      "Sub-agents are internal decomposition and do not replace the top-level critic",
      "pushback-free critic evidence",
      "BOOTSTRAP_LAYOUT_CONTRACT: manifest-distributable-only",
      "BOOTSTRAP_LAYOUT_CONTRACT: no-target-development-root",
      "BOOTSTRAP_LAYOUT_CONTRACT: target-override-owned",
      "BOOTSTRAP_LAYOUT_CONTRACT: preserve-target-owned-harness-state",
      "HARNESS_PROCESS_CONTRACT: default-for-all-agent-work",
      "Ordinary silence does not disable harness obligations",
      "Plan Mode still performs harness planning obligations but does not mutate tracked files",
      "Mutation-capable mode creates or updates execution ledgers before non-trivial edits",
      "Open every response with the `[harness]` tier line",
    ],
    "root AGENTS.md",
    failures,
  );
}

if (await pathExists(workspaceRoot, "CLAUDE.md")) {
  const content = await readWorkspaceFile("CLAUDE.md");
  requireIncludes(
    content,
    [
      "AGENTS.md",
      "harness/AGENTS.md",
      "top-level dual-role governance",
      "independent critic",
      "nonBlockingRisks",
      "pushback-free",
      "Sub-agent coordination is internal decomposition evidence; it does not replace the top-level critic",
      "HARNESS_PROCESS_CONTRACT: default-for-all-agent-work",
      "Ordinary silence does not disable harness obligations",
      "Plan Mode still performs harness planning obligations but does not mutate tracked files",
      "Mutation-capable mode creates or updates execution ledgers before non-trivial edits",
      "Open every response with the `[harness]` tier line",
    ],
    "root CLAUDE.md",
    failures,
  );
}

if (await pathExists(workspaceRoot, "BOOTSTRAP.md")) {
  const content = await readWorkspaceFile("BOOTSTRAP.md");
  requireIncludes(
    content,
    [
      "Dual-role governance",
      "top-level primary performer and independent critic model",
      "Prefer Codex plus Claude Code; if one agent family is unavailable, record single-family dual-role fallback instead of skipping critique",
      "Sub-agent expert roles are internal decomposition evidence",
      "critic evidence must be pushback-free",
      "nonBlockingRisks",
      "Directory Ownership At A Glance",
      "Agent Bootstrap Contract",
      "Whole-repo fetch rule",
      "BOOTSTRAP_AGENT_CONTRACT: fetch-source-archive",
      "BOOTSTRAP_AGENT_CONTRACT: ask-intake-before-target-files",
      "BOOTSTRAP_AGENT_CONTRACT: materialize-target-override",
      "repository name and one-sentence purpose",
      "primary users and main workflows",
      "project type and runtime surfaces",
      "data sensitivity, security posture, and regulatory constraints",
      "expected validation commands",
      "ask focused follow-up questions instead of guessing",
      "BOOTSTRAP_LAYOUT_CONTRACT: manifest-distributable-only",
      "BOOTSTRAP_LAYOUT_CONTRACT: no-target-development-root",
      "BOOTSTRAP_LAYOUT_CONTRACT: target-override-owned",
      "BOOTSTRAP_LAYOUT_CONTRACT: preserve-target-owned-harness-state",
      "Harness Is Default Operating Law",
      "HARNESS_PROCESS_CONTRACT: default-for-all-agent-work",
      "Ordinary silence does not disable harness obligations",
      "Plan Mode still performs harness planning obligations but does not mutate tracked files",
      "Mutation-capable mode creates or updates execution ledgers before non-trivial edits",
      "Harness Ownership And Overwrite Policy",
      "Framework-owned",
      "Target-owned live state",
      "Generated evidence",
      "Seed defaults",
      "copy-if-missing",
      "no `rm -rf harness`",
      "no recursive copy over an existing `harness/`",
      "no replacement of `harness/override/`, execution-plan ledgers, or artifact directories",
      "explicit, path-scoped, and diff-reviewed",
    ],
    "BOOTSTRAP.md",
    failures,
  );
}

const harnessAgents = await readHarnessFile("AGENTS.md");
requireIncludes(
  harnessAgents,
  [
    "framework/process/execution-plans.md",
    "framework/process/runtime-mode-strategy.md",
    "framework/process/bootstrap-intake.md",
    "framework/process/target-validation-profile.md",
    "framework/process/agentic-loop.md",
    "framework/process/sub-agent-coordination.md",
    "framework/process/critique-and-debate.md",
    "framework/process/cross-agent-collaboration.md",
    "framework/process/worktree-runtime.md",
    "framework/process/observability.md",
    "framework/process/browser-validation.md",
    "framework/process/permission-profiles.md",
    "framework/process/harness-engineering-alignment.md",
    "framework/process/upstream-codex-portable-patterns.md",
    "framework/process/external-reference-hardening.md",
    "BOOTSTRAP_LAYOUT_CONTRACT: manifest-distributable-only",
    "BOOTSTRAP_LAYOUT_CONTRACT: no-target-development-root",
    "BOOTSTRAP_LAYOUT_CONTRACT: target-override-owned",
    "BOOTSTRAP_LAYOUT_CONTRACT: preserve-target-owned-harness-state",
    "HARNESS_PROCESS_CONTRACT: default-for-all-agent-work",
    "Ordinary silence does not disable harness obligations",
    "Plan Mode still performs harness planning obligations but does not mutate tracked files",
    "Mutation-capable mode creates or updates execution ledgers before non-trivial edits",
    "Non-trivial work has a primary performer and an independent critic",
    "internal decomposition evidence consolidated into one primary-performer output",
    "Planning, implementation, code review, validation, completion, commit, and publish claims require critic terminal evidence with no unresolved pushback",
    "Every response opens with one tier line",
    "Visibility is mechanically reinforced",
    "framework/registry/enforcement-map.json",
  ],
  "harness/AGENTS.md",
  failures,
);

finishValidation("validate-entrypoints", failures, {
  checkedRoots: [workspaceRoot, harnessRoot],
});
