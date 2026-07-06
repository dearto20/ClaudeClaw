// Enforcement coverage contract: the mechanisms added by the
// enforcement-coverage-tightening plan must provably reject the negative
// space — stripped runtime wiring, stale skill adapters, uncovered commits,
// laundered upgrade-adoption shapes, silent enforcement-map gaps — and accept
// the compliant shapes. Deterministic, no network.

import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";
import {
  HOOK_EVENTS,
  mergeHarnessRuntimeSettings,
  runtimeSettingsFailures,
} from "../../scripts/runtime-hooks/settings-template.mjs";
import { enforcementMapFailures } from "../../scripts/validate-enforcement-map.mjs";
import { buildSkillOutputs } from "../../scripts/generate-skills.mjs";
import { skillsDriftFailures } from "../../scripts/validate-skills-drift.mjs";
import { familyRuntimeEnforcementFailures, recordIterationCapFailures } from "../../scripts/dual-role-governance-rules.mjs";
import { loadLegacyPlanAcceptance } from "../../scripts/validation-helpers.mjs";

const run = (cwd, command, args, opts = {}) =>
  spawnSync(command, args, { cwd, encoding: "utf8", ...opts });

// --- settings merge: additive-only, idempotent, target keys survive ---------

test("settings merge wires a fresh install and is idempotent", () => {
  const fresh = mergeHarnessRuntimeSettings(null);
  assert.equal(fresh.changed, true);
  assert.equal(runtimeSettingsFailures(fresh.settings).length, 0, "fresh merge must satisfy the wiring gate");
  const again = mergeHarnessRuntimeSettings(fresh.settings);
  assert.equal(again.changed, false, "second merge must be a no-op");
});

test("settings merge preserves target-owned keys and appends alongside foreign hooks", () => {
  const targetOwned = {
    statusLine: { type: "command", command: "./my-own-statusline.sh" },
    permissions: { allow: ["Bash(ls:*)"] },
    hooks: { Stop: [{ hooks: [{ type: "command", command: "./target-stop-hook.sh" }] }] },
  };
  const { settings, changed } = mergeHarnessRuntimeSettings(targetOwned);
  assert.equal(changed, true);
  assert.equal(settings.statusLine.command, "./my-own-statusline.sh", "target statusLine must not be overwritten");
  assert.deepEqual(settings.permissions, targetOwned.permissions, "unrelated keys must survive untouched");
  assert.equal(settings.hooks.Stop.length, 2, "harness Stop hook appends after the target's own");
  assert.equal(settings.hooks.Stop[0].hooks[0].command, "./target-stop-hook.sh");
  // Merged result fails the statusline wiring gate honestly — the target chose
  // its own statusline; the gate surfaces that as a finding, never silently.
  const failures = runtimeSettingsFailures(settings);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /statusLine/);
});

test("settings merge never clobbers malformed per-event hook values", () => {
  const targetOwned = {
    hooks: { Stop: "not-an-array", SessionStart: { broken: true } },
  };
  const { settings } = mergeHarnessRuntimeSettings(targetOwned);
  assert.equal(settings.hooks.Stop, "not-an-array", "malformed Stop value must be preserved verbatim");
  assert.deepEqual(settings.hooks.SessionStart, { broken: true }, "malformed SessionStart value must be preserved verbatim");
  assert.equal(Array.isArray(settings.hooks.UserPromptSubmit), true, "well-formed events still gain the harness hook");
  // The gate surfaces the malformed events instead of the merge hiding them.
  const failures = runtimeSettingsFailures(settings);
  assert.equal(failures.some((f) => f.includes("Stop")), true);
  assert.equal(failures.some((f) => f.includes("SessionStart")), true);
});

test("stripping a hook from settings is detected by the wiring gate", () => {
  const { settings } = mergeHarnessRuntimeSettings(null);
  delete settings.hooks.UserPromptSubmit;
  const failures = runtimeSettingsFailures(settings);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /UserPromptSubmit/);
});

// --- stop hook: first-text check, loop guard, fail-open ---------------------

const scaffoldStopHook = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "harness-stophook-"));
  const hookDir = path.join(root, "harness", "scripts", "runtime-hooks");
  await mkdir(hookDir, { recursive: true });
  await cp(getRepoPath("scripts", "runtime-hooks", "stop-tier-line-check.mjs"), path.join(hookDir, "stop-tier-line-check.mjs"));
  return { root, hookPath: path.join(hookDir, "stop-tier-line-check.mjs") };
};

const transcriptLine = (entry) => `${JSON.stringify(entry)}\n`;
const userText = (text) => ({ type: "user", message: { role: "user", content: [{ type: "text", text }] } });
const userToolResult = () => ({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: "ok" }] } });
const assistantText = (text) => ({ type: "assistant", message: { content: [{ type: "text", text }] } });

const runStopHook = (root, hookPath, input) =>
  run(root, "node", [hookPath], { input: JSON.stringify(input) });

