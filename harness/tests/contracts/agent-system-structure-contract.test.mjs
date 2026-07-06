// Structure contract: validate-structure must reject undeclared targets,
// enforce conformant layouts path-by-path per repo type, accept declared
// migration-planned divergence only with a meaningful plan, and pass declared
// non-agent repos. Any future weakening of the structure gate fails here.

import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";

const buildScratchTarget = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "structure-contract-"));
  await mkdir(path.join(root, "harness", "scripts"), { recursive: true });
  for (const script of ["validate-structure.mjs", "validation-helpers.mjs", "validation-mode.mjs"]) {
    await cp(getRepoPath("scripts", script), path.join(root, "harness", "scripts", script));
  }
  return root;
};

const runValidator = (root) =>
  spawnSync("node", ["harness/scripts/validate-structure.mjs"], { cwd: root, encoding: "utf8" });

const declare = async (root, payload) => {
  await mkdir(path.join(root, "harness", "override", "structure"), { recursive: true });
  await writeFile(
    path.join(root, "harness", "override", "structure", "agent-system-structure.md"),
    `# Declaration\n\n\`\`\`agent-system-structure-json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`,
  );
};

const coreDeclaration = {
  schemaVersion: "1.0.0",
  repoType: "core",
  systemName: "example-system",
  conformance: "conformant",
  core: { agentPackage: "examplepkg", channels: ["email", "telegram"] },
};

const BASELINE_MAKEFILE = "test:\n\tpytest\nlint:\n\truff check .\nvalidate:\n\tnode harness/scripts/validate-all.mjs && pytest\ndry-run:\n\tpython -m examplepkg --dry-run\n";

const materializeCoreLayout = async (root) => {
  for (const dir of ["agent/examplepkg", "channels/email", "channels/telegram", "tools", "docs", "tests"]) {
    await mkdir(path.join(root, dir), { recursive: true });
  }
  await writeFile(path.join(root, "modal_app.py"), "app = None\n");
  await writeFile(path.join(root, "pyproject.toml"), "[project]\nname = \"example\"\n");
  await writeFile(path.join(root, "Makefile"), BASELINE_MAKEFILE);
};

test("structure gate: undeclared target fails, declared none passes", async (t) => {
  const root = await buildScratchTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  let result = runValidator(root);
  assert.equal(result.status, 1, "missing declaration must fail");
  assert.match(result.stderr, /must declare its structure role/);

  await declare(root, { schemaVersion: "1.0.0", repoType: "none" });
  result = runValidator(root);
  assert.equal(result.status, 0, "declared none must pass");
  assert.match(result.stdout, /"exempt"/);
});

test("structure gate: migration-planned requires a meaningful plan", async (t) => {
  const root = await buildScratchTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  await declare(root, {
    ...coreDeclaration,
    conformance: "migration-planned",
    migrationPlan: "n/a",
  });
  let result = runValidator(root);
  assert.equal(result.status, 1, "empty migration plan must fail");
  assert.match(result.stderr, /meaningful migrationPlan/);

  await declare(root, {
    ...coreDeclaration,
    conformance: "migration-planned",
    migrationPlan: "harness/exec-plans/active/split-tools.md",
  });
  result = runValidator(root);
  assert.equal(result.status, 0, "planned migration must pass");
  assert.match(result.stdout, /split-tools/);
});

test("structure gate: conformant core layout is checked path-by-path", async (t) => {
  const root = await buildScratchTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  await declare(root, coreDeclaration);
  await materializeCoreLayout(root);
  await rm(path.join(root, "channels", "telegram"), { recursive: true });

  let result = runValidator(root);
  assert.equal(result.status, 1, "missing declared channel must fail");
  assert.match(result.stderr, /channels\/telegram/);

  await mkdir(path.join(root, "channels", "telegram"), { recursive: true });
  result = runValidator(root);
  assert.equal(result.status, 0, "full core layout must pass");
});

