import { readdir } from "node:fs/promises";
import path from "node:path";
import { finishValidation, harnessRoot, readHarnessFile, requireIncludes } from "./validation-helpers.mjs";

const failures = [];
const doc = await readHarnessFile("framework/process/review.md");
// Ledger diet (2.7.0): the expert bench lives in the annex template and is
// appended per-trigger; per-plan checks run when the annex sections are present.
const template = await readHarnessFile("exec-plans/templates/implementation-plan-annexes.md");

const roles = [
  "planner",
  "architect",
  "implementer",
  "test-engineer",
  "security-reviewer",
  "code-reviewer",
  "documentation-steward",
  "verifier",
];
const allowedStatuses = new Set(["pending", "in-progress", "passed", "failed", "blocked", "not-applicable"]);
const allowedBenchStatuses = new Set(["open", "closed"]);
const allowedPersistenceModes = new Set(["runtime-persistent", "repo-persistent-only"]);
const terminalPlanStates = new Set(["completed", "blocked", "abandoned"]);
const nonTerminalRoleStatuses = new Set(["pending", "in-progress", "failed"]);
const requiredColumns = ["Role", "Owner", "Task", "Loop Status", "Check Result", "Iterations", "Blocker", "Evidence"];

requireIncludes(doc, roles, "sub-agent coordination doc", failures);
requireIncludes(template, roles, "execution plan role table", failures);
requireIncludes(template, requiredColumns, "execution plan role table columns", failures);
requireIncludes(
  doc,
  [
    "Goal",
    "Scope",
    "Files or artifacts",
    "Constraints",
    "Expected output",
    "Validation command",
    "Risks",
    "Evidence",
    "Expert role =",
    "Expert Bench",
    "Repo-persistent role state",
    "runtime persistence",
    "The framework never validates runtime persistence",
    "Role Pass Criteria",
    "Role Outcomes",
    "Synthesis",
    "Sub-agent coordination is internal decomposition",
    "does not replace top-level dual-role governance",
    "cannot by themselves satisfy the top-level primary-performer/independent-critic separation",
    "one consolidated output owned by the primary performer",
  ],
  "sub-agent coordination handoff",
  failures,
);
requireIncludes(
  template,
  [
    "## Expert Bench",
    "Bench Status",
    "Persistence Mode",
    "runtime-persistent",
    "repo-persistent-only",
    "Roles Reconstructable From",
    "Continuity Log",
    "## Sub-Agent Expert Roles",
    "## Role Synthesis",
  ],
  "execution plan expert bench contract",
  failures,
);

const extractSection = (content, heading) => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^## ${escapedHeading}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"));
  return match ? match[1].trim() : "";
};

const valueAfterLabel = (section, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = section.match(new RegExp(`^[- ]*${escapedLabel}:[ \\t]*(.*)$`, "im"));
  return match ? match[1].trim() : "";
};

const normalizeCell = (value) => value.trim().replace(/^`|`$/g, "");

const parseMarkdownTable = (section) => {
  const lines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const splitRow = (line) => line.slice(1, -1).split("|").map(normalizeCell);
  const headers = splitRow(lines[0]);
  const rows = [];

  for (const line of lines.slice(2)) {
    if (/^\|?[\s:-]+\|/.test(line)) {
      continue;
    }

    const cells = splitRow(line);
    if (cells.length !== headers.length) {
      continue;
    }

    rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index]])));
  }

  return { headers, rows };
};

const planState = (content) => {
  const stateSection = extractSection(content, "State");
  const match = stateSection.match(/`([a-z][a-z-]*)`/) ?? stateSection.match(/\b([a-z][a-z-]*)\b/);
  return match ? match[1] : "";
};