test("stop hook blocks a turn whose first text lacks the tier line and records telemetry", async (t) => {
  const { root, hookPath } = await scaffoldStopHook();
  t.after(() => rm(root, { recursive: true, force: true }));
  const transcriptPath = path.join(root, "transcript.jsonl");
  await writeFile(
    transcriptPath,
    transcriptLine(userText("please do the thing")) +
      transcriptLine(assistantText("Doing the thing without a tier line.")) +
      transcriptLine(userToolResult()) +
      transcriptLine(assistantText("[harness] late line does not rescue the turn")),
  );
  const result = runStopHook(root, hookPath, { transcript_path: transcriptPath, stop_hook_active: false });
  assert.equal(result.status, 0);
  const decision = JSON.parse(result.stdout);
  assert.equal(decision.decision, "block");
  assert.match(decision.reason, /\[harness\] tier:/);
  const telemetry = await readFile(path.join(root, "harness", "artifacts", "telemetry", "visibility-compliance.jsonl"), "utf8");
  assert.match(telemetry, /"compliant":false/);
});

test("stop hook requires the full tier-line shape, not just the prefix", async (t) => {
  const { root, hookPath } = await scaffoldStopHook();
  t.after(() => rm(root, { recursive: true, force: true }));
  const transcriptPath = path.join(root, "transcript.jsonl");
  const cases = [
    ["[harness] done", true],
    ["[harness] tier: bogus — made-up tier", true],
    ["[harness] tier: standard — real work", false],
    ["[harness v2.4.0] tier: high-risk — versioned prefix also valid", false],
  ];
  for (const [firstText, expectBlock] of cases) {
    await writeFile(transcriptPath, transcriptLine(userText("go")) + transcriptLine(assistantText(firstText)));
    const result = runStopHook(root, hookPath, { transcript_path: transcriptPath, stop_hook_active: false });
    assert.equal(result.status, 0);
    if (expectBlock) {
      assert.match(result.stdout, /"decision":"block"/, `must block: ${firstText}`);
    } else {
      assert.equal(result.stdout.trim(), "", `must pass: ${firstText}`);
    }
  }
});

test("stop hook passes a compliant turn and respects the loop guard", async (t) => {
  const { root, hookPath } = await scaffoldStopHook();
  t.after(() => rm(root, { recursive: true, force: true }));
  const transcriptPath = path.join(root, "transcript.jsonl");
  await writeFile(
    transcriptPath,
    transcriptLine(userText("go")) + transcriptLine(assistantText("[harness] tier: trivial — done")),
  );
  let result = runStopHook(root, hookPath, { transcript_path: transcriptPath, stop_hook_active: false });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), "", "compliant turn must not emit a decision");

  // Loop guard: when a stop-hook continuation is already active, never re-block.
  await writeFile(transcriptPath, transcriptLine(userText("go")) + transcriptLine(assistantText("no tier line")));
  result = runStopHook(root, hookPath, { transcript_path: transcriptPath, stop_hook_active: true });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), "");
});

test("stop hook fails open on malformed input and missing transcript", async (t) => {
  const { root, hookPath } = await scaffoldStopHook();
  t.after(() => rm(root, { recursive: true, force: true }));
  let result = run(root, "node", [hookPath], { input: "not json at all" });
  assert.equal(result.status, 0, "garbage stdin must never brick the session");
  result = runStopHook(root, hookPath, { transcript_path: path.join(root, "absent.jsonl"), stop_hook_active: false });
  assert.equal(result.status, 0, "missing transcript must fail open");
});

test("prompt-context hook emits the re-injection reminder with the mechanical tier", () => {
  const repoRoot = getRepoPath("..");
  const result = run(repoRoot, "node", [getRepoPath("scripts", "runtime-hooks", "prompt-context.mjs")], { input: "{}" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /harness-runtime-reminder/);
  assert.match(result.stdout, /\[harness\]/);
});

// --- skills drift ------------------------------------------------------------

const scaffoldSkillsRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "harness-skills-"));
  await mkdir(path.join(root, "harness", "framework", "skills-src"), { recursive: true });
  await writeFile(
    path.join(root, "harness", "framework", "skills-src", "demo.md"),
    "---\nname: demo\ndescription: demo skill\n---\n\nBody of the demo skill.\n",
  );
  const { outputs } = await buildSkillOutputs(root);
  for (const out of outputs) {
    const target = path.join(root, out.relPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, out.content);
  }
  return root;
};

test("skills drift gate: in-sync passes; stale, missing, and orphaned outputs fail", async (t) => {
  const root = await scaffoldSkillsRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.deepEqual(await skillsDriftFailures(root), [], "freshly generated adapters must pass");

  const generated = path.join(root, ".claude", "skills", "demo", "SKILL.md");
  await writeFile(generated, "hand-edited content\n");
  let failures = await skillsDriftFailures(root);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /stale or hand-edited/);

  await rm(generated);
  failures = await skillsDriftFailures(root);
  assert.match(failures[0], /missing generated skill output/);

  const { outputs } = await buildSkillOutputs(root);
  await writeFile(generated, outputs.find((o) => o.relPath.startsWith(".claude")).content);
  // A target-owned skill without the generated-note marker is never an orphan.
  await mkdir(path.join(root, ".codex", "skills", "target-own"), { recursive: true });
  await writeFile(path.join(root, ".codex", "skills", "target-own", "SKILL.md"), "---\nname: target-own\n---\nhand-written target skill\n");
  failures = await skillsDriftFailures(root);
  assert.deepEqual(failures, [], "target-owned skills must be preserved, not flagged");

  // A generator-marked file whose source is gone IS an orphan.
  const { GENERATED_NOTE } = await import("../../scripts/generate-skills.mjs");
  await mkdir(path.join(root, ".codex", "skills", "ghost"), { recursive: true });
  await writeFile(path.join(root, ".codex", "skills", "ghost", "SKILL.md"), `---\nname: ghost\n---\n${GENERATED_NOTE}\n\nbody\n`);
  failures = await skillsDriftFailures(root);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /orphan generated skill/);
});

