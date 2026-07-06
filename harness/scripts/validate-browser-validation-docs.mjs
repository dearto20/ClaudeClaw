import { finishValidation, readHarnessFile, requireIncludes } from "./validation-helpers.mjs";

const failures = [];
const doc = await readHarnessFile("framework/process/browser-validation.md");

requireIncludes(
  doc,
  [
    "Startup command",
    "Browser automation command",
    "Required journeys",
    "Screenshot or video",
    "DOM",
    "Mobile and desktop",
    "not applicable",
  ],
  "browser validation contract",
  failures,
);

finishValidation("validate-browser-validation-docs", failures);
