import {
  finishValidation,
  pathExists,
  readHarnessFile,
  requireIncludes,
  harnessRoot,
} from "./validation-helpers.mjs";

const failures = [];
const agenticLoopPath = "framework/process/review.md";

if (!(await pathExists(harnessRoot, agenticLoopPath))) {
  failures.push(`missing ${agenticLoopPath}`);
} else {
  const loopDoc = await readHarnessFile(agenticLoopPath);
  requireIncludes(
    loopDoc,
    [
      "`DO`",
      "`CHECK`",
      "`REVISE`",
      "`RECHECK`",
      "`SYNTHESIZE`",
      "`passed`",
      "`blocked`",
      "`not-applicable`",
      "`pending`",
      "`in-progress`",
      "`failed`",
      "Completed plans cannot contain required expert roles with `pending`, `in-progress`, or `failed` outcomes",
      "## User Intent Discovery And Alignment Gate",
      "Decompose every request from the raw request",
      "explicit intent, implicit or hidden intent, desired outcome, acceptance criteria, constraints, risks, and implementation strategy",
      "Use every reasonably available capability — tools, source documents, code inspection, runtime signals, validation results, reviewer critique, current external references",
      "do not stop at a literal keyword interpretation",
      "root-cause investigation, hidden constraints, adjacent blockers, related failure modes",
      "not-applicable rationale instead of fabricating a defect frame",
      "best available path for the end-to-end outcome",
      "not a local symptom or the nearest literal fix",
      "User-visible capabilities are complete only when the user-observable outcome succeeds",
      "Internal milestones such as `queued`, `stored`, or `API returned OK` are evidence, not completion",
      "Cross-boundary work records an intent-to-outcome trace across each handoff",
      "user request, model or tool decision, backend state, endpoint response, client decode, client execution, user-visible result",
      "Defect fixes include a regression check from the failing user prompt or journey when feasible",
      "compare practical alternatives and record why the selected approach is best under current constraints",
      "show its work: investigation, decomposition, applicability decisions, alternatives, and selection rationale",
      "exceeding the requested minimum is valid only when it directly serves the discovered intent",
      "not automatic scope expansion",
      "exact-scope with beyond-minimum recorded as not applicable",
      "existing code, tests, architecture, prompts, and conventions are evidence to inspect",
      "silently optimizing for existing-pattern consistency, symptom-only repair, narrow literal interpretation, or partial coverage is a harness failure",
      "Unresolved critic pushback blocks readiness",
      "nonBlockingRisks",
    ],
    agenticLoopPath,
    failures,
  );
}

const subAgentDoc = await readHarnessFile("framework/process/review.md");
requireIncludes(
  subAgentDoc,
  [
    "Discovers detailed user intent",
    "implicit or hidden intent",
    "missed hidden intent",
    "root cause, hidden constraints, adjacent blockers, related failure modes",
    "user-observable outcome contract",
    "intent-to-outcome trace coverage",
    "user-observable completion",
    "internal milestone masquerading as completion",
    "downstream consumer evidence",
    "internal milestones treated as completion",
    "symptom-only fixes",
    "root-cause completeness",
    "applicable root cause or not-applicable rationale",
    "alternatives quality",
    "beyond-minimum opportunities or not-applicable rationale",
    "existing implementation is not treated as the default baseline",
    "discovered-intent versus existing-architecture conflict",
    "shallow intent interpretation",
    "tests that preserve obsolete behavior against user intent",
    "user-intent versus existing-pattern conflicts",
    "top-level critic pushback remains unresolved",
    "nonBlockingRisks",
  ],
  "framework/process/review.md",
  failures,
);
const roles = [
  "planner",
  "architect",
  "implementer",
  "test-engineer",
  "security-reviewer",
  "code-reviewer",
  "documentation-steward",
  "verifier",
  "critic",
];

for (const role of roles) {
  if (!subAgentDoc.includes(`| \`${role}\` |`)) {
    failures.push(`role pass criteria missing for ${role}`);
  }
}

// Ledger diet (2.7.0): core intent fields live in the core template; deep
// decomposition fields and the expert-role loop live in the annex template.
const template = await readHarnessFile("exec-plans/templates/implementation-plan.md");
requireIncludes(
  template,
  [
    "## User Intent Discovery And Alignment",
    "Raw user intent",
    "Discovered intent (explicit, implicit, hidden constraints)",
    "Sources consulted (docs, code paths, runtime evidence, external references)",
    "Alternatives considered and selected strategy",
    "Acceptance criteria (checkable done-when bounds)",
    "Beyond-minimum opportunities and scope guardrails, or n/a",
    "Decision: `aligned` | `blocked`",
  ],
  "execution plan template core intent fields",
  failures,
);

const annexTemplate = await readHarnessFile("exec-plans/templates/implementation-plan-annexes.md");
requireIncludes(
  annexTemplate,
  [
    "Loop Status",
    "Check Result",
    "Iterations",
    "Blocker",
    "Allowed loop statuses",
    "Completion rule",
    "## Role Synthesis",
    "Final decision",
    "## Deep Alignment",
    "Intent-to-outcome trace for cross-boundary work",
    "Failing prompt or journey regression check",
    "Root cause or full-investigation findings, or not-applicable rationale",
    "Adjacent blockers or related failure modes, or not-applicable rationale",
    "Evidence that the request was fully decomposed before implementation",
    "Existing implementation patterns reviewed (conflicts / preserved / revised)",
  ],
  "execution plan annex loop fields",
  failures,
);

finishValidation("validate-agentic-loop", failures, { roles: roles.length });
