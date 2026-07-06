import { finishValidation, readHarnessFile, requireIncludes } from "./validation-helpers.mjs";

const failures = [];
const doc = await readHarnessFile("framework/process/review.md");
// Ledger diet (2.7.0): Critique And Debate lives in the annex template.
const template = await readHarnessFile("exec-plans/templates/implementation-plan-annexes.md");

requireIncludes(
  doc,
  [
    "Required Triggers",
    "Framework process or validator changes",
    "Review Loop",
    "Readiness — pushback-free standard",
    "top-level dual-role obligation",
    "independent critic",
    "same-family fallback",
    "sub-agent findings cannot by themselves satisfy the top-level primary-performer/independent-critic separation",
    "A skipped critic pass blocks non-trivial work",
    "pushback-free readiness standard",
    "nonBlockingRisks",
    "must not be declared ready while critic pushback remains open",
    "accepted",
    "rejected",
    "blocked",
    "Final synthesis",
    "Finding Quality Rules",
    "discrete, actionable",
    "changed artifact or newly introduced behavior",
    "concrete affected path, scenario, or contract",
    "Specialized Review Lenses",
    "Breaking-change lens",
    "Model-visible context lens",
    "Testing lens",
    "Change-size lens",
    "Explicit Review Target",
    "uncommitted changes",
    "base branch diff",
    "commit",
    "custom instructions",
    "inline",
    "detached",
    "Change Size Check",
    "800 changed lines",
    "500 changed lines",
  ],
  "critique-and-debate doc",
  failures,
);

requireIncludes(
  template,
  ["Proposer summary", "Critic findings", "Resolutions", "Final synthesis"],
  "execution plan critique section",
  failures,
);

finishValidation("validate-critique-synthesis", failures);