test("structure gate: conformant core requires the toolchain surface", async (t) => {
  const root = await buildScratchTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  await declare(root, coreDeclaration);
  await materializeCoreLayout(root);
  let result = runValidator(root);
  assert.equal(result.status, 0, `full toolchain layout must pass: ${result.stderr}`);

  // Missing pyproject.toml (dependency source of truth) fails.
  await rm(path.join(root, "pyproject.toml"));
  result = runValidator(root);
  assert.equal(result.status, 1, "missing pyproject.toml must fail");
  assert.match(result.stderr, /pyproject\.toml/);
  await writeFile(path.join(root, "pyproject.toml"), "[project]\nname = \"example\"\n");

  // Missing Makefile fails.
  await rm(path.join(root, "Makefile"));
  result = runValidator(root);
  assert.equal(result.status, 1, "missing Makefile must fail");
  assert.match(result.stderr, /requires Makefile/);

  // Makefile missing a baseline target fails and names the target.
  await writeFile(path.join(root, "Makefile"), "test:\n\tpytest\nlint:\n\truff check .\nvalidate:\n\tmake test\n");
  result = runValidator(root);
  assert.equal(result.status, 1, "Makefile without dry-run target must fail");
  assert.match(result.stderr, /dry-run/);

  // A variable assignment resembling a target does not count as that target —
  // both `:=` and the simply-expanded `::=` are assignments, not rules.
  for (const assignment of ["dry-run := 1", "dry-run ::= 1"]) {
    await writeFile(path.join(root, "Makefile"), `test:\n\tpytest\nlint:\n\truff check .\nvalidate:\n\tmake test\n${assignment}\n`);
    result = runValidator(root);
    assert.equal(result.status, 1, `assignment "${assignment}" must not satisfy the dry-run target`);
    assert.match(result.stderr, /dry-run/);
  }

  // A `::` double-colon rule IS a real target and must satisfy the verb.
  await writeFile(path.join(root, "Makefile"), "test:\n\tpytest\nlint:\n\truff check .\nvalidate:\n\tmake test\ndry-run:: prep\n\tpython -m pkg --dry-run\n");
  result = runValidator(root);
  assert.equal(result.status, 0, `double-colon dry-run rule must satisfy the target: ${result.stderr}`);

  // Grouped multi-target rule declares several verbs at once.
  await writeFile(path.join(root, "Makefile"), "test lint: deps\n\techo x\nvalidate:\n\tmake test\ndry-run:\n\techo y\n");
  result = runValidator(root);
  assert.equal(result.status, 0, `grouped "test lint:" rule must satisfy both verbs: ${result.stderr}`);

  // A verb name appearing only inside a define…endef body is not a rule.
  await writeFile(path.join(root, "Makefile"), "define HELP\ntest: run tests\nlint: run linter\nvalidate: everything\ndry-run: preview\nendef\ntest:\n\tpytest\nlint:\n\truff check .\nvalidate:\n\tmake test\n");
  result = runValidator(root);
  assert.equal(result.status, 1, "verbs only inside a define block must not satisfy the targets");
  assert.match(result.stderr, /dry-run/);

  // All four verbs on a single grouped rule line satisfy the baseline.
  await writeFile(path.join(root, "Makefile"), "test lint validate dry-run: deps\n\techo x\n");
  result = runValidator(root);
  assert.equal(result.status, 0, `single grouped rule declaring all verbs must pass: ${result.stderr}`);

  // Target-specific variable assignment (`dry-run: VAR = x`) references a
  // target but defines no runnable recipe — it must not satisfy the verb,
  // including with GNU Make `private`/`override`/`export` modifiers.
  for (const assignment of ["dry-run: MODE = preview", "dry-run: private MODE = preview", "dry-run: override MODE = 1", "dry-run: export MODE = 1"]) {
    await writeFile(path.join(root, "Makefile"), `test:\n\tpytest\nlint:\n\truff check .\nvalidate:\n\tmake test\n${assignment}\n`);
    result = runValidator(root);
    assert.equal(result.status, 1, `assignment "${assignment}" must not satisfy the dry-run target`);
    assert.match(result.stderr, /dry-run/);
  }

  // A prerequisite that happens to be named like a modifier is still a real rule.
  await writeFile(path.join(root, "Makefile"), "test:\n\tpytest\nlint:\n\truff check .\nvalidate:\n\tmake test\ndry-run: private\n\techo go\n");
  result = runValidator(root);
  assert.equal(result.status, 0, `dry-run with a prerequisite named "private" is a real rule and must pass: ${result.stderr}`);

  // Target-specific assignments with GNU Make non-identifier variable names
  // (`-`, `.`) must not satisfy the verbs — a Makefile of only these has no
  // runnable rules.
  await writeFile(path.join(root, "Makefile"), "test: PYTHON-FLAGS = x\nlint: RUFF.FLAGS = y\nvalidate: TOOL-VERSION = z\ndry-run: DRY.RUN = yes\n");
  result = runValidator(root);
  assert.equal(result.status, 1, "target-specific assignments with non-identifier var names must not satisfy the verbs");
  assert.match(result.stderr, /test|lint|validate|dry-run/);

  // A rule with an inline `; recipe` containing `=` is runnable and counts.
  await writeFile(path.join(root, "Makefile"), "test: deps; VAR=1 pytest\nlint:\n\truff check .\nvalidate:\n\tmake test\ndry-run:\n\techo y\n");
  result = runValidator(root);
  assert.equal(result.status, 0, `inline-recipe rule with = must count as a real target: ${result.stderr}`);

  // Target-specific assignments cover every GNU Make operator, including the
  // simply-expanded `::=`/`:::=` forms — none define a runnable recipe.
  for (const op of ["::=", ":::=", "?=", "+="]) {
    await writeFile(path.join(root, "Makefile"), `test:\n\tpytest\nlint:\n\truff check .\nvalidate:\n\tmake test\ndry-run: MODE ${op} preview\n`);
    result = runValidator(root);
    assert.equal(result.status, 1, `target-specific "${op}" assignment must not satisfy the dry-run target`);
    assert.match(result.stderr, /dry-run/);
  }

  // A tab-indented recipe line whose text begins with `define`/`endef` must not
  // flip define-block state and swallow later real targets (false-negative guard).
  await writeFile(path.join(root, "Makefile"), "test:\n\tdefine=1 pytest\nlint:\n\truff check .\nvalidate:\n\tmake test\ndry-run:\n\techo endef done\n");
  result = runValidator(root);
  assert.equal(result.status, 0, `recipe lines containing define/endef text must not hide later targets: ${result.stderr}`);

  // `override define` opens a variable body too — verb-looking text inside it
  // is not a rule.
  await writeFile(path.join(root, "Makefile"), "override define HELP\ntest: run\nlint: run\nvalidate: run\ndry-run: run\nendef\n");
  result = runValidator(root);
  assert.equal(result.status, 1, "verbs inside an override define block must not satisfy the targets");
  assert.match(result.stderr, /test|lint|validate|dry-run/);

  // Backslash line-continuation: a target list split across lines is one rule.
  await writeFile(path.join(root, "Makefile"), "test lint \\\nvalidate dry-run: deps\n\t@echo all\n");
  result = runValidator(root);
  assert.equal(result.status, 0, `continued target list must count every verb: ${result.stderr}`);

  // Backslash line-continuation: an assignment body that spills onto a
  // rule-looking line is still an assignment, not a runnable target.
  await writeFile(path.join(root, "Makefile"), "test:\n\tpytest\nlint:\n\truff check .\nvalidate:\n\tmake test\nBLOB = x \\\ndry-run: y\n");
  result = runValidator(root);
  assert.equal(result.status, 1, "a rule-looking assignment continuation must not satisfy dry-run");
  assert.match(result.stderr, /dry-run/);
});

