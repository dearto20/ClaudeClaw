import {
  finishValidation,
  harnessRoot,
  isMeaningful,
  isObject,
  parseJsonFence,
  pathExists,
  readHarnessFile,
  requireIncludes,
} from "./validation-helpers.mjs";

const failures = [];
const docPath = "framework/process/references.md";

const requiredClassifications = new Set([
  "official",
  "public-open-source",
  "private-authorized",
  "generated",
  "unclear",
  "prohibited",
]);

const requiredGateIds = new Set([
  "PROVENANCE_CLASSIFICATION",
  "AUTHORIZATION_STATUS",
  "CLEAN_DERIVATION",
  "REJECTION_RATIONALE",
  "RAW_COPY_PROHIBITION",
  "OFFLINE_VALIDATION",
  "SOURCE_INVALIDATION",
]);

const requiredProhibitedImportIds = new Set([
  "RAW_CODE",
  "RAW_PROMPTS",
  "PROMPT_PHRASING",
  "ASSETS_OR_DIAGRAMS",
  "PRIVATE_CONFIG_OR_CREDENTIALS",
  "PRODUCT_SPECIFIC_IMPLEMENTATION",
]);

const requiredTemplateIds = new Map([
  ["EXTERNAL_REFERENCE_AUDIT", "framework/templates/external-reference-audit.md"],
  ["TARGET_EXPLORATION_GUIDE", "framework/templates/target-exploration-guide.md"],
  ["TOOL_COMMAND_CAPABILITY_CATALOG", "framework/templates/tool-command-capability-catalog.md"],
  ["INTEGRATION_SURFACE_INVENTORY", "framework/templates/integration-surface-inventory.md"],
  ["CONTEXT_COLLECTION_INSPECTION", "framework/templates/context-collection-inspection.md"],
  ["PLAN_CONTINUITY_EVIDENCE", "framework/templates/plan-continuity-evidence.md"],
]);