// --- enforcement map rules ----------------------------------------------------

test("enforcement map rules reject silent gaps and missing refs", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "harness-map-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "real-surface.mjs"), "// exists\n");

  const goodEntry = {
    id: "sample",
    source: "harness/AGENTS.md#tiers",
    obligation: "Sample obligation.",
    surfaces: [{ kind: "gate", ref: "real-surface.mjs" }],
  };
  assert.deepEqual(
    await enforcementMapFailures({ obligations: [goodEntry] }, root, { requiredObligations: ["sample"] }),
    [],
  );

  const cases = [
    [{ ...goodEntry, surfaces: [] }, /no enforcement surface/],
    [{ ...goodEntry, surfaces: [{ kind: "gate", ref: "missing.mjs" }] }, /ref does not exist/],
    [{ ...goodEntry, surfaces: [{ kind: "prose-declared", basis: "too short" }] }, /substantive basis/],
    [{ ...goodEntry, surfaces: [{ kind: "vibes" }] }, /unknown surface kind/],
  ];
  for (const [entry, pattern] of cases) {
    const failures = await enforcementMapFailures({ obligations: [entry] }, root, { requiredObligations: ["sample"] });
    assert.equal(failures.length, 1, JSON.stringify(entry.surfaces));
    assert.match(failures[0], pattern);
  }

  const floor = await enforcementMapFailures({ obligations: [goodEntry] }, root, {
    requiredObligations: ["sample", "not-registered"],
  });
  assert.match(floor[0], /required obligation missing/);
});

test("registry runtime-enforcement rule requires booleans and a basis", () => {
  assert.match(familyRuntimeEnforcementFailures({}, "fam")[0], /missing runtimeEnforcement/);
  const bad = familyRuntimeEnforcementFailures(
    { runtimeEnforcement: { statusline: "yes", promptReinjection: true, responseCheck: true, basis: "" } },
    "fam",
  );
  assert.equal(bad.length, 2);
  assert.deepEqual(
    familyRuntimeEnforcementFailures(
      { runtimeEnforcement: { statusline: false, promptReinjection: false, responseCheck: false, basis: "No hook surface as of 2026-07-03." } },
      "fam",
    ),
    [],
  );
});

// --- commit gate: upgrade-adoption shape and the CI range floor ---------------

const scaffoldGateTarget = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "harness-gate-"));
  for (const dir of ["harness/scripts", "harness/hooks", "harness/exec-plans/templates", "harness/exec-plans/active", "harness/framework", "harness/override/governance"]) {
    await mkdir(path.join(root, dir), { recursive: true });
  }
  for (const script of ["harness.mjs", "validate-all.mjs", "ledger-rules.mjs", "upgrade-surface.mjs"]) {
    await cp(getRepoPath("scripts", script), path.join(root, "harness", "scripts", script));
  }
  await cp(getRepoPath("..", "harness", "hooks", "pre-commit"), path.join(root, "harness", "hooks", "pre-commit"));
  await cp(
    getRepoPath("exec-plans", "templates", "implementation-plan.md"),
    path.join(root, "harness", "exec-plans", "templates", "implementation-plan.md"),
  );
  run(root, "git", ["init", "--quiet"]);
  run(root, "git", ["config", "user.email", "gate@harness.test"]);
  run(root, "git", ["config", "user.name", "Gate"]);
  await writeFile(path.join(root, "README.md"), "# gate target\n");
  run(root, "git", ["add", "-A"]);
  run(root, "git", ["commit", "--quiet", "-m", "scaffold", "--no-verify"]);
  return root;
};

const cli = ["harness/scripts/harness.mjs"];

test("upgrade-adoption commit shape is accepted only when the adoption record matches the incoming version", async (t) => {
  const root = await scaffoldGateTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  // A sync ledger covering the upgrade surface (coverage is never waived).
  run(root, "node", [...cli, "ledger", "new", "harness-sync"]);
  const ledgerPath = path.join(root, "harness", "exec-plans", "active", "harness-sync.md");
  const ledgerText = await readFile(ledgerPath, "utf8");
  await writeFile(ledgerPath, ledgerText.replace("## Affected Paths\n- n/a", "## Affected Paths\n- harness/\n- CHANGELOG.md"));

  await writeFile(path.join(root, "harness", "framework", "rule.md"), "# incoming framework change\n");
  await writeFile(path.join(root, "CHANGELOG.md"), "# Changelog\n\n## [9.9.9] — 2026-07-03\n\n- upstream change\n");
  await writeFile(
    path.join(root, "harness", "override", "governance", "harness-upgrade-adoption.json"),
    `${JSON.stringify({ harnessVersion: "9.9.9", appliedAt: "2026-07-03T00:00:00.000Z", mechanism: "upgrade" }, null, 2)}\n`,
  );
  run(root, "git", ["add", "-A"]);

  let result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 0, `matching adoption record must pass without a per-target critic: ${result.stdout}${result.stderr}`);
  assert.match(result.stdout, /upgrade-adoption commit shape accepted/);

  // Version mismatch: the adoption record no longer matches the incoming
  // CHANGELOG — the shape is rejected and critic evidence is required again.
  await writeFile(
    path.join(root, "harness", "override", "governance", "harness-upgrade-adoption.json"),
    `${JSON.stringify({ harnessVersion: "1.0.0", appliedAt: "2026-07-03T00:00:00.000Z", mechanism: "upgrade" }, null, 2)}\n`,
  );
  run(root, "git", ["add", "-A"]);
  result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 1, "mismatched adoption record must not launder a high-risk commit");
  assert.match(`${result.stdout}${result.stderr}`, /critic terminal evidence/);

  // Piggyback attempt: restore the matching adoption record but also change a
  // target-adapted root doc the upgrade tool never writes — the waiver must
  // not apply.
  await writeFile(
    path.join(root, "harness", "override", "governance", "harness-upgrade-adoption.json"),
    `${JSON.stringify({ harnessVersion: "9.9.9", appliedAt: "2026-07-03T00:00:00.000Z", mechanism: "upgrade" }, null, 2)}\n`,
  );
  await writeFile(path.join(root, "README.md"), "# tampered alongside adoption\n");
  run(root, "git", ["add", "-A"]);
  result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 1, "README piggyback must void the adoption waiver");
});

