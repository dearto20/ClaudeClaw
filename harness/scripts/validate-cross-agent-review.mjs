import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  finishValidation,
  harnessRoot,
  loadLegacyPlanAcceptance,
  pathExists,
  readHarnessFile,
  readWorkspaceFile,
  requireIncludes,
  workspaceRoot,
} from "./validation-helpers.mjs";
import { getValidationMode } from "./validation-mode.mjs";
import { isGovernedPath } from "./ledger-rules.mjs";
import { spawnSync } from "node:child_process";
import {
  affectedPathsFromPlan,
  calibrationCeilingFailures,
  recordIterationCapFailures,
  calibrationStalenessFailures,
  familyRuntimeEnforcementFailures,
  familyTransportFailures,
  reviewReportRefs,
  transportDegradationFailures,
  validateDualRoleGovernance,
} from "./dual-role-governance-rules.mjs";

const failures = [];
const maxReviewIterations = 5;
const statuses = new Set(["non-terminal", "complete", "blocked", "fallback-accepted"]);
const terminalStatuses = new Set(["complete", "blocked", "fallback-accepted"]);
const evidenceTypes = new Set(["file-line", "validation-report", "log-path", "commit-sha", "review-output"]);
const exactTriggerPaths = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "harness/AGENTS.md",
  "harness/exec-plans/templates/implementation-plan.md",
  "harness/framework/process/bootstrap-intake.md",
  "harness/framework/process/runtime-mode-strategy.md",
  "harness/framework/process/target-validation-profile.md",
  "harness/framework/process/review.md",
  "harness/framework/process/review.md",
  "harness/framework/process/review.md",
  "harness/framework/process/review.md",
  "harness/override/requirements/requirement-register.json",
  "harness/scripts/validate-intake.mjs",
  "harness/scripts/validate-target-profile.mjs",
  "harness/scripts/validate-target-overrides.mjs",
  "harness/scripts/validate-agentic-loop.mjs",
  "harness/scripts/validate-sub-agent-ledger.mjs",
  "harness/scripts/validate-critique-synthesis.mjs",
  "harness/scripts/validate-cross-agent-review.mjs",
  "harness/scripts/run-agent-review.mjs",
  "harness/scripts/run-claude-review.mjs",
]);

const crossAgentDoc = await readHarnessFile("framework/process/review.md");
requireIncludes(
  crossAgentDoc,
  [
    "explicit intent, implicit or hidden intent",
    "user-intent versus existing-pattern conflicts",
    "root-cause applicability and completeness",
    "adjacent blockers",
    "symptom-only fixes",
    "alternatives quality",
    "no unresolved explicit/hidden-intent gap",
    "no unresolved user-intent versus existing-pattern conflict",
    "no unresolved root-cause applicability or completeness gap",
    "no unresolved alternatives-quality gap",
    "Agent Review Transport Protocol",
    "node harness/scripts/run-agent-review.mjs",
    "node harness/scripts/run-claude-review.mjs",
    "framework/templates/cross-agent-review-packet.md",
    "Critic liveness probe",
    "Evidence-summary fallback prompt",
    "Do not keep changing prompt styles without recording attempts",
    "agent-review-json",
    "claude-review-json",
    "dual-role governance",
    "primary-performer",
    "independent-critic",
    "Non-trivial execution-plan-backed planning and implementation require top-level dual-role governance",
    "cross-agent review between two distinct registered agent families",
    "Sub-agent or Expert Bench decomposition is expected when useful, but it does not satisfy the independent critic role by itself",
    "single-family-dual-role-complete",
    "Planning, implementation, code review, validation, completion, commit, push, and publish tasks must not be declared ready while critic pushback remains open",
    "pushbackFree=true",
    "nonBlockingRisks",
  ],
  "framework/process/review.md",
  failures,
);

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isBoolean = (value) => typeof value === "boolean";
const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
const hasTrueAgreement = (record, field) => record.finalAgreement?.[field] === true;
const isIsoDateTime = (value) =>
  isNonEmptyString(value) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  !Number.isNaN(Date.parse(value));

