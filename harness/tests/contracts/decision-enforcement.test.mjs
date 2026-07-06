import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";

const sourceMarkerPath = getRepoPath("..", "development", "developmentharness-source.json");

const getDecisionContext = async () => {
  const marker = await readFile(sourceMarkerPath, "utf8").then(JSON.parse).catch(() => null);
  if (marker?.repoKind === "DevelopmentHarnessSource" && marker?.migrationPhase === "final") {
    return {
      adrDirectory: getRepoPath("..", "development", "design-docs", "adr"),
      reliabilityPath: getRepoPath("..", "development", "RELIABILITY.md"),
      architecturePath: getRepoPath("..", "development", "ARCHITECTURE.md"),
      requireReliabilityDecisionId: true,
      resolvePath: (relativePath) => {
        if (relativePath.startsWith("../")) {
          return getRepoPath("..", relativePath.slice("../".length));
        }
        if (relativePath.startsWith("override/")) {
          if (relativePath === "override/validation/target-validation-profile.md") {
            return getRepoPath("..", "development", "validation", "source-validation-profile.md");
          }
          return getRepoPath("..", "development", ...relativePath.slice("override/".length).split("/"));
        }
        if (relativePath.startsWith("framework/") || relativePath.startsWith("scripts/") || relativePath.startsWith("tests/") || relativePath.startsWith("exec-plans/") || relativePath.startsWith("hooks/")) {
          return getRepoPath(...relativePath.split("/"));
        }
        if (relativePath.startsWith("artifacts/")) {
          return getRepoPath(...relativePath.split("/"));
        }
        return getRepoPath("..", relativePath);
      },
    };
  }

  return {
    adrDirectory: getRepoPath("override", "design-docs", "adr"),
    reliabilityPath: getRepoPath("framework", "RELIABILITY.md"),
    architecturePath: getRepoPath("override", "ARCHITECTURE.md"),
    requireReliabilityDecisionId: false,
    resolvePath: (relativePath) => getRepoPath(...relativePath.split("/")),
  };
};

const extractSection = (content, heading) => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(`^## ${escapedHeading}\\n([\\s\\S]*?)(?=^## |\\Z)`, "m"),
  );

  return match ? match[1].trim() : "";
};

const extractTrackedPaths = (content) =>
  [...content.matchAll(/`([^`\n]+)`/g)]
    .map((match) => match[1])
    .filter((value) =>
      // Accept any relative path that looks like a file or directory reference.
      // Exclude bare words (no slash or dot), status labels, and inline code fragments.
      /[/.]/.test(value) && !/\s/.test(value) && !value.startsWith("http"),
    );

test("accepted ADRs stay connected to artifacts and verification", async () => {
  const context = await getDecisionContext();
  const fileNames = (await readdir(context.adrDirectory))
    .filter((fileName) => /^adr-\d+.*\.md$/i.test(fileName))
    .sort();
  const reliabilityDoc = await readFile(context.reliabilityPath, "utf8");
  const architectureDoc = await readFile(context.architecturePath, "utf8");

  for (const fileName of fileNames) {
    const fullPath = path.join(context.adrDirectory, fileName);
    const content = await readFile(fullPath, "utf8");

    if (!content.includes("- `Accepted`")) {
      continue;
    }

    const decisionId = content.match(/^# (ADR-\d+)/m)?.[1];
    assert.ok(decisionId, `${fileName} must declare an ADR id in the title`);

    const artifactSection = extractSection(content, "Artifact Enforcement");
    const verificationSection = extractSection(content, "Verification Enforcement");

    assert.ok(
      artifactSection,
      `${decisionId} must include an Artifact Enforcement section`,
    );
    assert.ok(
      verificationSection,
      `${decisionId} must include a Verification Enforcement section`,
    );

    const artifactPaths = extractTrackedPaths(artifactSection);
    const verificationPaths = extractTrackedPaths(verificationSection);

    assert.ok(
      artifactPaths.length > 0,
      `${decisionId} must list at least one artifact enforcement path`,
    );
    assert.ok(
      verificationPaths.length > 0,
      `${decisionId} must list at least one verification enforcement path`,
    );

    for (const relativePath of [...artifactPaths, ...verificationPaths]) {
      await access(
        context.resolvePath(relativePath),
        undefined,
      ).catch(() => {
        assert.fail(`${decisionId} references a missing path: ${relativePath}`);
      });
    }

    if (context.requireReliabilityDecisionId) {
      assert.match(
        reliabilityDoc,
        new RegExp(`\`${decisionId}\``),
        `${decisionId} must appear in source RELIABILITY.md`,
      );
    } else {
      assert.match(
        reliabilityDoc,
        /Accepted Decision Anchors|Project-Specific Gates/,
        "target reliability guidance must describe decision anchoring",
      );
    }
    assert.match(
      architectureDoc,
      new RegExp(`\`${decisionId}\``),
      `${decisionId} must be referenced by ARCHITECTURE.md`,
    );
  }
});
