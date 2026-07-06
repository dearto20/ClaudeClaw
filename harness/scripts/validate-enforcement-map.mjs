// validate-enforcement-map — the register that keeps obligations honest.
// Every contract obligation in framework/registry/enforcement-map.json names
// its enforcement surface; mechanical surfaces must point at files that exist,
// non-mechanical surfaces must record a basis. A required-obligation floor
// pins the contract-level anchors so the register cannot quietly shrink.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finishValidation, pathExists } from "./validation-helpers.mjs";
import { getValidationMode } from "./validation-mode.mjs";

const MECHANICAL_KINDS = new Set(["commit-gate", "ci", "gate", "contract-test", "runtime-adapter"]);
const DECLARED_KINDS = new Set(["review-lens", "prose-declared"]);

export const REQUIRED_OBLIGATIONS = Object.freeze([
  "tier-computation",
  "ledger-before-edits",
  "high-risk-critic-evidence",
  "visibility-tier-line",
  "visibility-transition-narration",
  "statusline-governed-visibility",
  "validate-all-before-completion",
  "pushback-free-readiness",
  "dual-role-governance",
  "transport-policy",
  "operational-constants",
  "hard-stops",
  "deviation-ci-floor",
  "skills-adapter-sync",
  "framework-override-boundary",
  "legacy-plan-acceptance",
  "intake-ready",
  "upgrade-adoption-record",
  "behavioral-triad",
  "memory-placement",
  "core-structure-conformance",
  "core-toolchain-conventions",
  "generated-artifact-policy",
]);

// Pure-ish rule evaluation (async only for ref-existence checks), exported so
// the contract suite can prove the negative space with fixtures.
export const enforcementMapFailures = async (map, workspaceRoot, { requiredObligations = REQUIRED_OBLIGATIONS } = {}) => {
  const failures = [];
  const obligations = Array.isArray(map?.obligations) ? map.obligations : [];
  if (!Array.isArray(map?.obligations)) failures.push("obligations must be an array");
  const ids = new Set();
  for (const entry of obligations) {
    const id = typeof entry?.id === "string" ? entry.id : "<missing id>";
    if (ids.has(id)) failures.push(`duplicate obligation id: ${id}`);
    ids.add(id);
    if (typeof entry?.source !== "string" || entry.source.trim() === "") {
      failures.push(`obligation ${id} must name its source doc anchor`);
    }
    if (typeof entry?.obligation !== "string" || entry.obligation.trim() === "") {
      failures.push(`obligation ${id} must state the obligation`);
    }
    const surfaces = Array.isArray(entry?.surfaces) ? entry.surfaces : [];
    if (surfaces.length === 0) {
      failures.push(`obligation ${id} has no enforcement surface — an obligation without a surface or a declared exception is a silent gap`);
      continue;
    }
    for (const surface of surfaces) {
      const kind = surface?.kind;
      if (MECHANICAL_KINDS.has(kind)) {
        if (typeof surface.ref !== "string" || surface.ref.trim() === "") {
          failures.push(`obligation ${id}: ${kind} surface must name a ref path`);
        } else if (!(await pathExists(workspaceRoot, surface.ref))) {
          failures.push(`obligation ${id}: ${kind} surface ref does not exist: ${surface.ref}`);
        }
      } else if (DECLARED_KINDS.has(kind)) {
        if (typeof surface.basis !== "string" || surface.basis.trim().length < 40) {
          failures.push(`obligation ${id}: ${kind} surface requires a substantive basis (why no mechanical surface exists and what bounds the risk)`);
        }
      } else {
        failures.push(`obligation ${id}: unknown surface kind: ${String(kind)}`);
      }
    }
  }
  for (const required of requiredObligations) {
    if (!ids.has(required)) failures.push(`required obligation missing from the enforcement map: ${required}`);
  }
  return failures;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const failures = [];
  const mode = await getValidationMode();
  const mapRel = "harness/framework/registry/enforcement-map.json";
  if (!(await pathExists(mode.workspaceRoot, mapRel))) {
    failures.push(`missing ${mapRel}`);
  } else {
    try {
      const map = JSON.parse(await readFile(path.join(mode.workspaceRoot, mapRel), "utf8"));
      failures.push(...(await enforcementMapFailures(map, mode.workspaceRoot)));
    } catch (error) {
      failures.push(`${mapRel} is not valid JSON: ${error.message}`);
    }
  }
  finishValidation("validate-enforcement-map", failures, { mode: mode.mode });
}