const normalizedPath = (value) => value.replace(/^\.\//, "");

const isRepoRelativePath = (value) => {
  if (!isNonEmptyString(value) || value.startsWith("/") || value.includes("\\")) {
    return false;
  }

  return !value.split("/").includes("..");
};

// Review requiredness derives from the SAME governed-path predicate the tier
// gate uses (ledger-rules.mjs) — the two can never drift — plus the review-
// specific extras below (intake, schemas, target-side ADRs).
const isTriggerPath = (value) => {
  const relativePath = normalizedPath(value);
  return (
    isGovernedPath(relativePath) ||
    exactTriggerPaths.has(relativePath) ||
    relativePath.startsWith("harness/override/design-docs/adr/") ||
    relativePath.startsWith("harness/framework/schemas/") ||
    relativePath.startsWith("harness/override/intake/")
  );
};

const extractSection = (content, heading) => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(new RegExp(`^## ${escapedHeading}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"));
  return match ? match[1].trim() : "";
};

const extractReviewPayload = (content, relativePath) => {
  const section = extractSection(content, "Cross-Agent Review");
  if (!section) {
    failures.push(`${relativePath} missing Cross-Agent Review section`);
    return null;
  }

  const matches = [...section.matchAll(/```cross-agent-review-json\n([\s\S]*?)\n```/g)];
  if (matches.length !== 1) {
    failures.push(`${relativePath} must contain exactly one cross-agent-review-json block`);
    return null;
  }

  // The section fence is the only legitimate home: a cross-agent-review-json
  // fence anywhere else in the ledger is a forgery surface for the commit
  // gate and is rejected outright.
  const allFences = [...content.matchAll(/```cross-agent-review-json\n/g)];
  if (allFences.length !== matches.length) {
    failures.push(`${relativePath} contains cross-agent-review-json fence(s) outside the Cross-Agent Review section`);
    return null;
  }

  try {
    return JSON.parse(matches[0][1]);
  } catch (error) {
    failures.push(`${relativePath} cross-agent-review-json is invalid JSON: ${error.message}`);
    return null;
  }
};

const planState = (content) => {
  const stateSection = extractSection(content, "State");
  const match = stateSection.match(/`?([a-z-]+)`?/);
  return match ? match[1] : "";
};

const validateEvidence = (evidence, label, { requireNonEmpty = false } = {}) => {
  if (!Array.isArray(evidence)) {
    failures.push(`${label} evidence must be an array`);
    return;
  }

  if (requireNonEmpty && evidence.length === 0) {
    failures.push(`${label} evidence must be non-empty`);
  }

  for (const [index, item] of evidence.entries()) {
    const itemLabel = `${label} evidence[${index}]`;
    if (!isObject(item)) {
      failures.push(`${itemLabel} must be an object`);
      continue;
    }

    if (!evidenceTypes.has(item.type)) {
      failures.push(`${itemLabel} has invalid type: ${item.type}`);
    }

    if (!isNonEmptyString(item.ref)) {
      failures.push(`${itemLabel} ref must be non-empty`);
    } else if (item.type === "file-line" && !/^.+:\d+$/.test(item.ref)) {
      failures.push(`${itemLabel} file-line ref must look like path:line`);
    } else if ((item.type === "validation-report" || item.type === "log-path") && !isRepoRelativePath(item.ref)) {
      failures.push(`${itemLabel} ref must be a repo-relative path`);
    } else if (item.type === "commit-sha" && !/^[0-9a-fA-F]{7,40}$/.test(item.ref)) {
      failures.push(`${itemLabel} ref must be a hexadecimal commit SHA`);
    } else if (item.type === "review-output" && !isRepoRelativePath(item.ref) && !/^#[A-Za-z0-9_.:-]+$/.test(item.ref)) {
      failures.push(`${itemLabel} review-output ref must be a repo-relative path or plan section id`);
    }

    if (!isNonEmptyString(item.summary)) {
      failures.push(`${itemLabel} summary must be non-empty`);
    }
  }
};

