import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";

const readText = (...parts) => readFile(getRepoPath(...parts), "utf8");
const sourceMarkerPath = getRepoPath("..", "development", "developmentharness-source.json");
const readSourceMarker = async () => readFile(sourceMarkerPath, "utf8").then(JSON.parse).catch(() => null);
const isSourceMode = async () => {
  const marker = await readSourceMarker();
  return marker?.repoKind === "DevelopmentHarnessSource" && ["coexistence", "final"].includes(marker?.migrationPhase);
};
const isSourceFinal = async () => {
  const marker = await readSourceMarker();
  return marker?.repoKind === "DevelopmentHarnessSource" && marker?.migrationPhase === "final";
};
const readIntakeText = async () =>
  (await isSourceFinal())
    ? readFile(getRepoPath("..", "development", "intake", "project-intake.md"), "utf8")
    : readText("override", "intake", "project-intake.md");
const readProfileText = async () =>
  (await isSourceFinal())
    ? readFile(getRepoPath("..", "development", "validation", "source-validation-profile.md"), "utf8")
    : readText("override", "validation", "target-validation-profile.md");
const readRequirementRegister = async () =>
  JSON.parse(
    await (
      (await isSourceFinal())
        ? readFile(getRepoPath("..", "development", "requirements", "requirement-register.json"), "utf8")
        : readText("override", "requirements", "requirement-register.json")
    ),
  );

const parseFence = (content, fenceName) => {
  const match = content.match(new RegExp(`\`\`\`${fenceName}\\n([\\s\\S]*?)\\n\`\`\``));
  assert.ok(match, `missing ${fenceName} fence`);
  return JSON.parse(match[1]);
};

test("bootstrap intake is ready and critical target facts are concrete", async () => {
  const intake = parseFence(await readIntakeText(), "intake-json");

  assert.equal(intake.schemaVersion, "1.0.0");
  assert.equal(intake.state, "ready");
  assert.ok(intake.project.name);
  assert.ok(intake.project.successCriteria.length > 0);
  assert.ok(intake.target.platforms.length > 0);
  assert.ok(intake.target.runtimeSurfaces.length > 0);
  assert.ok(intake.users.audiences.length > 0);
  assert.ok(intake.domain.verticals.length > 0);
  assert.ok(intake.validation.expectedCommandGroups.length > 0);
});

test("target validation profile executes command arrays and forbids recursive validate-all", async () => {
  const profile = parseFence(await readProfileText(), "target-validation-json");
  const validator = await readText("scripts", "validate-target-profile.mjs");

  assert.match(validator, /spawnSync/, "target profile validator must execute commands");
  assert.match(validator, /validate-all\.mjs/, "target profile validator must reject recursive validate-all");

  for (const command of profile.commands) {
    assert.ok(Array.isArray(command.command), `${command.id} command must be an array`);
    assert.ok(!command.command.some((part) => part.includes("validate-all.mjs")), `${command.id} must not recurse`);
  }
});

test("target validation profile declares artifact side effects for enabled commands", async () => {
  const profile = parseFence(await readProfileText(), "target-validation-json");

  for (const command of profile.commands.filter((item) => item.enabled === true)) {
    assert.ok(["repo", "temp", "external", "none"].includes(command.writesTo), `${command.id} writesTo`);
    assert.ok(
      ["tracked", "ignored", "temp-routed", "manual-cleanup", "none"].includes(command.artifactPolicy),
      `${command.id} artifactPolicy`,
    );
    assert.ok(
      ["none", "cleanup", "external-write", "destructive"].includes(command.approvalRisk),
      `${command.id} approvalRisk`,
    );
  }
});

