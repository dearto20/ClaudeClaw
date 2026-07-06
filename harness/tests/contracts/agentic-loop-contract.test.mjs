import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getRepoPath } from "../helpers/repo-path.mjs";

const TEMPLATE_PATH = getRepoPath("exec-plans", "templates", "implementation-plan.md");
const ANNEX_TEMPLATE_PATH = getRepoPath("exec-plans", "templates", "implementation-plan-annexes.md");
const LOOP_DOC_PATH = getRepoPath("framework", "process", "review.md");
const SUB_AGENT_DOC_PATH = getRepoPath("framework", "process", "review.md");

const standardRoles = [
  "planner",
  "architect",
  "implementer",
  "test-engineer",
  "security-reviewer",
  "code-reviewer",
  "documentation-steward",
  "verifier",
];

test("core template carries the slim intent contract; annexes carry the expert bench (ledger diet 2.7.0)", async () => {
  const template = await readFile(TEMPLATE_PATH, "utf8");
  const annexes = await readFile(ANNEX_TEMPLATE_PATH, "utf8");

  for (const field of [
    "## User Intent Discovery And Alignment",
    "Raw user intent",
    "Discovered intent (explicit, implicit, hidden constraints)",
    "Sources consulted (docs, code paths, runtime evidence, external references)",
    "Alternatives considered and selected strategy",
    "Acceptance criteria (checkable done-when bounds)",
    "Beyond-minimum opportunities and scope guardrails, or n/a",
    "Decision: `aligned` | `blocked`",
    "Conditional annexes",
  ]) {
    assert.ok(template.includes(field), `core template must include ${field}`);
  }

  for (const field of [
    "## Deep Alignment",
    "Intent-to-outcome trace for cross-boundary work",
    "Failing prompt or journey regression check",
    "Root cause or full-investigation findings, or not-applicable rationale",
    "Evidence that the request was fully decomposed before implementation",
    "## Expert Bench",
    "Bench Status",
    "Persistence Mode",
    "runtime-persistent",
    "repo-persistent-only",
    "Roles Reconstructable From",
    "Continuity Log",
    "Loop Status",
    "Check Result",
    "Iterations",
    "Blocker",
    "## Role Synthesis",
  ]) {
    assert.ok(annexes.includes(field), `annex template must include ${field}`);
  }

  for (const status of ["pending", "in-progress", "passed", "failed", "blocked", "not-applicable"]) {
    assert.ok(annexes.includes(`\`${status}\``), `annex template must document status ${status}`);
  }

  for (const role of standardRoles) {
    assert.match(annexes, new RegExp(`\\| ${role} \\|`), `annex template must include ${role} role`);
  }
});

test("core template stays within the ledger-diet line budget", async () => {
  const template = await readFile(TEMPLATE_PATH, "utf8");
  const lines = template.trimEnd().split("\n").length;
  assert.ok(lines <= 80, `core template must stay at or under 80 lines, found ${lines}`);
});

test("agentic loop docs define terminal and non-terminal role outcomes", async () => {
  const loopDoc = await readFile(LOOP_DOC_PATH, "utf8");

  for (const phase of ["`DO`", "`CHECK`", "`REVISE`", "`RECHECK`", "`SYNTHESIZE`"]) {
    assert.ok(loopDoc.includes(phase), `agentic loop must include ${phase}`);
  }

  for (const terminal of ["`passed`", "`blocked`", "`not-applicable`"]) {
    assert.ok(loopDoc.includes(terminal), `agentic loop must define terminal outcome ${terminal}`);
  }

  for (const nonTerminal of ["`pending`", "`in-progress`", "`failed`"]) {
    assert.ok(loopDoc.includes(nonTerminal), `agentic loop must define non-terminal outcome ${nonTerminal}`);
  }

  for (const field of [
    "## User Intent Discovery And Alignment Gate",
    "explicit intent, implicit or hidden intent",
    "root-cause investigation",
    "every reasonably available capability",
    "show its work",
    "not-applicable rationale instead of fabricating a defect frame",
    "best available path",
    "user-observable outcome succeeds",
    "intent-to-outcome trace",
    "model or tool decision, backend state, endpoint response, client decode, client execution",
    "failing user prompt or journey",
    "not automatic scope expansion",
    "symptom-only repair",
    "Unresolved critic pushback blocks readiness",
    "nonBlockingRisks",
  ]) {
    assert.ok(loopDoc.includes(field), `agentic loop must include intent-first gate text: ${field}`);
  }
});

test("sub-agent coordination defines pass criteria and persistence boundary for each role and critic", async () => {
  const subAgentDoc = await readFile(SUB_AGENT_DOC_PATH, "utf8");

  for (const role of [...standardRoles, "critic"]) {
    assert.ok(subAgentDoc.includes(`| \`${role}\` |`), `${role} must have pass criteria`);
  }

  assert.ok(
    subAgentDoc.includes("Completed plans cannot contain required expert roles with `pending`, `in-progress`, or `failed` outcomes."),
    "sub-agent docs must block completion with unfinished roles",
  );
  assert.ok(
    subAgentDoc.includes("Expert role ="),
    "sub-agent docs must define expert role terminology",
  );
  assert.ok(
    subAgentDoc.includes("Repo-persistent role state is mandatory"),
    "sub-agent docs must require repo-persistent role state",
  );
  assert.ok(
    subAgentDoc.includes("The framework never validates runtime persistence"),
    "sub-agent docs must not require runtime persistence",
  );
  assert.ok(
    subAgentDoc.includes("Discovers detailed user intent"),
    "planner role must discover detailed user intent",
  );
  assert.ok(
    subAgentDoc.includes("user-intent versus existing-pattern conflicts"),
    "critic role must challenge user-intent versus existing-pattern conflicts",
  );
  assert.ok(
    subAgentDoc.includes("internal milestones treated as completion"),
    "critic role must challenge internal milestones treated as completion",
  );
  assert.ok(
    subAgentDoc.includes("downstream consumer evidence"),
    "verifier role must require downstream consumer evidence",
  );
  assert.ok(
    subAgentDoc.includes("Sub-agent coordination is internal decomposition"),
    "sub-agent docs must define internal decomposition boundary",
  );
  assert.ok(
    subAgentDoc.includes("does not replace top-level dual-role governance"),
    "sub-agent docs must not let sub-agents replace top-level dual-role governance",
  );
  assert.ok(
    subAgentDoc.includes("one consolidated output owned by the primary performer"),
    "sub-agent docs must require consolidated output ownership",
  );
  assert.ok(
    subAgentDoc.includes("top-level critic pushback remains unresolved"),
    "sub-agent docs must block ready synthesis while critic pushback remains",
  );
  assert.ok(
    subAgentDoc.includes("nonBlockingRisks"),
    "sub-agent docs must treat nonBlockingRisks as unresolved pushback",
  );
});