const validateIteration = (iteration, index, label) => {
  if (!isObject(iteration)) {
    failures.push(`${label} iterations[${index}] must be an object`);
    return;
  }

  if (iteration.iterationNumber !== index + 1) {
    failures.push(`${label} iterations[${index}] iterationNumber must equal ${index + 1}`);
  }

  for (const field of ["primaryAgent", "secondaryAgent", "reviewPrompt"]) {
    if (!isNonEmptyString(iteration[field])) {
      failures.push(`${label} iterations[${index}] ${field} must be non-empty`);
    }
  }

  for (const field of ["findings", "accepted", "rejectedWithRationale", "blocked"]) {
    if (!Array.isArray(iteration[field])) {
      failures.push(`${label} iterations[${index}] ${field} must be an array`);
    }
  }

  if (!isBoolean(iteration.primaryAgreement)) {
    failures.push(`${label} iterations[${index}] primaryAgreement must be boolean`);
  }

  if (!isBoolean(iteration.secondaryAgreement)) {
    failures.push(`${label} iterations[${index}] secondaryAgreement must be boolean`);
  }

  validateEvidence(iteration.evidence ?? [], `${label} iterations[${index}]`);
};

const hasForbidden = (record, fields, label) => {
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(record, field)) {
      failures.push(`${label} must not include ${field}`);
    }
  }
};

const validateRecord = (record, index, label, dualRoleGovernance = null) => {
  const recordLabel = `${label} records[${index}]`;
  if (!isObject(record)) {
    failures.push(`${recordLabel} must be an object`);
    return;
  }

  if (!isNonEmptyString(record.reviewId)) {
    failures.push(`${recordLabel} reviewId must be non-empty`);
  }

  if (!statuses.has(record.status)) {
    failures.push(`${recordLabel} has invalid status: ${record.status}`);
  }

  if (Object.prototype.hasOwnProperty.call(record, "iterationCount")) {
    failures.push(`${recordLabel} must not store iterationCount; it is derived from iterations.length`);
  }

  if (!Array.isArray(record.iterations)) {
    failures.push(`${recordLabel} iterations must be an array`);
  } else {
    record.iterations.forEach((iteration, iterationIndex) => {
      validateIteration(iteration, iterationIndex, recordLabel);
    });
  }
  // Iteration-cap semantics live in the shared pure rule (verification
  // records with supersedesReviewId may enumerate more than the cap).
  failures.push(...recordIterationCapFailures(record, maxReviewIterations, recordLabel));

  if (record.supersedesReviewId !== undefined && !isNonEmptyString(record.supersedesReviewId)) {
    failures.push(`${recordLabel} supersedesReviewId must be non-empty when present`);
  }

  if (record.status === "complete") {
    if (dualRoleGovernance?.mode === "single-family-dual-role") {
      if (
        record.finalAgreement?.primaryPerformerAgreement !== true ||
        record.finalAgreement?.independentCriticAgreement !== true
      ) {
        failures.push(`${recordLabel} single-family complete status requires primary performer and independent critic agreement`);
      }
    } else if (
      !(
        (record.finalAgreement?.primaryPerformerAgreement === true &&
          record.finalAgreement?.independentCriticAgreement === true) ||
        (record.finalAgreement?.codexAgreement === true && record.finalAgreement?.claudeAgreement === true)
      )
    ) {
      failures.push(`${recordLabel} cross-agent complete status requires Codex and Claude Code agreement`);
    }

    validateEvidence(record.evidence, recordLabel, { requireNonEmpty: true });
    hasForbidden(record, ["reason", "blockedBy", "blockedAt", "unavailableAgent", "acceptedBy", "acceptedAt", "waivedTriggers"], recordLabel);
  }

  if (record.status === "blocked") {
    for (const field of ["reason", "blockedBy"]) {
      if (!isNonEmptyString(record[field])) {
        failures.push(`${recordLabel} blocked status requires non-empty ${field}`);
      }
    }
    if (!isIsoDateTime(record.blockedAt)) {
      failures.push(`${recordLabel} blockedAt must be ISO-8601 date-time`);
    }
    if (!Array.isArray(record.unresolvedFindings) || record.unresolvedFindings.length === 0) {
      failures.push(`${recordLabel} blocked status requires non-empty unresolvedFindings`);
    }
    validateEvidence(record.evidence, recordLabel, { requireNonEmpty: true });
    hasForbidden(record, ["unavailableAgent", "acceptedBy", "acceptedAt", "waivedTriggers"], recordLabel);
    if (hasTrueAgreement(record, "codexAgreement") || hasTrueAgreement(record, "claudeAgreement")) {
      failures.push(`${recordLabel} blocked status must not assert final agreement`);
    }
  }

  if (record.status === "fallback-accepted") {
    for (const field of ["reason", "unavailableAgent", "acceptedBy"]) {
      if (!isNonEmptyString(record[field])) {
        failures.push(`${recordLabel} fallback-accepted status requires non-empty ${field}`);
      }
    }
    if (record.acceptedBy === record.unavailableAgent) {
      failures.push(`${recordLabel} acceptedBy must not equal unavailableAgent`);
    }
    if (!isIsoDateTime(record.acceptedAt)) {
      failures.push(`${recordLabel} acceptedAt must be ISO-8601 date-time`);
    }
    if (!isStringArray(record.triggerSignals) || record.triggerSignals.length === 0) {
      failures.push(`${recordLabel} fallback-accepted requires non-empty triggerSignals`);
    }
    if (!isStringArray(record.waivedTriggers) || record.waivedTriggers.length === 0) {
      failures.push(`${recordLabel} fallback-accepted requires non-empty waivedTriggers`);
    }
    if (isStringArray(record.triggerSignals) && isStringArray(record.waivedTriggers)) {
      const triggerSet = new Set(record.triggerSignals);
      for (const waivedTrigger of record.waivedTriggers) {
        if (!triggerSet.has(waivedTrigger)) {
          failures.push(`${recordLabel} waivedTrigger is not in triggerSignals: ${waivedTrigger}`);
        }
      }
    }
    if (!Array.isArray(record.iterations) || record.iterations.length !== maxReviewIterations) {
      failures.push(`${recordLabel} fallback-accepted requires exactly ${maxReviewIterations} iterations`);
    }
    validateEvidence(record.evidence, recordLabel, { requireNonEmpty: true });
    hasForbidden(record, ["blockedBy", "blockedAt"], recordLabel);
    if (hasTrueAgreement(record, "codexAgreement") || hasTrueAgreement(record, "claudeAgreement")) {
      failures.push(`${recordLabel} fallback-accepted status must not assert final agreement`);
    }
  }
};

