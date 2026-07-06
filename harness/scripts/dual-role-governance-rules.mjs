import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const registryPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "framework", "registry", "agents.json");
export const agentRegistry = JSON.parse(readFileSync(registryPath, "utf8"));
const registryAliases = new Map();
for (const [family, spec] of Object.entries(agentRegistry.families)) {
  for (const alias of spec.aliases ?? []) registryAliases.set(alias, family);
}

export const allowedDualRoleAgents = new Set(Object.keys(agentRegistry.families));
export const allowedDualRoleModes = new Set(["cross-agent", "single-family-dual-role"]);
export const allowedDualRoleTerminalStatuses = new Set([
  "pending",
  "cross-agent-complete",
  "single-family-dual-role-complete",
  "blocked",
  "fallback-accepted",
]);

const placeholderValues = new Set(["", "n/a", "none", "unknown", "todo", "tbd", "pending"]);

export const normalizeDualRoleAgent = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-");
  return registryAliases.get(normalized) ?? normalized;
};

export const isMeaningfulDualRoleEvidence = (value, { allowPending = false } = {}) => {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (allowPending && normalized === "pending") {
    return true;
  }

  if (placeholderValues.has(normalized)) {
    return false;
  }

  return !normalized.includes("<") && !normalized.includes("...");
};

export const validateDualRoleGovernance = (
  config,
  {
    label = "dualRoleGovernance",
    expectedLocation = "template",
    requireTerminal = false,
  } = {},
) => {
  const failures = [];

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [`${label} must be an object`];
  }

  if (typeof config.required !== "boolean") {
    failures.push(`${label}.required must be boolean`);
  }

  if (!allowedDualRoleModes.has(config.mode)) {
    failures.push(`${label}.mode must be cross-agent or single-family-dual-role`);
  }

  const primaryPerformer = normalizeDualRoleAgent(config.primaryPerformer);
  const independentCritic = normalizeDualRoleAgent(config.independentCritic);

  if (!allowedDualRoleAgents.has(primaryPerformer)) {
    failures.push(`${label}.primaryPerformer must be a registered agent family`);
  }

  if (!allowedDualRoleAgents.has(independentCritic)) {
    failures.push(`${label}.independentCritic must be a registered agent family`);
  }

  if (typeof config.agentFamilySeparation !== "boolean") {
    failures.push(`${label}.agentFamilySeparation must be boolean`);
  }

  if (!allowedDualRoleTerminalStatuses.has(config.terminalStatus)) {
    failures.push(`${label}.terminalStatus is invalid: ${config.terminalStatus}`);
  }

  if (config.mode === "cross-agent") {
    if (primaryPerformer === independentCritic) {
      failures.push(`${label} cross-agent mode requires different agent families`);
    }
    if (config.agentFamilySeparation !== true) {
      failures.push(`${label} cross-agent mode requires agentFamilySeparation=true`);
    }
    const pair = new Set([primaryPerformer, independentCritic]);
    if (pair.size !== 2 || ![...pair].every((family) => allowedDualRoleAgents.has(family))) {
      failures.push(`${label} cross-agent mode requires two distinct registered agent families`);
    }
    if (requireTerminal && config.terminalStatus !== "cross-agent-complete") {
      failures.push(`${label} cross-agent completion requires terminalStatus=cross-agent-complete`);
    }
  }

  if (config.mode === "single-family-dual-role") {
    if (config.agentFamilySeparation !== false) {
      failures.push(`${label} single-family fallback requires agentFamilySeparation=false`);
    }
    if (primaryPerformer !== independentCritic) {
      failures.push(`${label} single-family fallback must use one available agent family for both roles`);
    }
    if (!isMeaningfulDualRoleEvidence(config.missingAgentAvailabilityEvidence)) {
      failures.push(`${label} single-family fallback requires missingAgentAvailabilityEvidence`);
    }
    const roleEvidence = typeof config.roleSeparationEvidence === "string" ? config.roleSeparationEvidence.toLowerCase() : "";
    if (!roleEvidence.includes("separate") || !roleEvidence.includes("critic") || !/(performer|primary)/.test(roleEvidence)) {
      failures.push(`${label} single-family fallback requires roleSeparationEvidence to describe separate performer and critic passes`);
    }
    if (requireTerminal && config.terminalStatus !== "single-family-dual-role-complete") {
      failures.push(`${label} single-family completion requires terminalStatus=single-family-dual-role-complete`);
    }
  }

  for (const field of ["roleSeparationEvidence", "internalDecompositionSummary", "consolidatedOutputOwner"]) {
    if (!isMeaningfulDualRoleEvidence(config[field], { allowPending: expectedLocation === "active" })) {
      failures.push(`${label}.${field} must be meaningful`);
    }
  }

  if (config.consolidatedOutputOwner !== "primary-performer") {
    failures.push(`${label}.consolidatedOutputOwner must equal primary-performer`);
  }

  if (config.required === true && config.terminalStatus === "pending" && requireTerminal) {
    failures.push(`${label} required completed review cannot remain pending`);
  }

  return failures;
};

