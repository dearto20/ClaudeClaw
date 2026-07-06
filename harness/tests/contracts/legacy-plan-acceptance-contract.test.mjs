// Contract: targets upgraded from harness v1 get an explicit, reviewable path
// through the v2 gates for pre-upgrade completed plans — and only that path.
// Acceptance is git-anchored: listed plans must exist at upgradeBaseCommit,
// so new work cannot be laundered through the acceptance file.
// Also proves the upgrade tool copies framework-owned paths that are entirely
// missing from the target (the v1 install had no harness/hooks).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, cp, realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadLegacyPlanAcceptance, legacyPlanAcceptancePath } from "../../scripts/validation-helpers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(__dirname, "..", "..", "..");

const git = (cwd, ...args) => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
};

// Scratch git repo shaped like a bootstrapped target: <repo>/harness/... with
// one completed plan committed at the base commit.
const scaffold = async () => {
  const repoRoot = await realpath(await mkdtemp(path.join(tmpdir(), "legacy-acceptance-")));
  const harnessRoot = path.join(repoRoot, "harness");
  await mkdir(path.join(harnessRoot, "exec-plans", "completed"), { recursive: true });
  await writeFile(path.join(harnessRoot, "exec-plans", "completed", "old-plan.md"), "# Old Plan\n");
  git(repoRoot, "init");
  git(repoRoot, "config", "user.email", "test@example.com");
  git(repoRoot, "config", "user.name", "Test");
  git(repoRoot, "add", "-A");
  git(repoRoot, "commit", "-m", "v1 history");
  const baseCommit = git(repoRoot, "rev-parse", "HEAD");
  return { repoRoot, harnessRoot, baseCommit };
};

const writeAcceptance = async (harnessRoot, acceptance) => {
  const absolute = path.join(harnessRoot, legacyPlanAcceptancePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, typeof acceptance === "string" ? acceptance : JSON.stringify(acceptance, null, 2));
};

const validAcceptance = (baseCommit) => ({
  rationale: "Plans completed under harness v1 before the v2 upgrade; history is never rewritten.",
  acceptedBy: "dearto20",
  acceptedDate: "2026-07-02",
  upgradeBaseCommit: baseCommit,
  plans: ["exec-plans/completed/old-plan.md"],
});

test("absent acceptance file exempts nothing and fails nothing", async () => {
  const { repoRoot, harnessRoot } = await scaffold();
  const result = await loadLegacyPlanAcceptance({ root: harnessRoot });
  assert.equal(result.plans.size, 0);
  assert.deepEqual(result.failures, []);
  await rm(repoRoot, { recursive: true, force: true });
});

test("valid git-anchored acceptance exempts exactly the listed completed plans", async () => {
  const { repoRoot, harnessRoot, baseCommit } = await scaffold();
  await writeAcceptance(harnessRoot, validAcceptance(baseCommit));
  const result = await loadLegacyPlanAcceptance({ root: harnessRoot });
  assert.deepEqual(result.failures, []);
  assert.ok(result.plans.has("exec-plans/completed/old-plan.md"));
  assert.equal(result.plans.size, 1);
  await rm(repoRoot, { recursive: true, force: true });
});

test("acceptance without rationale or upgradeBaseCommit fails validation", async () => {
  const { repoRoot, harnessRoot, baseCommit } = await scaffold();
  await writeAcceptance(harnessRoot, { ...validAcceptance(baseCommit), rationale: "", upgradeBaseCommit: "" });
  const result = await loadLegacyPlanAcceptance({ root: harnessRoot });
  assert.equal(result.plans.size, 0);
  assert.ok(result.failures.some((f) => f.includes("rationale")));
  assert.ok(result.failures.some((f) => f.includes("upgradeBaseCommit")));
  await rm(repoRoot, { recursive: true, force: true });
});