test("structure gate: conformant ios layout enforces skeleton with declared divergence", async (t) => {
  const root = await buildScratchTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  const iosDeclaration = {
    schemaVersion: "1.0.0",
    repoType: "ios",
    systemName: "example-system",
    conformance: "conformant",
    ios: {
      modulePrefix: "Example",
      appDir: "App",
      hasWidget: true,
      usesXcodeproj: false,
      extraModules: ["ExamplePersistence"],
    },
  };
  await declare(root, iosDeclaration);
  for (const dir of [
    "App",
    "Sources/ExampleAppCore",
    "Sources/ExamplePresence",
    "Sources/ExamplePersistence",
    "Tests",
    "Widget",
  ]) {
    await mkdir(path.join(root, dir), { recursive: true });
  }
  await writeFile(path.join(root, "Package.swift"), "// swift-tools-version:5.9\n");

  let result = runValidator(root);
  assert.equal(result.status, 1, "missing required Sync module must fail");
  assert.match(result.stderr, /Sources\/ExampleSync/);

  await mkdir(path.join(root, "Sources", "ExampleSync"), { recursive: true });
  result = runValidator(root);
  assert.equal(result.status, 0, "skeleton with declared SwiftPM-only divergence must pass");

  await declare(root, { ...iosDeclaration, ios: { ...iosDeclaration.ios, usesXcodeproj: true } });
  result = runValidator(root);
  assert.equal(result.status, 1, "usesXcodeproj=true without .xcodeproj must fail");
  assert.match(result.stderr, /xcodeproj/);
});