// --- Transport policy rules (pure, unit-testable) ---

const labeledValue = (content, label) => {
  const match = String(content ?? "").match(new RegExp(`^- ${label}:[ \\t]*(.*)$`, "m"));
  return match ? match[1].trim() : "";
};

const meaningfulAcceptance = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/^`|`$/g, "");
  return normalized.length > 0 && !placeholderValues.has(normalized) && !normalized.includes("<");
};

// Priced degradation: a complete review whose report says subPacketFallback
// (the critic reviewed the primary performer's summary, not the artifacts)
// requires explicit acceptance in the plan. Reports predating schema 1.1.0
// lack the field and are exempt — history is never rewritten.
export const transportDegradationFailures = (planContent, report, label) => {
  const failures = [];
  if (!report || typeof report !== "object" || report.subPacketFallback !== true) {
    return failures;
  }
  const acceptance = labeledValue(planContent, "Transport degradation acceptance");
  if (!meaningfulAcceptance(acceptance)) {
    failures.push(
      `${label} review completed below the packet-file rung (${report.rungDepth ?? report.selectedAttempt}); the plan must record a meaningful "Transport degradation acceptance" rationale`,
    );
  }
  return failures;
};

// Calibration floor: when a calibration artifact exists for a family, the
// registry ceilings must not undercut the measured recommendation.
export const calibrationCeilingFailures = (familySpec, calibration, family) => {
  const failures = [];
  const ceilings = familySpec?.transport?.rungCeilingsMs;
  const recommended = calibration?.recommendedCeilingsMs;
  if (!ceilings || !recommended) {
    return failures;
  }
  for (const [rung, recommendation] of Object.entries(recommended)) {
    if (Number.isFinite(ceilings[rung]) && Number.isFinite(recommendation) && ceilings[rung] < recommendation) {
      failures.push(
        `registry transport ceiling for ${family}/${rung} (${ceilings[rung]}ms) is below the calibrated recommendation (${recommendation}ms); raise the ceiling or recalibrate`,
      );
    }
  }
  return failures;
};

// Every review report a plan cites — the labeled line plus any review-output
// evidence refs in the payload — so the priced-degradation check cannot be
// dodged by citing the report only as record evidence.
export const reviewReportRefs = (planContent, payload) => {
  const refs = new Set();
  // Both the pre-diet label and the 2.7.0 core-template merged label; the
  // merged line may carry several paths — every harness/-relative REPORT
  // token (.json) is priced, so a renamed line cannot dodge the degradation
  // check, while the packet (.md) the same label names is never parsed as a
  // report.
  for (const label of ["Agent review report", "Agent review packet and report"]) {
    const labeled = labeledValue(planContent, label);
    for (const token of labeled.split(/[\s,]+/)) {
      const cleaned = token.replace(/^`|`$/g, "");
      if (cleaned.startsWith("harness/") && cleaned.endsWith(".json")) {
        refs.add(cleaned);
      }
    }
  }
  for (const record of payload?.records ?? []) {
    const evidenceSets = [record.evidence ?? [], ...(record.iterations ?? []).map((iteration) => iteration.evidence ?? [])];
    for (const evidence of evidenceSets) {
      for (const item of evidence) {
        if (item?.type === "review-output" && typeof item.ref === "string" && item.ref.startsWith("harness/")) {
          refs.add(item.ref);
        }
      }
    }
  }
  return [...refs];
};

