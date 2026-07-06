// Generates agent-family skill adapters and plain reference pages from the
// single-source skills in framework/skills-src/. One source, three outputs:
// .claude/skills/<name>/SKILL.md, .codex/skills/<name>/SKILL.md,
// framework/skills-ref/<name>.md. Never edit generated outputs — edit the
// source and rerun: node harness/scripts/generate-skills.mjs
// Drift between skills-src and the generated outputs is a validation failure
// (validate-skills-drift.mjs), which imports buildSkillOutputs from here.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const GENERATED_NOTE = "<!-- generated from harness/framework/skills-src — do not edit; rerun node harness/scripts/generate-skills.mjs -->";

const parseSource = (text, file) => {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  const meta = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  if (!meta.name || !meta.description) throw new Error(`${file}: frontmatter needs name and description`);
  return { meta, body: match[2].trim() };
};

// Pure builder: source files → expected generated outputs (repo-root-relative
// paths), so the generator and the drift gate share one definition of "in sync".
export const buildSkillOutputs = async (repoRoot) => {
  const srcDir = path.join(repoRoot, "harness", "framework", "skills-src");
  const files = (await readdir(srcDir)).filter((f) => f.endsWith(".md"));
  const outputs = [];
  for (const file of files) {
    const { meta, body } = parseSource(await readFile(path.join(srcDir, file), "utf8"), file);
    const skillMd = `---\nname: ${meta.name}\ndescription: ${meta.description}\n---\n${GENERATED_NOTE}\n\n${body}\n`;
    const refMd = `# ${meta.name}\n${GENERATED_NOTE}\n\n> ${meta.description}\n\n${body}\n`;
    outputs.push(
      { relPath: path.join(".claude", "skills", meta.name, "SKILL.md"), content: skillMd },
      { relPath: path.join(".codex", "skills", meta.name, "SKILL.md"), content: skillMd },
      { relPath: path.join("harness", "framework", "skills-ref", `${meta.name}.md`), content: refMd },
    );
  }
  return { sourceCount: files.length, outputs };
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, "..", "..");
  const { sourceCount, outputs } = await buildSkillOutputs(repoRoot);
  for (const out of outputs) {
    const target = path.join(repoRoot, out.relPath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, out.content);
  }
  console.log(`[generate-skills] ${sourceCount} skill(s) → ${outputs.length} generated file(s)`);
}
