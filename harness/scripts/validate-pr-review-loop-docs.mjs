import { finishValidation, readHarnessFile, requireIncludes } from "./validation-helpers.mjs";

const failures = [];
const doc = await readHarnessFile("framework/process/pr-review-loop.md");

requireIncludes(
  doc,
  [
    "small, focused PRs",
    "execution plan",
    "CI failures",
    "Review comments",
    "Merge readiness",
    "Record synthesis and evidence",
    "watch until a terminal state",
    "merged",
    "closed",
    "blocked on user help",
    "Green CI is a progress milestone",
    "classified before action",
    "branch-related failures",
    "flaky or infrastructure failures",
    "review-feedback state",
    "mergeability",
  ],
  "PR review loop",
  failures,
);

finishValidation("validate-pr-review-loop-docs", failures);
