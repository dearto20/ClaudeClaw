import {
  finishValidation,
  isMeaningful,
  loadLegacyPlanAcceptance,
  pathExists,
  readHarnessFile,
  readWorkspaceFile,
  requireIncludes,
  harnessRoot,
  workspaceRoot,
} from "./validation-helpers.mjs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { getValidationMode } from "./validation-mode.mjs";

// Plans live under harness/exec-plans in targets and additionally under
// development/exec-plans in the source repository; one reader serves both.
const readPlanFile = (relativePath) =>
  relativePath.startsWith("development/") ? readWorkspaceFile(relativePath) : readHarnessFile(relativePath);

const failures = [];

for (const dir of ["exec-plans/templates", "exec-plans/active", "exec-plans/completed", "exec-plans/tech-debt"]) {
  if (!(await pathExists(harnessRoot, dir))) {
    failures.push(`missing execution plan directory: ${dir}`);
  }
}

// Ledger diet (2.7.0): the core template stays small — every required-always
// field lives there; conditional material lives in the annex template and is
// appended per-trigger via `harness ledger annex`. Core and annex needle sets
// move in lockstep with the templates.
const templatePath = "exec-plans/templates/implementation-plan.md";
if (!(await pathExists(harnessRoot, templatePath))) {
  failures.push(`missing execution plan template: ${templatePath}`);
} else {
  const template = await readHarnessFile(templatePath);
  requireIncludes(
    template,
    [
      "## State",
      "## Goal",
      "## User Intent Discovery And Alignment",
      "Raw user intent",
      "Discovered intent (explicit, implicit, hidden constraints)",
      "Sources consulted (docs, code paths, runtime evidence, external references)",
      "Alternatives considered and selected strategy",
      "Acceptance criteria (checkable done-when bounds)",
      "Beyond-minimum opportunities and scope guardrails, or n/a",
      "Decision: `aligned` | `blocked`",
      "## Scope",
      "## Affected Paths\n- n/a",
      "## Runtime Mode",
      "Current mode",
      "Mutation allowed",
      "Plan Mode source",
      "Mode transition evidence",
      "Permission profile: `guarded` | `trusted-local` | `restricted-sandbox`",
      "## Dual-Role Governance",
      "Mode: `cross-agent`",
      "Primary performer agent: `claude-code`",
      "Independent critic agent: `codex`",
      "Agent-family separation: `yes`",
      "Internal decomposition summary",
      "Consolidated output owner",
      "Critic findings (accepted / rejected-with-rationale / blocking)",
      "Accepted non-blocking risks with rationale",
      "No-pushback terminal evidence",
      "Unresolved critic pushback",
      "Terminal status: `pending`",
      "## Cross-Agent Review",
      "cross-agent-review-json",
      "maxReviewIterations",
      "records",
      "Pushback-free review evidence",
      "Transport degradation acceptance",
      "## Current Step",
      "## Implementation Steps",
      "## Validation",
      "## Completion Evidence",
      "Summary",
      "Validation report",
      "Dirty worktree status",
      "Required new files tracked or intentionally ignored",
      "Generated artifacts handled by policy",
      "Push/publish state when publishing was requested",
      "Critic pushback-free status",
      "Remaining risk",
      "Conditional annexes",
      "ledger annex",
    ],
    templatePath,
    failures,
  );
}

const annexTemplatePath = "exec-plans/templates/implementation-plan-annexes.md";
if (!(await pathExists(harnessRoot, annexTemplatePath))) {
  failures.push(`missing execution plan annex template: ${annexTemplatePath}`);
} else {
  const annexes = await readHarnessFile(annexTemplatePath);
  requireIncludes(
    annexes,
    [
      "<!-- annex:deep-alignment -->",
      "## Deep Alignment",
      "Intent-to-outcome trace for cross-boundary work",
      "Failing prompt or journey regression check",
      "Root cause or full-investigation findings, or not-applicable rationale",
      "Adjacent blockers or related failure modes, or not-applicable rationale",
      "Evidence that the request was fully decomposed before implementation",
      "Existing implementation patterns reviewed (conflicts / preserved / revised)",
      "<!-- annex:expert-bench -->",
      "## Expert Bench",
      "Bench Status",
      "Persistence Mode",
      "Roles Reconstructable From",
      "Continuity Log",
      "## Sub-Agent Expert Roles",
      "Loop Status",
      "Check Result",
      "Iterations",
      "Blocker",
      "## Role Synthesis",
      "<!-- annex:critique-and-debate -->",
      "## Critique And Debate",
      "<!-- annex:intake-alignment -->",
      "## Intake Alignment",
      "Intake state",
      "Critical unknowns",
      "<!-- annex:target-profile -->",
      "## Target Validation Profile",
      "Executable runner",
      "Required command groups",
      "## Target Mechanism Evidence",
      "Architecture invariants",
      "Taste invariants",
      "Worktree runtime",
      "Observability",
      "Browser validation",
      "PR/CI loop",
      "Recurring cleanup",
      "## Not-Applicable Decisions",
      "Reviewer approvals",
      "Replacement evidence",
      "<!-- annex:worktree-runtime -->",
      "## Worktree Runtime",
      "<!-- annex:observability -->",
      "## Observability",
      "<!-- annex:browser-validation -->",
      "## Browser Validation",
      "<!-- annex:artifact-contract -->",
      "## Artifact Contract And Convergence",
    ],
    annexTemplatePath,
    failures,
  );
}

