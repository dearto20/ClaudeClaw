import { finishValidation, pathExists, harnessRoot, workspaceRoot } from "./validation-helpers.mjs";
import { getValidationMode } from "./validation-mode.mjs";

const failures = [];
const mode = await getValidationMode();

const requiredWorkspaceDocs = ["AGENTS.md", "CLAUDE.md", "BOOTSTRAP.md", "README.md"];
const portableHarnessDocs = [
  "AGENTS.md",
  "framework/process/writing-skills.md",
  "framework/templates/context-glossary.md",
  "framework/process/requirement-lifecycle.md",
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
  "framework/process/pr-review-loop.md",
  "framework/process/entropy-garbage-collection.md",
  "framework/process/cleanup-guardrails.md",
  "framework/process/agent-system-structure.md",
  "framework/templates/bootstrap-intake.md",
  "framework/templates/target-validation-profile.md",
  "framework/templates/cross-agent-review-packet.md",
  "framework/templates/external-reference-audit.md",
  "framework/templates/target-exploration-guide.md",
  "framework/templates/tool-command-capability-catalog.md",
  "framework/templates/integration-surface-inventory.md",
  "framework/templates/context-collection-inspection.md",
  "framework/templates/plan-continuity-evidence.md",
  "framework/templates/agent-system-structure.md",
  "framework/schemas/bootstrap-intake.schema.json",
];
const targetHarnessDocs = [
  "override/ARCHITECTURE.md",
  "override/intake/project-intake.md",
  "override/validation/target-validation-profile.md",
  "override/runtime/worktree-runtime.md",
  "override/observability/observability.md",
  "override/browser/browser-validation.md",
  "override/cleanup/recurring-cleanup.md",
  "override/quality/architecture-invariants.md",
  "override/quality/taste-invariants.md",
  "override/pr/pr-ci-loop.md",
  "override/requirements/requirement-register.json",
  "override/design-docs/adr/index.md",
  "override/structure/agent-system-structure.md",
];
const requiredSourceDocs = [
  "development/ARCHITECTURE.md",
  "development/RELIABILITY.md",
  "development/developmentharness-source.json",
  "development/distribution-manifest.json",
  "development/migration-evidence.json",
  "development/requirements/requirement-register.json",
  "development/design-docs/adr/index.md",
];

const requiredHarnessDocs = [
  ...portableHarnessDocs,
  ...(mode.isSourceFinal ? [] : targetHarnessDocs),
];

for (const doc of requiredWorkspaceDocs) {
  if (!(await pathExists(workspaceRoot, doc))) {
    failures.push(`missing workspace doc: ${doc}`);
  }
}

for (const doc of requiredHarnessDocs) {
  if (!(await pathExists(harnessRoot, doc))) {
    failures.push(`missing harness doc: ${doc}`);
  }
}

if (mode.isSource) {
  for (const doc of requiredSourceDocs) {
    if (!(await pathExists(workspaceRoot, doc))) {
      failures.push(`missing source doc: ${doc}`);
    }
  }
}

finishValidation("validate-doc-map", failures, {
  workspaceDocs: requiredWorkspaceDocs.length,
  harnessDocs: requiredHarnessDocs.length,
  sourceDocs: mode.isSource ? requiredSourceDocs.length : 0,
});
