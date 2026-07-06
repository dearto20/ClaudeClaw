// Rehearsal: the gates must reject fabricated non-compliant work and accept
// compliant work, mechanically, in a scratch git repo. This test is the
// permanent proof that "tasks are processed based on the harness" — any future
// change that weakens tier detection or the pre-commit gate fails here.

import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";

const run = (cwd, command, args, env = {}) =>
  spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });

const buildScratchTarget = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "harness-rehearsal-"));
  await mkdir(path.join(root, "harness", "scripts"), { recursive: true });
  await mkdir(path.join(root, "harness", "hooks"), { recursive: true });
  await mkdir(path.join(root, "harness", "exec-plans", "templates"), { recursive: true });
  await mkdir(path.join(root, "harness", "exec-plans", "active"), { recursive: true });
  await mkdir(path.join(root, "harness", "framework"), { recursive: true });
  await mkdir(path.join(root, "src"), { recursive: true });

  await cp(getRepoPath("scripts", "harness.mjs"), path.join(root, "harness", "scripts", "harness.mjs"));
  await cp(getRepoPath("scripts", "validate-all.mjs"), path.join(root, "harness", "scripts", "validate-all.mjs"));
  await cp(getRepoPath("scripts", "ledger-rules.mjs"), path.join(root, "harness", "scripts", "ledger-rules.mjs"));
  await cp(getRepoPath("scripts", "upgrade-surface.mjs"), path.join(root, "harness", "scripts", "upgrade-surface.mjs"));
  await cp(getRepoPath("..", "harness", "hooks", "pre-commit"), path.join(root, "harness", "hooks", "pre-commit"));
  await cp(
    getRepoPath("exec-plans", "templates", "implementation-plan.md"),
    path.join(root, "harness", "exec-plans", "templates", "implementation-plan.md"),
  );

  run(root, "git", ["init", "--quiet"]);
  run(root, "git", ["config", "user.email", "rehearsal@harness.test"]);
  run(root, "git", ["config", "user.name", "Rehearsal"]);
  run(root, "git", ["config", "core.hooksPath", "harness/hooks"]);
  run(root, "chmod", ["+x", "harness/hooks/pre-commit"]);
  await writeFile(path.join(root, "README.md"), "# rehearsal target\n");
  run(root, "git", ["add", "-A"]);
  run(root, "git", ["commit", "--quiet", "-m", "scaffold", "--no-verify"]);
  return root;
};

test("rehearsal: gates reject non-compliant work and accept compliant work", async (t) => {
  const root = await buildScratchTarget();
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const harnessCli = ["harness/scripts/harness.mjs"];

  // Tier detection: a framework edit is high-risk, a src edit is standard, none is trivial.
  await writeFile(path.join(root, "harness", "framework", "rule.md"), "# governed\n");
  run(root, "git", ["add", "-A"]);
  let result = run(root, "node", [...harnessCli, "tier"]);
  assert.match(result.stdout, /tier: high-risk/, "framework edit must compute high-risk");

  // Non-compliant: high-risk staged changes with no ledger → pre-commit gate rejects.
  result = run(root, "node", [...harnessCli, "precommit"]);
  assert.equal(result.status, 1, "pre-commit must reject non-trivial work without a ledger");
  assert.match(`${result.stdout}${result.stderr}`, /REJECTED/, "rejection must be explicit");

  // A real commit attempt is also rejected by the hook itself.
  result = run(root, "git", ["commit", "--quiet", "-m", "non-compliant"]);
  assert.notEqual(result.status, 0, "git commit must be blocked by the pre-commit hook");

  // A ledger alone is no longer enough: uncovered paths and missing critic
  // evidence are each rejected by name before the gate can pass.
  result = run(root, "node", [...harnessCli, "ledger", "new", "rehearsal-change"]);
  assert.equal(result.status, 0, "ledger scaffold must succeed");
  run(root, "git", ["add", "-A"]);
  result = run(root, "node", [...harnessCli, "precommit"]);
  assert.equal(result.status, 1, "template ledger (Affected Paths n/a) must not cover the staged paths");
  assert.match(`${result.stdout}${result.stderr}`, /uncovered/, "coverage rejection must name the gap");

  const ledgerPath = path.join(root, "harness", "exec-plans", "active", "rehearsal-change.md");
  let ledgerText = await readFile(ledgerPath, "utf8");
  ledgerText = ledgerText.replace("## Affected Paths\n- n/a", "## Affected Paths\n- harness/framework/\n- src/");
  await writeFile(ledgerPath, ledgerText);
  run(root, "git", ["add", "-A"]);
  result = run(root, "node", [...harnessCli, "precommit"]);
  assert.equal(result.status, 1, "high-risk work without critic evidence must be rejected");
  assert.match(`${result.stdout}${result.stderr}`, /critic terminal evidence/, "critic rejection must be explicit");

  ledgerText = ledgerText.replace('"records": []', '"records": [{ "reviewId": "gate-evidence", "status": "complete" }]');
  await writeFile(ledgerPath, ledgerText);
  run(root, "git", ["add", "-A"]);
  result = run(root, "node", [...harnessCli, "precommit"]);
  assert.equal(result.status, 0, `pre-commit must accept covered, critic-evidenced work: ${result.stdout}${result.stderr}`);
  result = run(root, "git", ["commit", "--quiet", "-m", "compliant"]);
  assert.equal(result.status, 0, "git commit must pass with coverage and critic evidence");

  // Standard-tier: src-only edits are standard and pass with coverage alone.
  await writeFile(path.join(root, "src", "app.js"), "console.log(1);\n");
  run(root, "git", ["add", "-A"]);
  result = run(root, "node", [...harnessCli, "tier"]);
  assert.match(result.stdout, /tier: standard/, "src edit must compute standard");
  result = run(root, "node", [...harnessCli, "precommit"]);
  assert.equal(result.status, 0, `standard covered work must pass: ${result.stdout}${result.stderr}`);
  run(root, "git", ["commit", "--quiet", "-m", "standard covered"]);

  // Escape hatch is loud but works, and only locally.
  await writeFile(path.join(root, "harness", "framework", "rule2.md"), "# governed 2\n");
  run(root, "git", ["add", "-A"]);
  result = run(root, "node", [...harnessCli, "precommit"], { HARNESS_SKIP: "1" });
  assert.equal(result.status, 0, "HARNESS_SKIP must bypass locally");
  assert.match(`${result.stdout}${result.stderr}`, /WARNING/, "escape hatch must be loud");
});

test("rehearsal: status derives every field from artifacts", async (t) => {
  const root = await buildScratchTarget();
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  let result = run(root, "node", ["harness/scripts/harness.mjs", "status", "--json"]);
  const state = JSON.parse(result.stdout);
  assert.equal(state.tier, "trivial");
  assert.equal(state.ledger, "none");
  assert.equal(state.critic, "none");

  run(root, "node", ["harness/scripts/harness.mjs", "ledger", "new", "visible-work"]);
  run(root, "node", ["harness/scripts/harness.mjs", "ledger", "step", "visible-work", "implementation — governing: gates.md"]);
  result = run(root, "node", ["harness/scripts/harness.mjs", "status", "--json"]);
  const next = JSON.parse(result.stdout);
  assert.equal(next.ledger, "visible-work");
  assert.match(next.step, /implementation — governing: gates.md/);
  assert.equal(next.critic, "pending", "critic state must be scoped to the active ledger");
});
