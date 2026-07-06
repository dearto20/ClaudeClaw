// Gate: no secrets in governance artifacts. Ledgers and override/development
// state capture command output and evidence — the paths where credentials most
// plausibly leak into tracked files. Patterns are strict to avoid false
// positives on prose that merely discusses secrets.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finishValidation, harnessRoot, workspaceRoot } from "./validation-helpers.mjs";

export const secretPatterns = [
  { id: "private-key-block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { id: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { id: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: "openai-style-key", pattern: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { id: "anthropic-key", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { id: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ },
  { id: "assigned-password", pattern: /\b(?:password|passwd|api_key|apikey|secret_key|auth_token)\s*[:=]\s*['"][^'"\s]{8,}['"]/i },
];

export const scanText = (text) =>
  secretPatterns.filter(({ pattern }) => pattern.test(text)).map(({ id }) => id);

const scanRoots = [
  path.join(harnessRoot, "exec-plans"),
  path.join(harnessRoot, "override"),
  path.join(workspaceRoot, "development"),
];

const failures = [];

const walk = async (dir) => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      await walk(abs);
    } else if (/\.(md|json|txt|yml|yaml)$/.test(entry.name)) {
      const hits = scanText(await readFile(abs, "utf8"));
      for (const id of hits) {
        failures.push(`${path.relative(workspaceRoot, abs)}: matches secret pattern ${id}`);
      }
    }
  }
};

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  for (const root of scanRoots) {
    await walk(root);
  }
  finishValidation("validate-secrets", failures, { scannedRoots: scanRoots.length });
}
