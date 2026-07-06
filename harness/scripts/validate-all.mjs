import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const artifactDirectory = path.join(repoRoot, "artifacts", "validation");

// ---------------------------------------------------------------------------
// Step discovery — no hardcoded list. Scans the repo for available gates.
// ---------------------------------------------------------------------------

const discoverSteps = async () => {
  const steps = [];

  // 1. Discover validate-*.mjs scripts (except validate-all.mjs itself)
  try {
    const scriptFiles = await readdir(path.join(repoRoot, "scripts"));
    const validationScripts = scriptFiles
      .filter((f) => f.startsWith("validate-") && f.endsWith(".mjs") && f !== "validate-all.mjs")
      .sort();

    for (const script of validationScripts) {
      const label = script.replace(/\.mjs$/, "").replace(/^validate-/, "") + " validation";
      steps.push({
        label,
        command: ["node", `scripts/${script}`],
        parser: (output) => {
          try {
            return JSON.parse(output.trim());
          } catch {
            return null;
          }
        },
      });
    }
  } catch {
    // scripts/ directory may not exist
  }

  // 2. Discover test files — run node --test if any .test.mjs files exist
  const hasTests = await hasTestFiles();
  if (hasTests) {
    steps.push({
      label: "test suite",
      command: ["node", "--test"],
      parser: (output) => {
        const readMetric = (pattern) => {
          const match = output.match(pattern);
          return match ? Number.parseInt(match[1], 10) : null;
        };

        return {
          tests: readMetric(/# tests (\d+)/),
          pass: readMetric(/# pass (\d+)/),
          fail: readMetric(/# fail (\d+)/),
          skipped: readMetric(/# skipped (\d+)/),
        };
      },
    });
  }

  return steps;
};

const hasTestFiles = async () => {
  const testsDir = path.join(repoRoot, "tests");

  try {
    await access(testsDir);
  } catch {
    return false;
  }

  const scan = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
        return true;
      }
      if (entry.isDirectory()) {
        const found = await scan(path.join(dir, entry.name));
        if (found) return true;
      }
    }
    return false;
  };

  return scan(testsDir);
};

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

const formatTimestamp = (date) => {
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "T",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    "Z",
  ].join("");
};

const getEnvironmentProfile = () => {
  if (process.env.CI) {
    return "ci-target";
  }

  return "local-full";
};

const runStep = (step) => {
  console.log(`\n[validate-all] ${step.label}`);
  const startedAt = Date.now();
  const result = spawnSync(step.command[0], step.command.slice(1), {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  const combinedOutput = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const parsed = step.parser ? step.parser(combinedOutput) : null;

  return {
    label: step.label,
    status: result.status === 0 ? "passed" : "failed",
    durationMs: Date.now() - startedAt,
    parsed,
  };
};

// ---------------------------------------------------------------------------
// Metrics (generic — counts test files by directory)
// ---------------------------------------------------------------------------

const countTestFiles = async () => {
  const testsDir = path.join(repoRoot, "tests");
  const counts = {};

  try {
    const entries = await readdir(testsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = path.join(testsDir, entry.name);
        const files = await readdir(subDir);
        counts[entry.name] = files.filter((f) => f.endsWith(".test.mjs")).length;
      }
    }
  } catch {
    // tests/ directory may not exist
  }

  return counts;
};

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const toMarkdownReport = (report) => {
  const testStep = report.steps.find((step) => step.label === "test suite");

  const lines = [
    "# Validation Report",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Environment profile: \`${report.environmentProfile}\``,
    `- Overall status: \`${report.overallStatus}\``,
    `- Total duration: ${report.totalDurationMs}ms`,
    "",
    "## Step Summary",
    "",
    ...report.steps.map(
      (step) => `- ${step.label}: \`${step.status}\` (${step.durationMs}ms)`,
    ),
    "",
  ];

  if (testStep) {
    lines.push(
      "## Test Results",
      "",
      `- Pass: ${testStep.parsed?.pass ?? "n/a"}`,
      `- Fail: ${testStep.parsed?.fail ?? "n/a"}`,
      `- Total: ${testStep.parsed?.tests ?? "n/a"}`,
      "",
    );
  }

  if (Object.keys(report.metrics.testFileCounts).length > 0) {
    lines.push(
      "## Test File Breakdown",
      "",
      ...Object.entries(report.metrics.testFileCounts).map(
        ([category, count]) => `- ${category}: ${count}`,
      ),
      "",
    );
  }

  return lines.join("\n");
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const startedAt = Date.now();
const startedAtIso = new Date().toISOString();
const stepResults = [];

const steps = await discoverSteps();

if (steps.length === 0) {
  console.log("[validate-all] no validation steps discovered — nothing to run");
  console.log("[validate-all] add tests under tests/ or scripts/validate-*.mjs to enable gates");
  process.exit(0);
}

console.log(`[validate-all] discovered ${steps.length} step(s): ${steps.map((s) => s.label).join(", ")}`);

const failures = [];

for (const step of steps) {
  const result = runStep(step);
  stepResults.push(result);

  if (result.status === "passed") {
    console.log(`[validate-all] ✓ ${step.label} (${result.durationMs}ms)`);
  } else {
    console.error(`[validate-all] ✗ ${step.label} (${result.durationMs}ms)`);
    failures.push(step.label);
  }
}

if (failures.length > 0) {
  console.error(`\n[validate-all] ${failures.length} step(s) failed: ${failures.join(", ")}`);
  process.exit(1);
}

const testFileCounts = await countTestFiles();
const totalTestFiles = Object.values(testFileCounts).reduce((sum, count) => sum + count, 0);

const report = {
  generatedAt: startedAtIso,
  environmentProfile: getEnvironmentProfile(),
  overallStatus: "passed",
  totalDurationMs: Date.now() - startedAt,
  metrics: { testFileCounts, totalTestFiles },
  steps: stepResults,
};

await mkdir(artifactDirectory, { recursive: true });

const timestamp = formatTimestamp(new Date());
const jsonReport = JSON.stringify(report, null, 2);
const markdownReport = toMarkdownReport(report);

await writeFile(path.join(artifactDirectory, "latest-report.json"), jsonReport);
await writeFile(path.join(artifactDirectory, "latest-summary.md"), markdownReport);
await writeFile(path.join(artifactDirectory, `${timestamp}-report.json`), jsonReport);
await writeFile(path.join(artifactDirectory, `${timestamp}-summary.md`), markdownReport);

console.log("\n[validate-all] all checks passed");
console.log(`[validate-all] report: ${path.relative(repoRoot, path.join(artifactDirectory, "latest-report.json"))}`);
