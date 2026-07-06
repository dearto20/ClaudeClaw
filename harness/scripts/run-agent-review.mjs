import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { workspaceRoot } from "./validation-helpers.mjs";
import { familyTransportFailures } from "./dual-role-governance-rules.mjs";

const registryPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "framework", "registry", "agents.json");
export const agentRegistry = JSON.parse(readFileSync(registryPath, "utf8"));
const registryFamilies = agentRegistry.families;
const aliasToFamily = new Map();
for (const [family, spec] of Object.entries(registryFamilies)) {
  for (const alias of spec.aliases ?? []) aliasToFamily.set(alias, family);
}

// Transport policy lives ONLY in the registry (per-family, validated for
// completeness) — no script fallback constants, so a partial registry cannot
// silently reintroduce guessed ceilings. The runtime boundary enforces the
// SAME completeness rule the validator does (familyTransportFailures), so an
// incomplete block throws here even if validation was skipped. An explicit
// override (tests, callers) merges over the registry values.
export const transportPolicyFor = (family, override = null) => {
  const normalizedFamily = normalizeAgent(family);
  const spec = registryFamilies[normalizedFamily];
  const completenessFailures = familyTransportFailures(spec ?? {}, normalizedFamily);
  if (completenessFailures.length > 0) {
    throw new Error(
      `registry family ${normalizedFamily} has no complete transport policy in framework/registry/agents.json: ${completenessFailures.join("; ")}`,
    );
  }
  const registryTransport = spec.transport;
  return {
    rungCeilingsMs: { ...registryTransport.rungCeilingsMs, ...(override?.rungCeilingsMs ?? {}) },
    retriesPerRung: Number.isInteger(override?.retriesPerRung)
      ? override.retriesPerRung
      : registryTransport.retriesPerRung,
    source: override ? "override" : "registry",
  };
};

const defaultOutputPath = "harness/artifacts/cross-agent-review/latest-agent-review.json";
const defaultFenceName = "agent-review-json";
const reviewStatuses = new Set(["NO_BLOCKING_ISSUES", "BLOCKING_FINDINGS"]);
const supportedAgents = new Set(Object.keys(registryFamilies));
export const highCapabilityCriticModelDefaults = Object.freeze(
  Object.fromEntries(Object.entries(registryFamilies).map(([family, spec]) => [family, spec.defaultCriticModel])),
);

const usage = `Usage:
  node harness/scripts/run-agent-review.mjs --packet <repo-relative packet.md> [options]

Options:
  --primary <agent>           Primary performer: codex or claude-code. Default: codex
  --critic <agent>            Independent critic: codex or claude-code. Default: claude-code
  --summary <path>            Optional repo-relative summary file used for fallback prompts.
  --out <path>                Repo-relative JSON report path. Default: ${defaultOutputPath}
  --timeout-ms <number>       Override ceiling for every substantive rung. Default: per-rung registry transport policy.
  --liveness-timeout-ms <n>   Override ceiling for the liveness probe. Default: registry transport policy.
  --claude-bin <command>      Claude executable. Default: claude
  --codex-bin <command>       Codex executable. Default: codex
  --claude-model <model>      Claude critic model. Default: env HARNESS_CLAUDE_CRITIC_MODEL or ${highCapabilityCriticModelDefaults["claude-code"]}
  --codex-model <model>       Codex critic model. Default: env HARNESS_CODEX_CRITIC_MODEL or ${highCapabilityCriticModelDefaults.codex}
  --high-risk                 Classify this review as high-risk in decision-gate telemetry.
  --dry-run                   Print planned attempts without invoking a critic.
  --help                      Show this help.
`;

