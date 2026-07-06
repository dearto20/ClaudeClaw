import { finishValidation, readHarnessFile, requireIncludes } from "./validation-helpers.mjs";

const failures = [];
const doc = await readHarnessFile("framework/process/worktree-runtime.md");

requireIncludes(
  doc,
  [
    "git worktree",
    "install dependencies",
    "start the app or service",
    "ports",
    "env files",
    "reset or tear down",
    "runtime artifacts",
    "validation command",
  ],
  "worktree runtime contract",
  failures,
);

finishValidation("validate-worktree-runtime-docs", failures);