test("range mode re-runs the same gate on a pushed diff — the CI floor behind bypassed hooks", async (t) => {
  const root = await scaffoldGateTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  // Bypass local hooks entirely (--no-verify): a high-risk change with no
  // ledger coverage lands locally…
  await writeFile(path.join(root, "harness", "framework", "rule.md"), "# governed, uncovered\n");
  run(root, "git", ["add", "-A"]);
  run(root, "git", ["commit", "--quiet", "-m", "bypassed", "--no-verify"]);

  // …and the range gate rejects exactly that diff.
  let result = run(root, "node", [...cli, "precommit", "--range", "HEAD~1...HEAD"]);
  assert.equal(result.status, 1, "range gate must reject the bypassed commit");
  assert.match(`${result.stdout}${result.stderr}`, /uncovered/);

  // A worktree-only ledger is NOT evidence in range mode — what is pushed is
  // what is judged.
  run(root, "node", [...cli, "ledger", "new", "covering"]);
  const ledgerPath = path.join(root, "harness", "exec-plans", "active", "covering.md");
  let text = await readFile(ledgerPath, "utf8");
  text = text.replace("## Affected Paths\n- n/a", "## Affected Paths\n- harness/framework/");
  text = text.replace('"records": []', '"records": [{ "reviewId": "gate-evidence", "status": "complete" }]');
  await writeFile(ledgerPath, text);
  result = run(root, "node", [...cli, "precommit", "--range", "HEAD~1...HEAD"]);
  assert.equal(result.status, 1, "uncommitted ledger must not satisfy the range gate");

  // Once the ledger is actually part of the pushed history, the range passes.
  run(root, "git", ["add", "-A"]);
  run(root, "git", ["commit", "--quiet", "-m", "ledger", "--no-verify"]);
  result = run(root, "node", [...cli, "precommit", "--range", "HEAD~2...HEAD"]);
  assert.equal(result.status, 0, `committed coverage must pass: ${result.stdout}${result.stderr}`);
});

test("unstaged ledger edits are not gate evidence in staged mode", async (t) => {
  const root = await scaffoldGateTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  // Commit a template ledger (declares nothing) so it exists at HEAD.
  run(root, "node", [...cli, "ledger", "new", "sneaky"]);
  run(root, "git", ["add", "-A"]);
  run(root, "git", ["commit", "--quiet", "-m", "ledger scaffold", "--no-verify"]);

  // Stage a high-risk change, then edit the ledger in the worktree only:
  // coverage and a terminal critic status that the commit would not contain.
  await writeFile(path.join(root, "harness", "framework", "rule.md"), "# governed\n");
  run(root, "git", ["add", "harness/framework/rule.md"]);
  const ledgerPath = path.join(root, "harness", "exec-plans", "active", "sneaky.md");
  let text = await readFile(ledgerPath, "utf8");
  text = text.replace("## Affected Paths\n- n/a", "## Affected Paths\n- harness/framework/");
  text = text.replace('"records": []', '"records": [{ "reviewId": "gate-evidence", "status": "complete" }]');
  await writeFile(ledgerPath, text);

  let result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 1, "unstaged ledger edits must not satisfy the gate");
  assert.match(
    `${result.stdout}${result.stderr}`,
    /identical in the index and the worktree/,
    "index/worktree divergence is rejected by name",
  );

  // Staging the ledger makes the same evidence real.
  run(root, "git", ["add", ledgerPath]);
  result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 0, `staged ledger evidence must pass: ${result.stdout}${result.stderr}`);
});

test("self-attested plain-text terminal status is not critic evidence", async (t) => {
  const root = await scaffoldGateTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  run(root, "node", [...cli, "ledger", "new", "self-attested"]);
  const ledgerPath = path.join(root, "harness", "exec-plans", "active", "self-attested.md");
  let text = await readFile(ledgerPath, "utf8");
  text = text.replace("## Affected Paths\n- n/a", "## Affected Paths\n- harness/framework/");
  // The drive-by edit: a plain-text terminal line with NO structured record.
  text = text.replace(/^- Terminal status: .+$/m, "- Terminal status: `cross-agent-complete`");
  await writeFile(ledgerPath, text);
  await writeFile(path.join(root, "harness", "framework", "rule.md"), "# governed\n");
  run(root, "git", ["add", "-A"]);

  let result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 1, "plain-text terminal status must not satisfy the high-risk gate");
  assert.match(`${result.stdout}${result.stderr}`, /critic terminal evidence/);

  // The structured record inside the review fence is the evidence shape.
  text = text.replace('"records": []', '"records": [{ "reviewId": "gate-evidence", "status": "complete" }]');
  await writeFile(ledgerPath, text);
  run(root, "git", ["add", "-A"]);
  result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 0, `structured terminal record must pass: ${result.stdout}${result.stderr}`);
});

