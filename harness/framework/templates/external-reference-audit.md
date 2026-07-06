# External Reference Audit

## Purpose
- Fill this in when an external repository, sibling checkout, generated artifact, document, prompt, image, or private source materially influences a harness or target-project change.
- Keep filled audits in the project-specific `override/` tree or an execution-plan evidence section. Do not make the framework template itself source-specific.

## Audit Data
```external-reference-audit-json
{
  "schemaVersion": "1.0.0",
  "source": {
    "label": "",
    "location": "",
    "classification": "unclear",
    "inspectionDate": "",
    "inspectedBy": "",
    "authorizationStatus": "unknown",
    "licenseOrAuthorizationNotes": "",
    "provenanceRisk": "",
    "retentionPolicy": "record sanitized audit only; do not retain copied source material"
  },
  "scope": {
    "inspectedAreas": [],
    "ignoredAreas": [],
    "dirtyOrUntrackedSourceStateUsed": false,
    "dirtyOrUntrackedSourceStateRationale": ""
  },
  "prohibitions": [
    "raw-code",
    "raw-prompts",
    "prompt-phrasing",
    "assets-or-diagrams",
    "private-config-or-credentials",
    "product-specific-implementation"
  ],
  "adoptedPatterns": [
    {
      "id": "",
      "title": "",
      "localContract": "",
      "independentJustification": "",
      "artifactPaths": [],
      "validationPaths": []
    }
  ],
  "deferredPatterns": [
    {
      "id": "",
      "title": "",
      "rationale": ""
    }
  ],
  "rejectedPatterns": [
    {
      "id": "",
      "title": "",
      "rationale": ""
    }
  ],
  "invalidationPath": {
    "trigger": "source retracted, prohibited, unauthorized, or materially changed",
    "reviewAction": "independently re-justify, rewrite without source influence, or remove affected artifacts",
    "artifactsToUpdate": []
  }
}
```

## Completion Checklist
- Source classification and authorization status are explicit.
- Every adopted pattern has an independent justification that does not depend on the external source.
- Every rejected or deferred candidate has a rationale.
- No raw source material is copied into the audit.
- Validation paths are local and do not require the external source at runtime.
