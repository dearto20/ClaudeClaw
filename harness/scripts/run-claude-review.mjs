import { pathToFileURL } from "node:url";
import {
  buildAttemptPlan as buildAgentAttemptPlan,
  clipText,
  extractAgentReview,
  parseArgs as parseAgentArgs,
  runAgentReview,
  writeReport,
} from "./run-agent-review.mjs";

const defaultOutputPath = "harness/artifacts/cross-agent-review/latest-claude-review.json";

const usage = `Usage:
  node harness/scripts/run-claude-review.mjs --packet <repo-relative packet.md> [options]

Options:
  --summary <path>            Optional repo-relative summary file used for fallback prompts.
  --out <path>                Repo-relative JSON report path. Default: ${defaultOutputPath}
  --timeout-ms <number>       Timeout per review attempt.
  --liveness-timeout-ms <n>   Timeout for Claude liveness probe.
  --claude-bin <command>      Claude executable. Default: claude
  --claude-model <model>      Claude critic model. Default: env HARNESS_CLAUDE_CRITIC_MODEL or opus
  --dry-run                   Print planned attempts without invoking Claude.
  --help                      Show this help.
`;

export { clipText, writeReport };

export const parseArgs = (argv) =>
  parseAgentArgs(argv, {
    outputPath: defaultOutputPath,
    primary: "codex",
    critic: "claude-code",
    fenceName: "claude-review-json",
  });

export const buildAttemptPlan = (options) =>
  buildAgentAttemptPlan({
    ...options,
    primary: options.primary ?? "codex",
    critic: "claude-code",
    fenceName: "claude-review-json",
  });

export const extractClaudeReview = extractAgentReview;

export const runClaudeReview = async (options) =>
  runAgentReview({
    ...options,
    primary: options.primary ?? "codex",
    critic: "claude-code",
    fenceName: "claude-review-json",
  });

export const main = async (argv) => {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage);
    return 0;
  }

  const report = await runClaudeReview(options);
  await writeReport(options.outputPath, report);
  console.log(JSON.stringify(report));

  // Mirror run-agent-review exit semantics: unresolved critic pushback is
  // never a successful review, even through the legacy wrapper.
  return report.status === "dry-run" || (report.status === "complete" && report.pushbackFree === true) ? 0 : 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(`[run-claude-review] ${error.message}`);
    process.exitCode = 1;
  }
}