test("review report files are never commit-gate evidence — only tree-visible terminal records", async (t) => {
  const root = await scaffoldGateTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  run(root, "node", [...cli, "ledger", "new", "cover"]);
  const ledgerPath = path.join(root, "harness", "exec-plans", "active", "cover.md");
  let text = await readFile(ledgerPath, "utf8");
  text = text.replace("## Affected Paths\n- n/a", "## Affected Paths\n- harness/framework/");
  await writeFile(ledgerPath, text);
  await writeFile(path.join(root, "harness", "framework", "rule.md"), "# governed\n");

  // A pushback-free report on disk — untracked, gitignored in real repos —
  // must not satisfy the gate: the commit will not contain it.
  const reviewDir = path.join(root, "harness", "artifacts", "cross-agent-review");
  await mkdir(reviewDir, { recursive: true });
  const report = JSON.stringify({ status: "complete", pushbackFree: true });
  await writeFile(path.join(reviewDir, "cover-r1-report.json"), report);
  run(root, "git", ["add", "harness/framework/rule.md", ledgerPath]);
  let result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 1, "worktree report file must not satisfy the high-risk gate");
  assert.match(`${result.stdout}${result.stderr}`, /lacking evidenced coverage/);

  // Even STAGING the report changes nothing — evidence is the ledger's fence
  // terminal record, in the index.
  run(root, "git", ["add", "-A"]);
  result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 1, "staged report file is still not fence-record evidence");

  text = text.replace('"records": []', '"records": [{ "reviewId": "gate-evidence", "status": "complete" }]');
  await writeFile(ledgerPath, text);
  run(root, "git", ["add", ledgerPath]);
  result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 0, `staged fence terminal record must pass: ${result.stdout}${result.stderr}`);
});

test("wiring gate rejects lookalike and non-executing command spoofs", () => {
  const { settings } = mergeHarnessRuntimeSettings(null);
  const spoofs = [
    "echo 'node harness/scripts/runtime-hooks/prompt-context.mjs'",
    "node harness/scripts/runtime-hooks/prompt-context.mjs && rm -rf /tmp/x",
    "true || node harness/scripts/runtime-hooks/prompt-context.mjs",
  ];
  for (const spoof of spoofs) {
    const spoofed = JSON.parse(JSON.stringify(settings));
    spoofed.hooks.UserPromptSubmit = [{ hooks: [{ type: "command", command: spoof }] }];
    const failures = runtimeSettingsFailures(spoofed);
    assert.equal(failures.length, 1, `spoof must fail wiring: ${spoof}`);
    assert.match(failures[0], /UserPromptSubmit/);
  }
  const wrappedStatus = JSON.parse(JSON.stringify(settings));
  wrappedStatus.statusLine.command = "node harness/scripts/harness.mjs status --line | tee /tmp/out";
  assert.match(runtimeSettingsFailures(wrappedStatus)[0], /statusLine/);

  // Exact command but a non-executing type must fail — the shape only runs
  // when type is "command".
  const wrongType = JSON.parse(JSON.stringify(settings));
  wrongType.statusLine.type = "text";
  assert.match(runtimeSettingsFailures(wrongType)[0], /statusLine/, "wrong statusLine.type must fail");
  const missingType = JSON.parse(JSON.stringify(settings));
  delete missingType.statusLine.type;
  assert.match(runtimeSettingsFailures(missingType)[0], /statusLine/, "missing statusLine.type must fail");
});

test("a commit cannot ride evidence from a ledger it deletes", async (t) => {
  const root = await scaffoldGateTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  // A covering, terminally-reviewed ledger lands at HEAD.
  run(root, "node", [...cli, "ledger", "new", "doomed"]);
  const ledgerPath = path.join(root, "harness", "exec-plans", "active", "doomed.md");
  let text = await readFile(ledgerPath, "utf8");
  text = text.replace("## Affected Paths\n- n/a", "## Affected Paths\n- harness/framework/");
  text = text.replace('"records": []', '"records": [{ "reviewId": "gate-evidence", "status": "complete" }]');
  await writeFile(ledgerPath, text);
  run(root, "git", ["add", "-A"]);
  run(root, "git", ["commit", "--quiet", "-m", "ledger", "--no-verify"]);

  // Stage a high-risk change AND the deletion of that ledger: the HEAD copy
  // must not count — the commit would not contain it.
  await writeFile(path.join(root, "harness", "framework", "rule.md"), "# governed\n");
  run(root, "git", ["rm", "--quiet", "harness/exec-plans/active/doomed.md"]);
  run(root, "git", ["add", "harness/framework/rule.md"]);
  const result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 1, "deleted ledger must not provide gate evidence");
  assert.match(`${result.stdout}${result.stderr}`, /uncovered|critic terminal evidence/);
});

