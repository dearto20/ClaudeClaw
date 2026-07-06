// Dependency-free ledger parsing rules shared by the commit gate (harness.mjs)
// and the governance validators. This module must stay import-light: the CLI
// and the statusline load it on every invocation, including in repos whose
// registry or framework state is broken — parsing rules must not die with them.

// Governed and process path taxonomies — ONE definition shared by the tier
// gate (harness.mjs) and the review-requiredness cross-check
// (validate-cross-agent-review.mjs), so the two can never drift apart.
export const GOVERNED_PREFIXES = Object.freeze([
  "harness/framework/",
  "harness/scripts/",
  "harness/tests/",
  "harness/hooks/",
  "harness/exec-plans/templates/",
  "harness/AGENTS.md",
  "AGENTS.md",
  "CLAUDE.md",
  "BOOTSTRAP.md",
  ".github/",
  "development/requirements/",
  "development/design-docs/",
  "harness/override/requirements/",
  "harness/override/design-docs/",
  // Runtime-adapter and distribution/version surfaces: these enforce or
  // version the governance itself — changing them is governed work.
  ".claude/",
  ".codex/",
  "CHANGELOG.md",
  "development/distribution-manifest.json",
]);

// Process/evidence paths never raise the tier: ledgers and generated artifacts
// are the paperwork of governance, not governed work themselves.
export const PROCESS_PREFIXES = Object.freeze([
  "harness/exec-plans/active/",
  "harness/exec-plans/completed/",
  "harness/exec-plans/tech-debt/",
  "harness/artifacts/",
  "development/exec-plans/",
]);

export const isProcessPath = (p) => PROCESS_PREFIXES.some((prefix) => p.startsWith(prefix));
// Directory entries (trailing slash) match by prefix; file entries match
// exactly — "CHANGELOG.md.bak" is not the changelog.
export const isGovernedPath = (p) =>
  GOVERNED_PREFIXES.some((prefix) => (prefix.endsWith("/") ? p.startsWith(prefix) : p === prefix));

// The authoritative review payload lives in exactly one cross-agent-review-json
// fence INSIDE the "## Cross-Agent Review" section. A fence anywhere else is
// never evidence — the validator rejects it and the commit gate ignores it,
// through this one shared parser.
export const crossAgentReviewSection = (ledgerText) => {
  const match = ledgerText.match(/^## Cross-Agent Review\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  return match ? match[1] : null;
};

export const crossAgentReviewPayload = (ledgerText) => {
  const section = crossAgentReviewSection(ledgerText);
  if (!section) return null;
  const fences = [...section.matchAll(/```cross-agent-review-json\n([\s\S]*?)\n```/g)];
  if (fences.length !== 1) return null;
  try {
    return JSON.parse(fences[0][1]);
  } catch {
    return null;
  }
};

// Terminal critic evidence for the commit gate: a terminal record inside the
// section-scoped authoritative payload only.
export const hasTerminalReviewRecord = (ledgerText) => {
  const payload = crossAgentReviewPayload(ledgerText);
  const records = Array.isArray(payload?.records) ? payload.records : [];
  return records.some((record) => record?.status === "complete" || record?.status === "fallback-accepted");
};

// Declared work surface of a plan: first token of each "## Affected Paths"
// bullet. One definition for "declared", used by the requiredness cross-check
// and the staged-path coverage gate alike.
export const affectedPathsFromPlan = (content) => {
  const section = content.match(/## Affected Paths\n([\s\S]*?)(?=\n## |$)/);
  if (!section) {
    return [];
  }
  return section[1]
    .split("\n")
    .map((line) => line.match(/^-\s+(\S+)/)?.[1] ?? "")
    .map((token) => token.replace(/^`+|`+$/g, "")) // backtick-wrapped paths are natural markdown
    .filter((token) => token && token !== "n/a");
};