test("target artifact policy accepts temp-routed builds and rejects manual cleanup without rationale", async () => {
  const { validateCommandArtifactPolicy } = await import(
    pathToFileURL(getRepoPath("scripts", "validate-target-profile.mjs")).href
  );

  const baseCommand = {
    id: "example",
    group: "build",
    enabled: true,
    writesTo: "temp",
    artifactPolicy: "temp-routed",
    approvalRisk: "none",
  };

  assert.deepEqual(validateCommandArtifactPolicy(baseCommand, "example"), []);

  assert.match(
    validateCommandArtifactPolicy(
      {
        ...baseCommand,
        writesTo: "repo",
        artifactPolicy: "manual-cleanup",
        approvalRisk: "cleanup",
      },
      "manual-cleanup-example",
    ).join("\n"),
    /artifactRationale is required/,
  );

  assert.deepEqual(
    validateCommandArtifactPolicy(
      {
        ...baseCommand,
        writesTo: "repo",
        artifactPolicy: "manual-cleanup",
        artifactRationale: "Legacy tool writes a bounded cache that cannot be redirected.",
        approvalRisk: "cleanup",
      },
      "manual-cleanup-example",
    ),
    [],
  );
});

test("destructive cleanup remains a hard stop for enabled target commands", async () => {
  const { validateCommandArtifactPolicy } = await import(
    pathToFileURL(getRepoPath("scripts", "validate-target-profile.mjs")).href
  );

  const failures = validateCommandArtifactPolicy(
    {
      id: "destructive-cleanup",
      group: "cleanup",
      enabled: true,
      writesTo: "repo",
      artifactPolicy: "manual-cleanup",
      artifactRationale: "Requires explicit human approval.",
      approvalRisk: "destructive",
    },
    "destructive-cleanup",
  );

  assert.match(failures.join("\n"), /destructive approvalRisk/);
});

test("execution plan template includes operational completion checks", async () => {
  const template = await readText("exec-plans", "templates", "implementation-plan.md");

  for (const field of [
    "Dirty worktree status",
    "Required new files tracked or intentionally ignored",
    "Generated artifacts handled by policy",
    "Push/publish state when publishing was requested",
    "Critic pushback-free status",
  ]) {
    assert.ok(template.includes(field), `template must include ${field}`);
  }
});

test("repository organization uses manifests instead of placeholder-only directories", async () => {
  const validator = await readText("scripts", "validate-entropy.mjs");
  const execPlanValidator = await readText("scripts", "validate-exec-plans.mjs");
  const subAgentValidator = await readText("scripts", "validate-sub-agent-ledger.mjs");
  const crossAgentValidator = await readText("scripts", "validate-cross-agent-review.mjs");

  if (await isSourceMode()) {
    const register = await readRequirementRegister();
    const requirement = register.requirements.find((item) => item.id === "REQ-FW-28");

    assert.ok(requirement, "REQ-FW-28 must exist in DevelopmentHarness source mode");
    assert.ok(
      requirement.artifactPaths.includes(
        (await isSourceFinal())
          ? "development/design-docs/adr/adr-017-repository-organization-manifests.md"
          : "override/design-docs/adr/adr-017-repository-organization-manifests.md",
      ),
      "REQ-FW-28 must trace to ADR-017 in DevelopmentHarness source mode",
    );
  }

  for (const parts of [
    ["exec-plans", "active", "README.md"],
    ["exec-plans", "tech-debt", "README.md"],
    ["artifacts", "validation", "README.md"],
    ["artifacts", "cross-agent-review", "README.md"],
  ]) {
    const manifest = await readText(...parts);
    assert.ok(manifest.trim().length > 0, `${parts.join("/")} must be a non-empty manifest`);
  }

  for (const text of [
    ".gitkeep",
    "placeholder files",
    "artifact README anchor",
    "scanEmptyDirs(mode.isSource ? workspaceRoot : harnessRoot)",
    "git ls-files",
    "empty directory without a tracked purpose manifest",
  ]) {
    assert.ok(validator.includes(text), `entropy validator must enforce ${text}`);
  }

  for (const validatorText of [execPlanValidator, subAgentValidator, crossAgentValidator]) {
    assert.ok(
      validatorText.includes("Plan validators must ignore this README"),
      "execution-plan validators must ignore README files only when they carry the directory-manifest signal",
    );
  }
});