const validatePayload = (payload, relativePath, expectedLocation = "template") => {
  if (!isObject(payload)) {
    failures.push(`${relativePath} review payload must be an object`);
    return;
  }

  if (!isBoolean(payload.required)) {
    failures.push(`${relativePath} required must be boolean`);
  }
  if (!isBoolean(payload.highRisk)) {
    failures.push(`${relativePath} highRisk must be boolean`);
  }
  if (!isStringArray(payload.triggerSignals)) {
    failures.push(`${relativePath} triggerSignals must be an array of strings`);
  }
  if (!isStringArray(payload.affectedPaths)) {
    failures.push(`${relativePath} affectedPaths must be an array of strings`);
  }
  if (payload.maxReviewIterations !== maxReviewIterations) {
    failures.push(`${relativePath} maxReviewIterations must equal ${maxReviewIterations}`);
  }
  if (!Array.isArray(payload.records)) {
    failures.push(`${relativePath} records must be an array`);
    return;
  }

  const inferredRequired =
    payload.required === true ||
    payload.highRisk === true ||
    (Array.isArray(payload.triggerSignals) && payload.triggerSignals.length > 0) ||
    (Array.isArray(payload.affectedPaths) && payload.affectedPaths.some(isTriggerPath));

  if (inferredRequired && payload.required !== true) {
    failures.push(`${relativePath} cross-agent review is triggered but required is not true`);
  }

  const dualRoleRequired = inferredRequired;

  if (dualRoleRequired && !isObject(payload.dualRoleGovernance)) {
    failures.push(`${relativePath} required review must include dualRoleGovernance`);
  }

  if (isObject(payload.dualRoleGovernance)) {
    if (dualRoleRequired && payload.dualRoleGovernance.required !== true) {
      failures.push(`${relativePath} required review must set dualRoleGovernance.required=true`);
    }

    for (const failure of validateDualRoleGovernance(payload.dualRoleGovernance, {
      label: `${relativePath} dualRoleGovernance`,
      expectedLocation,
      requireTerminal: expectedLocation === "completed" && dualRoleRequired,
    })) {
      failures.push(failure);
    }
  }

  payload.records.forEach((record, index) => validateRecord(record, index, relativePath, payload.dualRoleGovernance));

  const ids = new Map();
  const supersedes = new Map();
  payload.records.forEach((record, index) => {
    if (!isObject(record) || !isNonEmptyString(record.reviewId)) {
      return;
    }
    if (ids.has(record.reviewId)) {
      failures.push(`${relativePath} duplicate reviewId: ${record.reviewId}`);
    }
    ids.set(record.reviewId, { record, index });
  });

  payload.records.forEach((record, index) => {
    if (!isObject(record) || !isNonEmptyString(record.supersedesReviewId)) {
      return;
    }

    if (supersedes.has(record.supersedesReviewId)) {
      failures.push(`${relativePath} supersedesReviewId used more than once: ${record.supersedesReviewId}`);
    }
    supersedes.set(record.supersedesReviewId, record.reviewId);

    const target = ids.get(record.supersedesReviewId);
    if (!target) {
      failures.push(`${relativePath} supersedesReviewId does not resolve: ${record.supersedesReviewId}`);
      return;
    }

    if (target.index >= index) {
      failures.push(`${relativePath} supersedesReviewId must reference an earlier record: ${record.supersedesReviewId}`);
    }

    const allowed =
      (target.record.status === "non-terminal" && record.status === "complete") ||
      (target.record.status === "blocked" && record.status === "fallback-accepted");

    if (!allowed) {
      failures.push(`${relativePath} invalid supersession ${target.record.status} -> ${record.status}`);
    }
  });

  const supersededIds = new Set(supersedes.keys());
  const authoritativeTerminals = payload.records.filter(
    (record) => isObject(record) && terminalStatuses.has(record.status) && !supersededIds.has(record.reviewId),
  );

  if (authoritativeTerminals.length > 1) {
    failures.push(`${relativePath} has multiple unsuperseded terminal cross-agent records`);
  }

  if (inferredRequired && expectedLocation === "completed") {
    if (authoritativeTerminals.length !== 1) {
      failures.push(`${relativePath} completed required cross-agent review must have exactly one authoritative terminal record`);
    } else if (authoritativeTerminals[0].status === "blocked") {
      failures.push(`${relativePath} completed plan cannot have blocked as authoritative cross-agent review status`);
    } else if (dualRoleRequired && payload.dualRoleGovernance?.terminalStatus === "pending") {
      failures.push(`${relativePath} completed plan cannot leave dual-role terminal status pending`);
    }
  }
};

