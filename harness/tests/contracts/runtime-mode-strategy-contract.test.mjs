import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";

const readText = (...parts) => readFile(getRepoPath(...parts), "utf8");

test("runtime mode strategy process doc defines planning-only and mutation-capable behavior", async () => {
  const doc = await readText("framework", "process", "runtime-mode-strategy.md");

  for (const text of [
    "planning-only runtimes",
    "mutation-capable runtimes",
    "Planning-only runtime",
    "Mutation-capable runtime",
    "Agents must not edit tracked files",
    "Agents must not edit tracked files, create execution-plan artifacts",
    "Default mode must create or update execution ledgers before edits for non-trivial work.",
    "Pure Plan Mode sessions do not need active or completed execution-plan files",
    "If a required harness step needs repository mutation, record it as planned work, not completed work.",
    "If a mutation-capable runtime resumes from a planning-only proposal, convert the accepted proposal into `exec-plans/active/` before implementation edits.",
  ]) {
    assert.ok(doc.includes(text), `runtime mode strategy doc must include ${text}`);
  }
});

test("execution plan template includes Runtime Mode fields", async () => {
  const template = await readText("exec-plans", "templates", "implementation-plan.md");

  for (const text of [
    "## Runtime Mode",
    "Current mode: `plan` | `default`",
    "Mutation allowed: `yes` | `no`",
    "Plan Mode source",
    "Mode transition evidence",
  ]) {
    assert.ok(template.includes(text), `execution plan template must include ${text}`);
  }
});

test("execution plan process differentiates proposed plans from execution ledgers", async () => {
  const doc = await readText("framework", "process", "gates.md");

  for (const text of [
    "Planning obligations apply in both planning-only and mutation-capable runtimes.",
    "agents produce a proposed plan without editing tracked files or creating execution-plan artifacts",
    "agents convert accepted proposals into `exec-plans/active/`",
    "Non-trivial work must have an active plan before edits when the active runtime allows repository mutation.",
    "A plan may close as `completed` only when it records: Runtime Mode, mutation authority, validation evidence, completion evidence",
  ]) {
    assert.ok(doc.includes(text), `execution plan process must include ${text}`);
  }
});

test("validators enforce runtime mode template and completed-plan evidence fields", async () => {
  const validator = await readText("scripts", "validate-exec-plans.mjs");

  for (const text of [
    "## Runtime Mode",
    "Current mode",
    "Mutation allowed",
    "Plan Mode source",
    "Mode transition evidence",
    "completed plan must record Mutation allowed: yes",
    "completed plan missing completion evidence",
    "exec-plans/completed",
  ]) {
    assert.ok(validator.includes(text), `execution-plan validator must include ${text}`);
  }
});
