// Ledger diet (2.7.0): the core template stays small, annexes append on
// demand, and the validators still reject what they must. The negative tests
// EXECUTE the validators against fixture ledgers in a scratch workspace —
// string-pinning validator source would not catch silent under-validation.

import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";

const TEMPLATE_PATH = getRepoPath("exec-plans", "templates", "implementation-plan.md");
const ANNEX_TEMPLATE_PATH = getRepoPath("exec-plans", "templates", "implementation-plan-annexes.md");

const SCRIPTS = [
  "harness.mjs",
  "ledger-rules.mjs",
  "upgrade-surface.mjs",
  "validation-helpers.mjs",
  "validation-mode.mjs",
  "dual-role-governance-rules.mjs",
  "validate-exec-plans.mjs",
  "validate-cross-agent-review.mjs",
  "validate-sub-agent-ledger.mjs",
];

const runHarness = (cwd, args) =>
  spawnSync("node", ["harness/scripts/harness.mjs", ...args], { cwd, encoding: "utf8" });

const runValidator = (cwd, script) =>
  spawnSync("node", [`harness/scripts/${script}`], { cwd, encoding: "utf8" });

const buildScratchTarget = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "harness-ledger-diet-"));
  for (const dir of [
    ["harness", "scripts"],
    ["harness", "exec-plans", "templates"],
    ["harness", "exec-plans", "active"],
    ["harness", "exec-plans", "completed"],
    ["harness", "exec-plans", "tech-debt"],
    ["harness", "framework", "process"],
    ["harness", "framework", "registry"],
  ]) {
    await mkdir(path.join(root, ...dir), { recursive: true });
  }
  for (const script of SCRIPTS) {
    await cp(getRepoPath("scripts", script), path.join(root, "harness", "scripts", script));
  }
  await cp(TEMPLATE_PATH, path.join(root, "harness", "exec-plans", "templates", "implementation-plan.md"));
  await cp(ANNEX_TEMPLATE_PATH, path.join(root, "harness", "exec-plans", "templates", "implementation-plan-annexes.md"));
  await cp(
    getRepoPath("framework", "process", "review.md"),
    path.join(root, "harness", "framework", "process", "review.md"),
  );
  await cp(
    getRepoPath("framework", "registry", "agents.json"),
    path.join(root, "harness", "framework", "registry", "agents.json"),
  );
  return root;
};

const scaffoldActivePlan = async (root, slug) => {
  const result = runHarness(root, ["ledger", "new", slug]);
  assert.equal(result.status, 0, `ledger new must succeed: ${result.stderr}`);
  return path.join(root, "harness", "exec-plans", "active", `${slug}.md`);
};

