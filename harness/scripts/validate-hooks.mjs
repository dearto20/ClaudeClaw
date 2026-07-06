// Gate: enforcement must be active. Git hooks do not clone, so a harness whose
// pre-commit gate is not activated is silently unenforced. This validator fails
// locally until `harness activate-hooks` (or bootstrap) has run.
// Skipped in CI (CI enforces via the workflow itself) and outside git repos.

import path from "node:path";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(harnessRoot, "..");

const emit = (payload, code = 0) => {
  console.log(JSON.stringify(payload));
  process.exit(code);
};

if (process.env.CI) {
  emit({ status: "skipped", reason: "CI environment — workflow enforcement applies" });
}

const inRepo = spawnSync("git", ["rev-parse", "--git-dir"], { cwd: repoRoot, encoding: "utf8" });
if (inRepo.status !== 0) {
  emit({ status: "skipped", reason: "not a git repository" });
}

const hookFile = path.join(harnessRoot, "hooks", "pre-commit");
if (!existsSync(hookFile)) {
  emit({ status: "failed", reason: "harness/hooks/pre-commit missing from the distributable surface" }, 1);
}

const config = spawnSync("git", ["config", "core.hooksPath"], { cwd: repoRoot, encoding: "utf8" });
const configured = config.status === 0 ? config.stdout.trim() : "";
const active =
  configured === "harness/hooks" ||
  (configured && path.resolve(repoRoot, configured) === path.join(harnessRoot, "hooks"));

if (!active) {
  emit(
    {
      status: "failed",
      reason: "pre-commit gate not activated",
      fix: "node harness/scripts/harness.mjs activate-hooks",
    },
    1,
  );
}

emit({ status: "passed", hooksPath: configured });
