#!/usr/bin/env node
// harness CLI — the mechanical layer of the harness.
// Every procedure here runs identically under any agent family or model.
// Subcommands: check, status, tier, ledger, precommit, activate-hooks, review, bootstrap, upgrade.

import { appendFile, copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { affectedPathsFromPlan, hasTerminalReviewRecord, isGovernedPath, isProcessPath } from "./ledger-rules.mjs";
import { isUpgradeSurfacePath } from "./upgrade-surface.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(harnessRoot, "..");

const isSourceRepo = () => existsSync(path.join(repoRoot, "development", "developmentharness-source.json"));

// Governing harness version: manifest in the source repo, the target-owned
// adoption record everywhere else. Shown on the statusline so "this repo is
// managed by a bootstrapped harness" is visible at a glance, model-independent.
const harnessVersion = () => {
  try {
    if (isSourceRepo()) {
      const manifest = JSON.parse(readFileSync(path.join(repoRoot, "development", "distribution-manifest.json"), "utf8"));
      return manifest.harnessVersion ?? "unversioned";
    }
    const adoption = JSON.parse(
      readFileSync(path.join(harnessRoot, "override", "governance", "harness-upgrade-adoption.json"), "utf8"),
    );
    return adoption.harnessVersion ?? "unversioned";
  } catch {
    return "unversioned";
  }
};

// ---------------------------------------------------------------------------
// Tier model — mechanical, path-based. Never model-declared.
// ---------------------------------------------------------------------------

// Path taxonomies (governed/process) are shared rules in ledger-rules.mjs.

const git = (args, opts = {}) =>
  spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", ...opts });

const changedPaths = ({ stagedOnly = false } = {}) => {
  const result = stagedOnly
    ? git(["diff", "--cached", "--name-only"])
    : git(["status", "--porcelain"]);
  if (result.status !== 0) return null; // not a git repo
  const lines = result.stdout.split("\n").filter(Boolean);
  return stagedOnly
    ? lines
    : lines.map((line) => {
        const p = line.slice(3);
        // rename format: "old -> new"
        const arrow = p.indexOf(" -> ");
        return arrow === -1 ? p : p.slice(arrow + 4);
      });
};

const computeTier = (paths) => {
  const substantive = (paths ?? []).filter((p) => !isProcessPath(p));
  if (substantive.length === 0) return { tier: "trivial", triggers: [] };
  const governed = substantive.filter(isGovernedPath);
  if (governed.length > 0) return { tier: "high-risk", triggers: governed };
  return { tier: "standard", triggers: substantive };
};

// ---------------------------------------------------------------------------
// Ledger helpers
// ---------------------------------------------------------------------------

const activeDir = path.join(harnessRoot, "exec-plans", "active");
const templatePath = path.join(harnessRoot, "exec-plans", "templates", "implementation-plan.md");

// Slugs are basename-only: path separators or traversal in a slug would let
// ledger commands read or write outside exec-plans/active.
const assertSafeSlug = (slug) => {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug ?? "")) {
    fail(`invalid ledger slug (lowercase letters, digits, hyphens only): ${slug}`);
  }
};

const activeLedgers = async () => {
  try {
    const entries = await readdir(activeDir);
    return entries.filter((f) => f.endsWith(".md") && f !== "README.md");
  } catch {
    return [];
  }
};

const currentStepOf = (ledgerText) => {
  const match = ledgerText.match(/^- Current step: (.+)$/m);
  return match ? match[1].trim() : null;
};

const ledgerNew = async (slug) => {
  if (!slug) fail("usage: harness ledger new <slug>");
  assertSafeSlug(slug);
  const target = path.join(activeDir, `${slug}.md`);
  if (existsSync(target)) fail(`ledger already exists: ${rel(target)}`);
  let text = await readFile(templatePath, "utf8");
  text = text.replace("## State\n- `draft`", "## State\n- `active`");
  if (!text.includes("## Current Step")) {
    text = text.replace(
      "## Implementation Steps",
      "## Current Step\n- Current step: planning — governing: harness/AGENTS.md\n\n## Implementation Steps",
    );
  }
  await mkdir(activeDir, { recursive: true });
  await writeFile(target, text);
  await recordLedgerUsage({ event: "new", slug });
  console.log(`[harness] ledger created: ${rel(target)}`);
};

