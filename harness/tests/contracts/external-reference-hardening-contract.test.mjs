import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";

const readText = (...parts) => readFile(getRepoPath(...parts), "utf8");

const parseFence = (content, fenceName) => {
  const match = content.match(new RegExp(`\`\`\`${fenceName}\\n([\\s\\S]*?)\\n\`\`\``));
  assert.ok(match, `missing ${fenceName} fence`);
  return JSON.parse(match[1]);
};

const requiredClassifications = new Set([
  "official",
  "public-open-source",
  "private-authorized",
  "generated",
  "unclear",
  "prohibited",
]);

const requiredGates = new Set([
  "PROVENANCE_CLASSIFICATION",
  "AUTHORIZATION_STATUS",
  "CLEAN_DERIVATION",
  "REJECTION_RATIONALE",
  "RAW_COPY_PROHIBITION",
  "OFFLINE_VALIDATION",
  "SOURCE_INVALIDATION",
]);

const requiredProhibitions = new Set([
  "RAW_CODE",
  "RAW_PROMPTS",
  "PROMPT_PHRASING",
  "ASSETS_OR_DIAGRAMS",
  "PRIVATE_CONFIG_OR_CREDENTIALS",
  "PRODUCT_SPECIFIC_IMPLEMENTATION",
]);

const requiredTemplates = new Map([
  ["EXTERNAL_REFERENCE_AUDIT", "framework/templates/external-reference-audit.md"],
  ["TARGET_EXPLORATION_GUIDE", "framework/templates/target-exploration-guide.md"],
  ["TOOL_COMMAND_CAPABILITY_CATALOG", "framework/templates/tool-command-capability-catalog.md"],
  ["INTEGRATION_SURFACE_INVENTORY", "framework/templates/integration-surface-inventory.md"],
  ["CONTEXT_COLLECTION_INSPECTION", "framework/templates/context-collection-inspection.md"],
  ["PLAN_CONTINUITY_EVIDENCE", "framework/templates/plan-continuity-evidence.md"],
]);

const sourceSpecificSiblingPathPattern = /(?:^|[\s`"'])\.\.\/(?!AGENTS\.md|CLAUDE\.md|BOOTSTRAP\.md|README\.md)[A-Za-z0-9_.-]+/m;

const pathExists = async (relativePath) => {
  await access(getRepoPath(...relativePath.split("/")));
};

test("external reference hardening contract classifies sources and blocks raw copying", async () => {
  const doc = await readText("framework", "process", "references.md");
  const validator = await readText("scripts", "validate-external-reference-hardening.mjs");
  const contract = parseFence(doc, "external-reference-hardening-json");

  assert.equal(contract.schemaVersion, "1.1.0");
  assert.match(contract.principle, /observe-only/);
  assert.ok(!sourceSpecificSiblingPathPattern.test(doc), "framework process must not depend on a source-specific sibling checkout");

  for (const text of [
    "Default `unclear` and `prohibited` sources to observe-only",
    "Do not copy raw code, raw prompts, prompt phrasing",
    "Validation must be local and offline",
    "Clean Derivation",
    "Invalidation Path",
    "Reference-Only And Archive Targets",
    "must not gain install, package, publish, deploy, or container surfaces unless the user explicitly asks",
  ]) {
    assert.ok(doc.includes(text), `process doc must include ${text}`);
  }

  for (const classification of contract.sourceClassifications) {
    requiredClassifications.delete(classification.id);
    assert.equal(typeof classification.requiresAuthorizationNote, "boolean");
    if (classification.id === "unclear" || classification.id === "prohibited") {
      assert.match(classification.defaultUse, /observe-only/);
    }
  }
  assert.equal(requiredClassifications.size, 0, "all source classifications must be represented");

  for (const gate of contract.adoptionGates) {
    requiredGates.delete(gate.id);
    assert.ok(gate.requiredEvidence.trim().length > 0, `${gate.id} must require evidence`);
  }
  assert.equal(requiredGates.size, 0, "all adoption gates must be represented");

  for (const prohibitedImport of contract.prohibitedImports) {
    requiredProhibitions.delete(prohibitedImport.id);
    assert.ok(prohibitedImport.reason.trim().length > 0, `${prohibitedImport.id} must have rationale`);
  }
  assert.equal(requiredProhibitions.size, 0, "all prohibited import classes must be represented");

  assert.ok(validator.includes("requiredClassifications"));
  assert.ok(validator.includes("requiredGateIds"));
  assert.ok(validator.includes("requiredProhibitedImportIds"));
  assert.ok(validator.includes("requiredTemplateIds"));
});

test("external reference templates are local and independently validated", async () => {
  const doc = await readText("framework", "process", "references.md");
  const contract = parseFence(doc, "external-reference-hardening-json");

  assert.equal(contract.validation.validator, "scripts/validate-external-reference-hardening.mjs");
  assert.equal(contract.validation.contractTest, "tests/contracts/external-reference-hardening-contract.test.mjs");
  await pathExists(contract.validation.validator);
  await pathExists(contract.validation.contractTest);

  for (const template of contract.templates) {
    const expectedPath = requiredTemplates.get(template.id);
    assert.equal(template.path, expectedPath, `${template.id} must use the expected local template path`);
    await pathExists(template.path);
    const templateText = await readText(...template.path.split("/"));
    assert.ok(templateText.includes("## Purpose"), `${template.path} must include a purpose section`);
    assert.ok(!sourceSpecificSiblingPathPattern.test(templateText), `${template.path} must not depend on a source-specific sibling checkout`);
    requiredTemplates.delete(template.id);
  }
  assert.equal(requiredTemplates.size, 0, "all external-reference hardening templates must be represented");
});