export const clipText = (value, limit = 8_000) => {
  const text = String(value ?? "");
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}\n\n[truncated ${text.length - limit} characters]`;
};

export const normalizeAgent = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-");
  if (normalized === "claude") {
    return "claude-code";
  }
  return normalized;
};

const displayAgent = (agent) => registryFamilies[agent]?.displayName ?? agent;
const envModel = (envName, fallback) => {
  const value = process.env[envName];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
};

const ensureRepoRelative = (relativePath, label) => {
  if (!relativePath || typeof relativePath !== "string") {
    throw new Error(`${label} is required`);
  }
  if (relativePath.startsWith("/") || relativePath.includes("\\") || relativePath.split("/").includes("..")) {
    throw new Error(`${label} must be a repo-relative path without '..': ${relativePath}`);
  }
};

const resolveRepoPath = (relativePath, label) => {
  ensureRepoRelative(relativePath, label);
  return path.join(workspaceRoot, relativePath);
};

const validateAgent = (agent, label) => {
  const normalized = normalizeAgent(agent);
  if (!supportedAgents.has(normalized)) {
    throw new Error(`${label} must be codex or claude-code`);
  }
  return normalized;
};

const validateModel = (model, label) => {
  if (typeof model !== "string" || !model.trim()) {
    throw new Error(`${label} must be a non-empty model name or alias`);
  }
  if (/[\r\n]/.test(model)) {
    throw new Error(`${label} must not contain newlines`);
  }
  return model.trim();
};

const criticModel = (options) =>
  normalizeAgent(options.critic) === "claude-code" ? options.claudeModel : options.codexModel;

export const isPushbackFreeReview = (review) =>
  review?.status === "NO_BLOCKING_ISSUES" &&
  review?.unstructured !== true &&
  Array.isArray(review.blockingFindings) &&
  review.blockingFindings.length === 0 &&
  Array.isArray(review.nonBlockingRisks) &&
  review.nonBlockingRisks.length === 0;

export const validateHighCapabilityCriticModel = (agent, model, label = "criticModel") => {
  const normalizedAgent = validateAgent(agent, "critic");
  const normalizedModel = validateModel(model, label);
  const lowerModel = normalizedModel.toLowerCase();
  const failures = [];
  const spec = registryFamilies[normalizedAgent] ?? {};
  const markers = spec.lowCapabilityMarkers ?? [];
  if (markers.length > 0) {
    const lowCapabilityPattern = new RegExp(`(^|[-_.\\s])(${markers.join("|")})([-_.\\s]|$)`);
    if (lowCapabilityPattern.test(lowerModel)) {
      failures.push(`${label} for ${displayAgent(normalizedAgent)} must not be a low-cost or lower-tier model: ${normalizedModel}`);
    }
  }
  if (spec.highCapabilityPattern && !new RegExp(spec.highCapabilityPattern).test(lowerModel)) {
    failures.push(`${label} for ${displayAgent(normalizedAgent)} must satisfy the registry high-capability policy (${spec.highCapabilityRequirement}): ${normalizedModel}`);
  }

  return failures;
};

const assertHighCapabilityCriticModel = (options) => {
  const failures = validateHighCapabilityCriticModel(
    options.critic,
    criticModel(options),
    normalizeAgent(options.critic) === "claude-code" ? "--claude-model" : "--codex-model",
  );
  if (failures.length > 0) {
    throw new Error(failures.join("; "));
  }
};

const withCriticModelDefaults = (options) => {
  const reviewOptions = {
    ...options,
    claudeModel: validateModel(
      options.claudeModel ?? envModel("HARNESS_CLAUDE_CRITIC_MODEL", highCapabilityCriticModelDefaults["claude-code"]),
      "--claude-model",
    ),
    codexModel: validateModel(
      options.codexModel ?? envModel("HARNESS_CODEX_CRITIC_MODEL", highCapabilityCriticModelDefaults.codex),
      "--codex-model",
    ),
  };
  assertHighCapabilityCriticModel(reviewOptions);
  return reviewOptions;
};

export const parseArgs = (argv, defaults = {}) => {
  const options = {
    outputPath: defaults.outputPath ?? defaultOutputPath,
    timeoutMs: null,
    livenessTimeoutMs: null,
    claudeBin: "claude",
    codexBin: "codex",
    claudeModel: defaults.claudeModel ?? envModel("HARNESS_CLAUDE_CRITIC_MODEL", highCapabilityCriticModelDefaults["claude-code"]),
    codexModel: defaults.codexModel ?? envModel("HARNESS_CODEX_CRITIC_MODEL", highCapabilityCriticModelDefaults.codex),
    primary: defaults.primary ?? "codex",
    critic: defaults.critic ?? "claude-code",
    fenceName: defaults.fenceName ?? defaultFenceName,
    dryRun: false,
    highRisk: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = () => {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      return value;
    };

    if (arg === "--help") {
      options.help = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--high-risk") {
      options.highRisk = true;
    } else if (arg === "--packet") {
      options.packetPath = readValue();
    } else if (arg === "--summary") {
      options.summaryPath = readValue();
    } else if (arg === "--out") {
      options.outputPath = readValue();
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = Number.parseInt(readValue(), 10);
    } else if (arg === "--liveness-timeout-ms") {
      options.livenessTimeoutMs = Number.parseInt(readValue(), 10);
    } else if (arg === "--claude-bin") {
      options.claudeBin = readValue();
    } else if (arg === "--codex-bin") {
      options.codexBin = readValue();
    } else if (arg === "--claude-model") {
      options.claudeModel = readValue();
    } else if (arg === "--codex-model") {
      options.codexModel = readValue();
    } else if (arg === "--primary") {
      options.primary = readValue();
    } else if (arg === "--critic") {
      options.critic = readValue();
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  options.primary = validateAgent(options.primary, "--primary");
  options.critic = validateAgent(options.critic, "--critic");
  options.claudeModel = validateModel(options.claudeModel, "--claude-model");
  options.codexModel = validateModel(options.codexModel, "--codex-model");
  assertHighCapabilityCriticModel(options);

  if (!options.help) {
    ensureRepoRelative(options.packetPath, "--packet");
    ensureRepoRelative(options.outputPath, "--out");
    if (options.summaryPath) {
      ensureRepoRelative(options.summaryPath, "--summary");
    }
    for (const [label, value] of [["--timeout-ms", options.timeoutMs], ["--liveness-timeout-ms", options.livenessTimeoutMs]]) {
      if (value !== null && (!Number.isInteger(value) || value < 1_000 || value > 600_000)) {
        throw new Error(`${label} must be an integer between 1000 and 600000`);
      }
    }
  }

  return options;
};

const requiredJsonInstruction = (fenceName = defaultFenceName) => `Return exactly one fenced JSON block named ${fenceName} with this shape:
\`\`\`${fenceName}
{
  "status": "NO_BLOCKING_ISSUES",
  "blockingFindings": [],
  "nonBlockingRisks": [],
  "reviewedEvidence": [],
  "summary": ""
}
\`\`\`
Use status BLOCKING_FINDINGS when any finding prevents pushback-free readiness. A readiness response with NO_BLOCKING_ISSUES must leave both blockingFindings and nonBlockingRisks empty.
Mark each blockingFindings item with "novel": true when the issue is NOT already raised in the packet's own risks or specific review questions, false when the packet itself flagged it — this feeds the cross-family decision-gate telemetry.`;