test("bootstrap ownership policy preserves target-owned harness state and defines seed defaults", async () => {
  const bootstrap = await readFile(getRepoPath("..", "BOOTSTRAP.md"), "utf8");

  for (const text of [
    "BOOTSTRAP_LAYOUT_CONTRACT: preserve-target-owned-harness-state",
    "HARNESS_PROCESS_CONTRACT: default-for-all-agent-work",
    "Harness Is Default Operating Law",
    "Ordinary silence does not disable harness obligations",
    "Harness Ownership And Overwrite Policy",
    "Framework-owned",
    "Target-owned live state",
    "Generated evidence",
    "Seed defaults",
    "`harness/framework/`, `harness/scripts/`, `harness/tests/`, `harness/exec-plans/templates/`",
    "`harness/override/`, `harness/exec-plans/active/`, `harness/exec-plans/completed/`, `harness/exec-plans/tech-debt/`",
    "`harness/artifacts/`",
    "`harness/framework/seeds/`",
    "copy-if-missing",
    "Do not move live plans or generated evidence under `harness/framework/seeds/`.",
    "no `rm -rf harness`",
    "no recursive copy over an existing `harness/`",
    "no replacement of `harness/override/`, execution-plan ledgers, or artifact directories",
    "explicit, path-scoped, and diff-reviewed",
  ]) {
    assert.ok(bootstrap.includes(text), `BOOTSTRAP.md must include ${text}`);
  }

  for (const starterSnippetText of [
    "Stable harness process contract: `HARNESS_PROCESS_CONTRACT: default-for-all-agent-work`",
    "The harness is default operating law for all agent work. Ordinary silence does not disable harness obligations.",
    "Plan Mode still performs harness planning obligations but does not mutate tracked files.",
    "Mutation-capable mode creates or updates execution ledgers before non-trivial edits.",
    "Harness process is default operating law for all agent work: `HARNESS_PROCESS_CONTRACT: default-for-all-agent-work`.",
  ]) {
    assert.ok(bootstrap.includes(starterSnippetText), `starter snippets must include ${starterSnippetText}`);
  }
});

test("seed defaults exist under framework seeds while live runtime paths remain top-level", async () => {
  const seedPairs = [
    {
      seed: ["framework", "seeds", "exec-plans", "active", "README.md"],
      livePath: "harness/exec-plans/active/",
    },
    {
      seed: ["framework", "seeds", "exec-plans", "completed", "README.md"],
      livePath: "harness/exec-plans/completed/",
    },
    {
      seed: ["framework", "seeds", "exec-plans", "tech-debt", "README.md"],
      livePath: "harness/exec-plans/tech-debt/",
    },
    {
      seed: ["framework", "seeds", "artifacts", "validation", "README.md"],
      livePath: "harness/artifacts/validation/",
    },
    {
      seed: ["framework", "seeds", "artifacts", "cross-agent-review", "README.md"],
      livePath: "harness/artifacts/cross-agent-review/",
    },
  ];

  for (const { seed, livePath } of seedPairs) {
    const seedText = await readText(...seed);
    assert.ok(seedText.includes("Copy this README to"), `${seed.join("/")} must define copy behavior`);
    assert.ok(seedText.includes("only when"), `${seed.join("/")} must be copy-if-missing`);
    assert.ok(seedText.includes("Do not overwrite existing"), `${seed.join("/")} must forbid overwrites`);
    assert.ok(seedText.includes(livePath), `${seed.join("/")} must point to live path ${livePath}`);
    assert.ok(!livePath.startsWith("harness/framework/seeds/"), `${livePath} must remain outside framework seeds`);
  }

  for (const liveReadme of [
    ["exec-plans", "active", "README.md"],
    ["exec-plans", "completed", "README.md"],
    ["exec-plans", "tech-debt", "README.md"],
    ["artifacts", "validation", "README.md"],
    ["artifacts", "cross-agent-review", "README.md"],
  ]) {
    const liveText = await readText(...liveReadme);
    assert.ok(liveText.trim().length > 0, `${liveReadme.join("/")} must remain a live top-level README anchor`);
  }
});