const planFiles = async (relativeDir) => {
  const dir = path.join(harnessRoot, relativeDir);
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.name === "README.md") {
      const content = await readHarnessFile(relativePath);
      if (content.includes("Plan validators must ignore this README")) {
        continue;
      }
    }

    files.push(relativePath);
  }

  return files;
};

const processPath = "framework/process/review.md";
const templatePath = "exec-plans/templates/implementation-plan.md";
const packetTemplatePath = "framework/templates/cross-agent-review-packet.md";
const transportScriptPath = "scripts/run-agent-review.mjs";
const claudeWrapperPath = "scripts/run-claude-review.mjs";

if (!(await pathExists(harnessRoot, processPath))) {
  failures.push(`missing ${processPath}`);
} else {
  const processDoc = await readHarnessFile(processPath);
  requireIncludes(
    processDoc,
    [
      "maxReviewIterations",
      "Required Triggers",
      "Cross-Agent Review",
      "explicit intent, implicit or hidden intent",
      "user-intent versus existing-pattern conflicts",
      "root-cause applicability and completeness",
      "alternatives quality",
      "non-terminal",
      "complete",
      "blocked",
      "fallback-accepted",
      "Supersession Rules",
      "Evidence Shape",
      "Agent Review Transport Protocol",
      "node harness/scripts/run-agent-review.mjs",
      "node harness/scripts/run-claude-review.mjs",
      "framework/templates/cross-agent-review-packet.md",
      "high-capability model selection",
      "HARNESS_CODEX_CRITIC_MODEL",
      "HARNESS_CLAUDE_CRITIC_MODEL",
      "--codex-model",
      "--claude-model",
      "criticModel",
      "primary-performer",
      "independent-critic",
      "single-family-dual-role",
      "pushbackFree",
      "Unresolved critic pushback blocks readiness",
      "nonBlockingRisks",
    ],
    processPath,
    failures,
  );
}

