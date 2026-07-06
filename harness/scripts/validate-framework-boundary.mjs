import { finishValidation, readHarnessFile, requireIncludes } from "./validation-helpers.mjs";

const failures = [];

const agents = await readHarnessFile("AGENTS.md");
requireIncludes(
  agents,
  [
    "Belongs in `framework/`",
    "Belongs in `override/`",
    "DevelopmentHarness source repository uses `development/`",
    "Modify `framework/` only when",
    "Installed target project-specific changes always go to `override/`",
  ],
  "harness/AGENTS.md boundary rule",
  failures,
);

const bootstrap = await readHarnessFile("../BOOTSTRAP.md").catch(async () => "");
requireIncludes(
  bootstrap,
  [
    "`framework/` is portable, `override/` is project-specific",
    "`development/` is source-only",
    "manifest-approved distributable surface",
    "Don't edit the framework version",
    "filled-in project content goes in `harness/override/`",
  ],
  "BOOTSTRAP.md boundary guidance",
  failures,
);

finishValidation("validate-framework-boundary", failures);
