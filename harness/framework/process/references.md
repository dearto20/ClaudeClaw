# External References

The single normative home for external reference policy. Absorbs v1 `external-reference-hardening.md` (now a redirect stub) and adds the adoption-ledger rules. Adoption ledgers carry the data: `framework/process/upstream-codex-portable-patterns.md` (github.com/openai/codex audit) and `framework/process/harness-engineering-alignment.md` (openai.com harness-engineering article adoption ledger).

## Purpose
- External repositories, local sibling checkouts, generated bundles, documents, prompts, screenshots, and private artifacts are observe-only until classified.
- DevelopmentHarness may adopt independently justifiable patterns, but external material must not become framework content through raw copying, vague "template" adoption, or unverifiable source claims.
- Local docs, ADRs, requirements, validators, tests, and reports remain the system of record. External sources are evidence, not dependencies.

## Source Classification
- `official`: vendor-owned or standards-body material intentionally published by the source owner.
- `public-open-source`: publicly accessible source with an inspectable license.
- `private-authorized`: private source the user or organization confirms may be inspected for this work.
- `generated`: generated output, logs, reports, screenshots, or model-produced material whose upstream inputs may be mixed.
- `unclear`: source with missing license, unclear ownership, questionable provenance, or incomplete authorization.
- `prohibited`: source that appears leaked, contains secrets, violates access rules, or cannot be used under the current request.

## Adoption Rules
- Classify the source before using it for implementation decisions.
- Record authorization status and license/provenance notes for every source that influences a framework artifact.
- Default `unclear` and `prohibited` sources to observe-only. Do not derive framework content from them unless the resulting pattern has an independent clean-derivation justification.
- Adopt behavior-level or process-level patterns only when they can be explained from first principles, existing DevelopmentHarness goals, official/public references, or local requirements without relying on restricted source material.
- Record every adopted, deferred, and rejected candidate with a rationale.
- Record an invalidation path so future maintainers know how to re-justify, rewrite, or remove affected artifacts if a source is retracted or reclassified.
- Validation must be local and offline. Validators must not require the external source to exist.

## Hard Stops
- Do not copy raw code, raw prompts, prompt phrasing, assets, diagrams, private configuration, credentials, secret-bearing logs, or product-specific implementation details from external references into the harness.
- Do not use external source availability as completion evidence unless a sanitized local audit artifact records what was inspected and why it is safe to retain.
- Do not treat a commit hash, path, screenshot, or generated summary as proof of authorization.

## Clean Derivation
- A clean-derivation statement answers: "Why could this pattern be adopted if the external source disappeared?"
- Valid justifications include existing harness requirements, obvious engineering practice, public standards, official docs, prior local ADRs, or independently authored design reasoning.
- Invalid justifications include "because the external repo does it," "the source looked useful," or paraphrases of restricted prompt/code structure.

## Invalidation Path
- If a source is retracted, reclassified as prohibited, or found unauthorized, every adoption record tied to it must be reviewed.
- Each affected artifact must be either independently re-justified, rewritten without that influence, or removed.
- The review outcome must update the relevant ADR, requirement, validation contract, and execution ledger.

## Reference-Only And Archive Targets
- Some target repositories are reference-only archives rather than runnable applications or packages.
- Archive targets must not gain install, package, publish, deploy, or container surfaces unless the user explicitly asks for that runnable surface and the intake records it.
- Archive targets should keep repository identity neutral, avoid dependency output and generated runtime state, and distinguish reference material from runnable target behavior.
- Archive targets still need agent-legible maps: subsystem inventory, capability catalog, integration-surface inventory when applicable, diagnostics or status substitutes, and validation evidence for repository hygiene.
- If a source archive is only planning inspiration for the harness, durable framework artifacts must describe the generic contract, not the source identity.

## Template Set
- `framework/templates/external-reference-audit.md` records source classification and adoption decisions.
- `framework/templates/target-exploration-guide.md` helps target projects become agent-legible without copying another project's guide.
- `framework/templates/tool-command-capability-catalog.md` records tool and command side effects, permission posture, concurrency safety, and validation evidence.
- `framework/templates/integration-surface-inventory.md` records MCP, bridge, browser, plugin, skill, remote-control, transport, auth, and explorer surfaces.
- `framework/templates/context-collection-inspection.md` checks what runtime and project context is assembled while explicitly excluding prompt phrasing.
- `framework/templates/plan-continuity-evidence.md` records plan persistence, resume, fork, compaction, and completion evidence.