const annexTemplatePath = path.join(harnessRoot, "exec-plans", "templates", "implementation-plan-annexes.md");

const annexNames = (annexText) => [...annexText.matchAll(/<!-- annex:([a-z-]+) -->/g)].map((m) => m[1]);

// The name is proven against the declared slug list BEFORE any extraction, so
// user input never reaches a dynamic pattern (regex metacharacters cannot
// match a block they do not name).
const annexBlock = (annexText, name) => {
  const open = `<!-- annex:${name} -->\n`;
  const close = "\n<!-- /annex -->";
  const start = annexText.indexOf(open);
  if (start === -1) return null;
  const end = annexText.indexOf(close, start + open.length);
  if (end === -1) return null;
  return annexText.slice(start + open.length, end).trim();
};

const ledgerAnnex = async (slug, name) => {
  const annexText = await readFile(annexTemplatePath, "utf8");
  const available = annexNames(annexText);
  if (!slug || !name) fail(`usage: harness ledger annex <slug> <name> — available: ${available.join(", ")}`);
  assertSafeSlug(slug);
  if (!available.includes(name)) fail(`unknown annex: ${name} — available: ${available.join(", ")}`);
  const target = path.join(activeDir, `${slug}.md`);
  if (!existsSync(target)) fail(`no active ledger: ${rel(target)}`);
  const block = annexBlock(annexText, name);
  if (!block) fail(`unknown annex: ${name} — available: ${available.join(", ")}`);
  let text = await readFile(target, "utf8");
  const sectionHeading = block.match(/^## .+$/m)?.[0];
  if (sectionHeading && text.includes(`${sectionHeading}\n`)) {
    fail(`annex already present: ${name}`);
  }
  text = `${text.trimEnd()}\n\n${block}\n`;
  await writeFile(target, text);
  await recordLedgerUsage({ event: "annex", slug, annex: name });
  console.log(`[harness] annex appended: ${name} → ${rel(target)}`);
};

const ledgerStep = async (slug, stepText) => {
  if (!slug || !stepText) fail("usage: harness ledger step <slug> <text>");
  assertSafeSlug(slug);
  const target = path.join(activeDir, `${slug}.md`);
  let text = await readFile(target, "utf8");
  if (/^- Current step: .+$/m.test(text)) {
    text = text.replace(/^- Current step: .+$/m, `- Current step: ${stepText}`);
  } else {
    text = text.replace(
      /^## Implementation Steps$/m,
      `## Current Step\n- Current step: ${stepText}\n\n## Implementation Steps`,
    );
  }
  await writeFile(target, text);
  // Cadence only — step text is prose and stays out of telemetry by contract.
  await recordLedgerUsage({ event: "step", slug });
  console.log(`[harness] step → ${stepText}`);
};

const ledgerClose = async (slug) => {
  if (!slug) fail("usage: harness ledger close <slug>");
  assertSafeSlug(slug);
  const source = path.join(activeDir, `${slug}.md`);
  const sourceMode = existsSync(path.join(repoRoot, "development", "developmentharness-source.json"));
  const completedDir = sourceMode
    ? path.join(repoRoot, "development", "exec-plans", "completed")
    : path.join(harnessRoot, "exec-plans", "completed");
  await mkdir(completedDir, { recursive: true });
  const target = path.join(completedDir, `${slug}.md`);
  let text = await readFile(source, "utf8");
  text = text.replace("## State\n- `active`", "## State\n- `completed`");
  await writeFile(target, text);
  const { rm } = await import("node:fs/promises");
  await rm(source);
  await recordLedgerUsage({
    event: "close",
    slug,
    coreFields: ledgerFieldStates(text),
    annexes: [...text.matchAll(/^## (Deep Alignment|Expert Bench|Critique And Debate|Intake Alignment|Target Validation Profile|Worktree Runtime|Observability|Browser Validation|Artifact Contract And Convergence)$/gm)].map((m) => m[1]),
  });
  console.log(`[harness] ledger closed → ${rel(target)}`);
};

// ---------------------------------------------------------------------------
// Status — every field derived from artifacts, never from model claims.
// ---------------------------------------------------------------------------

const latestMtime = async (paths) => {
  let latest = 0;
  for (const p of paths) {
    try {
      const s = await stat(path.join(repoRoot, p));
      if (s.mtimeMs > latest) latest = s.mtimeMs;
    } catch {
      /* deleted file */
    }
  }
  return latest;
};

const checkState = async (dirtyPaths) => {
  const reportPath = path.join(harnessRoot, "artifacts", "validation", "latest-report.json");
  if (!existsSync(reportPath)) return "none";
  try {
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    if (report.overallStatus !== "passed") return "failing";
    const reportTime = (await stat(reportPath)).mtimeMs;
    const newest = await latestMtime((dirtyPaths ?? []).filter((p) => !isProcessPath(p)));
    return newest > reportTime ? "stale" : "fresh";
  } catch {
    return "none";
  }
};

const criticState = async (activeSlug = null) => {
  const reviewDir = path.join(harnessRoot, "artifacts", "cross-agent-review");
  try {
    let entries = [];
    try {
      entries = (await readdir(reviewDir)).filter((f) => f.endsWith("-report.json"));
    } catch {
      // No review artifacts yet: with active work the critic is pending, not absent.
      return activeSlug ? "pending" : "none";
    }
    if (activeSlug) {
      // Scope to the active ledger, delimiter-aware: slug "foo" must not match
      // "foobar-report.json" — a prefix collision is not critic evidence.
      const scoped = new RegExp(`^${activeSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(-r\\d+)?-report\\.json$`);
      entries = entries.filter((f) => scoped.test(f));
      if (entries.length === 0) return "pending";
    }
    if (entries.length === 0) return "none";
    let newest = null;
    let newestTime = 0;
    for (const entry of entries) {
      const s = await stat(path.join(reviewDir, entry));
      if (s.mtimeMs > newestTime) {
        newestTime = s.mtimeMs;
        newest = entry;
      }
    }
    const report = JSON.parse(await readFile(path.join(reviewDir, newest), "utf8"));
    if (report.pushbackFree === true) return "pushback-free";
    return "pending";
  } catch {
    return "none";
  }
};

const status = async ({ asLine = false, asJson = false } = {}) => {
  const dirty = changedPaths();
  const { tier } = computeTier(dirty);
  const ledgers = await activeLedgers();
  let step = null;
  if (ledgers.length > 0) {
    const text = await readFile(path.join(activeDir, ledgers[0]), "utf8");
    step = currentStepOf(text);
  }
  const activeSlug = ledgers.length > 0 ? ledgers[0].replace(/\.md$/, "") : null;
  const state = {
    tier,
    ledger: activeSlug ?? "none",
    step: step ?? "-",
    check: await checkState(dirty),
    critic: await criticState(activeSlug),
  };
  if (asJson) {
    console.log(JSON.stringify({ version: harnessVersion(), ...state }));
    return;
  }
  const line = `[harness v${harnessVersion()}] tier:${state.tier} | ledger:${state.ledger} | step:${state.step} | check:${state.check} | critic:${state.critic}`;
  console.log(asLine ? line : line);
};

// ---------------------------------------------------------------------------
// Check — runs the validation pipeline, verifies hook activation, records telemetry.
// ---------------------------------------------------------------------------

const hooksActive = () => {
  const result = git(["config", "core.hooksPath"]);
  if (result.status !== 0) return false;
  const configured = result.stdout.trim();
  return configured === "harness/hooks" || path.resolve(repoRoot, configured) === path.join(harnessRoot, "hooks");
};

const appendTelemetry = async (file, entry) => {
  // Failure-tolerant by contract: telemetry must never break the command
  // writing it. Raw counts only — interpretation belongs to pruning reviews.
  try {
    const telemetryDir = path.join(harnessRoot, "artifacts", "telemetry");
    await mkdir(telemetryDir, { recursive: true });
    await appendFile(path.join(telemetryDir, file), `${JSON.stringify(entry)}\n`);
  } catch {
    /* telemetry is observability, not control flow */
  }
};

const recordTelemetry = (entry) => appendTelemetry("gate-outcomes.jsonl", entry);

// Ledger-usage telemetry (R5): which annexes trigger, which core fields are
// left pending/boilerplate at close, and step cadence — the evidence base for
// the next template pruning round.
const CORE_LEDGER_FIELDS = [
  "Raw user intent",
  "Discovered intent (explicit, implicit, hidden constraints)",
  "Sources consulted (docs, code paths, runtime evidence, external references)",
  "Alternatives considered and selected strategy",
  "Acceptance criteria (checkable done-when bounds)",
  "Beyond-minimum opportunities and scope guardrails, or n/a",
  "Internal decomposition summary",
  "Critic findings (accepted / rejected-with-rationale / blocking)",
  "Accepted non-blocking risks with rationale",
  "No-pushback terminal evidence",
  "Unresolved critic pushback",
];

const ledgerFieldStates = (text) => {
  const states = {};
  for (const field of CORE_LEDGER_FIELDS) {
    const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`^[- ]*${escaped}:[ \\t]*(.*)$`, "im"));
    const value = (match?.[1] ?? "").trim().replace(/^\`|\`$/g, "").toLowerCase();
    states[field] = value.length === 0 ? "empty" : value === "pending" ? "pending" : value === "n/a" ? "n/a" : "filled";
  }
  return states;
};

const recordLedgerUsage = (entry) => appendTelemetry("ledger-usage.jsonl", { at: new Date().toISOString(), ...entry });

const check = async () => {
  const startedAt = Date.now();
  const result = spawnSync("node", ["scripts/validate-all.mjs"], {
    cwd: harnessRoot,
    encoding: "utf8",
    stdio: "inherit",
  });
  const passed = result.status === 0;
  let failedSteps = [];
  try {
    const report = JSON.parse(
      await readFile(path.join(harnessRoot, "artifacts", "validation", "latest-report.json"), "utf8"),
    );
    failedSteps = (report.steps ?? []).filter((s) => s.status !== "passed").map((s) => s.label);
  } catch {
    /* report may be absent on hard failure */
  }
  await recordTelemetry({
    at: new Date().toISOString(),
    command: "check",
    passed,
    failedSteps,
    durationMs: Date.now() - startedAt,
  });
  if (!passed) process.exit(1);
  console.log("[harness] check passed");
};

// ---------------------------------------------------------------------------
// Pre-commit gate — called by harness/hooks/pre-commit on staged changes.
// ---------------------------------------------------------------------------

// A path is covered when some governing ledger declares it (exactly or by a
// directory prefix) in its "## Affected Paths" section.
const isCoveredBy = (p, declared) =>
  declared.some((d) => p === d || (d.endsWith("/") ? p.startsWith(d) : p.startsWith(`${d}/`)));

// Gate evidence must come from what will actually be committed. Staged mode
// reads the index ONLY: the index holds every tracked file, so an absent path
// means the commit will not contain it (staged deletion or untracked) — no
// HEAD fallback, or a commit could delete its own governing ledger and still
// ride the deleted evidence. Range mode reads the pushed tree (HEAD).
const gateEvidenceText = (relPath, { staged }) => {
  const result = git(["show", staged ? `:${relPath}` : `HEAD:${relPath}`]);
  return result.status === 0 ? result.stdout : null;
};

const ledgerDocsForGate = async (changedFiles, { staged }) => {
  const docs = [];
  const seen = new Set();
  const add = (relPath) => {
    if (seen.has(relPath)) return;
    seen.add(relPath);
    const text = gateEvidenceText(relPath, { staged });
    if (text !== null) docs.push({ relPath, text });
  };
  for (const f of await activeLedgers()) add(`harness/exec-plans/active/${f}`);
  for (const p of changedFiles) {
    const isPlan =
      (p.startsWith("harness/exec-plans/") && !p.startsWith("harness/exec-plans/templates/")) ||
      p.startsWith("development/exec-plans/");
    if (isPlan && p.endsWith(".md") && !p.endsWith("README.md")) add(p);
  }
  return docs;
};

// Terminal critic evidence parsing is the shared section-scoped rule in ledger-rules.mjs.

const changelogTopVersion = ({ staged }) => {
  const changelog = gateEvidenceText("CHANGELOG.md", { staged });
  return changelog?.match(/^## \[(\d+\.\d+\.\d+)\]/m)?.[1] ?? null;
};

// The commit gate. Local: on staged changes via hooks/pre-commit. CI: on the
// pushed diff via `precommit --range <base>...<head>` — the floor that holds
// when local hooks were never activated or were skipped (HARNESS_SKIP is
// loud and local-only; CI runs with no skip).
const precommit = async ({ range = null } = {}) => {
  const mode = range ? `range ${range}` : "staged";
  if (!range && process.env.HARNESS_SKIP === "1") {
    console.error("[harness] WARNING: pre-commit gate skipped via HARNESS_SKIP=1 — CI will still enforce.");
    await recordTelemetry({ at: new Date().toISOString(), command: "precommit", mode, tier: null, passed: null, skipped: true });
    return;
  }
  let changed;
  if (range) {
    const result = git(["diff", "--name-only", range]);
    if (result.status !== 0) fail(`could not diff range ${range}`);
    changed = result.stdout.split("\n").filter(Boolean);
  } else {
    changed = changedPaths({ stagedOnly: true });
  }
  const { tier, triggers } = computeTier(changed);
  console.log(`[harness] gate (${mode}) tier: ${tier}`);
  const reject = async (reasons) => {
    for (const reason of reasons) console.error(`[harness] REJECTED: ${reason}`);
    await recordTelemetry({ at: new Date().toISOString(), command: "precommit", mode, tier, passed: false, reasons });
    process.exit(1);
  };
  if (tier === "trivial") {
    await recordTelemetry({ at: new Date().toISOString(), command: "precommit", mode, tier, passed: true });
    return;
  }

  const substantive = (changed ?? []).filter((p) => !isProcessPath(p));
  const ledgerDocs = await ledgerDocsForGate(changed ?? [], { staged: !range });

  // One artifact, one truth: in staged mode every governing ledger must be
  // identical in index and worktree, or validate-all (which reads the
  // worktree) would be validating a different ledger than the gate read from
  // the index — a staged minimal record could ride a valid worktree copy.
  if (!range) {
    const divergent = [];
    for (const doc of ledgerDocs) {
      try {
        const worktree = await readFile(path.join(repoRoot, doc.relPath), "utf8");
        if (worktree !== doc.text) divergent.push(doc.relPath);
      } catch {
        divergent.push(`${doc.relPath} (missing from worktree)`);
      }
    }
    if (divergent.length > 0) {
      await reject([
        "governing ledgers must be identical in the index and the worktree (stage your ledger edits or revert them) — the gate reads the index while validation reads the worktree, and they must judge the same artifact.",
        `divergent: ${divergent.slice(0, 5).join(", ")}${divergent.length > 5 ? ", …" : ""}`,
      ]);
    }
  }

  // Upgrade-adoption shape (targets only): a version-adoption commit touches
  // only the framework-owned upgrade surface and carries a freshly written
  // adoption record matching the incoming CHANGELOG version. The change was
  // critic-reviewed in the source repo; a per-target critic pass is not
  // re-required for mechanical adoption.
  const adoptionRecordPath = "harness/override/governance/harness-upgrade-adoption.json";
  let upgradeAdoption = false;
  if (!isSourceRepo() && substantive.every(isUpgradeSurfacePath) && (changed ?? []).includes(adoptionRecordPath)) {
    try {
      const adoption = JSON.parse(gateEvidenceText(adoptionRecordPath, { staged: !range }) ?? "null");
      upgradeAdoption =
        adoption?.harnessVersion != null && adoption.harnessVersion === changelogTopVersion({ staged: !range });
    } catch {
      upgradeAdoption = false;
    }
  }

  // Ledger coverage: every substantive path must be declared by a governing
  // ledger. An unrelated active ledger no longer satisfies the requirement.
  const declared = ledgerDocs.flatMap((doc) => affectedPathsFromPlan(doc.text));
  const uncovered = substantive.filter((p) => !isCoveredBy(p, declared) && p !== adoptionRecordPath);
  if (uncovered.length > 0) {
    await reject([
      `${tier} tier requires a ledger declaring the changed paths (harness ledger new <slug>, fill "## Affected Paths").`,
      `uncovered: ${uncovered.slice(0, 10).join(", ")}${uncovered.length > 10 ? ", …" : ""}`,
    ]);
  }

  // High-risk commits are commit claims (harness/AGENTS.md → Readiness):
  // critic terminal evidence must exist — a scoped pushback-free review
  // report, a ledger with a terminal dual-role status, or the priced
  // upgrade-adoption shape above.
  if (tier === "high-risk" && !upgradeAdoption) {
    // Evidence is bound to the governing ledger AND to the committed tree:
    // every high-risk path must be covered by a ledger (read from the index or
    // HEAD, never the worktree) whose cross-agent-review JSON carries a
    // terminal record. Review report files are gitignored evidence artifacts —
    // they are never part of the committed tree, so they are status-display
    // inputs, not commit-gate evidence.
    const evidencedCoverage = ledgerDocs
      .filter((doc) => hasTerminalReviewRecord(doc.text))
      .flatMap((doc) => affectedPathsFromPlan(doc.text));
    const unevidenced = triggers.filter((p) => !isCoveredBy(p, evidencedCoverage));
    if (unevidenced.length > 0) {
      await reject([
        "high-risk paths require critic terminal evidence from the ledger that covers them: a terminal record inside that ledger's cross-agent-review JSON, present in the staged index (or HEAD in range mode). Plain-text terminal-status lines, worktree-only edits, gitignored report files, and evidence on unrelated ledgers do not count.",
        `high-risk paths lacking evidenced coverage: ${unevidenced.slice(0, 5).join(", ")}${unevidenced.length > 5 ? ", …" : ""}`,
      ]);
    }
  }
  if (upgradeAdoption) console.log("[harness] upgrade-adoption commit shape accepted (framework surface + adoption record; source-repo critic review applies)");

  // In range mode CI runs validate-all as its own job step — do not run it twice.
  if (!range) {
    const result = spawnSync("node", ["scripts/validate-all.mjs"], {
      cwd: harnessRoot,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      process.stdout.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
      await reject(["validation failing. Fix and re-commit, or see harness check output."]);
    }
  }
  await recordTelemetry({ at: new Date().toISOString(), command: "precommit", mode, tier, passed: true, upgradeAdoption });
  console.log(`[harness] gate (${mode}) passed`);
};

const activateHooks = () => {
  const result = git(["config", "core.hooksPath", "harness/hooks"]);
  if (result.status !== 0) fail("could not set core.hooksPath (not a git repo?)");
  console.log("[harness] hooks activated: core.hooksPath → harness/hooks");
};

// ---------------------------------------------------------------------------
// Review — thin wrapper around the transport (registry-driven defaults).
// ---------------------------------------------------------------------------

const review = (args) => {
  if (args[0] === "decision-gate") {
    reviewDecisionGate();
    return;
  }
  const script = args[0] === "calibrate" ? "calibrate-critic-transport.mjs" : "run-agent-review.mjs";
  const scriptArgs = args[0] === "calibrate" ? args.slice(1) : args;
  const runner = path.join(harnessRoot, "scripts", script);
  const result = spawnSync("node", [runner, ...scriptArgs], { cwd: repoRoot, encoding: "utf8", stdio: "inherit" });
  process.exit(result.status ?? 1);
};

// Cross-family decision gate (framework/process/review.md): aggregate the
// review-transport telemetry against the pre-committed demotion criterion.
const reviewDecisionGate = () => {
  const telemetryFile = path.join(harnessRoot, "artifacts", "telemetry", "review-transport.jsonl");
  if (!existsSync(telemetryFile)) {
    console.log("[harness] decision-gate: no review-transport telemetry yet");
    return;
  }
  const entries = readFileSync(telemetryFile, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
  // The criterion judges the promised window: high-risk cross-family reviews
  // only — optional runs must not drive the demote/keep decision.
  const crossFamily = entries.filter((entry) => entry.primary !== entry.critic && entry.highRisk === true);
  const window = crossFamily.slice(-10);
  const completed = window.filter((entry) => entry.status === "complete");
  const packetFile = completed.filter((entry) => entry.rungDepth === "packet-file");
  const novel = window.reduce((sum, entry) => sum + (entry.novelBlockingFindings ?? 0), 0);
  const unclassified = window.filter((entry) => entry.blockingFindings > 0 && entry.novelClassified === false).length;
  const completionRate = window.length ? Math.round((packetFile.length / window.length) * 100) : 0;
  console.log(`[harness] decision-gate: ${window.length}/10 high-risk cross-family reviews in window`);
  console.log(`[harness]   packet-file completion: ${packetFile.length}/${window.length} (${completionRate}%)`);
  console.log(`[harness]   novel blocking findings in window: ${novel}`);
  if (unclassified > 0) {
    console.log(`[harness]   WARNING: ${unclassified} review(s) have unclassified findings (legacy string shape) — excluded from the novel count; telemetry incomplete`);
  }
  if (window.length < 10) {
    console.log("[harness]   verdict: insufficient data — gate evaluates at 10 reviews");
  } else if (completionRate < 70) {
    // Completion-rate demotion is independent of finding classification — it
    // must never be masked by unclassified telemetry.
    console.log("[harness]   verdict: DEMOTE — packet-file completion below 70%; make same-family fresh-context the high-risk default");
  } else if (novel === 0 && unclassified > 0) {
    console.log("[harness]   verdict: inconclusive on the novel criterion — zero classified novel findings but unclassified reviews exist; fix finding classification before deciding");
  } else if (novel === 0) {
    console.log("[harness]   verdict: DEMOTE — zero novel findings across the window; make same-family fresh-context the high-risk default");
  } else {
    console.log("[harness]   verdict: keep cross-family for high-risk work");
  }
};

// ---------------------------------------------------------------------------
// Bootstrap / upgrade — implemented in scripts/harness-bootstrap.mjs (P6).
// ---------------------------------------------------------------------------

const delegate = (script, args) => {
  const target = path.join(harnessRoot, "scripts", script);
  if (!existsSync(target)) fail(`${script} not available in this harness version`);
  const result = spawnSync("node", [target, ...args], { cwd: repoRoot, encoding: "utf8", stdio: "inherit" });
  process.exit(result.status ?? 1);
};

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

const rel = (p) => path.relative(repoRoot, p);
const fail = (message) => {
  console.error(`[harness] ${message}`);
  process.exit(1);
};

const usage = `harness — mechanical layer of the governance harness

  harness check                     run all gates, record telemetry
  harness status [--json]           artifact-derived state: tier, ledger, step, check, critic
  harness tier                      compute tier of current working-tree changes
  harness ledger new <slug>         scaffold an active execution ledger
  harness ledger step <slug> <txt>  update the ledger's Current step pointer
  harness ledger annex <slug> <n>   append a conditional annex block (see templates/implementation-plan-annexes.md)
  harness ledger close <slug>       move a finished ledger to completed
  harness precommit                 commit gate on staged changes (invoked by harness/hooks/pre-commit)
  harness precommit --range A...B   same gate on a pushed diff (CI floor; validate-all runs separately)
  harness activate-hooks            point core.hooksPath at harness/hooks
  harness review <transport args>   run the cross-agent review transport
  harness bootstrap [...]           install the harness into a target project
  harness upgrade [...]             apply path-scoped framework updates to a target
  harness review calibrate [...]    measure critic latency and record recommended transport ceilings
  harness review decision-gate      evaluate the cross-family demotion criterion from telemetry`;

const [, , command, ...args] = process.argv;

switch (command) {
  case "check":
    await check();
    break;
  case "status":
    await status({ asLine: args.includes("--line"), asJson: args.includes("--json") });
    break;
  case "tier": {
    const { tier, triggers } = computeTier(changedPaths());
    console.log(`[harness] tier: ${tier}${triggers.length ? ` — triggers: ${triggers.join(", ")}` : ""}`);
    break;
  }
  case "ledger":
    if (args[0] === "new") await ledgerNew(args[1]);
    else if (args[0] === "step") await ledgerStep(args[1], args.slice(2).join(" "));
    else if (args[0] === "annex") await ledgerAnnex(args[1], args[2]);
    else if (args[0] === "close") await ledgerClose(args[1]);
    else fail("usage: harness ledger <new|step|annex|close> …");
    break;
  case "precommit": {
    const rangeIdx = args.indexOf("--range");
    await precommit({ range: rangeIdx !== -1 ? args[rangeIdx + 1] ?? null : null });
    break;
  }
  case "activate-hooks":
    activateHooks();
    break;
  case "review":
    review(args);
    break;
  case "bootstrap":
    delegate("harness-bootstrap.mjs", args);
    break;
  case "upgrade":
    delegate("harness-upgrade.mjs", args);
    break;
  default:
    console.log(usage);
    process.exit(command ? 1 : 0);
}
