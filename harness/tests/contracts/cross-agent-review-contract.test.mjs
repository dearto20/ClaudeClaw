import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";

const PROCESS_PATH = getRepoPath("framework", "process", "review.md");
const TEMPLATE_PATH = getRepoPath("exec-plans", "templates", "implementation-plan.md");
const VALIDATOR_PATH = getRepoPath("scripts", "validate-cross-agent-review.mjs");
const TRANSPORT_PATH = getRepoPath("scripts", "run-agent-review.mjs");
const CLAUDE_WRAPPER_PATH = getRepoPath("scripts", "run-claude-review.mjs");
const DUAL_ROLE_RULES_PATH = getRepoPath("scripts", "dual-role-governance-rules.mjs");
const PACKET_TEMPLATE_PATH = getRepoPath("framework", "templates", "cross-agent-review-packet.md");
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

const readSourceAwareRequirementRegister = async () =>
  JSON.parse(
    await (
      (await isSourceFinal())
        ? readFile(getRepoPath("..", "development", "requirements", "requirement-register.json"), "utf8")
        : readFile(getRepoPath("override", "requirements", "requirement-register.json"), "utf8")
    ),
  );

const readSourceAwareAdr = async (fileName) =>
  (await isSourceFinal())
    ? readFile(getRepoPath("..", "development", "design-docs", "adr", fileName), "utf8")
    : readFile(getRepoPath("override", "design-docs", "adr", fileName), "utf8");

test("cross-agent collaboration process defines terminal review rules", async () => {
  const processDoc = await readFile(PROCESS_PATH, "utf8");

  for (const text of [
    "Required Triggers",
    "maxReviewIterations",
    "non-terminal",
    "complete",
    "blocked",
    "fallback-accepted",
    "Supersession Rules",
    "Evidence Shape",
    "explicit intent, implicit or hidden intent",
    "root-cause applicability and completeness",
    "alternatives quality",
    "no unresolved explicit/hidden-intent gap",
    "no unresolved root-cause applicability or completeness gap",
    "Agent Review Transport Protocol",
    "node harness/scripts/run-agent-review.mjs",
    "node harness/scripts/run-claude-review.mjs",
    "framework/templates/cross-agent-review-packet.md",
    "Critic liveness probe",
    "Do not keep changing prompt styles without recording attempts",
    "high-capability model selection",
    "HARNESS_CODEX_CRITIC_MODEL",
    "HARNESS_CLAUDE_CRITIC_MODEL",
    "--codex-model",
    "--claude-model",
    "criticModel",
    "agent-review-json",
    "claude-review-json",
    "Dual-Role Governance",
    "primary-performer",
    "independent-critic",
    "single-family-dual-role-complete",
    "Sub-agent or Expert Bench decomposition",
    "Planning, implementation, code review, validation, completion, commit, push, and publish tasks must not be declared ready while critic pushback remains open",
    "pushbackFree=true",
    "nonBlockingRisks",
  ]) {
    assert.ok(processDoc.includes(text), `process doc must include ${text}`);
  }
});

test("execution plan template includes machine-readable cross-agent review block", async () => {
  const template = await readFile(TEMPLATE_PATH, "utf8");

  assert.ok(template.includes("## Cross-Agent Review"), "template must include Cross-Agent Review section");
  assert.ok(template.includes("```cross-agent-review-json"), "template must include cross-agent JSON fence");

  const match = template.match(/```cross-agent-review-json\n([\s\S]*?)\n```/);
  assert.ok(match, "template must have a parseable cross-agent JSON block");

  // Ledger diet (2.7.0): the core fence omits dualRoleGovernance — the block is
  // structurally required by validatePayload only when a review is triggered.
  const payload = JSON.parse(match[1]);
  assert.equal(payload.required, false);
  assert.equal(payload.highRisk, false);
  assert.equal(payload.maxReviewIterations, 5);
  assert.equal(payload.dualRoleGovernance, undefined);
  assert.ok(Array.isArray(payload.triggerSignals));
  assert.ok(Array.isArray(payload.affectedPaths));
  assert.ok(Array.isArray(payload.records));

  for (const text of [
    "## Dual-Role Governance",
    "Mode: `cross-agent`",
    "Primary performer agent: `claude-code`",
    "Independent critic agent: `codex`",
    "Internal decomposition summary",
    "Agent review packet and report",
    "No-pushback terminal evidence",
    "Unresolved critic pushback",
    "Pushback-free review evidence",
    "Critic pushback-free status",
  ]) {
    assert.ok(template.includes(text), `template must include ${text}`);
  }
});