test("structure gate: required paths are checked by kind, not mere existence", async (t) => {
  const root = await buildScratchTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  await declare(root, coreDeclaration);
  await materializeCoreLayout(root);
  await mkdir(path.join(root, "harness"), { recursive: true });

  // A plain file standing in for a required directory must fail.
  await rm(path.join(root, "tools"), { recursive: true, force: true });
  await writeFile(path.join(root, "tools"), "not a directory\n");
  let result = runValidator(root);
  assert.equal(result.status, 1, "file named tools must not satisfy the tools/ directory");
  assert.match(result.stderr, /tools to be a directory/);

  // A directory standing in for a required file must fail.
  await rm(path.join(root, "tools"));
  await mkdir(path.join(root, "tools"), { recursive: true });
  await rm(path.join(root, "modal_app.py"));
  await mkdir(path.join(root, "modal_app.py"), { recursive: true });
  result = runValidator(root);
  assert.equal(result.status, 1, "directory named modal_app.py must not satisfy the file requirement");
  assert.match(result.stderr, /modal_app.py to be a file/);

  await rm(path.join(root, "modal_app.py"), { recursive: true, force: true });
  await writeFile(path.join(root, "modal_app.py"), "app = None\n");
  result = runValidator(root);
  assert.equal(result.status, 0, `kind-correct layout must pass: ${result.stderr}`);

  // An .xcodeproj plain file must not satisfy the Xcode project requirement.
  const iosRoot = await buildScratchTarget();
  t.after(() => rm(iosRoot, { recursive: true, force: true }));
  await declare(iosRoot, {
    schemaVersion: "1.0.0",
    repoType: "ios",
    systemName: "example-system",
    conformance: "conformant",
    ios: { modulePrefix: "Example", appDir: "App", hasWidget: false, usesXcodeproj: true, extraModules: [] },
  });
  for (const dir of ["App", "Sources/ExampleAppCore", "Sources/ExamplePresence", "Sources/ExampleSync", "Tests", "harness"]) {
    await mkdir(path.join(iosRoot, dir), { recursive: true });
  }
  await writeFile(path.join(iosRoot, "Package.swift"), "// swift-tools-version:5.9\n");
  await writeFile(path.join(iosRoot, "Example.xcodeproj"), "not a project directory\n");
  result = runValidator(iosRoot);
  assert.equal(result.status, 1, "plain file ending in .xcodeproj must not satisfy the project requirement");
  assert.match(result.stderr, /xcodeproj directory/);
});

test("structure gate: undeclared channel directories fail conformant core repos", async (t) => {
  const root = await buildScratchTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  await declare(root, coreDeclaration);
  await materializeCoreLayout(root);
  await mkdir(path.join(root, "harness"), { recursive: true });
  let result = runValidator(root);
  assert.equal(result.status, 0, `declared layout must pass: ${result.stderr}`);

  await mkdir(path.join(root, "channels", "sms"), { recursive: true });
  result = runValidator(root);
  assert.equal(result.status, 1, "undeclared channels/sms must fail");
  assert.match(result.stderr, /channels\/sms is not declared in core.channels/);

  await rm(path.join(root, "channels", "sms"), { recursive: true, force: true });
  await mkdir(path.join(root, "agent", "legacy"), { recursive: true });
  result = runValidator(root);
  assert.equal(result.status, 1, "second agent package must fail");
  assert.match(result.stderr, /agent\/legacy is not the declared core.agentPackage/);
});

