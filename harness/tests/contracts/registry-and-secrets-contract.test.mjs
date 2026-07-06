// Negative fixtures for the v2 gates: the agent registry, the registry-driven
// critic-model policy, and the secret-scan patterns must each demonstrably
// FAIL their known-bad inputs. A gate that cannot fail is documentation.

import assert from "node:assert/strict";
import test from "node:test";

import {
  agentRegistry,
  allowedDualRoleAgents,
  validateDualRoleGovernance,
} from "../../scripts/dual-role-governance-rules.mjs";
import { validateHighCapabilityCriticModel } from "../../scripts/run-agent-review.mjs";
import { scanText } from "../../scripts/validate-secrets.mjs";

test("registry declares at least two agent families with model policy", () => {
  const families = Object.entries(agentRegistry.families);
  assert.ok(families.length >= 2, "cross-agent review needs two registered families");
  for (const [family, spec] of families) {
    assert.ok(spec.cli, `${family} must declare a CLI`);
    assert.ok(spec.defaultCriticModel, `${family} must declare a default critic model`);
    assert.ok(spec.lowCapabilityMarkers?.length > 0, `${family} must declare low-capability markers`);
    assert.ok(allowedDualRoleAgents.has(family));
  }
});

test("governance rejects unregistered families and same-family cross-agent pairs", () => {
  const base = {
    required: true,
    mode: "cross-agent",
    agentFamilySeparation: true,
    terminalStatus: "pending",
    roleSeparationEvidence: "separate performer and critic passes recorded",
    internalDecompositionSummary: "roles recorded",
    consolidatedOutputOwner: "primary-performer",
  };
  assert.ok(
    validateDualRoleGovernance({ ...base, primaryPerformer: "unregistered-agent", independentCritic: "codex" })
      .some((f) => f.includes("registered agent family")),
    "unregistered family must fail",
  );
  assert.ok(
    validateDualRoleGovernance({ ...base, primaryPerformer: "codex", independentCritic: "codex" })
      .some((f) => f.includes("different agent families") || f.includes("two distinct registered agent families")),
    "same-family cross-agent pair must fail",
  );
});

test("critic model policy rejects downgrades and accepts high-capability models", () => {
  assert.ok(validateHighCapabilityCriticModel("claude-code", "haiku").length > 0, "haiku must be rejected");
  assert.ok(validateHighCapabilityCriticModel("claude-code", "sonnet").length > 0, "sonnet must be rejected");
  assert.ok(validateHighCapabilityCriticModel("codex", "gpt-5.5-mini").length > 0, "mini must be rejected");
  assert.ok(validateHighCapabilityCriticModel("codex", "gpt-4o").length > 0, "older-generation must be rejected");
  assert.equal(validateHighCapabilityCriticModel("claude-code", "opus").length, 0);
  assert.equal(validateHighCapabilityCriticModel("claude-code", "claude-fable-5").length, 0);
  assert.equal(validateHighCapabilityCriticModel("codex", "gpt-5.5").length, 0);
});

test("secret scan fails its known-bad fixtures and passes prose about secrets", () => {
  const knownBad = [
    "-----BEGIN RSA PRIVATE KEY-----",
    "key=AKIAABCDEFGHIJKLMNOP",
    `token: "ghp_${"a".repeat(36)}"`,
    `api_key = "super-secret-value-123"`,
  ];
  for (const bad of knownBad) {
    assert.ok(scanText(bad).length > 0, `must detect: ${bad.slice(0, 30)}…`);
  }
  const prose = "Do not copy secrets, credentials, or private keys into the harness. Checkpoint before modifying secrets.";
  assert.equal(scanText(prose).length, 0, "prose that discusses secrets must not trigger the gate");
});
