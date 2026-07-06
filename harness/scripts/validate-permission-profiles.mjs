import { finishValidation, readHarnessFile, requireIncludes } from "./validation-helpers.mjs";

const failures = [];
const doc = await readHarnessFile("framework/process/permission-profiles.md");

requireIncludes(
  doc,
  [
    "`guarded`",
    "`trusted-local`",
    "`restricted-sandbox`",
    "Approval Avoidance Ladder",
    "Redirect build, test, runtime, browser, observability, and validation outputs",
    "Approval prompts are a last resort",
    "workflow defect",
    "Destructive source cleanup",
    "Resetting git state",
    "Force pushing",
    "Modifying secrets or credentials",
    "Reading, printing, copying, or rewriting secrets and credentials outside explicit scope",
    "Writing outside configured workspace roots",
    "Running cleanup that targets databases, external services, or undeclared outside-workspace paths",
    "Target validation profiles declare command artifact side effects",
    "Command Policy Discipline",
    "allow, prompt, and forbidden decisions",
    "narrowest practical ordered prefix",
    "positive example and one negative example",
    "Absolute executable paths must not silently bypass basename policy",
  ],
  "permission profiles",
  failures,
);

finishValidation("validate-permission-profiles", failures);
