// Claude Code SessionStart hook: re-arm the harness obligations when a session
// starts, resumes, or compacts. Compaction is the documented trigger for
// visibility drift — the contract text falls out of the working set and the
// tier line silently disappears. Fail-open by design.

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, "..", "..", "..");
  let statusLine = "status unavailable";
  const result = spawnSync("node", [path.join(repoRoot, "harness", "scripts", "harness.mjs"), "status", "--line"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 10000,
  });
  if (result.status === 0 && result.stdout) statusLine = result.stdout.trim();
  console.log(
    [
      "<harness-runtime-reminder>Harness obligations remain in force for this session (harness/AGENTS.md):",
      "- Open every response with the `[harness]` tier line; narrate governed transitions.",
      "- Non-trivial tracked edits require an execution ledger first; run `node harness/scripts/validate-all.mjs` before any completion claim.",
      `- Mechanical state: ${statusLine}</harness-runtime-reminder>`,
    ].join("\n"),
  );
} catch {
  console.log(
    "<harness-runtime-reminder>Harness obligations remain in force: open every response with the `[harness]` tier line (harness/AGENTS.md).</harness-runtime-reminder>",
  );
}
process.exit(0);
