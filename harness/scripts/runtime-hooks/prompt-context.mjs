// Claude Code UserPromptSubmit hook: re-inject the visibility obligation and
// the current mechanical tier at every turn. The contract instruction at the
// top of context decays over long sessions (the observed failure mode); a
// per-turn injection arrives adjacent to the work. Fail-open by design — a
// hook error must never block the user's prompt.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  let tierLine = "tier unavailable";
  const result = spawnSync("node", [path.join(repoRoot, "harness", "scripts", "harness.mjs"), "tier"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 10000,
  });
  if (result.status === 0 && result.stdout) tierLine = result.stdout.trim();
  console.log(
    `<harness-runtime-reminder>Open your response with the \`[harness]\` tier line and narrate governed transitions (harness/AGENTS.md → Visibility). Mechanical state: ${tierLine}</harness-runtime-reminder>`,
  );
} catch {
  console.log(
    "<harness-runtime-reminder>Open your response with the `[harness]` tier line (harness/AGENTS.md → Visibility).</harness-runtime-reminder>",
  );
}
process.exit(0);