## Machine-Readable Contract
```external-reference-hardening-json
{
  "schemaVersion": "1.1.0",
  "principle": "External references are observe-only until classified, authorized, independently justified, and validated locally.",
  "sourceClassifications": [
    {
      "id": "official",
      "defaultUse": "reference-and-adopt-with-validation",
      "requiresAuthorizationNote": false
    },
    {
      "id": "public-open-source",
      "defaultUse": "reference-and-adopt-with-license-review",
      "requiresAuthorizationNote": true
    },
    {
      "id": "private-authorized",
      "defaultUse": "reference-with-explicit-user-or-organization-authorization",
      "requiresAuthorizationNote": true
    },
    {
      "id": "generated",
      "defaultUse": "reference-only-until-inputs-and-rights-are-understood",
      "requiresAuthorizationNote": true
    },
    {
      "id": "unclear",
      "defaultUse": "observe-only",
      "requiresAuthorizationNote": true
    },
    {
      "id": "prohibited",
      "defaultUse": "observe-only-or-reject",
      "requiresAuthorizationNote": true
    }
  ],
  "adoptionGates": [
    {
      "id": "PROVENANCE_CLASSIFICATION",
      "requiredEvidence": "source path or URL, source class, inspection date, and provenance summary"
    },
    {
      "id": "AUTHORIZATION_STATUS",
      "requiredEvidence": "license, user authorization, organizational authorization, or explicit blocked state"
    },
    {
      "id": "CLEAN_DERIVATION",
      "requiredEvidence": "independent justification for every adopted pattern"
    },
    {
      "id": "REJECTION_RATIONALE",
      "requiredEvidence": "reason for every deferred or rejected candidate"
    },
    {
      "id": "RAW_COPY_PROHIBITION",
      "requiredEvidence": "explicit ban on raw code, raw prompts, prompt phrasing, assets, diagrams, credentials, and product-specific implementation"
    },
    {
      "id": "OFFLINE_VALIDATION",
      "requiredEvidence": "local artifact and executable validation path; no dependency on the external source at validation time"
    },
    {
      "id": "SOURCE_INVALIDATION",
      "requiredEvidence": "retraction or reclassification handling with re-justify, rewrite, or remove outcomes"
    }
  ],
  "prohibitedImports": [
    {
      "id": "RAW_CODE",
      "reason": "copyright, license, and product-coupling risk"
    },
    {
      "id": "RAW_PROMPTS",
      "reason": "highest-risk prompt surface and likely product-specific behavior"
    },
    {
      "id": "PROMPT_PHRASING",
      "reason": "paraphrased prompt wording can still preserve restricted expression"
    },
    {
      "id": "ASSETS_OR_DIAGRAMS",
      "reason": "visual assets and diagrams may carry protected expression"
    },
    {
      "id": "PRIVATE_CONFIG_OR_CREDENTIALS",
      "reason": "secrets and private configuration must not enter the harness"
    },
    {
      "id": "PRODUCT_SPECIFIC_IMPLEMENTATION",
      "reason": "implementation details are not portable framework contracts"
    }
  ],
  "templates": [
    {
      "id": "EXTERNAL_REFERENCE_AUDIT",
      "path": "framework/templates/external-reference-audit.md",
      "purpose": "Record source classification, authorization, clean derivation, decisions, and invalidation handling."
    },
    {
      "id": "TARGET_EXPLORATION_GUIDE",
      "path": "framework/templates/target-exploration-guide.md",
      "purpose": "Make target repositories easier for agents to navigate and trace."
    },
    {
      "id": "TOOL_COMMAND_CAPABILITY_CATALOG",
      "path": "framework/templates/tool-command-capability-catalog.md",
      "purpose": "Declare command and tool capability, permission, side-effect, concurrency, and validation metadata."
    },
    {
      "id": "INTEGRATION_SURFACE_INVENTORY",
      "path": "framework/templates/integration-surface-inventory.md",
      "purpose": "Declare cross-boundary integration surfaces, auth and session boundaries, disabled behavior, runtime evidence, and validation paths."
    },
    {
      "id": "CONTEXT_COLLECTION_INSPECTION",
      "path": "framework/templates/context-collection-inspection.md",
      "purpose": "Inspect gathered runtime and project context without copying prompt phrasing."
    },
    {
      "id": "PLAN_CONTINUITY_EVIDENCE",
      "path": "framework/templates/plan-continuity-evidence.md",
      "purpose": "Record plan persistence, resume, fork, compaction, and completion evidence."
    }
  ],
  "validation": {
    "validator": "scripts/validate-external-reference-hardening.mjs",
    "contractTest": "tests/contracts/external-reference-hardening-contract.test.mjs"
  }
}
```

## Adoption Ledgers

An adoption ledger records, per source: pinned coordinates (repo URL + verified commit, or article URL + published/lastVerified dates), the inspected source paths, `adoptedPatterns` (each with a locally-authored contract, local artifact paths, local validation paths), and `deferredPatterns` (each with the reason adoption is inappropriate or not yet needed).

- Adoption is incident-driven: a new upstream pattern earns adoption when a real project hits the problem it solves — never for coverage of the source.
- Once adopted, a pattern is owned locally; later changes to the source do not obligate updates. Re-audits are deliberate, recorded events that update the pin.
- There is no per-section or per-heading coverage requirement against any external source. A coverage claim that cannot be mechanically verified offline is invalid.
