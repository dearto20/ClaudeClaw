// harness review calibrate — measure real critic latency per registered
// family and record recommended transport ceilings, so rung ceilings are
// measured data, never guesses. Writes
// harness/artifacts/telemetry/critic-calibration-<family>.json; the
// cross-agent-review validator fails when a registry ceiling undercuts the
// recorded recommendation.
// Usage:
//   node harness/scripts/calibrate-critic-transport.mjs [--family <name>] [--samples <n>]
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { agentRegistry, transportPolicyFor } from "./run-agent-review.mjs";

const harnessRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const MICRO_REVIEW_PROMPT = `You are performing a calibration micro-review. Evidence summary:
- Change: one-line docstring fix in a utility module; validation passed.
Return exactly one fenced JSON block named agent-review-json with keys status ("NO_BLOCKING_ISSUES"), blockingFindings [], nonBlockingRisks [], reviewedEvidence [], summary (one sentence).`;

const invoke = (family, spec, prompt, timeoutMs) => {
  const started = Date.now();
  const command = spec.criticInvocationStyle === "claude-print"
    ? { bin: spec.cli, args: ["--model", spec.defaultCriticModel, "-p", prompt] }
    : { bin: spec.cli, args: ["-m", spec.defaultCriticModel, "--ask-for-approval", "never", "exec", "--sandbox", "read-only", "--ephemeral", prompt] };
  const result = spawnSync(command.bin, command.args, { encoding: "utf8", timeout: timeoutMs, killSignal: "SIGTERM" });
  return {
    durationMs: Date.now() - started,
    completed: result.status === 0 && !result.error,
    timedOut: result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM",
  };
};

const cliVersion = (spec) => {
  const result = spawnSync(spec.cli, ["--version"], { encoding: "utf8", timeout: 15_000 });
  return result.status === 0 ? (result.stdout || result.stderr).trim().split("\n")[0] : "unknown";
};

const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)];
};

export const calibrateFamily = async (family, spec, { samples = 3, maxSampleMs = 600_000 } = {}) => {
  const liveness = invoke(family, spec, "Return exactly: OK", 60_000);
  if (!liveness.completed) {
    return { family, status: "unavailable", reason: liveness.timedOut ? "liveness timed out" : "liveness failed" };
  }
  const runs = [];
  for (let index = 0; index < samples; index += 1) {
    const run = invoke(family, spec, MICRO_REVIEW_PROMPT, maxSampleMs);
    runs.push(run);
  }
  const completedDurations = runs.filter((run) => run.completed).map((run) => run.durationMs);
  if (completedDurations.length === 0) {
    return { family, status: "failed", reason: "no calibration sample completed", runs };
  }
  const p50 = percentile(completedDurations, 0.5);
  const p95 = percentile(completedDurations, 0.95);
  // Headroom multipliers: the micro-review has no file access, so the
  // packet-file rung (real tool use) gets the largest margin.
  return {
    family,
    status: "calibrated",
    calibratedAt: new Date().toISOString(),
    cliVersion: cliVersion(spec),
    model: spec.defaultCriticModel,
    samples: completedDurations.length,
    livenessMs: liveness.durationMs,
    p50Ms: p50,
    p95Ms: p95,
    recommendedCeilingsMs: {
      liveness: Math.max(20_000, liveness.durationMs * 2),
      "evidence-summary": p95 * 2,
      "minimal-blocking-review": Math.round(p95 * 1.5),
      "packet-file": p95 * 4,
    },
    currentRegistryCeilingsMs: transportPolicyFor(family).rungCeilingsMs,
  };
};

export const main = async (argv) => {
  const familyArg = argv.includes("--family") ? argv[argv.indexOf("--family") + 1] : null;
  const samples = argv.includes("--samples") ? Number.parseInt(argv[argv.indexOf("--samples") + 1], 10) : 3;
  const families = Object.entries(agentRegistry.families).filter(([name]) => !familyArg || name === familyArg);
  if (families.length === 0) {
    console.error(`[calibrate] unknown family: ${familyArg}`);
    return 1;
  }
  let failed = false;
  for (const [family, spec] of families) {
    console.log(`[calibrate] ${family} (${spec.cli}, ${spec.defaultCriticModel}) — ${samples} sample(s)…`);
    const result = await calibrateFamily(family, spec, { samples });
    if (result.status !== "calibrated") {
      console.error(`[calibrate] ${family}: ${result.status} — ${result.reason}`);
      failed = true;
      continue;
    }
    const outPath = path.join(harnessRoot, "artifacts", "telemetry", `critic-calibration-${family}.json`);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`[calibrate] ${family}: p50 ${result.p50Ms}ms, p95 ${result.p95Ms}ms → ${path.relative(harnessRoot, outPath)}`);
    for (const [rung, recommended] of Object.entries(result.recommendedCeilingsMs)) {
      const current = result.currentRegistryCeilingsMs[rung];
      const verdict = current >= recommended ? "ok" : "RAISE";
      console.log(`[calibrate]   ${rung}: recommended ${recommended}ms, registry ${current}ms (${verdict})`);
    }
  }
  return failed ? 1 : 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2));
}
