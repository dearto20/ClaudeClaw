// Single definition of the framework-owned upgrade surface, shared by
// harness-upgrade.mjs (what gets copied) and the commit gate (which paths an
// upgrade-adoption commit may touch). One home, so the copy list and the gate
// shape can never drift apart.

// Roots the upgrade tool copies wholesale from the source checkout. The two
// root files are harness-owned surface in targets too: the adoption commit
// shape matches the adoption record against the incoming CHANGELOG version,
// and the CI floor lives in the workflow — an upgrade that leaves either
// behind strands the target on a stale gate.
export const frameworkOwnedRoots = Object.freeze([
  "harness/AGENTS.md",
  "harness/framework",
  "harness/scripts",
  "harness/tests",
  "harness/hooks",
  "harness/exec-plans/templates",
  "CHANGELOG.md",
  ".github/workflows/validate.yml",
]);

const isFileRoot = (p) => /\.[a-z]+$/i.test(p);

// Exactly what the upgrade tooling writes, nothing more: the copied
// framework surface, the regenerated skill adapters, the merged runtime
// settings, and the adoption record. Target-adapted root docs (AGENTS.md,
// CLAUDE.md, BOOTSTRAP.md, README.md, .gitignore) and hand-written governance
// records (legacy-plan-acceptance.json) are deliberately NOT here — changes
// to them cannot piggyback on a critic-waived adoption commit and need normal
// high-risk evidence.
export const upgradeSurfacePrefixes = Object.freeze([
  ...frameworkOwnedRoots.map((p) => (isFileRoot(p) ? p : `${p}/`)),
  ".claude/skills/",
  ".codex/skills/",
  ".claude/settings.json",
  "harness/override/governance/harness-upgrade-adoption.json",
]);

export const isUpgradeSurfacePath = (p) =>
  upgradeSurfacePrefixes.some((prefix) => (prefix.endsWith("/") ? p.startsWith(prefix) : p === prefix));
