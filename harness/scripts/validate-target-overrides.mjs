import {
  finishValidation,
  getByPath,
  harnessRoot,
  isIsoDateTime,
  isMeaningful,
  isObject,
  parseJsonFence,
  pathExists,
  readHarnessFile,
  workspaceRoot,
} from "./validation-helpers.mjs";
import { getValidationMode } from "./validation-mode.mjs";

const failures = [];
const mode = await getValidationMode();
const intakePath = "override/intake/project-intake.md";
const profilePath = "override/validation/target-validation-profile.md";
const mechanisms = [
  { id: "worktree-runtime", path: "override/runtime/worktree-runtime.md" },
  { id: "observability", path: "override/observability/observability.md" },
  { id: "browser-validation", path: "override/browser/browser-validation.md" },
  { id: "recurring-cleanup", path: "override/cleanup/recurring-cleanup.md" },
  { id: "architecture-invariants", path: "override/quality/architecture-invariants.md" },
  { id: "taste-invariants", path: "override/quality/taste-invariants.md" },
  { id: "pr-ci-loop", path: "override/pr/pr-ci-loop.md" },
];

if (mode.isSourceFinal) {
  finishValidation("validate-target-overrides", failures, {
    mode: mode.mode,
    notApplicable: "DevelopmentHarness source-final mode does not keep target-owned harness/override artifacts.",
  });
  process.exit(0);
}

if (!mode.isSource && (await pathExists(workspaceRoot, "development"))) {
  failures.push("target-mode validation forbids root development/; use DevelopmentHarness as a source archive and materialize only the manifest-approved distributable surface");
}

const intakeContent = await readHarnessFile(intakePath).catch(() => null);
const profileContent = await readHarnessFile(profilePath).catch(() => null);
const intake = intakeContent ? parseJsonFence(intakeContent, "intake-json", intakePath, failures) : null;
const profile = profileContent ? parseJsonFence(profileContent, "target-validation-json", profilePath, failures) : null;
const enabledCommandIds = new Set((profile?.commands ?? []).filter((command) => command.enabled === true).map((command) => command.id));

if (!intakeContent) {
  failures.push(`missing ${intakePath}`);
}
if (!profileContent) {
  failures.push(`missing ${profilePath}`);
}

const validateEvidence = (evidence, label) => {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    failures.push(`${label} evidence must be non-empty`);
    return;
  }

  for (const [index, item] of evidence.entries()) {
    const itemLabel = `${label} evidence[${index}]`;
    if (!isObject(item)) {
      failures.push(`${itemLabel} must be an object`);
      continue;
    }
    for (const field of ["type", "ref", "summary"]) {
      if (!isMeaningful(item[field])) {
        failures.push(`${itemLabel} ${field} must be meaningful`);
      }
    }
  }
};

const validateNotApplicable = (payload, label, linkedIntakeFields) => {
  if (!isObject(payload)) {
    failures.push(`${label} notApplicable must be an object`);
    return;
  }

  for (const field of ["rationale", "reviewerRole", "approvedAt", "linkedIntakeField"]) {
    if (!isMeaningful(payload[field])) {
      failures.push(`${label} notApplicable ${field} must be meaningful`);
    }
  }

  if (!isIsoDateTime(payload.approvedAt)) {
    failures.push(`${label} notApplicable approvedAt must be ISO-8601 date-time`);
  }

  if (!linkedIntakeFields.includes(payload.linkedIntakeField)) {
    failures.push(`${label} notApplicable linkedIntakeField must be listed in linkedIntakeFields`);
  } else if (intake && getByPath(intake, payload.linkedIntakeField) === undefined) {
    failures.push(`${label} notApplicable linkedIntakeField does not exist in intake`);
  }

  if (payload.highRisk !== true && payload.highRisk !== false) {
    failures.push(`${label} notApplicable highRisk must be boolean`);
  }

  if (payload.highRisk === true && !isMeaningful(payload.crossAgentReviewRef)) {
    failures.push(`${label} high-risk notApplicable requires crossAgentReviewRef`);
  }

  validateEvidence(payload.replacementEvidence, `${label} notApplicable replacementEvidence`);
};

for (const mechanism of mechanisms) {
  if (!(await pathExists(harnessRoot, mechanism.path))) {
    failures.push(`missing ${mechanism.path}`);
    continue;
  }

  const payload = parseJsonFence(await readHarnessFile(mechanism.path), "target-mechanism-json", mechanism.path, failures);
  if (!payload) {
    continue;
  }

  const label = mechanism.path;
  if (payload.schemaVersion !== "1.0.0") {
    failures.push(`${label} schemaVersion must equal 1.0.0`);
  }
  if (payload.id !== mechanism.id) {
    failures.push(`${label} id must equal ${mechanism.id}`);
  }
  if (!["applicable", "not-applicable"].includes(payload.status)) {
    failures.push(`${label} invalid status: ${payload.status}`);
  }
  if (!Array.isArray(payload.linkedIntakeFields) || payload.linkedIntakeFields.length === 0) {
    failures.push(`${label} linkedIntakeFields must be non-empty`);
  } else if (intake) {
    for (const field of payload.linkedIntakeFields) {
      if (getByPath(intake, field) === undefined) {
        failures.push(`${label} linked intake field does not exist: ${field}`);
      }
    }
  }
  if (!Array.isArray(payload.profileCommandIds)) {
    failures.push(`${label} profileCommandIds must be an array`);
  }

  if (payload.status === "applicable") {
    if (!Array.isArray(payload.profileCommandIds) || payload.profileCommandIds.length === 0) {
      failures.push(`${label} applicable mechanism must list profileCommandIds`);
    } else {
      for (const commandId of payload.profileCommandIds) {
        if (!enabledCommandIds.has(commandId)) {
          failures.push(`${label} references missing or disabled target profile command: ${commandId}`);
        }
      }
    }
    if (payload.notApplicable !== null) {
      failures.push(`${label} applicable mechanism must set notApplicable to null`);
    }
    validateEvidence(payload.evidence, label);
  }

  if (payload.status === "not-applicable") {
    if (Array.isArray(payload.profileCommandIds) && payload.profileCommandIds.length > 0) {
      failures.push(`${label} not-applicable mechanism must not list profileCommandIds`);
    }
    validateNotApplicable(payload.notApplicable, label, payload.linkedIntakeFields ?? []);
  }
}

finishValidation("validate-target-overrides", failures, { mechanisms: mechanisms.length });