test("cross-agent validator encodes trigger and terminal status checks", async () => {
  const validator = await readFile(VALIDATOR_PATH, "utf8");

  for (const text of [
    "validate-cross-agent-review",
    "complete",
    "blocked",
    "fallback-accepted",
    "supersedesReviewId",
    "maxReviewIterations",
    "harness/framework/process/review.md",
    "harness/scripts/validate-cross-agent-review.mjs",
    "harness/scripts/run-agent-review.mjs",
    "harness/scripts/run-claude-review.mjs",
    "no unresolved explicit/hidden-intent gap",
    "no unresolved root-cause applicability or completeness gap",
    "no unresolved alternatives-quality gap",
    "Agent Review Transport Protocol",
    "packet-file",
    "evidence-summary",
    "minimal-blocking-review",
    "dualRoleGovernance",
    "primaryPerformer",
    "independentCritic",
    "Plan validators must ignore this README",
    "single-family-dual-role",
    "pushbackFree",
    "Unresolved critic pushback blocks readiness",
  ]) {
    assert.ok(validator.includes(text), `validator must include ${text}`);
  }
});

test("dual-role governance rules enforce cross-agent preference and same-family fallback evidence", async () => {
  const rules = await import(pathToFileURL(DUAL_ROLE_RULES_PATH).href);

  assert.deepEqual(
    rules.validateDualRoleGovernance({
      required: true,
      mode: "cross-agent",
      primaryPerformer: "codex",
      independentCritic: "claude-code",
      agentFamilySeparation: true,
      missingAgentAvailabilityEvidence: "n/a",
      roleSeparationEvidence: "Codex implements and Claude critiques.",
      internalDecompositionSummary: "Expert roles feed the consolidated plan.",
      consolidatedOutputOwner: "primary-performer",
      terminalStatus: "cross-agent-complete",
    }, { requireTerminal: true }),
    [],
  );

  assert.deepEqual(
    rules.validateDualRoleGovernance({
      required: true,
      mode: "cross-agent",
      primaryPerformer: "claude-code",
      independentCritic: "codex",
      agentFamilySeparation: true,
      missingAgentAvailabilityEvidence: "n/a",
      roleSeparationEvidence: "Claude Code implements and Codex critiques.",
      internalDecompositionSummary: "Expert roles feed the consolidated plan.",
      consolidatedOutputOwner: "primary-performer",
      terminalStatus: "cross-agent-complete",
    }, { requireTerminal: true }),
    [],
  );

  assert.deepEqual(
    rules.validateDualRoleGovernance({
      required: true,
      mode: "single-family-dual-role",
      primaryPerformer: "codex",
      independentCritic: "codex",
      agentFamilySeparation: false,
      missingAgentAvailabilityEvidence: "Claude Code liveness failed after bounded attempts.",
      roleSeparationEvidence: "Codex performer pass and Codex critic pass were separate.",
      internalDecompositionSummary: "Expert roles feed the consolidated plan.",
      consolidatedOutputOwner: "primary-performer",
      terminalStatus: "single-family-dual-role-complete",
    }, { requireTerminal: true }),
    [],
  );

  assert.ok(
    rules.validateDualRoleGovernance({
      required: true,
      mode: "cross-agent",
      primaryPerformer: "codex",
      independentCritic: "codex",
      agentFamilySeparation: true,
      missingAgentAvailabilityEvidence: "n/a",
      roleSeparationEvidence: "same agent",
      internalDecompositionSummary: "Expert roles",
      consolidatedOutputOwner: "primary-performer",
      terminalStatus: "cross-agent-complete",
    }, { requireTerminal: true }).some((failure) => failure.includes("different agent families")),
    "same-family cross-agent mode must fail",
  );

  assert.ok(
    rules.validateDualRoleGovernance({
      required: true,
      mode: "single-family-dual-role",
      primaryPerformer: "codex",
      independentCritic: "codex",
      agentFamilySeparation: false,
      missingAgentAvailabilityEvidence: "n/a",
      roleSeparationEvidence: "separate passes",
      internalDecompositionSummary: "Expert roles",
      consolidatedOutputOwner: "primary-performer",
      terminalStatus: "single-family-dual-role-complete",
    }, { requireTerminal: true }).some((failure) => failure.includes("missingAgentAvailabilityEvidence")),
    "single-family fallback without unavailable-agent evidence must fail",
  );

  assert.ok(
    rules.validateDualRoleGovernance({
      required: true,
      mode: "single-family-dual-role",
      primaryPerformer: "codex",
      independentCritic: "codex",
      agentFamilySeparation: false,
      missingAgentAvailabilityEvidence: "Claude Code liveness failed after bounded attempts.",
      roleSeparationEvidence: "same agent label",
      internalDecompositionSummary: "Expert roles",
      consolidatedOutputOwner: "primary-performer",
      terminalStatus: "single-family-dual-role-complete",
    }, { requireTerminal: true }).some((failure) => failure.includes("separate performer and critic passes")),
    "single-family fallback without distinct role-separation evidence must fail",
  );
});

