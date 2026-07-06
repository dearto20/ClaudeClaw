import {
  finishValidation,
  getByPath,
  hasMeaningfulValue,
  harnessRoot,
  isIsoDateTime,
  isMeaningful,
  isObject,
  parseJsonFence,
  pathExists,
  readHarnessFile,
  requireIncludes,
} from "./validation-helpers.mjs";
import { getValidationMode } from "./validation-mode.mjs";

const failures = [];
const mode = await getValidationMode();
const intakePath = "override/intake/project-intake.md";
const templatePath = "framework/templates/bootstrap-intake.md";
const schemaPath = "framework/schemas/bootstrap-intake.schema.json";

if (mode.isSourceFinal) {
  finishValidation("validate-intake", failures, {
    mode: mode.mode,
    notApplicable: "DevelopmentHarness source-final mode stores source intake under development/intake/.",
  });
  process.exit(0);
}

for (const requiredPath of [intakePath, templatePath, schemaPath, "framework/process/bootstrap-intake.md"]) {
  if (!(await pathExists(harnessRoot, requiredPath))) {
    failures.push(`missing ${requiredPath}`);
  }
}

if (await pathExists(harnessRoot, "framework/process/bootstrap-intake.md")) {
  const processDoc = await readHarnessFile("framework/process/bootstrap-intake.md");
  requireIncludes(
    processDoc,
    ["draft", "incomplete", "ready", "Critical Fields", "Deferred Noncritical Fields", "feature implementation is blocked"],
    "bootstrap intake process",
    failures,
  );
}

const criticalFields = [
  "project.name",
  "project.summary",
  "project.primaryGoal",
  "project.successCriteria",
  "project.nonGoals",
  "target.platforms",
  "target.deploymentModel",
  "target.runtimeSurfaces",
  "target.environments",
  "users.audiences",
  "users.roles",
  "users.primaryUser",
  "domain.verticals",
  "domain.workflows",
  "domain.criticality",
  "risk.dataSensitivity",
  "risk.securityPosture",
  "risk.regulatoryPosture",
  "risk.operationalImpact",
  "validation.expectedCommandGroups",
  "validation.browserRequired",
  "validation.observabilityRequired",
  "validation.runtimeRequired",
  "constraints",
];

let intake = null;
if (await pathExists(harnessRoot, intakePath)) {
  intake = parseJsonFence(await readHarnessFile(intakePath), "intake-json", intakePath, failures);
}

if (intake) {
  if (intake.schemaVersion !== "1.0.0") {
    failures.push(`${intakePath} schemaVersion must equal 1.0.0`);
  }

  if (!["draft", "incomplete", "ready"].includes(intake.state)) {
    failures.push(`${intakePath} has invalid state: ${intake.state}`);
  }

  for (const field of criticalFields) {
    const value = getByPath(intake, field);
    if (!hasMeaningfulValue(value)) {
      failures.push(`${intakePath} missing critical field: ${field}`);
    }
  }

  if (intake.state !== "ready") {
    failures.push(`${intakePath} state ${intake.state} blocks feature implementation`);
  }

  if (!Array.isArray(intake.deferredNoncriticalFields)) {
    failures.push(`${intakePath} deferredNoncriticalFields must be an array`);
  } else {
    const criticalSet = new Set(criticalFields);
    for (const [index, deferred] of intake.deferredNoncriticalFields.entries()) {
      const label = `${intakePath} deferredNoncriticalFields[${index}]`;
      if (!isObject(deferred)) {
        failures.push(`${label} must be an object`);
        continue;
      }

      for (const field of ["field", "rationale", "ownerRole", "reviewerRole", "approvedAt", "replacementEvidence", "followUp"]) {
        if (!Object.prototype.hasOwnProperty.call(deferred, field)) {
          failures.push(`${label} missing ${field}`);
        }
      }

      if (!isMeaningful(deferred.field)) {
        failures.push(`${label} field must be meaningful`);
      } else if (criticalSet.has(deferred.field) && intake.state === "ready") {
        failures.push(`${label} cannot defer critical field while intake is ready: ${deferred.field}`);
      }

      for (const field of ["rationale", "ownerRole", "reviewerRole", "followUp"]) {
        if (!isMeaningful(deferred[field])) {
          failures.push(`${label} ${field} must be meaningful`);
        }
      }

      if (!isIsoDateTime(deferred.approvedAt)) {
        failures.push(`${label} approvedAt must be ISO-8601 date-time`);
      }

      if (!Array.isArray(deferred.replacementEvidence) || deferred.replacementEvidence.length === 0) {
        failures.push(`${label} replacementEvidence must be non-empty`);
      }
    }
  }
}

finishValidation("validate-intake", failures, { criticalFields: criticalFields.length });