test("ledger annex appends known blocks, rejects unknown, duplicate, and regex-metacharacter names", async (t) => {
  const root = await buildScratchTarget();
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const planPath = await scaffoldActivePlan(root, "diet-smoke");

  for (const name of [
    "deep-alignment",
    "expert-bench",
    "critique-and-debate",
    "intake-alignment",
    "target-profile",
    "worktree-runtime",
    "observability",
    "browser-validation",
    "artifact-contract",
  ]) {
    const result = runHarness(root, ["ledger", "annex", "diet-smoke", name]);
    assert.equal(result.status, 0, `ledger annex ${name} must succeed: ${result.stderr}`);
  }

  const ledger = await readFile(planPath, "utf8");
  for (const heading of [
    "## Deep Alignment",
    "## Expert Bench",
    "## Sub-Agent Expert Roles",
    "## Role Synthesis",
    "## Critique And Debate",
    "## Intake Alignment",
    "## Target Validation Profile",
    "## Worktree Runtime",
    "## Observability",
    "## Browser Validation",
    "## Artifact Contract And Convergence",
  ]) {
    assert.ok(ledger.includes(`${heading}\n`), `annexed ledger must contain ${heading}`);
  }

  assert.notEqual(runHarness(root, ["ledger", "annex", "diet-smoke", "no-such-annex"]).status, 0, "unknown annex must fail");
  assert.notEqual(runHarness(root, ["ledger", "annex", "diet-smoke", "expert-bench"]).status, 0, "duplicate annex must fail");

  // Regex-metacharacter names must never reach a pattern that matches a block.
  const before = await readFile(planPath, "utf8");
  for (const evil of [".*", "[a-z-]+", "deep-alignment|expert-bench"]) {
    assert.notEqual(runHarness(root, ["ledger", "annex", "diet-smoke", evil]).status, 0, `annex name ${evil} must fail`);
  }
  assert.equal(await readFile(planPath, "utf8"), before, "rejected annex names must not modify the ledger");

  // Path-traversal slugs must be rejected by every ledger command before any
  // filesystem resolution — an escaped slug could write outside active/.
  const outside = path.join(root, "harness", "victim.md");
  await writeFile(outside, "# victim\n\n## Implementation Steps\n");
  for (const evilSlug of ["../victim", "a/b", "..", "-dash-start", "UPPER"]) {
    assert.notEqual(runHarness(root, ["ledger", "new", evilSlug]).status, 0, `ledger new ${evilSlug} must fail`);
    assert.notEqual(runHarness(root, ["ledger", "annex", evilSlug, "observability"]).status, 0, `ledger annex ${evilSlug} must fail`);
    assert.notEqual(runHarness(root, ["ledger", "step", evilSlug, "x"]).status, 0, `ledger step ${evilSlug} must fail`);
    assert.notEqual(runHarness(root, ["ledger", "close", evilSlug]).status, 0, `ledger close ${evilSlug} must fail`);
  }
  assert.equal(await readFile(outside, "utf8"), "# victim\n\n## Implementation Steps\n", "traversal slug must not touch files outside active/");

  assert.equal(runHarness(root, ["ledger", "step", "diet-smoke", "x — governing: y"]).status, 0);
  assert.match(await readFile(planPath, "utf8"), /^- Current step: x — governing: y$/m);

  // Telemetry shape contract: lifecycle identifiers and state enums only —
  // never prose (step text, field content).
  const telemetry = (await readFile(path.join(root, "harness", "artifacts", "telemetry", "ledger-usage.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const stepRecord = telemetry.find((r) => r.event === "step");
  assert.deepEqual(Object.keys(stepRecord).sort(), ["at", "event", "slug"], "step telemetry must carry no prose");
  const annexRecord = telemetry.find((r) => r.event === "annex");
  assert.deepEqual(Object.keys(annexRecord).sort(), ["annex", "at", "event", "slug"]);

  // The fully annexed ACTIVE draft must be scaffold-valid under every
  // plan-parsing validator — annex prefills may not create instant debt.
  for (const validator of ["validate-exec-plans.mjs", "validate-cross-agent-review.mjs", "validate-sub-agent-ledger.mjs"]) {
    const output = runValidator(root, validator).stdout;
    assert.ok(!output.includes("diet-smoke"), `${validator} must accept the fully annexed active draft: ${output}`);
  }
});

test("validate-exec-plans bites: fresh scaffold clean, missing core evidence fails", async (t) => {
  const root = await buildScratchTarget();
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  // Positive control: a fresh scaffold carries no exec-plans failures.
  await scaffoldActivePlan(root, "clean-draft");
  let output = runValidator(root, "validate-exec-plans.mjs").stdout;
  assert.ok(!output.includes("clean-draft"), `fresh scaffold must not fail exec-plans checks: ${output}`);

  // Negative: an active plan whose dual-role critic field is gutted must fail.
  const planPath = path.join(root, "harness", "exec-plans", "active", "clean-draft.md");
  const gutted = (await readFile(planPath, "utf8")).replace(
    /^- Critic findings \(accepted \/ rejected-with-rationale \/ blocking\): pending$/m,
    "- Critic findings (accepted / rejected-with-rationale / blocking):",
  );
  await writeFile(planPath, gutted);
  output = runValidator(root, "validate-exec-plans.mjs").stdout;
  assert.ok(
    output.includes("missing meaningful Dual-Role Governance field: Critic findings"),
    `gutted critic field must fail: ${output}`,
  );

  // Negative: a completed plan without Completion Evidence must fail.
  const completed = (await readFile(planPath, "utf8"))
    .replace("## State\n- `active`", "## State\n- `completed`")
    .replace(/## Completion Evidence[\s\S]*?(?=\nConditional annexes)/, "");
  await writeFile(path.join(root, "harness", "exec-plans", "completed", "done-plan.md"), completed);
  await rm(planPath);
  output = runValidator(root, "validate-exec-plans.mjs").stdout;
  assert.ok(
    output.includes("done-plan.md completed plan missing Completion Evidence section"),
    `missing completion evidence must fail: ${output}`,
  );
});

test("validate-exec-plans bites: completed plan cannot keep `pending` dual-role evidence", async (t) => {
  const root = await buildScratchTarget();
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const planPath = await scaffoldActivePlan(root, "still-pending");
  const completed = (await readFile(planPath, "utf8"))
    .replace("## State\n- `active`", "## State\n- `completed`")
    .replace("- Terminal status: `pending`", "- Terminal status: `cross-agent-complete`");
  await writeFile(path.join(root, "harness", "exec-plans", "completed", "still-pending.md"), completed);
  await rm(planPath);

  const output = runValidator(root, "validate-exec-plans.mjs").stdout;
  for (const field of ["Critic findings", "No-pushback terminal evidence", "Unresolved critic pushback"]) {
    assert.ok(
      output.includes(`still-pending.md missing meaningful Dual-Role Governance field: ${field}`),
      `completed plan keeping pending ${field} must fail: ${output}`,
    );
  }
});

test("validate-cross-agent-review bites: triggered-but-absent Critique And Debate annex fails", async (t) => {
  const root = await buildScratchTarget();
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const planPath = await scaffoldActivePlan(root, "hot-plan");
  const scaffold = await readFile(planPath, "utf8");

  // Negative: highRisk=true without the critique annex must fail.
  await writeFile(planPath, scaffold.replace('"highRisk": false', '"highRisk": true').replace('"required": false', '"required": true'));
  let output = runValidator(root, "validate-cross-agent-review.mjs").stdout;
  assert.ok(
    output.includes("hot-plan.md has a triggered Critique And Debate annex"),
    `high-risk plan without critique annex must fail: ${output}`,
  );

  // Negative: framework-change (governed affected path) with highRisk=false must also fail.
  await writeFile(
    planPath,
    scaffold
      .replace('"required": false', '"required": true')
      .replace("## Affected Paths\n- n/a", "## Affected Paths\n- harness/framework/process/review.md"),
  );
  output = runValidator(root, "validate-cross-agent-review.mjs").stdout;
  assert.ok(
    output.includes("hot-plan.md has a triggered Critique And Debate annex"),
    `framework-change plan without critique annex must fail: ${output}`,
  );

  // Negative: declared triggerSignals (e.g. security/runtime) with highRisk
  // false and non-governed paths must still require the annex.
  await writeFile(
    planPath,
    scaffold
      .replace('"required": false', '"required": true')
      .replace('"triggerSignals": []', '"triggerSignals": ["security-review"]')
      .replace("## Affected Paths\n- n/a", "## Affected Paths\n- src/app.py"),
  );
  output = runValidator(root, "validate-cross-agent-review.mjs").stdout;
  assert.ok(
    output.includes("hot-plan.md has a triggered Critique And Debate annex"),
    `triggerSignals-declared plan without critique annex must fail: ${output}`,
  );

  // Positive control: appending the annex clears that failure.
  assert.equal(runHarness(root, ["ledger", "annex", "hot-plan", "critique-and-debate"]).status, 0);
  output = runValidator(root, "validate-cross-agent-review.mjs").stdout;
  assert.ok(
    !output.includes("hot-plan.md has a triggered Critique And Debate annex"),
    `annexed plan must clear the triggered-annex failure: ${output}`,
  );
});

test("validate-cross-agent-review bites: renamed report label cannot dodge transport-degradation pricing", async (t) => {
  const root = await buildScratchTarget();
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const planPath = await scaffoldActivePlan(root, "priced-plan");
  let plan = (await readFile(planPath, "utf8"))
    .replace('"required": false', '"required": true')
    .replace('"highRisk": false', '"highRisk": true')
    .replace(
      "- Agent review packet and report:",
      "- Agent review packet and report: harness/artifacts/cross-agent-review/ghost-report.json",
    );
  // Completed location exercises the degradation check; move the plan there.
  plan = plan.replace("## State\n- `active`", "## State\n- `completed`");
  await writeFile(path.join(root, "harness", "exec-plans", "completed", "priced-plan.md"), plan);
  await rm(planPath);

  const output = runValidator(root, "validate-cross-agent-review.mjs").stdout;
  assert.ok(
    output.includes("priced-plan.md cites a review report that does not exist and carries no Transport degradation acceptance line"),
    `missing report on the merged label must trip the pricing gate: ${output}`,
  );
});

test("validate-cross-agent-review: packet .md on the merged label is never parsed as a JSON report", async (t) => {
  const root = await buildScratchTarget();
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const planPath = await scaffoldActivePlan(root, "traced-plan");
  await mkdir(path.join(root, "harness", "artifacts", "cross-agent-review"), { recursive: true });
  await writeFile(
    path.join(root, "harness", "artifacts", "cross-agent-review", "traced-plan-packet.md"),
    "# Cross-Agent Review Packet\nnot json on purpose\n",
  );
  let plan = (await readFile(planPath, "utf8"))
    .replace('"required": false', '"required": true')
    .replace('"highRisk": false', '"highRisk": true')
    .replace(
      "- Agent review packet and report:",
      "- Agent review packet and report: harness/artifacts/cross-agent-review/traced-plan-packet.md",
    )
    .replace("- Transport degradation acceptance:", "- Transport degradation acceptance: n/a — packet-file rung completed.")
    .replace("## State\n- `active`", "## State\n- `completed`");
  await writeFile(path.join(root, "harness", "exec-plans", "completed", "traced-plan.md"), plan);
  await rm(planPath);

  const output = runValidator(root, "validate-cross-agent-review.mjs").stdout;
  assert.ok(
    !output.includes("traced-plan.md cites a review report that is not valid JSON"),
    `packet .md on the merged label must not be parsed as a report: ${output}`,
  );
});

test("validate-cross-agent-review bites: completed triggered critique annex with empty fields fails", async (t) => {
  const root = await buildScratchTarget();
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const planPath = await scaffoldActivePlan(root, "hollow-plan");
  assert.equal(runHarness(root, ["ledger", "annex", "hollow-plan", "critique-and-debate"]).status, 0);
  let plan = (await readFile(planPath, "utf8"))
    .replace('"required": false', '"required": true')
    .replace('"highRisk": false', '"highRisk": true')
    .replace("## State\n- `active`", "## State\n- `completed`");
  await writeFile(path.join(root, "harness", "exec-plans", "completed", "hollow-plan.md"), plan);
  await rm(planPath);

  const output = runValidator(root, "validate-cross-agent-review.mjs").stdout;
  for (const label of ["Critic findings", "Resolutions", "Final synthesis"]) {
    assert.ok(
      output.includes(`hollow-plan.md triggered Critique And Debate annex missing meaningful ${label}`),
      `empty triggered critique field ${label} must fail on completed plans: ${output}`,
    );
  }

  // `pending` placeholders are just as hollow as blanks on completed plans —
  // both validators must reject them.
  const completedPath = path.join(root, "harness", "exec-plans", "completed", "hollow-plan.md");
  let pendingPlan = await readFile(completedPath, "utf8");
  for (const label of ["Proposer summary", "Critic findings", "Resolutions", "Final synthesis"]) {
    pendingPlan = pendingPlan.replace(`- ${label}:`, `- ${label}: pending`);
  }
  await writeFile(completedPath, pendingPlan);
  const crossOutput = runValidator(root, "validate-cross-agent-review.mjs").stdout;
  const subOutput = runValidator(root, "validate-sub-agent-ledger.mjs").stdout;
  for (const label of ["Critic findings", "Resolutions", "Final synthesis"]) {
    assert.ok(
      crossOutput.includes(`hollow-plan.md triggered Critique And Debate annex missing meaningful ${label}`),
      `pending critique field ${label} must fail cross-agent validation: ${crossOutput}`,
    );
    assert.ok(
      subOutput.includes(`hollow-plan.md high-risk plan missing ${label}`),
      `pending critique field ${label} must fail sub-agent validation: ${subOutput}`,
    );
  }
});

test("core template preserves the load-bearing literals the tooling parses", async () => {
  const template = await readFile(TEMPLATE_PATH, "utf8");
  for (const literal of [
    "## State\n- `draft`",
    "## Affected Paths\n- n/a",
    "## Current Step",
    "- Current step: ",
    "## Implementation Steps",
    "## Cross-Agent Review",
    "```cross-agent-review-json",
  ]) {
    assert.ok(template.includes(literal), `core template must preserve literal: ${JSON.stringify(literal)}`);
  }
});