export const buildAttemptPlan = ({
  packetPath,
  packetText = "",
  summaryText = "",
  timeoutMs = null,
  livenessTimeoutMs = null,
  primary = "codex",
  critic = "claude-code",
  fenceName = defaultFenceName,
  transport = null,
}) => {
  const primaryAgent = displayAgent(normalizeAgent(primary));
  const criticAgent = displayAgent(normalizeAgent(critic));
  const policy = transportPolicyFor(critic, transport);
  const rungCeiling = (rung) =>
    rung === "liveness"
      ? livenessTimeoutMs ?? policy.rungCeilingsMs.liveness
      : timeoutMs ?? policy.rungCeilingsMs[rung];
  const packetExcerpt = clipText(packetText, 8_000);
  const summaryExcerpt = clipText(summaryText || packetText, 5_000);
  const minimalExcerpt = clipText(summaryText || packetText, 1_800);

  return [
    {
      name: "liveness",
      timeoutMs: rungCeiling("liveness"),
      prompt: "Return exactly: OK",
      expects: "OK",
    },
    {
      name: "packet-file",
      timeoutMs: rungCeiling("packet-file"),
      prompt: `You are ${criticAgent} performing an independent critic review for ${primaryAgent}. Read only this repo-relative review packet unless it names specific evidence files: ${packetPath}

Do not perform broad repository exploration. Review for blocking correctness, security, validation, framework/override boundary, traceability, and user-intent gaps.

${requiredJsonInstruction(fenceName)}`,
    },
    {
      name: "evidence-summary",
      timeoutMs: rungCeiling("evidence-summary"),
      prompt: `You are ${criticAgent} performing an independent critic review for ${primaryAgent} from an evidence summary only. Do not inspect files.

Evidence summary:
${summaryExcerpt}

Review for blocking correctness, security, validation, framework/override boundary, traceability, and user-intent gaps.

${requiredJsonInstruction(fenceName)}`,
    },
    {
      name: "minimal-blocking-review",
      timeoutMs: rungCeiling("minimal-blocking-review"),
      prompt: `You are ${criticAgent} performing an independent critic review for ${primaryAgent}. Use this bounded context only:
${minimalExcerpt}

Report only findings that should stop pushback-free readiness. Leave both findings arrays empty only when no pushback remains.

${requiredJsonInstruction(fenceName)}`,
    },
  ];
};