const allowedModes = new Set(["plan", "default"]);
const allowedMutationValues = new Set(["yes", "no"]);
const dualRoleModes = new Set(["cross-agent", "single-family-dual-role"]);
const dualRoleAgents = new Set(["codex", "claude-code"]);
const dualRoleTerminalStatuses = new Set([
  "pending",
  "cross-agent-complete",
  "single-family-dual-role-complete",
  "blocked",
  "fallback-accepted",
]);

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

const stripTicks = (value) => value.trim().replace(/^`|`$/g, "");
const normalizeAgent = (value) => stripTicks(value).toLowerCase().replace(/\s+/g, "-");

const hasPlanEvidence = (value, { allowPending = false } = {}) => {
  const normalized = stripTicks(value).trim().toLowerCase();
  if (normalized === "pending") {
    // `pending` is a valid mid-flight placeholder for active plans only;
    // completed plans must replace it with real evidence.
    return allowPending;
  }

  return isMeaningful(value) && normalized !== "todo" && normalized !== "tbd" && !normalized.includes("<") && !normalized.includes("...");
};

const planFiles = async (relativeDir) => {
  const dir = path.join(harnessRoot, relativeDir);
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.name === "README.md") {
      const content = await readHarnessFile(relativePath);
      if (content.includes("Plan validators must ignore this README")) {
        continue;
      }
    }

    files.push(relativePath);
  }

  return files;
};

const validateCompletedPlan = async (relativePath) => {
  const content = await readPlanFile(relativePath);
  const runtimeSection = extractSection(content, "Runtime Mode");
  const completionSection = extractSection(content, "Completion Evidence");

  if (!runtimeSection) {
    failures.push(`${relativePath} completed plan missing Runtime Mode section`);
    return;
  }

  const currentMode = valueAfterLabel(runtimeSection, "Current mode");
  const mutationAllowed = valueAfterLabel(runtimeSection, "Mutation allowed");
  const planModeSource = valueAfterLabel(runtimeSection, "Plan Mode source");
  const transitionEvidence = valueAfterLabel(runtimeSection, "Mode transition evidence");

  if (!allowedModes.has(currentMode)) {
    failures.push(`${relativePath} completed plan has invalid Current mode: ${currentMode}`);
  }

  if (!allowedMutationValues.has(mutationAllowed)) {
    failures.push(`${relativePath} completed plan has invalid Mutation allowed: ${mutationAllowed}`);
  }

  if (mutationAllowed !== "yes") {
    failures.push(`${relativePath} completed plan must record Mutation allowed: yes`);
  }

  if (!isMeaningful(planModeSource)) {
    failures.push(`${relativePath} completed plan missing meaningful Plan Mode source`);
  }

  if (!isMeaningful(transitionEvidence)) {
    failures.push(`${relativePath} completed plan missing meaningful Mode transition evidence`);
  }

  if (!completionSection) {
    failures.push(`${relativePath} completed plan missing Completion Evidence section`);
    return;
  }

  for (const label of [
    "Summary",
    "Validation report",
    "Dirty worktree status",
    "Required new files tracked or intentionally ignored",
    "Generated artifacts handled by policy",
    "Push/publish state when publishing was requested",
    "Critic pushback-free status",
    "Remaining risk",
  ]) {
    if (!isMeaningful(valueAfterLabel(completionSection, label))) {
      failures.push(`${relativePath} completed plan missing completion evidence: ${label}`);
    }
  }
};

