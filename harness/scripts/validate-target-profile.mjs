import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  finishValidation,
  getByPath,
  isIsoDateTime,
  isMeaningful,
  isObject,
  parseJsonFence,
  pathExists,
  readHarnessFile,
  workspaceRoot,
} from "./validation-helpers.mjs";
import { getValidationMode } from "./validation-mode.mjs";

const profilePath = "override/validation/target-validation-profile.md";
const intakePath = "override/intake/project-intake.md";
const allowedGroups = new Set([
  "build",
  "lint",
  "unit-test",
  "integration-test",
  "architecture",
  "runtime",
  "browser",
  "observability",
  "cleanup",
  "pr-ci",
]);
const allowedWritesTo = new Set(["repo", "temp", "external", "none"]);
const allowedArtifactPolicies = new Set(["tracked", "ignored", "temp-routed", "manual-cleanup", "none"]);
const allowedApprovalRisks = new Set(["none", "cleanup", "external-write", "destructive"]);

export const validateCommandArtifactPolicy = (command, label) => {
  const policyFailures = [];

  if (command.enabled !== true) {
    return policyFailures;
  }

  if (!allowedWritesTo.has(command.writesTo)) {
    policyFailures.push(`${label} writesTo must be one of: ${[...allowedWritesTo].join(", ")}`);
  }
  if (!allowedArtifactPolicies.has(command.artifactPolicy)) {
    policyFailures.push(`${label} artifactPolicy must be one of: ${[...allowedArtifactPolicies].join(", ")}`);
  }
  if (!allowedApprovalRisks.has(command.approvalRisk)) {
    policyFailures.push(`${label} approvalRisk must be one of: ${[...allowedApprovalRisks].join(", ")}`);
  }

  if (command.artifactPolicy === "manual-cleanup" && !isMeaningful(command.artifactRationale)) {
    policyFailures.push(`${label} artifactRationale is required when artifactPolicy is manual-cleanup`);
  }

  if (command.approvalRisk === "destructive") {
    policyFailures.push(`${label} enabled command must not declare destructive approvalRisk; record a blocker or require explicit approval instead`);
  }

  if (command.writesTo === "none" && command.artifactPolicy !== "none") {
    policyFailures.push(`${label} artifactPolicy must be none when writesTo is none`);
  }
  if (command.artifactPolicy === "none" && command.writesTo !== "none") {
    policyFailures.push(`${label} writesTo must be none when artifactPolicy is none`);
  }
  if (command.artifactPolicy === "temp-routed" && command.writesTo !== "temp") {
    policyFailures.push(`${label} writesTo must be temp when artifactPolicy is temp-routed`);
  }
  if (command.writesTo === "external" && command.approvalRisk !== "external-write") {
    policyFailures.push(`${label} approvalRisk must be external-write when writesTo is external`);
  }
  if (command.approvalRisk === "cleanup" && command.artifactPolicy !== "manual-cleanup") {
    policyFailures.push(`${label} artifactPolicy must be manual-cleanup when approvalRisk is cleanup`);
  }

  return policyFailures;
};