test("whole-repo bootstrap contract materializes only distributable target state", async () => {
  const bootstrap = await readFile(getRepoPath("..", "BOOTSTRAP.md"), "utf8");
  const rootAgents = await readFile(getRepoPath("..", "AGENTS.md"), "utf8");
  const harnessAgents = await readText("AGENTS.md");
  const entrypointValidator = await readText("scripts", "validate-entrypoints.mjs");
  const sourceValidator = await readText("scripts", "validate-source-repository.mjs");
  const targetOverrideValidator = await readText("scripts", "validate-target-overrides.mjs");
  const sourceMode = await isSourceMode();
  const manifest = sourceMode
    ? JSON.parse(await readFile(getRepoPath("..", "development", "distribution-manifest.json"), "utf8"))
    : null;

  for (const anchor of [
    "BOOTSTRAP_LAYOUT_CONTRACT: manifest-distributable-only",
    "BOOTSTRAP_LAYOUT_CONTRACT: no-target-development-root",
    "BOOTSTRAP_LAYOUT_CONTRACT: target-override-owned",
    "BOOTSTRAP_LAYOUT_CONTRACT: preserve-target-owned-harness-state",
  ]) {
    for (const [label, content] of [
      ["BOOTSTRAP.md", bootstrap],
      ["root AGENTS.md", rootAgents],
      ["harness/AGENTS.md", harnessAgents],
      ["validate-entrypoints.mjs", entrypointValidator],
    ]) {
      assert.ok(content.includes(anchor), `${label} must carry ${anchor}`);
    }
  }

  for (const text of [
    "Agent Bootstrap Contract",
    "BOOTSTRAP_AGENT_CONTRACT: fetch-source-archive",
    "BOOTSTRAP_AGENT_CONTRACT: ask-intake-before-target-files",
    "BOOTSTRAP_AGENT_CONTRACT: materialize-target-override",
    "repository name and one-sentence purpose",
    "primary users and main workflows",
    "project type and runtime surfaces",
    "data sensitivity, security posture, and regulatory constraints",
    "expected validation commands",
    "ask focused follow-up questions instead of guessing",
  ]) {
    assert.ok(bootstrap.includes(text), `BOOTSTRAP.md must include ${text}`);
    assert.ok(entrypointValidator.includes(text) || text.startsWith("repository "), `entrypoint validator must enforce ${text}`);
  }

  if (sourceMode) {
    for (const requiredInclude of [
      "harness/exec-plans/active/README.md",
      "harness/exec-plans/completed/README.md",
      "harness/exec-plans/tech-debt/README.md",
      "harness/artifacts/validation/README.md",
      "harness/artifacts/cross-agent-review/README.md",
    ]) {
      assert.ok(manifest.distribution.include.includes(requiredInclude), `manifest include must keep ${requiredInclude}`);
      assert.ok(sourceValidator.includes(requiredInclude), `source validator must require ${requiredInclude}`);
    }

    for (const requiredExclude of [
      "development/**",
      "harness/override/**",
      "harness/exec-plans/completed/*.md",
      "harness/exec-plans/active/*.md",
      "harness/exec-plans/tech-debt/*.md",
      "harness/artifacts/validation/*.json",
      "harness/artifacts/cross-agent-review/*.json",
    ]) {
      assert.ok(manifest.distribution.exclude.includes(requiredExclude), `manifest exclude must block ${requiredExclude}`);
      assert.ok(sourceValidator.includes(requiredExclude), `source validator must require exclusion ${requiredExclude}`);
    }
  }

  assert.ok(
    targetOverrideValidator.includes("target-mode validation forbids root development/"),
    "target override validator must reject root development/ in target mode",
  );
  assert.ok(targetOverrideValidator.includes("workspaceRoot"), "target override validator must check the workspace root");
});

