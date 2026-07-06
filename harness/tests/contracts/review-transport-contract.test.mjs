// Contract: the review transport is stable by construction — rung ceilings
// come from registry data, a rung is retried once before degrading, and any
// review completed below the packet-file rung is priced (subPacketFallback
// recorded, ledger acceptance required). Driven against a stub critic CLI so
// CI proves the ladder mechanics deterministically, no network or real CLI.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runAgentReview, transportPolicyFor } from "../../scripts/run-agent-review.mjs";
import { transportDegradationFailures, calibrationCeilingFailures } from "../../scripts/dual-role-governance-rules.mjs";

// Stub claude-style CLI: `stub --model m -p <prompt>`. Behavior per marker in
// the prompt; invocation counts recorded per rung so retries are observable.
const makeStub = async (dir, { packetDelayMs = 0, packetFailFirstTry = false } = {}) => {
  const counterFile = path.join(dir, "invocations.json");
  await writeFile(counterFile, "{}");
  const stubPath = path.join(dir, "stub-critic.mjs");
  const review = JSON.stringify({ status: "NO_BLOCKING_ISSUES", blockingFindings: [], nonBlockingRisks: [], reviewedEvidence: ["stub"], summary: "stub review" });
  await writeFile(stubPath, `#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
const prompt = process.argv[process.argv.indexOf("-p") + 1] ?? "";
const rung = prompt.includes("Return exactly: OK") ? "liveness"
  : prompt.includes("review packet") ? "packet-file"
  : prompt.includes("evidence summary only") ? "evidence-summary"
  : "minimal-blocking-review";
const counters = JSON.parse(readFileSync(${JSON.stringify(counterFile)}, "utf8"));
counters[rung] = (counters[rung] ?? 0) + 1;
writeFileSync(${JSON.stringify(counterFile)}, JSON.stringify(counters));
if (rung === "liveness") { console.log("OK"); process.exit(0); }
if (rung === "packet-file") {
  if (${packetFailFirstTry} && counters[rung] === 1) process.exit(1);
  const until = Date.now() + ${packetDelayMs};
  while (Date.now() < until) {}
}
console.log("\\n\`\`\`agent-review-json\\n" + ${JSON.stringify(review)} + "\\n\`\`\`");
`);
  await chmod(stubPath, 0o755);
  return { stubPath, counters: async () => JSON.parse(await readFile(counterFile, "utf8")) };
};

test("transport policy comes from the registry with builtin fallback", () => {
  const registryPolicy = transportPolicyFor("codex");
  assert.equal(registryPolicy.source, "registry");
  assert.ok(registryPolicy.rungCeilingsMs["packet-file"] >= 300_000);
  assert.equal(registryPolicy.retriesPerRung, 1);
  const overridden = transportPolicyFor("codex", { rungCeilingsMs: { "packet-file": 1234 }, retriesPerRung: 0 });
  assert.equal(overridden.source, "override");
  assert.equal(overridden.rungCeilingsMs["packet-file"], 1234);
  assert.equal(overridden.rungCeilingsMs["evidence-summary"], 180_000);
});

// runAgentReview requires a repo-relative packet; use the scratchpad-free
// harness tmp route: write the packet under the repo's tmp/ (gitignored).
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const repoTmpPacket = async (name) => {
  const rel = path.join("tmp", name);
  await writeFile(path.join(repoRoot, rel), "# Stub Packet\n- Change: stub.\n").catch(async (error) => {
    if (error.code === "ENOENT") {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(path.join(repoRoot, "tmp"), { recursive: true });
      await writeFile(path.join(repoRoot, rel), "# Stub Packet\n- Change: stub.\n");
    } else {
      throw error;
    }
  });
  return rel.split(path.sep).join("/");
};

const baseOptions = (dir, stubPath, packetRel, transport) => ({
  packetPath: packetRel,
  outputPath: "tmp/stub-report.json",
  primary: "codex",
  critic: "claude-code",
  claudeBin: stubPath,
  codexBin: stubPath,
  claudeModel: "opus",
  codexModel: "gpt-5.5",
  timeoutMs: null,
  livenessTimeoutMs: null,
  transport,
});