test("dual-role governance traces the sub-agent boundary through requirement and ADR", async (t) => {
  if (!(await isSourceMode())) {
    t.skip("DevelopmentHarness source-owned REQ-FW/ADR traceability is source-mode only");
    return;
  }

  const adr = await readSourceAwareAdr("adr-014-dual-role-governance.md");
  const register = await readSourceAwareRequirementRegister();
  const requirement = register.requirements.find((item) => item.id === "REQ-FW-25");

  assert.ok(requirement, "REQ-FW-25 must exist");
  assert.equal(requirement.title, "Governed work uses pushback-free dual-role readiness");
  assert.ok(
    requirement.guidanceDocs.some((item) => item.endsWith("framework/process/review.md")),
    "REQ-FW-25 must include sub-agent coordination guidance",
  );
  assert.ok(
    requirement.artifactPaths.some((item) => item.endsWith("framework/process/review.md")),
    "REQ-FW-25 must include sub-agent coordination artifacts",
  );
  assert.ok(
    requirement.validationPaths.some((item) => item.endsWith("scripts/validate-sub-agent-ledger.mjs")),
    "REQ-FW-25 must validate the sub-agent boundary",
  );

  for (const text of [
    "Sub-agent and expert-role decomposition are useful internal mechanisms",
    "they do not replace top-level performer/critic separation",
    "Keep sub-agent expert roles as internal decomposition evidence",
    "pushback-free readiness",
    "nonBlockingRisks",
  ]) {
    assert.ok(adr.includes(text), `ADR-014 must include ${text}`);
  }
});