test("high-risk paths cannot borrow critic evidence from an unrelated ledger", async (t) => {
  const root = await scaffoldGateTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  // Ledger A covers the high-risk path but has no critic evidence.
  run(root, "node", [...cli, "ledger", "new", "covering-no-evidence"]);
  const aPath = path.join(root, "harness", "exec-plans", "active", "covering-no-evidence.md");
  let a = await readFile(aPath, "utf8");
  a = a.replace("## Affected Paths\n- n/a", "## Affected Paths\n- harness/framework/");
  await writeFile(aPath, a);

  // Ledger B has terminal evidence but covers something unrelated.
  run(root, "node", [...cli, "ledger", "new", "evidenced-unrelated"]);
  const bPath = path.join(root, "harness", "exec-plans", "active", "evidenced-unrelated.md");
  let b = await readFile(bPath, "utf8");
  b = b.replace("## Affected Paths\n- n/a", "## Affected Paths\n- src/");
  b = b.replace('"records": []', '"records": [{ "reviewId": "gate-evidence", "status": "complete" }]');
  await writeFile(bPath, b);

  await writeFile(path.join(root, "harness", "framework", "rule.md"), "# governed\n");
  run(root, "git", ["add", "-A"]);
  let result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 1, "evidence on an unrelated ledger must not satisfy the covering ledger's paths");
  assert.match(`${result.stdout}${result.stderr}`, /lacking evidenced coverage/);

  // Evidence on the covering ledger satisfies the gate.
  a = a.replace('"records": []', '"records": [{ "reviewId": "gate-evidence", "status": "complete" }]');
  await writeFile(aPath, a);
  run(root, "git", ["add", "-A"]);
  result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 0, `evidenced covering ledger must pass: ${result.stdout}${result.stderr}`);
});

test("runtime-adapter and version surfaces compute high-risk", async (t) => {
  const root = await scaffoldGateTarget();
  t.after(() => rm(root, { recursive: true, force: true }));
  const cases = [".claude/settings.json", ".codex/skills/demo/SKILL.md", "CHANGELOG.md", "development/distribution-manifest.json"];
  for (const rel of cases) {
    await mkdir(path.join(root, path.dirname(rel)), { recursive: true });
    await writeFile(path.join(root, rel), "{}\n");
    run(root, "git", ["add", rel]);
    const result = run(root, "node", [...cli, "tier"]);
    // tier reads the working tree; staged-only is fine for status porcelain
    assert.match(result.stdout, /tier: high-risk/, `${rel} must compute high-risk`);
    run(root, "git", ["rm", "--cached", "--quiet", rel]);
    await rm(path.join(root, rel), { force: true });
  }
});

test("a staged minimal record cannot ride a diverging worktree ledger", async (t) => {
  const root = await scaffoldGateTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  run(root, "node", [...cli, "ledger", "new", "split-truth"]);
  const ledgerPath = path.join(root, "harness", "exec-plans", "active", "split-truth.md");
  let text = await readFile(ledgerPath, "utf8");
  text = text.replace("## Affected Paths\n- n/a", "## Affected Paths\n- harness/framework/");
  text = text.replace('"records": []', '"records": [{ "reviewId": "gate-evidence", "status": "complete" }]');
  await writeFile(ledgerPath, text);
  await writeFile(path.join(root, "harness", "framework", "rule.md"), "# governed\n");
  run(root, "git", ["add", "-A"]);

  // Index and worktree agree: gate passes.
  let result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 0, `consistent ledger must pass: ${result.stdout}${result.stderr}`);

  // Now the worktree copy diverges (the "valid" version validate-all would
  // see) while the index keeps the staged record: the gate must reject.
  await writeFile(ledgerPath, `${text}\n- Post-stage edit the commit will not contain.\n`);
  result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 1, "diverging index/worktree ledger must be rejected");
  assert.match(`${result.stdout}${result.stderr}`, /identical in the index and the worktree/);
});

test("affected-paths parsing tolerates backtick-wrapped entries", async () => {
  const { affectedPathsFromPlan } = await import("../../scripts/ledger-rules.mjs");
  const plan = "## Affected Paths\n- `harness/framework/process/x.md`\n- harness/scripts/\n- `n/a`\n\n## Next";
  assert.deepEqual(affectedPathsFromPlan(plan), ["harness/framework/process/x.md", "harness/scripts/"]);
});

test("ci diff base fails closed except the single-commit genesis exception", async (t) => {
  const root = await scaffoldGateTarget();
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(getRepoPath("scripts", "ci-diff-base.mjs"), path.join(root, "harness", "scripts", "ci-diff-base.mjs"));
  const script = ["harness/scripts/ci-diff-base.mjs"];

  // Usable base: resolves and prints it.
  const head = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();
  let result = run(root, "node", [...script, "push", head]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), head);

  // Multi-commit history with an unusable base must fail closed — a forced
  // multi-commit replacement must never be gated by its tip alone.
  await writeFile(path.join(root, "extra.txt"), "x\n");
  run(root, "git", ["add", "-A"]);
  run(root, "git", ["commit", "--quiet", "-m", "second", "--no-verify"]);
  result = run(root, "node", [...script, "push", "0000000000000000000000000000000000000000"]);
  assert.equal(result.status, 1, "unusable base on multi-commit history must fail closed");
  result = run(root, "node", [...script, "pull_request", "deadbeef"]);
  assert.equal(result.status, 1, "unfetchable PR base must fail closed");
});