const validateDualRoleSection = async (relativePath, expectedLocation) => {
  const content = await readPlanFile(relativePath);
  const section = extractSection(content, "Dual-Role Governance");
  if (!section) {
    failures.push(`${relativePath} missing Dual-Role Governance section`);
    return;
  }

  const mode = stripTicks(valueAfterLabel(section, "Mode"));
  const primary = normalizeAgent(valueAfterLabel(section, "Primary performer agent"));
  const critic = normalizeAgent(valueAfterLabel(section, "Independent critic agent"));
  const separation = stripTicks(valueAfterLabel(section, "Agent-family separation")).toLowerCase();
  const terminalStatus = stripTicks(valueAfterLabel(section, "Terminal status"));
  const allowPending = expectedLocation === "active";

  if (!dualRoleModes.has(mode)) {
    failures.push(`${relativePath} has invalid Dual-Role Governance mode: ${mode}`);
  }
  if (!dualRoleAgents.has(primary)) {
    failures.push(`${relativePath} has invalid primary performer agent: ${primary}`);
  }
  if (!dualRoleAgents.has(critic)) {
    failures.push(`${relativePath} has invalid independent critic agent: ${critic}`);
  }
  if (!["yes", "no"].includes(separation)) {
    failures.push(`${relativePath} has invalid Agent-family separation: ${separation}`);
  }
  if (!dualRoleTerminalStatuses.has(terminalStatus)) {
    failures.push(`${relativePath} has invalid dual-role terminal status: ${terminalStatus}`);
  }

  if (mode === "cross-agent") {
    if (primary === critic) {
      failures.push(`${relativePath} cross-agent dual-role governance requires different agent families`);
    }
    if (separation !== "yes") {
      failures.push(`${relativePath} cross-agent dual-role governance requires Agent-family separation: yes`);
    }
    const pair = new Set([primary, critic]);
    if (!pair.has("codex") || !pair.has("claude-code")) {
      failures.push(`${relativePath} cross-agent dual-role governance requires Codex plus Claude Code`);
    }
  }

  if (mode === "single-family-dual-role") {
    if (primary !== critic) {
      failures.push(`${relativePath} single-family fallback must use one available agent family for both roles`);
    }
    if (separation !== "no") {
      failures.push(`${relativePath} single-family fallback requires Agent-family separation: no`);
    }
  }

  if (expectedLocation === "completed" && terminalStatus === "pending") {
    failures.push(`${relativePath} completed plan cannot leave Dual-Role Governance terminal status pending`);
  }

  // Core required set (2.7.0 ledger diet). Alternatives accept both the slim
  // core label and the pre-diet label so superset (old-template) plans stay
  // green under subset semantics.
  for (const alternatives of [
    ["Internal decomposition summary"],
    ["Consolidated output owner"],
    ["Critic findings (accepted / rejected-with-rationale / blocking)", "Critic findings"],
    ["Accepted non-blocking risks with rationale"],
    ["No-pushback terminal evidence"],
    ["Unresolved critic pushback"],
  ]) {
    const satisfied = alternatives.some((label) => hasPlanEvidence(valueAfterLabel(section, label), { allowPending }));
    if (!satisfied) {
      failures.push(`${relativePath} missing meaningful Dual-Role Governance field: ${alternatives[0]}`);
    }
  }

  if (stripTicks(valueAfterLabel(section, "Consolidated output owner")) !== "primary-performer") {
    failures.push(`${relativePath} Consolidated output owner must be primary-performer`);
  }
};

const legacyAcceptance = await loadLegacyPlanAcceptance();
failures.push(...legacyAcceptance.failures);

for (const file of await planFiles("exec-plans/completed")) {
  if (legacyAcceptance.plans.has(file)) {
    continue;
  }
  await validateCompletedPlan(file);
}

for (const file of await planFiles("exec-plans/active")) {
  await validateDualRoleSection(file, "active");
}

for (const file of await planFiles("exec-plans/completed")) {
  if (legacyAcceptance.plans.has(file)) {
    continue;
  }
  await validateDualRoleSection(file, "completed");
}

// Source mode: the source repository's own ledgers under development/exec-plans
// meet the same completed-plan and dual-role rules; pre-scan-extension history
// is exempt only via the git-anchored source acceptance file.
const validationMode = await getValidationMode();
if (validationMode.isSource) {
  const sourceAcceptance = await loadLegacyPlanAcceptance({
    root: workspaceRoot,
    acceptancePath: "development/governance/legacy-plan-acceptance.json",
    planPrefix: "development/exec-plans/completed/",
  });
  failures.push(...sourceAcceptance.failures);
  const sourcePlanFiles = async (relativeDir) => {
    const entries = await readdir(path.join(workspaceRoot, relativeDir), { withFileTypes: true }).catch(() => []);
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
      .map((entry) => `${relativeDir}/${entry.name}`);
  };
  for (const file of await sourcePlanFiles("development/exec-plans/completed")) {
    if (sourceAcceptance.plans.has(file)) {
      continue;
    }
    await validateCompletedPlan(file);
    await validateDualRoleSection(file, "completed");
  }
  for (const file of await sourcePlanFiles("development/exec-plans/active")) {
    await validateDualRoleSection(file, "active");
  }
}

finishValidation("validate-exec-plans", failures);
