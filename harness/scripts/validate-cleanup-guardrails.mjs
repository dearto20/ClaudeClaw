import { finishValidation, readHarnessFile, requireIncludes } from "./validation-helpers.mjs";

const failures = [];
const doc = await readHarnessFile("framework/process/gates.md");

requireIncludes(
  doc,
  [
    "dirty worktree",
    "Cleanup Prevention Contract",
    "`manual-cleanup` is valid only with rationale",
    "Prefer non-destructive inspection and profile changes before requesting cleanup approval",
    "target paths",
    "tracked, ignored, or untracked",
    "No `git reset --hard`",
    "No broad recursive deletion",
    "No secret, credential, or environment file rewrite",
    "No destructive source cleanup",
  ],
  "cleanup guardrails",
  failures,
);

finishValidation("validate-cleanup-guardrails", failures);
