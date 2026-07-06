import { finishValidation, readHarnessFile, requireIncludes } from "./validation-helpers.mjs";

const failures = [];
const doc = await readHarnessFile("framework/process/observability.md");

requireIncludes(
  doc,
  [
    "logs",
    "metrics",
    "traces",
    "query command",
    "worktree",
    "not applicable",
    "failure triage",
    "doctor",
    "health",
    "status",
    "diagnostic",
    "cost",
    "usage",
    "rate-limit",
    "quota",
    "Runtime Summary Evidence",
    "cwd",
    "workspace roots",
    "permission profile",
    "sandbox",
    "network",
    "model/provider",
    "token/context budget",
  ],
  "observability contract",
  failures,
);

finishValidation("validate-observability-docs", failures);