const isMeaningful = (value) => {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "n/a" && normalized !== "none";
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

const validatePlan = async (relativePath, expectedLocation) => {
  const content = await readHarnessFile(relativePath);
  const state = planState(content);

  if (expectedLocation === "active" && ["completed", "abandoned"].includes(state)) {
    failures.push(`${relativePath} is in active/ but has terminal state: ${state}`);
  }
  if (expectedLocation === "completed" && state !== "completed") {
    failures.push(`${relativePath} is in completed/ but state is not completed`);
  }

  // Critique And Debate is trigger-declared: when present with a governed
  // trigger, its fields are required on COMPLETED plans regardless of the
  // expert-bench annex. Active plans are mid-debate — the freshly annexed
  // scaffold (concrete `high-risk` trigger, blank fields) stays valid until
  // close, matching validate-cross-agent-review's location tolerance.
  if (expectedLocation === "completed") {
    const critiqueSection = extractSection(content, "Critique And Debate");
    const trigger = valueAfterLabel(critiqueSection, "Trigger").replace(/`/g, "");
    if (["high-risk", "framework-change", "security", "runtime", "conflict"].includes(trigger)) {
      for (const label of ["Critic findings", "Resolutions", "Final synthesis"]) {
        const value = valueAfterLabel(critiqueSection, label).replace(/`/g, "").toLowerCase();
        // `pending` is mid-debate state — never completed-plan evidence.
        if (!isMeaningful(value) || value === "pending") {
          failures.push(`${relativePath} ${trigger} plan missing ${label}`);
        }
      }
    }
  }

  // Expert-bench annex: validated when present (appending it commits the plan
  // to the full bench contract); absent means sub-agent decomposition was not
  // ledger-tracked and the dual-role core carries the decomposition summary.
  const benchSection = extractSection(content, "Expert Bench");
  const roleSectionPresent = content.includes("## Sub-Agent Expert Roles");
  if (!benchSection && !roleSectionPresent) {
    return;
  }
  const benchStatus = valueAfterLabel(benchSection, "Bench Status").replace(/`/g, "");
  const persistenceMode = valueAfterLabel(benchSection, "Persistence Mode").replace(/`/g, "");
  const reconstructableFrom = valueAfterLabel(benchSection, "Roles Reconstructable From");
  const continuityLog = valueAfterLabel(benchSection, "Continuity Log");
  const roleSection = extractSection(content, "Sub-Agent Expert Roles");
  const { headers, rows } = parseMarkdownTable(roleSection);

  for (const column of requiredColumns) {
    if (!headers.includes(column)) {
      failures.push(`${relativePath} missing role table column: ${column}`);
    }
  }

  if (!allowedBenchStatuses.has(benchStatus)) {
    failures.push(`${relativePath} has invalid Bench Status: ${benchStatus}`);
  }

  if (!allowedPersistenceModes.has(persistenceMode)) {
    failures.push(`${relativePath} has invalid Persistence Mode: ${persistenceMode}`);
  }

  if (!isMeaningful(reconstructableFrom)) {
    failures.push(`${relativePath} missing meaningful Roles Reconstructable From`);
  }

  if (!isMeaningful(continuityLog)) {
    failures.push(`${relativePath} missing meaningful Continuity Log`);
  }

  if (state === "active" && benchStatus !== "open") {
    failures.push(`${relativePath} active plan must have Bench Status open`);
  }

  if (terminalPlanStates.has(state) && benchStatus !== "closed") {
    failures.push(`${relativePath} terminal plan must have Bench Status closed`);
  }

  const roleRows = new Map(rows.map((row) => [row.Role, row]));
  for (const role of roles) {
    if (!roleRows.has(role)) {
      failures.push(`${relativePath} missing required role row: ${role}`);
    }
  }

  for (const row of rows) {
    const role = row.Role;
    const status = row["Loop Status"];
    const checkResult = row["Check Result"] ?? "";
    const blocker = row.Blocker ?? "";
    const evidence = row.Evidence ?? "";

    if (!allowedStatuses.has(status)) {
      failures.push(`${relativePath} role ${role} has invalid status: ${status}`);
      continue;
    }

    if (benchStatus === "closed" && status === "pending") {
      failures.push(`${relativePath} closed bench has pending role ${role}`);
    }

    if (expectedLocation === "completed" && (nonTerminalRoleStatuses.has(status) || status === "blocked")) {
      failures.push(`${relativePath} completed plan has non-terminal role ${role}: ${status}`);
    }

    if (expectedLocation === "completed" && !isMeaningful(checkResult)) {
      failures.push(`${relativePath} completed plan role ${role} lacks check result`);
    }

    if (expectedLocation === "completed" && status === "passed" && !isMeaningful(evidence)) {
      failures.push(`${relativePath} completed plan role ${role} lacks evidence`);
    }

    if (status === "blocked") {
      if (state !== "blocked") {
        failures.push(`${relativePath} role ${role} is blocked but plan state is not blocked`);
      }
      if (!isMeaningful(blocker)) {
        failures.push(`${relativePath} role ${role} is blocked without blocker text`);
      }
    }

    if (status === "not-applicable" && !isMeaningful(checkResult) && !isMeaningful(blocker)) {
      failures.push(`${relativePath} role ${role} is not-applicable without rationale`);
    }
  }

  const synthesisSection = extractSection(content, "Role Synthesis");
  if (state === "completed" && !isMeaningful(valueAfterLabel(synthesisSection, "Final decision"))) {
    failures.push(`${relativePath} completed plan missing Role Synthesis final decision`);
  }
};

for (const file of await planFiles("exec-plans/active")) {
  await validatePlan(file, "active");
}

for (const file of await planFiles("exec-plans/completed")) {
  await validatePlan(file, "completed");
}

finishValidation("validate-sub-agent-ledger", failures, { roleCount: roles.length });