export const extractAgentReview = (stdout) => {
  const text = String(stdout ?? "");
  const fenceNames = ["agent-review-json", "claude-review-json", "codex-review-json"];

  // The LAST accepted fenced block in the whole output wins, across ALL
  // accepted fence names in occurrence order: the prompt itself carries a
  // sample block, and a CLI that echoes its prompt must never have that
  // sample — an empty pushback-free review — accepted as the critic's
  // verdict, regardless of which fence name the real verdict uses.
  const blocks = [...text.matchAll(new RegExp(`\`\`\`(${fenceNames.join("|")})\\n([\\s\\S]*?)\\n\`\`\``, "g"))];
  if (blocks.length > 0) {
    const match = blocks[blocks.length - 1];

    const parsed = JSON.parse(match[2]);
    if (!reviewStatuses.has(parsed.status)) {
      throw new Error(`invalid review status: ${parsed.status}`);
    }
    for (const field of ["blockingFindings", "nonBlockingRisks", "reviewedEvidence"]) {
      if (!Array.isArray(parsed[field])) {
        throw new Error(`${field} must be an array`);
      }
    }
    if (typeof parsed.summary !== "string") {
      throw new Error("summary must be a string");
    }
    return parsed;
  }

  // Unstructured output can only BLOCK, never clear: a stray
  // "NO_BLOCKING_ISSUES" in prose must not become a pushback-free review.
  if (/BLOCKING[ _-]?FINDINGS/i.test(text)) {
    return {
      status: "BLOCKING_FINDINGS",
      blockingFindings: [clipText(text.trim(), 2_000)],
      nonBlockingRisks: [],
      reviewedEvidence: [],
      summary: "Unstructured blocking findings output.",
      unstructured: true,
    };
  }

  return null;
};

const runCommandAttempt = ({ options, attempt, cwd = workspaceRoot }) => {
  const startedAt = Date.now();
  const critic = normalizeAgent(options.critic);
  const command = critic === "claude-code"
    ? {
        bin: options.claudeBin,
        args: ["--model", options.claudeModel, "-p", attempt.prompt],
      }
    : {
        bin: options.codexBin,
        args: [
          "-m",
          options.codexModel,
          "--ask-for-approval",
          "never",
          "exec",
          "--sandbox",
          "read-only",
          "-C",
          cwd,
          "--ephemeral",
          attempt.prompt,
        ],
      };

  const result = spawnSync(command.bin, command.args, {
    cwd,
    encoding: "utf8",
    timeout: attempt.timeoutMs,
    killSignal: "SIGTERM",
  });
  const durationMs = Date.now() - startedAt;
  const timedOut = result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM";
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  return {
    name: attempt.name,
    critic,
    model: criticModel(options),
    timeoutMs: attempt.timeoutMs,
    durationMs,
    exitCode: result.status,
    signal: result.signal,
    status: timedOut ? "timed-out" : result.status === 0 ? "completed" : "failed",
    stdout: clipText(stdout, 20_000),
    stderr: clipText(stderr, 8_000),
    error: result.error?.message,
  };
};

const livenessPassed = (attemptResult) => {
  if (attemptResult.status !== "completed") {
    return false;
  }

  return attemptResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === "OK");
};