test("bidirectional agent review transport is traceable through ADR and requirements", async (t) => {
  if (!(await isSourceMode())) {
    t.skip("DevelopmentHarness source-owned REQ-FW/ADR traceability is source-mode only");
    return;
  }

  const adr = await readSourceAwareAdr("adr-011-cross-agent-review-transport.md");
  const register = await readSourceAwareRequirementRegister();
  const requirement = register.requirements.find((item) => item.id === "REQ-FW-22");

  assert.ok(requirement, "REQ-FW-22 must exist");
  assert.equal(requirement.title, "Agent review transport is bounded, bidirectional, and auditable");
  assert.ok(requirement.artifactPaths.some((item) => item.endsWith("scripts/run-agent-review.mjs")));
  assert.ok(requirement.artifactPaths.some((item) => item.endsWith("scripts/run-claude-review.mjs")));
  assert.ok(requirement.validationPaths.some((item) => item.endsWith("tests/contracts/cross-agent-review-contract.test.mjs")));

  for (const text of [
    "Support Codex and Claude Code as either primary performer or independent critic",
    "Keep `scripts/run-claude-review.mjs` as a compatibility wrapper",
    "bounded agent review transport",
  ]) {
    assert.ok(adr.includes(text), `ADR-011 must include ${text}`);
  }
});