// Calibration staleness: measured data must track the measured system. When
// the critic CLI version at validation time differs from the version the
// calibration recorded, the calibration is stale and must be rerun.
export const calibrationStalenessFailures = (calibration, family, currentCliVersion) => {
  const failures = [];
  if (!calibration?.cliVersion || !currentCliVersion) {
    return failures;
  }
  if (calibration.cliVersion.trim() !== currentCliVersion.trim()) {
    failures.push(
      `calibration for ${family} was recorded against CLI version "${calibration.cliVersion}" but the current version is "${currentCliVersion}"; rerun \`harness review calibrate --family ${family}\``,
    );
  }
  return failures;
};

// Registry transport completeness: every family must fully define its
// transport policy in the registry — a partial or missing block would
// otherwise silently fall back to script constants, reopening the
// guessed-constants defect class.
export const requiredTransportRungs = Object.freeze([
  "liveness",
  "packet-file",
  "evidence-summary",
  "minimal-blocking-review",
]);

// Declared work surface of a plan — defined in the dependency-free
// ledger-rules module (the commit gate and statusline load it without
// touching the registry) and re-exported here for the validators.
export { affectedPathsFromPlan } from "./ledger-rules.mjs";

// maxReviewIterations bounds the primary review loop; a superseding
// verification record (supersedesReviewId present) honestly enumerates as
// many recheck rounds as terminal convergence actually took — capping it
// would force splitting or hiding real history (framework/process/review.md).
export const recordIterationCapFailures = (record, maxReviewIterations, recordLabel) => {
  const failures = [];
  const isSupersedingVerification =
    typeof record?.supersedesReviewId === "string" && record.supersedesReviewId.trim().length > 0;
  const iterations = Array.isArray(record?.iterations) ? record.iterations : null;
  if (iterations && !isSupersedingVerification && iterations.length > maxReviewIterations) {
    failures.push(`${recordLabel} exceeds maxReviewIterations`);
  }
  if (record?.status === "complete") {
    if (!iterations || iterations.length < 1 || (!isSupersedingVerification && iterations.length > maxReviewIterations)) {
      failures.push(
        `${recordLabel} complete status requires one to ${maxReviewIterations} iterations (superseding verification records may enumerate more)`,
      );
    }
  }
  return failures;
};

// Runtime enforcement capability is per-family registry data: which harness
// visibility surfaces the family's runtime can mechanically enforce. All-false
// is valid only with a recorded basis — a declared exception, never a silent gap.
export const familyRuntimeEnforcementFailures = (spec, family) => {
  const failures = [];
  const enforcement = spec?.runtimeEnforcement;
  if (!enforcement || typeof enforcement !== "object") {
    failures.push(`registry family ${family} missing runtimeEnforcement policy`);
    return failures;
  }
  for (const capability of ["statusline", "promptReinjection", "responseCheck"]) {
    if (typeof enforcement[capability] !== "boolean") {
      failures.push(`registry family ${family} runtimeEnforcement.${capability} must be a boolean`);
    }
  }
  if (typeof enforcement.basis !== "string" || enforcement.basis.trim().length === 0) {
    failures.push(`registry family ${family} runtimeEnforcement.basis must record a dated basis`);
  }
  return failures;
};

export const familyTransportFailures = (spec, family) => {
  const failures = [];
  const transport = spec?.transport;
  if (!transport || typeof transport !== "object") {
    failures.push(`registry family ${family} missing transport policy`);
    return failures;
  }
  for (const rung of requiredTransportRungs) {
    if (!Number.isFinite(transport.rungCeilingsMs?.[rung]) || transport.rungCeilingsMs[rung] < 1000) {
      failures.push(`registry family ${family} transport.rungCeilingsMs.${rung} must be a number >= 1000`);
    }
  }
  if (!Number.isInteger(transport.retriesPerRung) || transport.retriesPerRung < 0) {
    failures.push(`registry family ${family} transport.retriesPerRung must be a non-negative integer`);
  }
  if (typeof transport.ceilingBasis !== "string" || transport.ceilingBasis.trim().length === 0) {
    failures.push(`registry family ${family} transport.ceilingBasis must record the basis (calibration or dated rationale)`);
  }
  return failures;
};