test("structure gate: widget divergence must be declared explicitly and match the filesystem", async (t) => {
  const root = await buildScratchTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  const base = {
    schemaVersion: "1.0.0",
    repoType: "ios",
    systemName: "example-system",
    conformance: "conformant",
    ios: { modulePrefix: "Example", appDir: "App", usesXcodeproj: false, extraModules: [] },
  };
  for (const dir of ["App", "Sources/ExampleAppCore", "Sources/ExamplePresence", "Sources/ExampleSync", "Tests"]) {
    await mkdir(path.join(root, dir), { recursive: true });
  }
  await writeFile(path.join(root, "Package.swift"), "// swift-tools-version:5.9\n");
  await mkdir(path.join(root, "harness"), { recursive: true });

  // Omitted hasWidget: silent divergence path must be closed.
  await declare(root, base);
  let result = runValidator(root);
  assert.equal(result.status, 1, "omitted hasWidget must fail");
  assert.match(result.stderr, /hasWidget must be an explicit boolean/);

  // Non-boolean hasWidget must fail the same way.
  await declare(root, { ...base, ios: { ...base.ios, hasWidget: "yes" } });
  result = runValidator(root);
  assert.equal(result.status, 1, "non-boolean hasWidget must fail");
  assert.match(result.stderr, /hasWidget must be an explicit boolean/);

  // hasWidget:false with a Widget/ directory present is undeclared divergence.
  await declare(root, { ...base, ios: { ...base.ios, hasWidget: false } });
  await mkdir(path.join(root, "Widget"), { recursive: true });
  result = runValidator(root);
  assert.equal(result.status, 1, "Widget/ present with hasWidget=false must fail");
  assert.match(result.stderr, /Widget\/ exists but ios.hasWidget is false/);

  // Matching declaration passes; non-boolean usesXcodeproj fails.
  result = runValidator(root);
  await declare(root, { ...base, ios: { ...base.ios, hasWidget: true } });
  result = runValidator(root);
  assert.equal(result.status, 0, `matching widget declaration must pass: ${result.stderr}`);

  await declare(root, { ...base, ios: { ...base.ios, hasWidget: true, usesXcodeproj: "nope" } });
  result = runValidator(root);
  assert.equal(result.status, 1, "non-boolean usesXcodeproj must fail");
  assert.match(result.stderr, /usesXcodeproj must be a boolean/);

  // Bidirectional: declaring SwiftPM-only while a project directory exists
  // is undeclared divergence, same as the widget rule.
  await declare(root, { ...base, ios: { ...base.ios, hasWidget: true, usesXcodeproj: false } });
  await mkdir(path.join(root, "Example.xcodeproj"), { recursive: true });
  result = runValidator(root);
  assert.equal(result.status, 1, "usesXcodeproj=false with a project directory must fail");
  assert.match(result.stderr, /\.xcodeproj directory exists but ios.usesXcodeproj is false/);
});

test("structure gate: undeclared Sources modules fail conformant ios repos", async (t) => {
  const root = await buildScratchTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  await declare(root, {
    schemaVersion: "1.0.0",
    repoType: "ios",
    systemName: "example-system",
    conformance: "conformant",
    ios: { modulePrefix: "Example", hasWidget: false, usesXcodeproj: false, extraModules: [] },
  });
  for (const dir of ["App", "Sources/ExampleAppCore", "Sources/ExamplePresence", "Sources/ExampleSync", "Sources/ExampleSneaky", "Tests"]) {
    await mkdir(path.join(root, dir), { recursive: true });
  }
  await writeFile(path.join(root, "Package.swift"), "// swift-tools-version:5.9\n");

  const result = runValidator(root);
  assert.equal(result.status, 1, "undeclared Sources module must fail");
  assert.match(result.stderr, /Sources\/ExampleSneaky is not a required module/);
});

test("structure gate: declaration path components must be safe segments", async (t) => {
  const root = await buildScratchTarget();
  t.after(() => rm(root, { recursive: true, force: true }));

  await declare(root, {
    ...coreDeclaration,
    core: { agentPackage: "../escape", channels: ["email"] },
  });
  let result = runValidator(root);
  assert.equal(result.status, 1, "traversal in agentPackage must fail");
  assert.match(result.stderr, /core\.agentPackage must be a safe path segment/);

  await declare(root, {
    ...coreDeclaration,
    core: { agentPackage: "examplepkg", channels: ["email/../../etc"] },
  });
  result = runValidator(root);
  assert.equal(result.status, 1, "separators in channel names must fail");
  assert.match(result.stderr, /core\.channels entry must be a safe path segment/);

  await declare(root, {
    schemaVersion: "1.0.0",
    repoType: "ios",
    systemName: "example-system",
    conformance: "conformant",
    ios: { modulePrefix: "Example", appDir: "/tmp", usesXcodeproj: false, extraModules: [] },
  });
  result = runValidator(root);
  assert.equal(result.status, 1, "absolute appDir must fail");
  assert.match(result.stderr, /ios\.appDir must be a safe path segment/);
});
