// Gate: the harness-engineering adoption ledger is well-formed and locally
// enforced. Policy: framework/process/references.md — adoption is incident-
// driven; there is no per-heading coverage requirement against the external
// article (a coverage claim that cannot be verified offline is invalid).

import { finishValidation, pathExists, readHarnessFile, harnessRoot, workspaceRoot } from "./validation-helpers.mjs";
import { getValidationMode } from "./validation-mode.mjs";

const mode = await getValidationMode();
const ledgerPathExists = async (relPath) => {
  if (await pathExists(harnessRoot, relPath)) return true;
  if (mode.isSource && relPath === "override/validation/target-validation-profile.md") {
    return pathExists(workspaceRoot, "development/validation/source-validation-profile.md");
  }
  if (mode.isSource && relPath.startsWith("override/")) {
    return pathExists(workspaceRoot, `development/${relPath.slice("override/".length)}`);
  }
  return false;
};

const failures = [];
const docPath = "framework/process/harness-engineering-alignment.md";

const isMeaningfulValue = (value) => typeof value === "string" && value.trim().length > 0;

const doc = await readHarnessFile(docPath);

const fenceMatches = [...doc.matchAll(/```harness-engineering-alignment-json\n([\s\S]*?)\n```/g)];
if (fenceMatches.length !== 1) {
  failures.push(`${docPath} must contain exactly one harness-engineering-alignment-json block`);
}

let contract = null;
if (fenceMatches.length === 1) {
  try {
    contract = JSON.parse(fenceMatches[0][1]);
  } catch (error) {
    failures.push(`${docPath} contract is not valid JSON: ${error.message}`);
  }
}

if (contract) {
  if (contract.schemaVersion !== "2.0.0") {
    failures.push(`${docPath} schemaVersion must be 2.0.0 (adoption-ledger form)`);
  }
  for (const field of ["title", "url", "published", "lastVerified"]) {
    if (!isMeaningfulValue(contract.source?.[field])) {
      failures.push(`${docPath} source.${field} must be a pinned value`);
    }
  }
  // The coverage contract is retired: its presence is a policy violation.
  if (contract.source?.coveragePolicy !== undefined || contract.sourceSections !== undefined) {
    failures.push(`${docPath} must not carry coveragePolicy or sourceSections — per-heading coverage against a live external source is retired (framework/process/references.md)`);
  }

  if (!Array.isArray(contract.adoptedPatterns) || contract.adoptedPatterns.length === 0) {
    failures.push(`${docPath} adoptedPatterns must be non-empty`);
  }
  for (const [index, pattern] of (contract.adoptedPatterns ?? []).entries()) {
    const label = `${docPath} adoptedPatterns[${index}]`;
    for (const field of ["id", "title", "localContract"]) {
      if (!isMeaningfulValue(pattern[field])) {
        failures.push(`${label}.${field} must be meaningful`);
      }
    }
    for (const listField of ["artifactPaths", "validationPaths"]) {
      if (!Array.isArray(pattern[listField]) || pattern[listField].length === 0) {
        failures.push(`${label}.${listField} must be a non-empty array`);
        continue;
      }
      for (const relPath of pattern[listField]) {
        if (!(await ledgerPathExists(relPath))) {
          failures.push(`${label} references missing path: ${relPath}`);
        }
      }
    }
  }

  for (const [index, pattern] of (contract.deferredPatterns ?? []).entries()) {
    const label = `${docPath} deferredPatterns[${index}]`;
    if (!isMeaningfulValue(pattern.id) || !isMeaningfulValue(pattern.reason)) {
      failures.push(`${label} must record id and reason`);
    }
  }
}

finishValidation("validate-harness-engineering-alignment", failures, {
  adoptedPatterns: contract?.adoptedPatterns?.length ?? 0,
  deferredPatterns: contract?.deferredPatterns?.length ?? 0,
});
