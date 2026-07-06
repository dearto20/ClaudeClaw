import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";

const workspaceRoot = getRepoPath("..");
const sourceMarkerPath = path.join(workspaceRoot, "development", "developmentharness-source.json");
const requiresSourceFixture = (t) => {
  if (!existsSync(sourceMarkerPath)) {
    t.skip("source-only fixture; not applicable in target mode");
    return false;
  }

  return true;
};

const copyTargetHarness = () => {
  const targetRoot = mkdtempSync(path.join(os.tmpdir(), "dh-target-boundary-"));

  cpSync(getRepoPath(), path.join(targetRoot, "harness"), { recursive: true });
  for (const file of ["AGENTS.md", "BOOTSTRAP.md", "CLAUDE.md", "README.md"]) {
    cpSync(path.join(workspaceRoot, file), path.join(targetRoot, file));
  }

  const overrideRoot = path.join(targetRoot, "harness", "override");
  for (const dir of [
    "intake",
    "validation",
    "runtime",
    "observability",
    "browser",
    "cleanup",
    "quality",
    "pr",
    "requirements",
    "design-docs/adr",
  ]) {
    mkdirSync(path.join(overrideRoot, dir), { recursive: true });
  }

  cpSync(
    path.join(workspaceRoot, "development", "intake", "project-intake.md"),
    path.join(overrideRoot, "intake", "project-intake.md"),
  );
  cpSync(
    path.join(workspaceRoot, "development", "validation", "source-validation-profile.md"),
    path.join(overrideRoot, "validation", "target-validation-profile.md"),
  );
  writeFileSync(
    path.join(overrideRoot, "requirements", "requirement-register.json"),
    `${JSON.stringify({ version: 2, requirements: [] }, null, 2)}\n`,
  );

  return targetRoot;
};

const runInTarget = (targetRoot, command, args) => {
  const result = spawnSync(command, args, {
    cwd: targetRoot,
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  assert.equal(
    result.status,
    0,
    [`${command} ${args.join(" ")}`, output].filter(Boolean).join("\n"),
  );

  return { ...result, output };
};

test("target mode skips DevelopmentHarness source-only validation and REQ/ADR checks", (t) => {
  if (!requiresSourceFixture(t)) {
    return;
  }

  const targetRoot = copyTargetHarness();
  try {
    const sourceValidation = runInTarget(targetRoot, "node", ["harness/scripts/validate-source-repository.mjs"]);
    const sourceReport = JSON.parse(sourceValidation.output.trim());
    assert.equal(sourceReport.mode, "target");
    assert.equal(sourceReport.notApplicable, true);

    const targetConcreteness = readFileSync(
      path.join(targetRoot, "harness", "tests", "contracts", "target-concreteness-contract.test.mjs"),
      "utf8",
    );
    assert.match(targetConcreteness, /if \(await isSourceMode\(\)\) \{[\s\S]*REQ-FW-28 must exist in DevelopmentHarness source mode/);
    assert.match(targetConcreteness, /const manifest = sourceMode[\s\S]*: null;/);

    const crossAgent = readFileSync(
      path.join(targetRoot, "harness", "tests", "contracts", "cross-agent-review-contract.test.mjs"),
      "utf8",
    );
    assert.equal(
      crossAgent.match(/DevelopmentHarness source-owned REQ-FW\/ADR traceability is source-mode only/g)?.length,
      2,
    );
  } finally {
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

test("target entropy scans harness root instead of empty target application folders", (t) => {
  if (!requiresSourceFixture(t)) {
    return;
  }

  const targetRoot = copyTargetHarness();
  try {
    runInTarget(targetRoot, "git", ["init", "--quiet"]);

    for (const dir of [
      "runtime",
      "observability",
      "browser",
      "cleanup",
      "quality",
      "pr",
      "design-docs/adr",
    ]) {
      writeFileSync(path.join(targetRoot, "harness", "override", dir, "README.md"), `# ${dir}\n`);
    }

    mkdirSync(path.join(targetRoot, "src", "empty-feature"), { recursive: true });

    const entropy = runInTarget(targetRoot, "node", ["harness/scripts/validate-entropy.mjs"]);
    const report = JSON.parse(entropy.output.trim());

    assert.equal(report.status, "passed");
    assert.equal(report.emptyDirs, 0);
    assert.doesNotMatch(entropy.output, /src\/empty-feature/);
  } finally {
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

test("target command drift reads harness AGENTS when target Git ignores harness", (t) => {
  if (!requiresSourceFixture(t)) {
    return;
  }

  const targetRoot = copyTargetHarness();
  try {
    writeFileSync(path.join(targetRoot, ".gitignore"), "harness/\n");
    writeFileSync(path.join(targetRoot, "AGENTS.md"), "# Target Agents\n\nProject-specific guidance.\n");
    writeFileSync(path.join(targetRoot, "BOOTSTRAP.md"), "# Target Bootstrap\n\nProject-specific setup.\n");
    writeFileSync(path.join(targetRoot, "CLAUDE.md"), "# Target Claude\n\nProject-specific guidance.\n");
    writeFileSync(path.join(targetRoot, "README.md"), "# Target Project\n\nProduct README.\n");
    runInTarget(targetRoot, "git", ["init", "--quiet"]);

    const drift = runInTarget(targetRoot, "node", ["harness/scripts/validate-command-drift.mjs"]);
    const report = JSON.parse(drift.output.trim());

    assert.equal(report.status, "passed");
    assert.equal(report.directFallbackFiles, 1);
    assert.ok(report.canonicalCount >= 1);
  } finally {
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

test("target bootstrap anchors do not require project README ownership", (t) => {
  if (!requiresSourceFixture(t)) {
    return;
  }

  const targetRoot = copyTargetHarness();
  try {
    const testPath = path.join(targetRoot, "harness", "tests", "contracts", "target-concreteness-contract.test.mjs");
    const content = readFileSync(testPath, "utf8");

    assert.doesNotMatch(content, /\["README\.md", readme\]/);
    assert.match(content, /\["BOOTSTRAP\.md", bootstrap\]/);
    assert.match(content, /\["root AGENTS\.md", rootAgents\]/);
    assert.match(content, /\["harness\/AGENTS\.md", harnessAgents\]/);
    assert.match(content, /\["validate-entrypoints\.mjs", entrypointValidator\]/);
  } finally {
    rmSync(targetRoot, { recursive: true, force: true });
  }
});