test("target exploration guide requires subsystem, trace, integration, diagnostic, and gated-surface coverage", async () => {
  const template = await readText("framework", "templates", "target-exploration-guide.md");

  for (const text of [
    "## Subsystem Inventory",
    "## Capability Map",
    "Trace a disabled or gated surface",
    "Trace diagnostics or status",
    "Find integration surfaces",
    "Find diagnostics/status commands",
    "Find observability hooks",
    "## Disabled Or Gated Surfaces",
  ]) {
    assert.ok(template.includes(text), `target exploration guide must include ${text}`);
  }
});

test("capability catalog schema captures owner surface, gating, side effects, concurrency, evidence, and validation", async () => {
  const template = await readText("framework", "templates", "tool-command-capability-catalog.md");
  const catalog = parseFence(template, "capability-catalog-json");
  const example = catalog.capabilities[0];

  for (const field of [
    "id",
    "kind",
    "capabilityType",
    "category",
    "ownerSurface",
    "entrypoint",
    "registryPath",
    "inputSchemaOrContract",
    "outputContract",
    "permissionProfile",
    "approvalRisk",
    "readOnly",
    "destructive",
    "writesTo",
    "artifactPolicy",
    "gated",
    "activationConditions",
    "disabledBehavior",
    "concurrencySafety",
    "runtimeEvidence",
    "validationPaths",
  ]) {
    assert.ok(Object.hasOwn(example, field), `capability catalog example must include ${field}`);
  }
});

test("integration surface inventory template is machine-readable and covers cross-boundary runtime surfaces", async () => {
  const template = await readText("framework", "templates", "integration-surface-inventory.md");
  const inventory = parseFence(template, "integration-surface-inventory-json");
  const surface = inventory.surfaces[0];

  assert.equal(inventory.schemaVersion, "1.0.0");
  for (const field of [
    "id",
    "kind",
    "status",
    "entrypoints",
    "protocols",
    "transports",
    "authBoundaries",
    "sessionBoundaries",
    "exposedCapabilities",
    "dataFlows",
    "permissionChecks",
    "gated",
    "activationConditions",
    "disabledBehavior",
    "safeFallback",
    "runtimeEvidence",
    "validationPaths",
    "notApplicable",
  ]) {
    assert.ok(Object.hasOwn(surface, field), `integration surface example must include ${field}`);
  }

  for (const kind of ["mcp-server", "mcp-client", "ide-bridge", "browser-hook", "plugin-loader", "skill-loader", "remote-control", "transport", "auth-boundary", "explorer-interface"]) {
    assert.ok(template.includes(kind), `integration surface template must mention ${kind}`);
  }
});

test("target mechanisms are override-bound and not-applicable decisions are audited", async () => {
  const validator = await readText("scripts", "validate-target-overrides.mjs");

  for (const text of [
    "override/runtime/worktree-runtime.md",
    "override/observability/observability.md",
    "override/browser/browser-validation.md",
    "override/cleanup/recurring-cleanup.md",
    "override/quality/architecture-invariants.md",
    "override/quality/taste-invariants.md",
    "override/pr/pr-ci-loop.md",
    "notApplicable",
    "replacementEvidence",
    "reviewerRole",
    "approvedAt",
    "linkedIntakeField",
  ]) {
    assert.ok(validator.includes(text), `target override validator must include ${text}`);
  }
});

test("target mechanism requirements point at override artifacts", async () => {
  const sourceFinal = await isSourceFinal();
  const register = await readRequirementRegister();
  const checkedIds = new Set(["REQ-FW-06", "REQ-FW-07", "REQ-FW-09", "REQ-FW-16", "REQ-FW-17"]);

  for (const requirement of register.requirements.filter((item) => checkedIds.has(item.id))) {
    assert.ok(
      requirement.artifactPaths.every((artifactPath) => artifactPath.startsWith(sourceFinal ? "development/" : "override/")),
      `${requirement.id} mechanism artifactPaths must point at ${sourceFinal ? "development" : "override"} artifacts`,
    );
  }
});