test("a rung ceiling from policy times the rung out and the ladder degrades with priced fallback", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "transport-"));
  const { stubPath } = await makeStub(dir, { packetDelayMs: 1_500 });
  const packetRel = await repoTmpPacket("stub-packet-degrade.md");
  const report = await runAgentReview(baseOptions(dir, stubPath, packetRel, {
    rungCeilingsMs: { liveness: 20_000, "packet-file": 400, "evidence-summary": 30_000, "minimal-blocking-review": 30_000 },
    retriesPerRung: 1,
  }));
  assert.equal(report.status, "complete");
  assert.equal(report.selectedAttempt, "evidence-summary");
  assert.equal(report.rungDepth, "evidence-summary");
  assert.equal(report.subPacketFallback, true);
  assert.equal(report.transportPolicy.source, "override");
  await rm(dir, { recursive: true, force: true });
  await rm(path.join(repoRoot, packetRel), { force: true });
});

test("a failed rung is retried once at the same rung before degrading", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "transport-"));
  const { stubPath, counters } = await makeStub(dir, { packetFailFirstTry: true });
  const packetRel = await repoTmpPacket("stub-packet-retry.md");
  const report = await runAgentReview(baseOptions(dir, stubPath, packetRel, {
    rungCeilingsMs: { liveness: 20_000, "packet-file": 30_000, "evidence-summary": 30_000, "minimal-blocking-review": 30_000 },
    retriesPerRung: 1,
  }));
  assert.equal(report.status, "complete");
  assert.equal(report.selectedAttempt, "packet-file");
  assert.equal(report.subPacketFallback, false);
  assert.equal((await counters())["packet-file"], 2, "packet-file must be invoked twice: fail then retry");
  await rm(dir, { recursive: true, force: true });
  await rm(path.join(repoRoot, packetRel), { force: true });
});

test("sub-packet reviews require plan acceptance; packet-file reviews do not", () => {
  const subPacketReport = { schemaVersion: "1.1.0", status: "complete", subPacketFallback: true, rungDepth: "evidence-summary" };
  const planWithout = "- Agent review report: harness/artifacts/x.json\n- Transport degradation acceptance:\n";
  const planPlaceholder = "- Transport degradation acceptance: pending\n";
  const planWith = "- Transport degradation acceptance: accepted — codex ladder exhausted after retries; attempt trail preserved and raw critic output archived.\n";
  assert.equal(transportDegradationFailures(planWithout, subPacketReport, "plan.md").length, 1);
  assert.equal(transportDegradationFailures(planPlaceholder, subPacketReport, "plan.md").length, 1);
  assert.equal(transportDegradationFailures(planWith, subPacketReport, "plan.md").length, 0);
  // Vintage boundary: pre-1.1.0 reports lack the field and are exempt.
  assert.equal(transportDegradationFailures(planWithout, { schemaVersion: "1.0.0", status: "complete" }, "plan.md").length, 0);
  // Packet-file completion needs nothing.
  assert.equal(transportDegradationFailures(planWithout, { subPacketFallback: false }, "plan.md").length, 0);
});

test("registry ceilings below a calibrated recommendation fail validation", () => {
  const familySpec = { transport: { rungCeilingsMs: { "packet-file": 100_000, "evidence-summary": 180_000 } } };
  const calibration = { recommendedCeilingsMs: { "packet-file": 200_000, "evidence-summary": 90_000 } };
  const failures = calibrationCeilingFailures(familySpec, calibration, "codex");
  assert.equal(failures.length, 1);
  assert.match(failures[0], /codex\/packet-file/);
  assert.equal(calibrationCeilingFailures(familySpec, null, "codex").length, 0);
});

test("report refs are gathered from the labeled line AND review-output evidence — the bypass is closed", async () => {
  const { reviewReportRefs } = await import("../../scripts/dual-role-governance-rules.mjs");
  const planContent = "- Agent review report: harness/artifacts/cross-agent-review/a-report.json\n";
  const payload = {
    required: true,
    records: [{
      evidence: [{ type: "review-output", ref: "harness/artifacts/cross-agent-review/b-report.json" }],
      iterations: [{ evidence: [{ type: "review-output", ref: "harness/artifacts/cross-agent-review/c-report.json" }, { type: "validation-report", ref: "harness/artifacts/validation/x.json" }] }],
    }],
  };
  const refs = reviewReportRefs(planContent, payload);
  assert.deepEqual(refs.sort(), [
    "harness/artifacts/cross-agent-review/a-report.json",
    "harness/artifacts/cross-agent-review/b-report.json",
    "harness/artifacts/cross-agent-review/c-report.json",
  ]);
  // Evidence-only citation (no labeled line) still surfaces the report.
  assert.deepEqual(reviewReportRefs("", payload), [
    "harness/artifacts/cross-agent-review/b-report.json",
    "harness/artifacts/cross-agent-review/c-report.json",
  ]);
});

