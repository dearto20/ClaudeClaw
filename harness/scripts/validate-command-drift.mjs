import { finishValidation, listMarkdownFiles, pathExists, readWorkspaceFile, workspaceRoot } from "./validation-helpers.mjs";

const failures = [];
const markdownFiles = await listMarkdownFiles(workspaceRoot, ".");
const directFallbackFiles = [];
const canonical = "node harness/scripts/validate-all.mjs";
const drift = "node scripts/validate-all.mjs";

for (const file of ["harness/AGENTS.md"]) {
  if (!markdownFiles.includes(file) && await pathExists(workspaceRoot, file)) {
    directFallbackFiles.push(file);
  }
}

const commandEvidenceFiles = [...markdownFiles, ...directFallbackFiles];

for (const file of commandEvidenceFiles) {
  const content = await readWorkspaceFile(file);
  if (content.includes(drift)) {
    failures.push(`${file} uses non-canonical validation command: ${drift}`);
  }
}

let canonicalCount = 0;
for (const file of commandEvidenceFiles) {
  const content = await readWorkspaceFile(file);
  if (content.includes(canonical)) {
    canonicalCount += 1;
  }
}

if (canonicalCount === 0) {
  failures.push(`no markdown file references canonical command: ${canonical}`);
}

finishValidation("validate-command-drift", failures, {
  markdownFiles: markdownFiles.length,
  directFallbackFiles: directFallbackFiles.length,
  canonicalCount,
});
