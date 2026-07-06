// Claude Code Stop hook: verify the turn's first visible text opened with the
// `[harness]` tier line. Non-compliant turns are blocked with a correction
// instruction (one round — stop_hook_active guards against loops), and every
// checked turn appends a compliance record to
// harness/artifacts/telemetry/visibility-compliance.jsonl so drift is
// measurable, not anecdotal. Fail-open by design: on any internal error the
// session continues — gates on tracked state remain the authoritative floor.

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

const isRealUserMessage = (entry) => {
  if (entry?.type !== "user") return false;
  const content = entry?.message?.content;
  if (typeof content === "string") return content.trim().length > 0;
  if (Array.isArray(content)) return content.some((item) => item?.type === "text");
  return false;
};

const assistantTexts = (entry) => {
  if (entry?.type !== "assistant") return [];
  const content = entry?.message?.content;
  if (!Array.isArray(content)) return [];
  return content.filter((item) => item?.type === "text" && typeof item.text === "string").map((item) => item.text);
};

try {
  const input = JSON.parse(await readStdin());
  if (input.stop_hook_active === true) process.exit(0); // correction round already issued
  const transcript = readFileSync(input.transcript_path, "utf8");
  const entries = transcript
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((entry) => entry && entry.isSidechain !== true);

  let turnStart = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (isRealUserMessage(entries[i])) {
      turnStart = i;
      break;
    }
  }
  const turnEntries = entries.slice(turnStart + 1);
  const texts = turnEntries.flatMap(assistantTexts);
  if (texts.length === 0) process.exit(0); // nothing user-visible to check

  // The contract requires the full tier-line shape, not just the prefix:
  // a bare "[harness] done" or a made-up tier must not pass.
  const compliant = /^\s*\[harness(?:\s+v[^\]]*)?\]\s+tier:\s*(trivial|standard|high-risk)\b/.test(texts[0]);

  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const telemetryDir = path.resolve(__dirname, "..", "..", "artifacts", "telemetry");
    mkdirSync(telemetryDir, { recursive: true });
    appendFileSync(
      path.join(telemetryDir, "visibility-compliance.jsonl"),
      `${JSON.stringify({ at: new Date().toISOString(), compliant, textBlocks: texts.length })}\n`,
    );
  } catch {
    /* telemetry is best-effort; never affects the decision */
  }

  if (!compliant) {
    console.log(
      JSON.stringify({
        decision: "block",
        reason:
          "[harness] visibility gate: this turn's first text did not open with the `[harness]` tier line required by harness/AGENTS.md → Visibility. Issue a corrected final message that opens with `[harness] tier: <trivial|standard|high-risk> — <one-line context>` followed by your answer.",
      }),
    );
  }
  process.exit(0);
} catch {
  process.exit(0); // fail open: a hook defect must never brick the session
}
