import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  discoverRepoFiles,
  listMarkdownFiles,
  toRepoSlashPath,
} from "../../scripts/validation-helpers.mjs";

const hasGit = () => spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;

const withTempDir = async (callback) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "dh-validation-discovery-"));
  try {
    await callback(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

const initializeGitRepo = (dir) => {
  const result = spawnSync("git", ["init", "--quiet"], {
    cwd: dir,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
};

test("toRepoSlashPath normalizes Windows-style separators on every host OS", () => {
  assert.equal(toRepoSlashPath("harness\\framework\\x.md"), "harness/framework/x.md");
});

test("Git-backed discovery returns repo-relative slash paths", async (t) => {
  if (!hasGit()) {
    t.skip("git is unavailable");
    return;
  }

  await withTempDir(async (tempDir) => {
    initializeGitRepo(tempDir);
    await mkdir(path.join(tempDir, "harness", "framework"), { recursive: true });
    await writeFile(path.join(tempDir, "harness", "framework", "x.md"), "# X\n");

    const files = await discoverRepoFiles(tempDir);

    assert.ok(files.includes("harness/framework/x.md"));
    assert.ok(files.every((file) => !file.includes("\\")), "discovery paths must use slash separators");
  });
});

test("Markdown discovery excludes Git-ignored virtualenv content", async (t) => {
  if (!hasGit()) {
    t.skip("git is unavailable");
    return;
  }

  await withTempDir(async (tempDir) => {
    initializeGitRepo(tempDir);
    await mkdir(path.join(tempDir, ".venv"), { recursive: true });
    await writeFile(path.join(tempDir, ".gitignore"), ".venv/\n");
    await writeFile(path.join(tempDir, ".venv", "ignored.md"), "# Ignored\n");
    await writeFile(path.join(tempDir, "README.md"), "# Included\n");

    const files = await listMarkdownFiles(tempDir, ".");

    assert.deepEqual(files, ["README.md"]);
  });
});

test("Git discovery failure falls back to filesystem discovery", async () => {
  await withTempDir(async (tempDir) => {
    await mkdir(path.join(tempDir, "docs"), { recursive: true });
    await mkdir(path.join(tempDir, ".venv"), { recursive: true });
    await writeFile(path.join(tempDir, "docs", "fallback.md"), "# Fallback\n");
    await writeFile(path.join(tempDir, ".venv", "ignored.md"), "# Ignored\n");

    const files = await listMarkdownFiles(tempDir, ".", {
      gitCommand: "__development_harness_missing_git__",
    });

    assert.deepEqual(files, ["docs/fallback.md"]);
  });
});