export const runAgentReview = async (options) => {
  const reviewOptions = withCriticModelDefaults(options);
  const startedAt = new Date().toISOString();
  const policy = transportPolicyFor(reviewOptions.critic, reviewOptions.transport ?? null);
  const packetText = await readFile(resolveRepoPath(reviewOptions.packetPath, "--packet"), "utf8");
  const summaryText = reviewOptions.summaryPath
    ? await readFile(resolveRepoPath(reviewOptions.summaryPath, "--summary"), "utf8")
    : packetText;
  const attemptPlan = buildAttemptPlan({
    packetPath: reviewOptions.packetPath,
    packetText,
    summaryText,
    timeoutMs: reviewOptions.timeoutMs,
    livenessTimeoutMs: reviewOptions.livenessTimeoutMs,
    primary: reviewOptions.primary,
    critic: reviewOptions.critic,
    fenceName: reviewOptions.fenceName,
    transport: reviewOptions.transport ?? null,
  });
  const reportBase = () => ({
    schemaVersion: "1.1.0",
    primary: normalizeAgent(reviewOptions.primary),
    critic: normalizeAgent(reviewOptions.critic),
    criticModel: criticModel(reviewOptions),
    transportPolicy: {
      source: policy.source,
      rungCeilingsMs: policy.rungCeilingsMs,
      retriesPerRung: policy.retriesPerRung,
    },
  });

  if (reviewOptions.dryRun) {
    return {
      ...reportBase(),
      status: "dry-run",
      criticModelDefaults: highCapabilityCriticModelDefaults,
      pushbackFree: null,
      attempts: attemptPlan.map((attempt) => ({
        name: attempt.name,
        timeoutMs: attempt.timeoutMs,
        promptChars: attempt.prompt.length,
      })),
    };
  }

  const attempts = [];
  // One retry at the same rung before degrading: a transient stall must not
  // permanently cost a rung of review depth.
  const runRungWithRetry = (attempt) => {
    let result = null;
    for (let attemptNumber = 1; attemptNumber <= 1 + policy.retriesPerRung; attemptNumber += 1) {
      result = runCommandAttempt({ options: reviewOptions, attempt });
      result.try = attemptNumber;
      attempts.push(result);
      if (result.status === "completed" && result.stdout.trim()) {
        return result;
      }
    }
    return result;
  };

  const livenessAttempt = runRungWithRetry(attemptPlan[0]);
  if (!livenessPassed(livenessAttempt)) {
    return {
      ...reportBase(),
      status: "blocked",
      pushbackFree: false,
      reason: `${displayAgent(normalizeAgent(reviewOptions.critic))} liveness probe failed or timed out.`,
      startedAt,
      completedAt: new Date().toISOString(),
      selectedAttempt: null,
      rungDepth: null,
      attempts,
    };
  }

  for (const attempt of attemptPlan.slice(1)) {
    const attemptResult = runRungWithRetry(attempt);

    if (attemptResult.status !== "completed" || !attemptResult.stdout.trim()) {
      continue;
    }

    try {
      const review = extractAgentReview(attemptResult.stdout);
      if (review) {
        const pushbackFree = isPushbackFreeReview(review);
        return {
          ...reportBase(),
          status: "complete",
          pushbackFree,
          startedAt,
          completedAt: new Date().toISOString(),
          selectedAttempt: attempt.name,
          rungDepth: attempt.name,
          // Priced degradation: any complete review below the packet-file rung
          // reviewed the primary performer's summary, not the artifacts.
          subPacketFallback: attempt.name !== "packet-file",
          review,
          attempts,
        };
      }
      attemptResult.status = "unparseable";
    } catch (error) {
      attemptResult.status = "unparseable";
      attemptResult.parseError = error.message;
    }
  }

  return {
    ...reportBase(),
    status: "blocked",
    pushbackFree: false,
    reason: `${displayAgent(normalizeAgent(reviewOptions.critic))} review attempts exhausted without parseable review output.`,
    startedAt,
    completedAt: new Date().toISOString(),
    selectedAttempt: null,
    rungDepth: null,
    attempts,
  };
};

export const writeReport = async (relativePath, report) => {
  const outputPath = resolveRepoPath(relativePath, "--out");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
};

// Durable decision-gate telemetry: one JSONL line per review run, the data
// surface behind `harness review decision-gate` and the cross-family
// demotion criterion in framework/process/review.md.
export const reviewTelemetryPath = "harness/artifacts/telemetry/review-transport.jsonl";

export const appendReviewTelemetry = async (report, reportPath, { telemetryPath = reviewTelemetryPath, highRisk = null } = {}) => {
  const blockingFindings = report.review?.blockingFindings ?? [];
  // The novel count is only meaningful when every finding carries the boolean
  // classification; a review using the legacy string shape records null so the
  // decision gate can surface it as unclassified instead of counting zero.
  const novelClassified = blockingFindings.every(
    (finding) => finding && typeof finding === "object" && typeof finding.novel === "boolean",
  );
  const entry = {
    at: report.completedAt ?? new Date().toISOString(),
    primary: report.primary,
    critic: report.critic,
    criticModel: report.criticModel,
    status: report.status,
    highRisk,
    rungDepth: report.rungDepth ?? null,
    subPacketFallback: report.subPacketFallback ?? null,
    pushbackFree: report.pushbackFree ?? null,
    blockingFindings: blockingFindings.length,
    novelClassified,
    novelBlockingFindings: novelClassified
      ? blockingFindings.filter((finding) => finding.novel === true).length
      : null,
    reportPath,
  };
  const absolute = path.isAbsolute(telemetryPath) ? telemetryPath : path.join(workspaceRoot, telemetryPath);
  await mkdir(path.dirname(absolute), { recursive: true });
  const { appendFile } = await import("node:fs/promises");
  await appendFile(absolute, `${JSON.stringify(entry)}\n`);
  return entry;
};

export const main = async (argv) => {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage);
    return 0;
  }

  const report = await runAgentReview(options);
  await writeReport(options.outputPath, report);
  if (report.status !== "dry-run") {
    await appendReviewTelemetry(report, options.outputPath, { highRisk: options.highRisk === true });
  }
  console.log(JSON.stringify(report));

  return report.status === "dry-run" || (report.status === "complete" && report.pushbackFree === true) ? 0 : 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(`[run-agent-review] ${error.message}`);
    process.exitCode = 1;
  }
}