test("a plan committed after the base commit cannot be laundered into acceptance", async () => {
  const { repoRoot, harnessRoot, baseCommit } = await scaffold();
  await writeFile(path.join(harnessRoot, "exec-plans", "completed", "fresh-plan.md"), "# Fresh Plan\n");
  git(repoRoot, "add", "-A");
  git(repoRoot, "commit", "-m", "new work after upgrade base");
  await writeAcceptance(harnessRoot, {
    ...validAcceptance(baseCommit),
    plans: ["exec-plans/completed/old-plan.md", "exec-plans/completed/fresh-plan.md"],
  });
  const result = await loadLegacyPlanAcceptance({ root: harnessRoot });
  assert.ok(result.plans.has("exec-plans/completed/old-plan.md"));
  assert.ok(!result.plans.has("exec-plans/completed/fresh-plan.md"));
  assert.ok(result.failures.some((f) => f.includes("did not exist at upgradeBaseCommit")));
  await rm(repoRoot, { recursive: true, force: true });
});

test("an unknown upgradeBaseCommit fails validation", async () => {
  const { repoRoot, harnessRoot, baseCommit } = await scaffold();
  await writeAcceptance(harnessRoot, { ...validAcceptance(baseCommit), upgradeBaseCommit: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" });
  const result = await loadLegacyPlanAcceptance({ root: harnessRoot });
  assert.equal(result.plans.size, 0);
  assert.ok(result.failures.some((f) => f.includes("is not a commit")));
  await rm(repoRoot, { recursive: true, force: true });
});

test("acceptance may only list completed plans, never active ones", async () => {
  const { repoRoot, harnessRoot, baseCommit } = await scaffold();
  await writeAcceptance(harnessRoot, { ...validAcceptance(baseCommit), plans: ["exec-plans/active/sneaky.md"] });
  const result = await loadLegacyPlanAcceptance({ root: harnessRoot });
  assert.equal(result.plans.size, 0);
  assert.ok(result.failures.some((f) => f.includes("exec-plans/completed/")));
  await rm(repoRoot, { recursive: true, force: true });
});

test("listing a plan that does not exist fails validation", async () => {
  const { repoRoot, harnessRoot, baseCommit } = await scaffold();
  await writeAcceptance(harnessRoot, { ...validAcceptance(baseCommit), plans: ["exec-plans/completed/ghost.md"] });
  const result = await loadLegacyPlanAcceptance({ root: harnessRoot });
  assert.equal(result.plans.size, 0);
  assert.ok(result.failures.some((f) => f.includes("does not exist")));
  await rm(repoRoot, { recursive: true, force: true });
});

test("malformed JSON fails validation loudly, never silently skips", async () => {
  const { repoRoot, harnessRoot } = await scaffold();
  await writeAcceptance(harnessRoot, "{not json");
  const result = await loadLegacyPlanAcceptance({ root: harnessRoot });
  assert.equal(result.plans.size, 0);
  assert.ok(result.failures.some((f) => f.includes("not valid JSON")));
  await rm(repoRoot, { recursive: true, force: true });
});

test("upgrade tool copies framework-owned paths missing from the target", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "upgrade-target-"));
  // A v1-shaped target: has scripts (including its copy of the upgrade tool)
  // but no harness/hooks and no harness/AGENTS.md.
  await mkdir(path.join(target, "harness", "scripts"), { recursive: true });
  await cp(
    path.join(sourceRoot, "harness", "scripts", "harness-upgrade.mjs"),
    path.join(target, "harness", "scripts", "harness-upgrade.mjs"),
  );
  const run = spawnSync(
    "node",
    [path.join(target, "harness", "scripts", "harness-upgrade.mjs"), "--source", sourceRoot, "--apply"],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.ok(existsSync(path.join(target, "harness", "hooks", "pre-commit")), "harness/hooks/pre-commit must be copied to a target that lacked it");
  assert.ok(existsSync(path.join(target, "harness", "AGENTS.md")), "harness/AGENTS.md contract must be framework-owned and copied");
  assert.match(run.stdout, /new to target/);
  await rm(target, { recursive: true, force: true });
});