test("every review run appends a decision-gate telemetry line with novel-finding counts", async () => {
  const { appendReviewTelemetry } = await import("../../scripts/run-agent-review.mjs");
  const dir = await mkdtemp(path.join(tmpdir(), "telemetry-"));
  const telemetryPath = path.join(dir, "review-transport.jsonl");
  const report = {
    completedAt: "2026-07-02T00:00:00.000Z",
    primary: "claude-code",
    critic: "codex",
    criticModel: "gpt-5.5",
    status: "complete",
    rungDepth: "packet-file",
    subPacketFallback: false,
    pushbackFree: false,
    review: { blockingFindings: [{ id: "a", novel: true }, { id: "b", novel: false }] },
  };
  const entry = await appendReviewTelemetry(report, "harness/artifacts/cross-agent-review/x.json", { telemetryPath });
  assert.equal(entry.blockingFindings, 2);
  assert.equal(entry.novelBlockingFindings, 1);
  assert.equal(entry.novelClassified, true);
  assert.equal(entry.rungDepth, "packet-file");
  const lines = (await readFile(telemetryPath, "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).critic, "codex");
  await rm(dir, { recursive: true, force: true });
});

test("prompt-echoed sample blocks and unstructured text can never clear readiness", async () => {
  const { extractAgentReview, isPushbackFreeReview } = await import("../../scripts/run-agent-review.mjs");
  // Echoed prompt carries the empty sample block first; the critic's real
  // verdict comes last — last fence wins.
  const echoed = '```agent-review-json\n{"status": "NO_BLOCKING_ISSUES", "blockingFindings": [], "nonBlockingRisks": [], "reviewedEvidence": [], "summary": ""}\n```\n...critic reasoning...\n```agent-review-json\n{"status": "BLOCKING_FINDINGS", "blockingFindings": [{"id": "x"}], "nonBlockingRisks": [], "reviewedEvidence": ["y"], "summary": "real verdict"}\n```';
  const parsed = extractAgentReview(echoed);
  assert.equal(parsed.status, "BLOCKING_FINDINGS");
  assert.equal(parsed.summary, "real verdict");
  // Unstructured NO_BLOCKING_ISSUES prose parses to nothing.
  assert.equal(extractAgentReview("All good. NO_BLOCKING_ISSUES from me."), null);
  // Unstructured BLOCKING text still blocks, and never counts as pushback-free.
  const unstructuredBlock = extractAgentReview("I found problems. BLOCKING_FINDINGS: the validator is bypassable.");
  assert.equal(unstructuredBlock.status, "BLOCKING_FINDINGS");
  assert.equal(isPushbackFreeReview(unstructuredBlock), false);
  assert.equal(isPushbackFreeReview({ status: "NO_BLOCKING_ISSUES", unstructured: true, blockingFindings: [], nonBlockingRisks: [] }), false);
});

test("telemetry records the high-risk classification the decision gate filters on", async () => {
  const { appendReviewTelemetry } = await import("../../scripts/run-agent-review.mjs");
  const dir = await mkdtemp(path.join(tmpdir(), "telemetry-"));
  const telemetryPath = path.join(dir, "review-transport.jsonl");
  const report = { primary: "claude-code", critic: "codex", criticModel: "gpt-5.5", status: "complete", rungDepth: "packet-file", subPacketFallback: false, pushbackFree: true, review: { blockingFindings: [] } };
  const highRiskEntry = await appendReviewTelemetry(report, "r.json", { telemetryPath, highRisk: true });
  const optionalEntry = await appendReviewTelemetry(report, "r.json", { telemetryPath, highRisk: false });
  assert.equal(highRiskEntry.highRisk, true);
  assert.equal(optionalEntry.highRisk, false);
  await rm(dir, { recursive: true, force: true });
});

test("mixed fence names cannot let an echoed sample outrank the real verdict", async () => {
  const { extractAgentReview } = await import("../../scripts/run-agent-review.mjs");
  // Echoed empty agent-review-json sample first, real claude-review-json verdict last.
  const mixed = '```agent-review-json\n{"status": "NO_BLOCKING_ISSUES", "blockingFindings": [], "nonBlockingRisks": [], "reviewedEvidence": [], "summary": ""}\n```\n...\n```claude-review-json\n{"status": "BLOCKING_FINDINGS", "blockingFindings": [{"id": "real"}], "nonBlockingRisks": [], "reviewedEvidence": ["z"], "summary": "real cross-fence verdict"}\n```';
  const parsed = extractAgentReview(mixed);
  assert.equal(parsed.status, "BLOCKING_FINDINGS");
  assert.equal(parsed.summary, "real cross-fence verdict");
});

test("legacy claude wrapper exits nonzero on blocking findings", async () => {
  const wrapperSource = await readFile(path.join(repoRoot, "harness", "scripts", "run-claude-review.mjs"), "utf8");
  assert.match(
    wrapperSource,
    /report\.status === "dry-run" \|\| \(report\.status === "complete" && report\.pushbackFree === true\)/,
    "wrapper success must require pushbackFree, not mere completion",
  );
  assert.ok(!/report\.status === "complete" \|\| report\.status === "dry-run"/.test(wrapperSource));
});

test("untouched template text never satisfies transport degradation acceptance", async () => {
  const templateText = await readFile(path.join(repoRoot, "harness", "exec-plans", "templates", "implementation-plan.md"), "utf8");
  const line = templateText.split("\n").find((l) => l.startsWith("- Transport degradation acceptance:"));
  assert.ok(line, "template must carry the acceptance line");
  const subPacketReport = { schemaVersion: "1.1.0", status: "complete", subPacketFallback: true, rungDepth: "evidence-summary" };
  assert.equal(
    transportDegradationFailures(`${line}\n`, subPacketReport, "plan.md").length,
    1,
    "the template's own placeholder value must fail the meaningfulness check",
  );
});

test("calibration recorded against a different CLI version is stale", async () => {
  const { calibrationStalenessFailures } = await import("../../scripts/dual-role-governance-rules.mjs");
  const calibration = { cliVersion: "codex-cli 0.142.3" };
  assert.equal(calibrationStalenessFailures(calibration, "codex", "codex-cli 0.142.3").length, 0);
  const failures = calibrationStalenessFailures(calibration, "codex", "codex-cli 0.143.0");
  assert.equal(failures.length, 1);
  assert.match(failures[0], /rerun `harness review calibrate --family codex`/);
  // CLI absent locally is not staleness.
  assert.equal(calibrationStalenessFailures(calibration, "codex", null).length, 0);
  assert.equal(calibrationStalenessFailures(null, "codex", "anything").length, 0);
});

test("transport policy has no script fallback — incomplete registry throws, completeness is validated", async () => {
  const { familyTransportFailures } = await import("../../scripts/dual-role-governance-rules.mjs");
  // Runtime: unknown family (no registry transport) must throw, not fall back.
  assert.throws(() => transportPolicyFor("no-such-family"), /no complete transport policy/);
  // Validation: partial transport blocks fail per missing field.
  const complete = { transport: { rungCeilingsMs: { liveness: 20000, "packet-file": 300000, "evidence-summary": 180000, "minimal-blocking-review": 120000 }, retriesPerRung: 1, ceilingBasis: "calibrated 2026-07-02" } };
  assert.deepEqual(familyTransportFailures(complete, "codex"), []);
  const partial = { transport: { rungCeilingsMs: { liveness: 20000 }, retriesPerRung: 1, ceilingBasis: "x" } };
  assert.equal(familyTransportFailures(partial, "codex").length, 3);
  assert.equal(familyTransportFailures({}, "codex").length, 1);
  const noBasis = { transport: { ...complete.transport, ceilingBasis: " " } };
  assert.ok(familyTransportFailures(noBasis, "codex").some((f) => f.includes("ceilingBasis")));
});

test("legacy string findings record unclassified telemetry, never a false zero novel count", async () => {
  const { appendReviewTelemetry } = await import("../../scripts/run-agent-review.mjs");
  const dir = await mkdtemp(path.join(tmpdir(), "telemetry-"));
  const telemetryPath = path.join(dir, "review-transport.jsonl");
  const base = { primary: "claude-code", critic: "codex", criticModel: "gpt-5.5", status: "complete", rungDepth: "packet-file", subPacketFallback: false, pushbackFree: false };
  const legacy = await appendReviewTelemetry({ ...base, review: { blockingFindings: ["a plain string finding"] } }, "r.json", { telemetryPath, highRisk: true });
  assert.equal(legacy.novelClassified, false);
  assert.equal(legacy.novelBlockingFindings, null);
  const classified = await appendReviewTelemetry({ ...base, review: { blockingFindings: [{ id: "x", novel: true }] } }, "r.json", { telemetryPath, highRisk: true });
  assert.equal(classified.novelClassified, true);
  assert.equal(classified.novelBlockingFindings, 1);
  const clean = await appendReviewTelemetry({ ...base, review: { blockingFindings: [] } }, "r.json", { telemetryPath, highRisk: true });
  assert.equal(clean.novelClassified, true);
  assert.equal(clean.novelBlockingFindings, 0);
  await rm(dir, { recursive: true, force: true });
});