test("ci diff base grants only the genesis exception", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "harness-genesis-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "harness", "scripts"), { recursive: true });
  await cp(getRepoPath("scripts", "ci-diff-base.mjs"), path.join(root, "harness", "scripts", "ci-diff-base.mjs"));
  run(root, "git", ["init", "--quiet"]);
  run(root, "git", ["config", "user.email", "g@t"]);
  run(root, "git", ["config", "user.name", "g"]);
  await writeFile(path.join(root, "README.md"), "# genesis\n");
  run(root, "git", ["add", "-A"]);
  run(root, "git", ["commit", "--quiet", "-m", "genesis", "--no-verify"]);
  const result = run(root, "node", ["harness/scripts/ci-diff-base.mjs", "push", ""]);
  assert.equal(result.status, 2, "single parentless commit is the bounded exception");
});

test("iteration cap binds primary records but not superseding verification records", () => {
  const iters = (n) => Array.from({ length: n }, (_, i) => ({ iterationNumber: i + 1 }));
  // Primary (non-superseding) record beyond the cap fails.
  let failures = recordIterationCapFailures({ status: "non-terminal", iterations: iters(7) }, 5, "r");
  assert.match(failures[0], /exceeds maxReviewIterations/);
  failures = recordIterationCapFailures({ status: "complete", iterations: iters(6) }, 5, "r");
  assert.equal(failures.length, 2, "complete beyond cap fails both rules");
  // A superseding verification record may honestly enumerate more rounds.
  failures = recordIterationCapFailures(
    { status: "complete", iterations: iters(8), supersedesReviewId: "r1" }, 5, "r",
  );
  assert.deepEqual(failures, []);
  // But it still needs at least one iteration.
  failures = recordIterationCapFailures({ status: "complete", iterations: [], supersedesReviewId: "r1" }, 5, "r");
  assert.match(failures[0], /one to 5 iterations/);
});

test("source-mode legacy acceptance uses the development prefix and path", async (t) => {
  const { realpath } = await import("node:fs/promises");
  // realpath: macOS tmpdir is a symlink (/var → /private/var) and the git
  // toplevel comparison inside the loader needs canonical paths.
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "harness-srcacc-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  run(root, "git", ["init", "--quiet"]);
  run(root, "git", ["config", "user.email", "a@t"]);
  run(root, "git", ["config", "user.name", "a"]);
  await mkdir(path.join(root, "development", "exec-plans", "completed"), { recursive: true });
  await mkdir(path.join(root, "development", "governance"), { recursive: true });
  await writeFile(path.join(root, "development", "exec-plans", "completed", "old-plan.md"), "# old\n");
  run(root, "git", ["add", "-A"]);
  run(root, "git", ["commit", "--quiet", "-m", "base", "--no-verify"]);
  const base = run(root, "git", ["rev-parse", "HEAD"]).stdout.trim();
  await writeFile(
    path.join(root, "development", "governance", "legacy-plan-acceptance.json"),
    JSON.stringify({
      rationale: "pre-scan-extension source history, never rewritten",
      acceptedBy: "primary-performer",
      acceptedDate: "2026-07-03",
      upgradeBaseCommit: base,
      plans: ["development/exec-plans/completed/old-plan.md"],
    }),
  );
  const ok = await loadLegacyPlanAcceptance({
    root,
    acceptancePath: "development/governance/legacy-plan-acceptance.json",
    planPrefix: "development/exec-plans/completed/",
  });
  assert.deepEqual(ok.failures, []);
  assert.equal(ok.plans.has("development/exec-plans/completed/old-plan.md"), true);

  // A plan outside the source prefix is rejected — target-form paths cannot
  // launder into the source acceptance file.
  await writeFile(
    path.join(root, "development", "governance", "legacy-plan-acceptance.json"),
    JSON.stringify({
      rationale: "pre-scan-extension source history, never rewritten",
      acceptedBy: "primary-performer",
      acceptedDate: "2026-07-03",
      upgradeBaseCommit: base,
      plans: ["exec-plans/completed/old-plan.md"],
    }),
  );
  const bad = await loadLegacyPlanAcceptance({
    root,
    acceptancePath: "development/governance/legacy-plan-acceptance.json",
    planPrefix: "development/exec-plans/completed/",
  });
  assert.match(bad.failures[0], /may only list development\/exec-plans\/completed\//);
});

test("an out-of-section terminal fence cannot forge commit-gate evidence", async (t) => {
  const root = await scaffoldGateTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  run(root, "node", [...cli, "ledger", "new", "forged"]);
  const ledgerPath = path.join(root, "harness", "exec-plans", "active", "forged.md");
  let text = await readFile(ledgerPath, "utf8");
  text = text.replace("## Affected Paths\n- n/a", "## Affected Paths\n- harness/framework/");
  // Forgery: a minimal terminal fence PREPENDED outside the Cross-Agent Review
  // section, while the real section payload stays non-terminal.
  text = '```cross-agent-review-json\n{ "records": [{ "reviewId": "forged", "status": "complete" }] }\n```\n\n' + text;
  await writeFile(ledgerPath, text);
  await writeFile(path.join(root, "harness", "framework", "rule.md"), "# governed\n");
  run(root, "git", ["add", "-A"]);

  const result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 1, "out-of-section terminal fence must not satisfy the gate");
  assert.match(`${result.stdout}${result.stderr}`, /lacking evidenced coverage/);
});