if (!(await pathExists(harnessRoot, packetTemplatePath))) {
  failures.push(`missing ${packetTemplatePath}`);
} else {
  const packetTemplate = await readHarnessFile(packetTemplatePath);
  requireIncludes(
    packetTemplate,
    [
      "Cross-Agent Review Packet",
      "Required Agent Output",
      "agent-review-json",
      "NO_BLOCKING_ISSUES",
      "BLOCKING_FINDINGS",
      "Critic model:",
      "Critic model evidence:",
      "pushback-free",
      "nonBlockingRisks",
    ],
    packetTemplatePath,
    failures,
  );
}

if (!(await pathExists(harnessRoot, transportScriptPath))) {
  failures.push(`missing ${transportScriptPath}`);
} else {
  const transportScript = await readHarnessFile(transportScriptPath);
  requireIncludes(
    transportScript,
    [
      "buildAttemptPlan",
      "liveness",
      "packet-file",
      "evidence-summary",
      "minimal-blocking-review",
      "timeout",
      "agent-review-json",
      "claude-review-json",
      "codex",
      "claude-code",
      "highCapabilityCriticModelDefaults",
      "agentRegistry",
      "criticModel",
      "pushbackFree",
      "validateHighCapabilityCriticModel",
      "lowCapabilityPattern",
      "\"--model\"",
      "\"-m\"",
      "HARNESS_CODEX_CRITIC_MODEL",
      "HARNESS_CLAUDE_CRITIC_MODEL",
      "NO_BLOCKING_ISSUES",
      "BLOCKING_FINDINGS",
    ],
    transportScriptPath,
    failures,
  );
}

{
  const registryPath = "framework/registry/agents.json";
  if (!(await pathExists(harnessRoot, registryPath))) {
    failures.push(`missing ${registryPath}`);
  } else {
    const registry = JSON.parse(await readHarnessFile(registryPath));
    const families = Object.keys(registry.families ?? {});
    if (families.length < 2) {
      failures.push(`${registryPath} must register at least two agent families`);
    }
    for (const [family, spec] of Object.entries(registry.families ?? {})) {
      for (const field of ["cli", "defaultCriticModel", "criticModelEnv"]) {
        if (typeof spec[field] !== "string" || spec[field].length === 0) {
          failures.push(`${registryPath} family ${family} missing ${field}`);
        }
      }
      if (!Array.isArray(spec.lowCapabilityMarkers) || spec.lowCapabilityMarkers.length === 0) {
        failures.push(`${registryPath} family ${family} missing lowCapabilityMarkers`);
      }
      failures.push(...familyTransportFailures(spec, family));
      failures.push(...familyRuntimeEnforcementFailures(spec, family));
    }
  }
}

if (!(await pathExists(harnessRoot, claudeWrapperPath))) {
  failures.push(`missing ${claudeWrapperPath}`);
} else {
  const claudeWrapper = await readHarnessFile(claudeWrapperPath);
  requireIncludes(
    claudeWrapper,
    [
      "runAgentReview",
      "claude-review-json",
      "claude-code",
      "latest-claude-review.json",
      "--claude-model",
    ],
    claudeWrapperPath,
    failures,
  );
}

const template = await readHarnessFile(templatePath);
// Ledger diet (2.7.0): the core template carries a minimal fence (required=false,
// no dualRoleGovernance block — validatePayload requires that block only when a
// review is actually triggered) plus the always-needed prose evidence lines.
requireIncludes(
  template,
  [
    "## Cross-Agent Review",
    "cross-agent-review-json",
    "maxReviewIterations",
    "records",
    "Agent review packet and report",
    "Pushback-free review evidence",
    "Transport degradation acceptance",
  ],
  templatePath,
  failures,
);

const templatePayload = extractReviewPayload(template, templatePath);
if (templatePayload) {
  validatePayload(templatePayload, templatePath);
}


const legacyAcceptance = await loadLegacyPlanAcceptance();

