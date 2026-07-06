// Resolve the diff base for the CI tier gate — extracted from the workflow so
// the fail-closed policy is contract-testable. Publish claims (pull requests
// and default-branch pushes) fail CLOSED on an unusable base; the single
// documented exception is repo genesis (one parentless commit — the
// human-reviewed bootstrap push). A forced default-branch push with an
// unusable before-SHA fails closed too: gating only the tip commit would let
// high-risk changes in earlier replaced commits land unexamined.
//
// Usage: node harness/scripts/ci-diff-base.mjs <event-name> <base-sha>
// stdout: the resolved base SHA (exit 0) — caller runs `precommit --range <base>...HEAD`
// exit 2: bounded genesis exception — caller skips the range gate loudly
// exit 1: fail closed

import { spawnSync } from "node:child_process";

const [, , eventName, baseSha] = process.argv;
const git = (args) => spawnSync("git", args, { encoding: "utf8" });

const usable = (sha) =>
  typeof sha === "string" &&
  sha.length > 0 &&
  !/^0+$/.test(sha) &&
  git(["cat-file", "-e", sha]).status === 0;

if (usable(baseSha)) {
  console.log(baseSha);
  process.exit(0);
}

const commitCount = git(["rev-list", "--count", "HEAD"]).stdout.trim();
if (eventName !== "pull_request" && commitCount === "1") {
  console.error("repo genesis push (single parentless commit) — bounded exception; validate-all remains the floor");
  process.exit(2);
}

console.error(
  `unusable diff base ${JSON.stringify(baseSha ?? null)} for ${eventName ?? "push"} — publish claims fail closed (a forced ref must be gated against its true base, not its tip)`,
);
process.exit(1);