test("governed-path predicate covers every governed prefix", async () => {
  const { isGovernedPath, GOVERNED_PREFIXES } = await import("../../scripts/ledger-rules.mjs");
  for (const prefix of GOVERNED_PREFIXES) {
    const sample = prefix.endsWith("/") ? `${prefix}sample-file.txt` : prefix;
    assert.equal(isGovernedPath(sample), true, `${sample} must be governed`);
  }
  assert.equal(isGovernedPath("src/app.js"), false);
  assert.equal(isGovernedPath("CHANGELOG.md.bak"), false, "exact file entries must not prefix-match");
});

test("file discovery survives tracked-but-worktree-deleted files", async (t) => {
  const { realpath, unlink } = await import("node:fs/promises");
  const { listMarkdownFiles } = await import("../../scripts/validation-helpers.mjs");
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "harness-deleted-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  run(root, "git", ["init", "--quiet"]);
  run(root, "git", ["config", "user.email", "d@t"]);
  run(root, "git", ["config", "user.name", "d"]);
  await writeFile(path.join(root, "keep.md"), "# keep\n");
  await writeFile(path.join(root, "mid-close.md"), "# tracked then deleted from the worktree\n");
  run(root, "git", ["add", "-A"]);
  run(root, "git", ["commit", "--quiet", "-m", "base", "--no-verify"]);
  await unlink(path.join(root, "mid-close.md")); // deletion unstaged — a normal mid-close state
  const files = await listMarkdownFiles(root, ".");
  assert.deepEqual(files, ["keep.md"], "discovery must skip the deleted file, not crash on it");
});

test("structure enumeration exempts gitignored generated directories", async (t) => {
  const { realpath } = await import("node:fs/promises");
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "harness-pycache-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "harness", "scripts"), { recursive: true });
  for (const script of ["validate-structure.mjs", "validation-helpers.mjs", "validation-mode.mjs"]) {
    await cp(getRepoPath("scripts", script), path.join(root, "harness", "scripts", script));
  }
  run(root, "git", ["init", "--quiet"]);
  await writeFile(path.join(root, ".gitignore"), "__pycache__/\n");
  await mkdir(path.join(root, "harness", "override", "structure"), { recursive: true });
  await writeFile(
    path.join(root, "harness", "override", "structure", "agent-system-structure.md"),
    "# Declaration\n\n```agent-system-structure-json\n" + JSON.stringify({
      schemaVersion: "1.0.0", repoType: "core", systemName: "example", conformance: "conformant",
      core: { agentPackage: "pkg", channels: ["email"] },
    }, null, 2) + "\n```\n",
  );
  for (const dir of ["agent/pkg", "agent/__pycache__", "channels/email", "channels/__pycache__", "tools", "docs", "tests", "harness"]) {
    await mkdir(path.join(root, dir), { recursive: true });
  }
  await writeFile(path.join(root, "modal_app.py"), "app = None\n");
  await writeFile(path.join(root, "pyproject.toml"), "[project]\nname = \"example\"\n");
  await writeFile(path.join(root, "Makefile"), "test:\n\tpytest\nlint:\n\truff check .\nvalidate:\n\tmake test\ndry-run:\n\tpython -m pkg --dry-run\n");
  let result = run(root, "node", ["harness/scripts/validate-structure.mjs"]);
  assert.equal(result.status, 0, `gitignored caches must be exempt: ${result.stderr}`);

  // An UNignored extra directory is still undeclared divergence.
  await mkdir(path.join(root, "channels", "sms"), { recursive: true });
  result = run(root, "node", ["harness/scripts/validate-structure.mjs"]);
  assert.equal(result.status, 1, "unignored undeclared channel must still fail");
  assert.match(result.stderr, /channels\/sms/);
  await rm(path.join(root, "channels", "sms"), { recursive: true, force: true });

  // Laundering attempt: force-add a tracked file INSIDE an ignored directory —
  // committed structure must not hide behind the directory's ignore rule.
  run(root, "git", ["config", "user.email", "s@t"]);
  run(root, "git", ["config", "user.name", "s"]);
  await mkdir(path.join(root, "channels", "__pycache__"), { recursive: true });
  await writeFile(path.join(root, "channels", "__pycache__", "smuggled.py"), "# committed structure\n");
  run(root, "git", ["add", "-f", "channels/__pycache__/smuggled.py"]);
  result = run(root, "node", ["harness/scripts/validate-structure.mjs"]);
  assert.equal(result.status, 1, "tracked content inside an ignored directory must fail enumeration");
  assert.match(result.stderr, /channels\/__pycache__/);
});

test("trivial and skip paths stay loud but unblocked", async (t) => {
  const root = await scaffoldGateTarget();
  t.after(() => rm(root, { recursive: true, force: true }));
  // Trivial: no substantive changes.
  let result = run(root, "node", [...cli, "precommit"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /tier: trivial/);
  // HARNESS_SKIP: loud warning, exit 0, telemetry recorded.
  await writeFile(path.join(root, "harness", "framework", "rule.md"), "# governed\n");
  run(root, "git", ["add", "-A"]);
  result = run(root, "node", [...cli, "precommit"], { env: { ...process.env, HARNESS_SKIP: "1" } });
  assert.equal(result.status, 0);
  assert.match(result.stderr, /WARNING/);
  assert.equal(existsSync(path.join(root, "harness", "artifacts", "telemetry", "gate-outcomes.jsonl")), true);
});