const sourceSpecificSiblingPathPattern = /(?:^|[\s`"'])\.\.\/(?!AGENTS\.md|CLAUDE\.md|BOOTSTRAP\.md|README\.md)[A-Za-z0-9_.-]+/m;

const doc = await readHarnessFile(docPath).catch(() => null);

if (!doc) {
  failures.push(`missing ${docPath}`);
} else {
  requireIncludes(
    doc,
    [
      "External references are observe-only until classified",
      "Default `unclear` and `prohibited` sources to observe-only",
      "Do not copy raw code, raw prompts, prompt phrasing, assets, diagrams, private configuration, credentials",
      "Validation must be local and offline",
      "Clean Derivation",
      "Invalidation Path",
      "external-reference-hardening-json",
      "framework/templates/external-reference-audit.md",
      "framework/templates/target-exploration-guide.md",
      "framework/templates/tool-command-capability-catalog.md",
      "framework/templates/integration-surface-inventory.md",
      "framework/templates/context-collection-inspection.md",
      "framework/templates/plan-continuity-evidence.md",
      "Reference-Only And Archive Targets",
      "must not gain install, package, publish, deploy, or container surfaces unless the user explicitly asks",
      "subsystem inventory, capability catalog, integration-surface inventory",
    ],
    docPath,
    failures,
  );

  if (sourceSpecificSiblingPathPattern.test(doc)) {
    failures.push(`${docPath} must not depend on a source-specific sibling path`);
  }
}

const contract = doc ? parseJsonFence(doc, "external-reference-hardening-json", docPath, failures) : null;

const requireSetMembers = (values, required, label) => {
  const seen = new Set(values);
  for (const id of required) {
    if (!seen.has(id)) {
      failures.push(`${label} missing required id: ${id}`);
    }
  }
};

if (contract) {
  if (contract.schemaVersion !== "1.1.0") {
    failures.push(`${docPath} schemaVersion must equal 1.1.0`);
  }
  if (!isMeaningful(contract.principle) || !contract.principle.includes("observe-only")) {
    failures.push(`${docPath} principle must state the observe-only default`);
  }

  const classifications = contract.sourceClassifications ?? [];
  if (!Array.isArray(classifications)) {
    failures.push(`${docPath} sourceClassifications must be an array`);
  } else {
    requireSetMembers(classifications.map((item) => item?.id), requiredClassifications, `${docPath} sourceClassifications`);

    for (const [index, classification] of classifications.entries()) {
      const label = `${docPath} sourceClassifications[${index}]`;
      if (!isObject(classification)) {
        failures.push(`${label} must be an object`);
        continue;
      }
      if (!requiredClassifications.has(classification.id)) {
        failures.push(`${label} has unexpected id: ${classification.id}`);
      }
      if (!isMeaningful(classification.defaultUse)) {
        failures.push(`${label} missing meaningful defaultUse`);
      }
      if (typeof classification.requiresAuthorizationNote !== "boolean") {
        failures.push(`${label} requiresAuthorizationNote must be boolean`);
      }
      if ((classification.id === "unclear" || classification.id === "prohibited") && !classification.defaultUse.includes("observe-only")) {
        failures.push(`${label} unclear/prohibited sources must default to observe-only`);
      }
    }
  }

  const gates = contract.adoptionGates ?? [];
  if (!Array.isArray(gates)) {
    failures.push(`${docPath} adoptionGates must be an array`);
  } else {
    requireSetMembers(gates.map((item) => item?.id), requiredGateIds, `${docPath} adoptionGates`);
    for (const [index, gate] of gates.entries()) {
      const label = `${docPath} adoptionGates[${index}]`;
      if (!isObject(gate)) {
        failures.push(`${label} must be an object`);
        continue;
      }
      if (!requiredGateIds.has(gate.id)) {
        failures.push(`${label} has unexpected id: ${gate.id}`);
      }
      if (!isMeaningful(gate.requiredEvidence)) {
        failures.push(`${label} missing meaningful requiredEvidence`);
      }
    }
  }

  const prohibitedImports = contract.prohibitedImports ?? [];
  if (!Array.isArray(prohibitedImports)) {
    failures.push(`${docPath} prohibitedImports must be an array`);
  } else {
    requireSetMembers(prohibitedImports.map((item) => item?.id), requiredProhibitedImportIds, `${docPath} prohibitedImports`);
    for (const [index, prohibitedImport] of prohibitedImports.entries()) {
      const label = `${docPath} prohibitedImports[${index}]`;
      if (!isObject(prohibitedImport)) {
        failures.push(`${label} must be an object`);
        continue;
      }
      if (!requiredProhibitedImportIds.has(prohibitedImport.id)) {
        failures.push(`${label} has unexpected id: ${prohibitedImport.id}`);
      }
      if (!isMeaningful(prohibitedImport.reason)) {
        failures.push(`${label} missing meaningful reason`);
      }
    }
  }

  const templates = contract.templates ?? [];
  if (!Array.isArray(templates)) {
    failures.push(`${docPath} templates must be an array`);
  } else {
    requireSetMembers(templates.map((item) => item?.id), new Set(requiredTemplateIds.keys()), `${docPath} templates`);
    for (const [index, template] of templates.entries()) {
      const label = `${docPath} templates[${index}]`;
      if (!isObject(template)) {
        failures.push(`${label} must be an object`);
        continue;
      }
      const expectedPath = requiredTemplateIds.get(template.id);
      if (!expectedPath) {
        failures.push(`${label} has unexpected id: ${template.id}`);
      } else if (template.path !== expectedPath) {
        failures.push(`${label} path must equal ${expectedPath}`);
      }
      if (!isMeaningful(template.purpose)) {
        failures.push(`${label} missing meaningful purpose`);
      }
      if (typeof template.path === "string" && !(await pathExists(harnessRoot, template.path))) {
        failures.push(`${label} references missing template path: ${template.path}`);
      } else if (typeof template.path === "string") {
        const templateText = await readHarnessFile(template.path);
        if (sourceSpecificSiblingPathPattern.test(templateText)) {
          failures.push(`${template.path} must not depend on a source-specific sibling path`);
        }
      }
    }
  }

  const validatorPath = contract.validation?.validator;
  const contractTestPath = contract.validation?.contractTest;
  if (validatorPath !== "scripts/validate-external-reference-hardening.mjs") {
    failures.push(`${docPath} validation.validator must reference scripts/validate-external-reference-hardening.mjs`);
  }
  if (contractTestPath !== "tests/contracts/external-reference-hardening-contract.test.mjs") {
    failures.push(`${docPath} validation.contractTest must reference tests/contracts/external-reference-hardening-contract.test.mjs`);
  }
  for (const relativePath of [validatorPath, contractTestPath].filter(Boolean)) {
    if (!(await pathExists(harnessRoot, relativePath))) {
      failures.push(`${docPath} validation references missing path: ${relativePath}`);
    }
  }
}

finishValidation("validate-external-reference-hardening", failures, {
  classifications: contract?.sourceClassifications?.length ?? 0,
  gates: contract?.adoptionGates?.length ?? 0,
  prohibitedImports: contract?.prohibitedImports?.length ?? 0,
  templates: contract?.templates?.length ?? 0,
});