test("agent review packet template and transport runner define bounded structured review", async () => {
  const packetTemplate = await readFile(PACKET_TEMPLATE_PATH, "utf8");
  const transport = await import(pathToFileURL(TRANSPORT_PATH).href);
  const claudeWrapper = await import(pathToFileURL(CLAUDE_WRAPPER_PATH).href);
  const transportSource = await readFile(TRANSPORT_PATH, "utf8");
  const wrapperSource = await readFile(CLAUDE_WRAPPER_PATH, "utf8");

  for (const text of [
    "Cross-Agent Review Packet",
    "Required Agent Output",
    "agent-review-json",
    "NO_BLOCKING_ISSUES",
    "BLOCKING_FINDINGS",
    "Critic model:",
    "Critic model evidence:",
    "pushback-free",
    "nonBlockingRisks",
  ]) {
    assert.ok(packetTemplate.includes(text), `packet template must include ${text}`);
  }

  const attempts = transport.buildAttemptPlan({
    packetPath: "harness/artifacts/cross-agent-review/example-packet.md",
    packetText: "Task evidence",
    summaryText: "Summary evidence",
    timeoutMs: 45000,
    livenessTimeoutMs: 12000,
    primary: "claude-code",
    critic: "codex",
  });

  assert.deepEqual(
    attempts.map((attempt) => attempt.name),
    ["liveness", "packet-file", "evidence-summary", "minimal-blocking-review"],
  );
  assert.equal(attempts[0].timeoutMs, 12000);
  assert.ok(attempts.slice(1).every((attempt) => attempt.timeoutMs === 45000));
  assert.ok(attempts.slice(1).every((attempt) => attempt.prompt.includes("agent-review-json")));
  assert.ok(attempts.slice(1).every((attempt) => attempt.prompt.includes("Codex")));
  assert.ok(attempts.slice(1).every((attempt) => attempt.prompt.includes("Claude Code")));

  const parsed = transport.extractAgentReview(`\`\`\`agent-review-json
{
  "status": "NO_BLOCKING_ISSUES",
  "blockingFindings": [],
  "nonBlockingRisks": ["watch timeout behavior"],
  "reviewedEvidence": ["packet"],
  "summary": "No blockers."
}
\`\`\``);

  assert.equal(parsed.status, "NO_BLOCKING_ISSUES");
  assert.deepEqual(parsed.blockingFindings, []);
  assert.deepEqual(parsed.nonBlockingRisks, ["watch timeout behavior"]);
  assert.equal(transport.isPushbackFreeReview(parsed), false);

  const legacyParsed = transport.extractAgentReview(`\`\`\`claude-review-json
{
  "status": "NO_BLOCKING_ISSUES",
  "blockingFindings": [],
  "nonBlockingRisks": [],
  "reviewedEvidence": ["legacy packet"],
  "summary": "Legacy wrapper accepted."
}
\`\`\``);
  assert.equal(legacyParsed.status, "NO_BLOCKING_ISSUES");
  assert.equal(transport.isPushbackFreeReview(legacyParsed), true);

  assert.ok(
    transportSource.includes("spawnSync(command.bin, command.args"),
    "agent review runner must invoke critics with argv arrays, not shell-interpolated strings",
  );
  for (const text of [
    "isPushbackFreeReview",
    "pushbackFree",
    "A readiness response with NO_BLOCKING_ISSUES must leave both blockingFindings and nonBlockingRisks empty",
  ]) {
    assert.ok(transportSource.includes(text), `agent review runner must include ${text}`);
  }
  assert.ok(transportSource.includes("\"--ask-for-approval\""));
  assert.ok(transportSource.includes("\"read-only\""));
  assert.equal(transport.highCapabilityCriticModelDefaults.codex, "gpt-5.5");
  assert.equal(transport.highCapabilityCriticModelDefaults["claude-code"], "opus");
  assert.ok(transportSource.includes("HARNESS_CODEX_CRITIC_MODEL"));
  assert.ok(transportSource.includes("HARNESS_CLAUDE_CRITIC_MODEL"));
  assert.ok(transportSource.includes("\"--model\""));
  assert.ok(transportSource.includes("\"-m\""));
  assert.ok(transportSource.includes("criticModel"));
  assert.ok(transportSource.includes("validateHighCapabilityCriticModel"));
  assert.ok(transportSource.includes("lowCapabilityPattern"));
  assert.ok(wrapperSource.includes("runAgentReview"));
  assert.ok(wrapperSource.includes("--claude-model"));

  const parsedOptions = transport.parseArgs([
    "--packet",
    "harness/framework/templates/cross-agent-review-packet.md",
    "--critic",
    "codex",
    "--codex-model",
    "gpt-5.5",
    "--claude-model",
    "opus",
  ]);
  assert.equal(parsedOptions.codexModel, "gpt-5.5");
  assert.equal(parsedOptions.claudeModel, "opus");
  assert.deepEqual(transport.validateHighCapabilityCriticModel("claude-code", "opus"), []);
  assert.deepEqual(transport.validateHighCapabilityCriticModel("codex", "gpt-5.5"), []);
  assert.match(
    transport.validateHighCapabilityCriticModel("claude-code", "sonnet").join("\n"),
    /lower-tier model/,
  );
  assert.match(
    transport.validateHighCapabilityCriticModel("codex", "gpt-5-mini").join("\n"),
    /lower-tier model/,
  );
  assert.throws(
    () =>
      transport.parseArgs([
        "--packet",
        "harness/framework/templates/cross-agent-review-packet.md",
        "--critic",
        "codex",
        "--codex-model",
        "gpt-5-mini",
      ]),
    /lower-tier model/,
  );

  const wrapperAttempts = claudeWrapper.buildAttemptPlan({
    packetPath: "harness/artifacts/cross-agent-review/example-packet.md",
    packetText: "Task evidence",
    summaryText: "Summary evidence",
    timeoutMs: 45000,
    livenessTimeoutMs: 12000,
  });
  assert.ok(wrapperAttempts.slice(1).every((attempt) => attempt.prompt.includes("claude-review-json")));

  const wrapperDryRun = await claudeWrapper.runClaudeReview({
    packetPath: "harness/framework/templates/cross-agent-review-packet.md",
    outputPath: "harness/artifacts/cross-agent-review/wrapper-dry-run.json",
    timeoutMs: 45000,
    livenessTimeoutMs: 12000,
    claudeBin: "claude",
    codexBin: "codex",
    primary: "codex",
    critic: "claude-code",
    fenceName: "claude-review-json",
    dryRun: true,
  });
  assert.equal(wrapperDryRun.status, "dry-run");
  assert.equal(wrapperDryRun.primary, "codex");
  assert.equal(wrapperDryRun.critic, "claude-code");
  assert.equal(wrapperDryRun.criticModel, "opus");
});