// Priced transport degradation: every review report the plan cites — the
// labeled line AND review-output evidence refs — is checked; a plan cannot
// dodge the rule by citing a sub-packet report only as record evidence. A
// required review naming a report that does not exist is a failure, never a
// silent skip.
const checkTransportDegradation = async (file, content, payload) => {
  const refs = reviewReportRefs(content, payload);
  for (const ref of refs) {
    const reportRelative = ref.replace(/^harness\//, "");
    if (!(await pathExists(harnessRoot, reportRelative))) {
      // Reports are gitignored audit artifacts, so a fresh checkout (CI)
      // legitimately lacks them. Absence is not a dodge as long as the plan
      // carries a meaningful (or explicit n/a) degradation-acceptance line —
      // deleting a report cannot silently drop the pricing question. A
      // template placeholder or missing line still fails.
      if (payload?.required === true) {
        const acceptanceLine = content.match(/^- Transport degradation acceptance: (.+)$/m)?.[1]?.trim();
        const meaningfulOrNa =
          typeof acceptanceLine === "string" &&
          acceptanceLine.length > 0 &&
          !acceptanceLine.startsWith("<") &&
          !/^(todo|tbd|pending)$/i.test(acceptanceLine);
        if (!meaningfulOrNa) {
          failures.push(
            `${file} cites a review report that does not exist and carries no Transport degradation acceptance line: ${ref}`,
          );
        }
      }
      continue;
    }
    let report;
    try {
      report = JSON.parse(await readHarnessFile(reportRelative));
    } catch {
      failures.push(`${file} cites a review report that is not valid JSON: ${ref}`);
      continue;
    }
    failures.push(...transportDegradationFailures(content, report, file));
  }
};

// Requiredness cannot be lost by leaving the payload empty: the plan's own
// "## Affected Paths" section (parsed by the shared rule in
// dual-role-governance-rules.mjs) is cross-checked against the trigger list,
// so a framework change with a template payload (required=false, no paths) fails.
const checkDeclaredTriggerPaths = (file, content, payload) => {
  if (!payload) {
    return;
  }
  const declared = affectedPathsFromPlan(content);
  if (declared.some(isTriggerPath) && payload.required !== true) {
    failures.push(`${file} Affected Paths include governed trigger paths but cross-agent review required is not true`);
  }
};

// Ledger diet (2.7.0): annexes are conditional, but a declared trigger still
// requires its annex. Mechanically decidable Critique And Debate triggers:
// highRisk, and framework-change (governed paths among the declared Affected
// Paths). security/runtime/conflict remain self-declared via the annex's own
// Trigger field (enforced by validate-sub-agent-ledger when present).
const meaningfulCritiqueValue = (section, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = section.match(new RegExp(`^[- ]*${escapedLabel}:[ \\t]*(.*)$`, "im"));
  const value = match ? match[1].trim().replace(/^`|`$/g, "").toLowerCase() : "";
  return value.length > 0 && value !== "n/a" && value !== "none" && !value.includes("<") && !/^(todo|tbd|pending)$/.test(value);
};

const checkTriggeredAnnexes = (file, content, payload, expectedLocation) => {
  if (!payload) {
    return;
  }
  // Same predicate as validatePayload's inferredRequired — any mechanically
  // triggered review (required flag, highRisk, declared triggerSignals such
  // as security/runtime/conflict, or governed affected paths) requires the
  // Critique And Debate annex; the two predicates must never drift.
  const triggered =
    payload.required === true ||
    payload.highRisk === true ||
    (Array.isArray(payload.triggerSignals) && payload.triggerSignals.length > 0) ||
    affectedPathsFromPlan(content).some(isTriggerPath);
  if (!triggered) {
    return;
  }
  if (!content.includes("## Critique And Debate")) {
    failures.push(
      `${file} has a triggered Critique And Debate annex (highRisk or governed affected paths) but the annex is missing (harness ledger annex <slug> critique-and-debate)`,
    );
    return;
  }
  // Presence is not enough: a mechanically triggered annex must carry
  // meaningful content regardless of its self-declared Trigger label.
  // Active plans may still be mid-debate; completed plans may not.
  // Compatibility: pre-diet completed plans carry the section as a template
  // artifact whose Trigger line is still the untouched enum menu (contains
  // "|") — their critique evidence lives in the review records instead; the
  // 2.7.0 annex prefills a concrete trigger, so new plans are always enforced.
  if (expectedLocation === "completed") {
    const section = extractSection(content, "Critique And Debate");
    const triggerLine = section.match(/^[- ]*Trigger:[ \t]*(.*)$/im)?.[1] ?? "";
    if (triggerLine.includes("|")) {
      return;
    }
    for (const label of ["Critic findings", "Resolutions", "Final synthesis"]) {
      if (!meaningfulCritiqueValue(section, label)) {
        failures.push(`${file} triggered Critique And Debate annex missing meaningful ${label}`);
      }
    }
  }
};

for (const file of await planFiles("exec-plans/active")) {
  const content = await readHarnessFile(file);
  const payload = extractReviewPayload(content, file);
  if (payload) {
    validatePayload(payload, file, "active");
  }
  checkDeclaredTriggerPaths(file, content, payload);
  checkTriggeredAnnexes(file, content, payload, "active");
}

for (const file of await planFiles("exec-plans/completed")) {
  if (legacyAcceptance.plans.has(file)) {
    continue;
  }
  const content = await readHarnessFile(file);
  const payload = extractReviewPayload(content, file);
  if (payload) {
    validatePayload(payload, file, "completed");
  }
  checkDeclaredTriggerPaths(file, content, payload);
  checkTriggeredAnnexes(file, content, payload, "completed");
  await checkTransportDegradation(file, content, payload);
}

// Source mode: the source repository's own governance ledgers live under
// development/exec-plans/ — they supply the terminal evidence for framework
// commits and must meet the same schema, not sit in a scan blind spot.
// Pre-scan-extension history is exempt only via the git-anchored source
// acceptance file (development/governance/legacy-plan-acceptance.json).
const validationMode = await getValidationMode();
if (validationMode.isSource) {
  const sourceAcceptance = await loadLegacyPlanAcceptance({
    root: workspaceRoot,
    acceptancePath: "development/governance/legacy-plan-acceptance.json",
    planPrefix: "development/exec-plans/completed/",
  });
  failures.push(...sourceAcceptance.failures);
  const sourcePlanFiles = async (relativeDir) => {
    const entries = await readdir(path.join(workspaceRoot, relativeDir), { withFileTypes: true }).catch(() => []);
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
      .map((entry) => `${relativeDir}/${entry.name}`);
  };
  for (const file of await sourcePlanFiles("development/exec-plans/active")) {
    const content = await readWorkspaceFile(file);
    const payload = extractReviewPayload(content, file);
    if (payload) {
      validatePayload(payload, file, "active");
    }
    checkDeclaredTriggerPaths(file, content, payload);
  checkTriggeredAnnexes(file, content, payload, "active");
  }
  for (const file of await sourcePlanFiles("development/exec-plans/completed")) {
    if (sourceAcceptance.plans.has(file)) {
      continue;
    }
    const content = await readWorkspaceFile(file);
    const payload = extractReviewPayload(content, file);
    if (payload) {
      validatePayload(payload, file, "completed");
    }
    checkDeclaredTriggerPaths(file, content, payload);
  checkTriggeredAnnexes(file, content, payload, "completed");
    await checkTransportDegradation(file, content, payload);
  }
}

// Calibration floor and staleness: registry ceilings must not undercut
// measured recommendations, and a calibration recorded against a different
// CLI version than the one now installed is stale (skipped when the CLI is
// not installed here — absence is not staleness).
const currentCliVersion = (cli) => {
  const result = spawnSync(cli, ["--version"], { encoding: "utf8", timeout: 15_000 });
  if (result.error || result.status !== 0) {
    return null;
  }
  return (result.stdout || result.stderr).trim().split("\n")[0] || null;
};

if (await pathExists(harnessRoot, "framework/registry/agents.json")) {
  const transportRegistry = JSON.parse(await readHarnessFile("framework/registry/agents.json"));
  for (const [family, spec] of Object.entries(transportRegistry.families ?? {})) {
    const calibrationRelative = `artifacts/telemetry/critic-calibration-${family}.json`;
    if (await pathExists(harnessRoot, calibrationRelative)) {
      try {
        const calibration = JSON.parse(await readHarnessFile(calibrationRelative));
        failures.push(...calibrationCeilingFailures(spec, calibration, family));
        failures.push(...calibrationStalenessFailures(calibration, family, currentCliVersion(spec.cli)));
      } catch {
        failures.push(`${calibrationRelative} is not valid JSON`);
      }
    }
  }
}

finishValidation("validate-cross-agent-review", failures, {
  maxReviewIterations,
  triggerPaths: exactTriggerPaths.size,
});