export const runValidation = async () => {
  const failures = [];
  const mode = await getValidationMode();
  if (mode.isSourceFinal) {
    finishValidation("validate-target-profile", failures, {
      mode: mode.mode,
      notApplicable: "DevelopmentHarness source-final mode stores source validation evidence under development/validation/.",
    });
    return;
  }

  const profileContent = await readHarnessFile(profilePath).catch(() => null);
  const intakeContent = await readHarnessFile(intakePath).catch(() => null);

  if (!profileContent) {
    failures.push(`missing ${profilePath}`);
  }
  if (!intakeContent) {
    failures.push(`missing ${intakePath}`);
  }

  const profile = profileContent ? parseJsonFence(profileContent, "target-validation-json", profilePath, failures) : null;
  const intake = intakeContent ? parseJsonFence(intakeContent, "intake-json", intakePath, failures) : null;
  const commandResults = [];

  const blockerFor = (commandId) => {
    if (!Array.isArray(profile?.infraBlockers)) {
      return null;
    }

    return profile.infraBlockers.find((blocker) => blocker.commandId === commandId);
  };

  const validateInfraBlocker = (blocker, label) => {
    if (!isObject(blocker)) {
      failures.push(`${label} infra blocker must be an object`);
      return false;
    }

    let valid = true;
    for (const field of ["commandId", "reason", "evidence", "reviewerRole", "approvedAt", "followUp"]) {
      if (!isMeaningful(blocker[field])) {
        failures.push(`${label} infra blocker missing meaningful ${field}`);
        valid = false;
      }
    }

    if (!isIsoDateTime(blocker.approvedAt)) {
      failures.push(`${label} infra blocker approvedAt must be ISO-8601 date-time`);
      valid = false;
    }

    return valid;
  };

  if (profile) {
    if (profile.schemaVersion !== "1.0.0") {
      failures.push(`${profilePath} schemaVersion must equal 1.0.0`);
    }
    if (!isMeaningful(profile.profileId)) {
      failures.push(`${profilePath} profileId must be meaningful`);
    }
    if (profile.intakeRef !== intakePath) {
      failures.push(`${profilePath} intakeRef must equal ${intakePath}`);
    }
    if (!Array.isArray(profile.commands) || profile.commands.length === 0) {
      failures.push(`${profilePath} commands must be non-empty`);
    }
    if (!Array.isArray(profile.infraBlockers)) {
      failures.push(`${profilePath} infraBlockers must be an array`);
    }

    const seenIds = new Set();
    const enabledGroups = new Set();
    for (const [index, command] of (profile.commands ?? []).entries()) {
      const label = `${profilePath} commands[${index}]`;
      if (!isObject(command)) {
        failures.push(`${label} must be an object`);
        continue;
      }

      if (!isMeaningful(command.id)) {
        failures.push(`${label} id must be meaningful`);
      } else if (seenIds.has(command.id)) {
        failures.push(`${label} duplicate id: ${command.id}`);
      } else {
        seenIds.add(command.id);
      }

      if (!allowedGroups.has(command.group)) {
        failures.push(`${label} invalid group: ${command.group}`);
      }
      if (command.enabled !== true && command.enabled !== false) {
        failures.push(`${label} enabled must be boolean`);
      }
      if (!Number.isInteger(command.timeoutSeconds) || command.timeoutSeconds < 1 || command.timeoutSeconds > 900) {
        failures.push(`${label} timeoutSeconds must be 1..900`);
      }
      if (!isMeaningful(command.cwd) || command.cwd.startsWith("/") || command.cwd.split("/").includes("..")) {
        failures.push(`${label} cwd must be a repo-relative path`);
      } else if (!(await pathExists(workspaceRoot, command.cwd))) {
        failures.push(`${label} cwd does not exist: ${command.cwd}`);
      }
      if (!Array.isArray(command.command) || command.command.length === 0 || !command.command.every((part) => typeof part === "string" && part.length > 0)) {
        failures.push(`${label} command must be a non-empty array of strings`);
      } else if (command.command.some((part) => part.includes("validate-all.mjs"))) {
        failures.push(`${label} must not call validate-all.mjs recursively`);
      }
      if (!isMeaningful(command.evidence) || command.evidence.startsWith("/") || command.evidence.split("/").includes("..")) {
        failures.push(`${label} evidence must be repo-relative`);
      }

      if (command.enabled === true) {
        failures.push(...validateCommandArtifactPolicy(command, label));
        enabledGroups.add(command.group);
      }
    }

    const expectedGroups = intake ? getByPath(intake, "validation.expectedCommandGroups") : [];
    if (Array.isArray(expectedGroups)) {
      for (const group of expectedGroups) {
        if (!enabledGroups.has(group)) {
          failures.push(`${profilePath} missing enabled command for expected group: ${group}`);
        }
      }
    }
  }

  if (failures.length === 0 && profile) {
    for (const command of profile.commands.filter((item) => item.enabled === true)) {
      const startedAt = Date.now();
      const result = spawnSync(command.command[0], command.command.slice(1), {
        cwd: path.join(workspaceRoot, command.cwd),
        encoding: "utf8",
        timeout: command.timeoutSeconds * 1000,
      });

      const commandResult = {
        id: command.id,
        group: command.group,
        status: result.status === 0 ? "passed" : "failed",
        durationMs: Date.now() - startedAt,
      };
      commandResults.push(commandResult);

      if (result.error) {
        commandResult.status = "failed";
        commandResult.error = result.error.message;
      }

      if (commandResult.status !== "passed") {
        const blocker = blockerFor(command.id);
        if (!validateInfraBlocker(blocker, `${profilePath} command ${command.id}`)) {
          failures.push(`${profilePath} command ${command.id} failed without valid infra blocker`);
        }
      }
    }
  }

  finishValidation("validate-target-profile", failures, { commands: commandResults });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runValidation();
}
