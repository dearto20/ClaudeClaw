import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";

const sourceMarkerPath = getRepoPath("..", "development", "developmentharness-source.json");

const getRequirementContext = async () => {
  const marker = await readFile(sourceMarkerPath, "utf8").then(JSON.parse).catch(() => null);
  if (marker?.repoKind === "DevelopmentHarnessSource" && marker?.migrationPhase === "final") {
    return {
      registerPath: getRepoPath("..", "development", "requirements", "requirement-register.json"),
      pathBase: path.resolve(getRepoPath("..")),
    };
  }

  return {
    registerPath: getRepoPath("override", "requirements", "requirement-register.json"),
    pathBase: getRepoPath(),
  };
};

const VALID_TIERS = new Set(["hard", "review", "future"]);
const VALID_MODES = new Set(["automated", "manual-review", "planned", "artifact-review", "content-check"]);
const VALID_CATEGORIES = new Set([
  "scope",
  "workflow",
  "architecture",
  "domain",
  "product",
  "quality",
  "reliability",
  "security",
  "design",
  "frontend",
  "data-governance",
  "discussion",
  "diagram",
  "research",
  "narrative",
]);

const HARD_TIER_MODES = new Set(["automated", "artifact-review", "content-check"]);

const hasExecutableValidationPath = (paths) =>
  paths.some((relativePath) =>
    relativePath.startsWith("tests/") ||
    relativePath.startsWith("scripts/") ||
    relativePath.startsWith("harness/tests/") ||
    relativePath.startsWith("harness/scripts/")
  );

const hasReviewableValidationPath = (paths) =>
  paths.some((relativePath) => relativePath.endsWith(".md") || relativePath.endsWith(".json") || relativePath.endsWith(".svg"));

test("requirement register stays traceable across docs, artifacts, and validation", async () => {
  const context = await getRequirementContext();
  const register = JSON.parse(await readFile(context.registerPath, "utf8"));

  assert.ok([1, 2].includes(register.version), "requirement register version must be 1 or 2");
  assert.ok(Array.isArray(register.requirements), "requirements must be an array");
  // Empty register is valid during bootstrap — schema and per-requirement checks still apply
  const seenIds = new Set();
  const coveredSourceDocs = new Set();

  for (const requirement of register.requirements) {
    assert.equal(typeof requirement.id, "string", "requirement id must be a string");
    assert.ok(!seenIds.has(requirement.id), `duplicate requirement id: ${requirement.id}`);
    seenIds.add(requirement.id);

    assert.equal(typeof requirement.title, "string", `${requirement.id} must have a title`);
    assert.ok(VALID_TIERS.has(requirement.tier), `${requirement.id} has invalid tier`);
    assert.ok(VALID_MODES.has(requirement.validationMode), `${requirement.id} has invalid validation mode`);
    assert.ok(VALID_CATEGORIES.has(requirement.category), `${requirement.id} has invalid category`);

    for (const field of ["sourceDocs", "guidanceDocs", "validationPaths"]) {
      assert.ok(Array.isArray(requirement[field]), `${requirement.id} ${field} must be an array`);
    }

    // Accept either artifactPaths (v2) or implementationPaths (v1 backward compat)
    const artifactPaths = requirement.artifactPaths ?? requirement.implementationPaths;
    assert.ok(Array.isArray(artifactPaths), `${requirement.id} must have artifactPaths or implementationPaths array`);

    assert.ok(requirement.sourceDocs.length > 0, `${requirement.id} must reference at least one source doc`);
    assert.ok(requirement.guidanceDocs.length > 0, `${requirement.id} must reference at least one guidance doc`);
    assert.ok(
      artifactPaths.length > 0,
      `${requirement.id} must reference at least one artifact path`,
    );

    if (requirement.tier === "hard") {
      assert.ok(
        HARD_TIER_MODES.has(requirement.validationMode),
        `${requirement.id} hard requirement must use automated or artifact-review validation`,
      );

      if (requirement.validationMode === "automated") {
        assert.ok(
          hasExecutableValidationPath(requirement.validationPaths),
          `${requirement.id} hard automated requirement must have an executable validation path`,
        );
      }

      if (requirement.validationMode === "artifact-review" || requirement.validationMode === "content-check") {
        assert.ok(
          hasReviewableValidationPath(requirement.validationPaths),
          `${requirement.id} hard ${requirement.validationMode} requirement must have a reviewable validation path`,
        );
      }
    }

    if (requirement.tier === "review") {
      assert.equal(
        requirement.validationMode,
        "manual-review",
        `${requirement.id} review requirement must use manual-review validation`,
      );
    }

    if (requirement.tier === "future") {
      assert.equal(
        requirement.validationMode,
        "planned",
        `${requirement.id} future requirement must use planned validation`,
      );
    }

    for (const relativePath of [
      ...requirement.sourceDocs,
      ...requirement.guidanceDocs,
      ...artifactPaths,
      ...requirement.validationPaths,
    ]) {
      await access(path.join(context.pathBase, relativePath)).catch(() => {
        assert.fail(`${requirement.id} references a missing path: ${relativePath}`);
      });
    }

    requirement.sourceDocs.forEach((sourceDoc) => {
      coveredSourceDocs.add(sourceDoc);
    });
  }

  // Mandatory source docs: from register metadata (v2) or skip if not declared.
  // Skip coverage check during bootstrap (empty register).
  const mandatorySourceDocs = register.mandatorySourceDocs ?? [];
  if (register.requirements.length > 0) {
    mandatorySourceDocs.forEach((sourceDoc) => {
      assert.ok(
        coveredSourceDocs.has(sourceDoc),
        `mandatory source doc must be covered by at least one requirement: ${sourceDoc}`,
      );
    });
  }
});
