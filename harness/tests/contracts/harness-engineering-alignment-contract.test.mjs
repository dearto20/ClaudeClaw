import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";

const readText = (...parts) => readFile(getRepoPath(...parts), "utf8");

const existsAnywhere = async (relPath) => {
  try {
    await access(getRepoPath(...relPath.split("/")));
    return true;
  } catch {}
  if (relPath === "override/validation/target-validation-profile.md") {
    try {
      await access(getRepoPath("..", "development", "validation", "source-validation-profile.md"));
      return true;
    } catch {}
  }
  if (relPath.startsWith("override/")) {
    try {
      await access(getRepoPath("..", "development", ...relPath.slice("override/".length).split("/")));
      return true;
    } catch {}
  }
  return false;
};

const parseFence = (doc, fenceName) => {
  const match = doc.match(new RegExp(`\`\`\`${fenceName}\\n([\\s\\S]*?)\\n\`\`\``));
  assert.ok(match, `missing ${fenceName} fence`);
  return JSON.parse(match[1]);
};

test("harness engineering alignment is an adoption ledger with a pinned source", async () => {
  const doc = await readText("framework", "process", "harness-engineering-alignment.md");
  const contract = parseFence(doc, "harness-engineering-alignment-json");

  assert.equal(contract.schemaVersion, "2.0.0");
  assert.equal(contract.source.url, "https://openai.com/index/harness-engineering/");
  assert.ok(contract.source.published, "source must pin published date");
  assert.ok(contract.source.lastVerified, "source must pin lastVerified date");
});

test("adoption ledger has no coverage obligation against the live article", async () => {
  const doc = await readText("framework", "process", "harness-engineering-alignment.md");
  const contract = parseFence(doc, "harness-engineering-alignment-json");
  const validator = await readText("scripts", "validate-harness-engineering-alignment.mjs");

  assert.equal(contract.source.coveragePolicy, undefined, "coveragePolicy is retired");
  assert.equal(contract.sourceSections, undefined, "sourceSections coverage mapping is retired");
  assert.ok(
    validator.includes("must not carry coveragePolicy or sourceSections"),
    "validator must reject the retired coverage-contract form",
  );
  assert.ok(
    (contract.deferredPatterns ?? []).some((p) => p.id === "PER_HEADING_COVERAGE"),
    "retirement of per-heading coverage must be recorded as a deferred pattern with rationale",
  );
});

test("every adopted pattern is locally restated and locally enforced", async () => {
  const doc = await readText("framework", "process", "harness-engineering-alignment.md");
  const contract = parseFence(doc, "harness-engineering-alignment-json");

  assert.ok(contract.adoptedPatterns.length > 0, "ledger must adopt at least one pattern");
  for (const pattern of contract.adoptedPatterns) {
    assert.ok(pattern.localContract, `${pattern.id} must restate the pattern locally`);
    assert.ok(pattern.artifactPaths.length > 0, `${pattern.id} must have artifacts`);
    assert.ok(pattern.validationPaths.length > 0, `${pattern.id} must have validation`);
    for (const relPath of [...pattern.artifactPaths, ...pattern.validationPaths]) {
      assert.ok(await existsAnywhere(relPath), `${pattern.id} path must exist: ${relPath}`);
    }
  }
});
