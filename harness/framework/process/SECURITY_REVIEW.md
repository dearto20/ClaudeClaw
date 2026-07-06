# Security Review Checklist

Comprehensive security checklist for all project changes. Referenced by the requirement lifecycle at Steps 5 and 10b. Project-specific quality discovery determines which standards are applicable.

---

## OWASP Top 10 (2021) — Web/Application Security

For each item, check: does this change introduce or worsen this risk?

### A01:2021 — Broken Access Control
- [ ] Does this change add or modify authentication/authorization logic?
- [ ] Are access controls enforced server-side (not just client-side)?
- [ ] Is there a default-deny rule for new endpoints?
- [ ] Are direct object references validated against the user's permissions?

### A02:2021 — Cryptographic Failures
- [ ] Does this change handle sensitive data (credentials, tokens, PII)?
- [ ] Is data encrypted in transit (TLS 1.2+) and at rest?
- [ ] Are cryptographic keys stored securely (not hardcoded, not in git)?
- [ ] Are deprecated algorithms avoided (MD5, SHA1, DES)?

### A03:2021 — Injection
- [ ] Does this change accept user or external input?
- [ ] Is input validated, sanitized, and parameterized (no string concatenation in queries)?
- [ ] Is output encoded for the target context (HTML, SQL, shell, LDAP)?

### A04:2021 — Insecure Design
- [ ] Are threat models updated for new features?
- [ ] Are abuse cases and negative flows considered?
- [ ] Are rate limits and resource constraints defined?

### A05:2021 — Security Misconfiguration
- [ ] Are default credentials removed or changed?
- [ ] Are error messages non-revealing (no stack traces, no internal paths)?
- [ ] Are unnecessary features, ports, and services disabled?
- [ ] Are security headers configured (CSP, HSTS, X-Frame-Options)?

### A06:2021 — Vulnerable and Outdated Components
- [ ] Does this change add new dependencies?
- [ ] Are dependencies pinned to specific versions?
- [ ] Are known CVEs checked for all dependencies?

### A07:2021 — Identification and Authentication Failures
- [ ] Are session tokens properly managed (rotation, expiration, secure flags)?
- [ ] Are passwords hashed with strong algorithms (bcrypt, argon2)?
- [ ] Is multi-factor authentication available for privileged operations?

### A08:2021 — Software and Data Integrity Failures
- [ ] Are CI/CD pipelines protected from unauthorized modification?
- [ ] Is code signing or verification in place for deployments?
- [ ] Are serialization formats safe (no pickle, no eval, no yaml.load)?

### A09:2021 — Security Logging and Monitoring Failures
- [ ] Are security-relevant events logged (auth failures, access denials, config changes)?
- [ ] Are logs tamper-resistant and stored securely?
- [ ] Are alerting thresholds defined for anomalous patterns?

### A10:2021 — Server-Side Request Forgery (SSRF)
- [ ] Does this change make outbound HTTP/network requests?
- [ ] Are URL/hostname inputs validated against an allowlist?
- [ ] Are internal resources protected from external request access?

---

## OWASP API Security Top 10 (2023)

For API-related changes:

### API1:2023 — Broken Object Level Authorization
- [ ] Are object-level permissions checked for every API call?
- [ ] Can a user access another user's objects by changing an ID?

### API2:2023 — Broken Authentication
- [ ] Are authentication mechanisms consistent across all endpoints?
- [ ] Are tokens validated on every request (not just login)?

### API3:2023 — Broken Object Property Level Authorization
- [ ] Can users modify properties they shouldn't (mass assignment)?
- [ ] Are response fields filtered based on user permissions?

### API4:2023 — Unrestricted Resource Consumption
- [ ] Are rate limits enforced per user/key?
- [ ] Are request size limits configured?
- [ ] Are pagination limits enforced?

### API5:2023 — Broken Function Level Authorization
- [ ] Are admin/privileged functions access-controlled?
- [ ] Are HTTP methods restricted per endpoint?

### API6:2023 — Unrestricted Access to Sensitive Business Flows
- [ ] Are critical business flows protected from automated abuse?
- [ ] Are CAPTCHA or progressive delays in place?

### API7:2023 — Server Side Request Forgery
- [ ] See A10:2021 above.

### API8:2023 — Security Misconfiguration
- [ ] See A05:2021 above, applied to API configuration.

### API9:2023 — Improper Inventory Management
- [ ] Are all API endpoints documented?
- [ ] Are deprecated endpoints disabled, not just undocumented?

### API10:2023 — Unsafe Consumption of APIs
- [ ] Are third-party API responses validated before use?
- [ ] Are timeouts and circuit breakers configured for external calls?

---

## OWASP Top 10 for LLM Applications (2025)

For AI/LLM-related changes:

### LLM01:2025 — Prompt Injection
- [ ] Does this pass user input directly to LLM prompts?
- [ ] Is input sanitized before prompt construction?
- [ ] Are system prompts isolated from user content?

### LLM02:2025 — Sensitive Information Disclosure
- [ ] Can the LLM leak training data, system prompts, or internal context?
- [ ] Are output filters in place for PII and credentials?

### LLM03:2025 — Supply Chain Vulnerabilities
- [ ] Are model sources verified (checksums, signatures)?
- [ ] Are prompt templates version-controlled?

### LLM04:2025 — Data and Model Poisoning
- [ ] Is training/fine-tuning data validated and auditable?
- [ ] Are RAG data sources trusted and integrity-checked?

### LLM05:2025 — Improper Output Handling
- [ ] Is LLM output treated as untrusted (sanitized before rendering, execution, or storage)?
- [ ] Are code generation outputs sandboxed before execution?

### LLM06:2025 — Excessive Agency
- [ ] Are LLM-triggered actions scoped to minimum necessary permissions?
- [ ] Are destructive actions gated by human approval?
- [ ] Is there a maximum action count per session?

### LLM07:2025 — System Prompt Leakage
- [ ] Can the system prompt be extracted via prompt injection?
- [ ] Are system prompts treated as confidential?

### LLM08:2025 — Vector and Embedding Weaknesses
- [ ] Are embedding inputs sanitized?
- [ ] Are vector databases access-controlled?

### LLM09:2025 — Misinformation
- [ ] Are factual claims from LLMs verified against authoritative sources?
- [ ] Are confidence indicators provided with LLM outputs?

### LLM10:2025 — Unbounded Consumption
- [ ] Are token limits enforced per request and per session?
- [ ] Are cost alerting thresholds configured?

---

## OWASP Top 10 for Agentic Applications (2025)

For agent-based systems with tool use and autonomous actions:

### AG01 — Excessive Autonomy
- [ ] Does this grant the agent ability to take actions without human approval?
- [ ] Are destructive operations gated (delete, send, publish)?
- [ ] Is the scope of agent tool access minimally scoped?

### AG02 — Insufficient Tool Access Control
- [ ] Are tool invocations authenticated and authorized?
- [ ] Can the agent invoke tools outside its intended scope?
- [ ] Are tool parameters validated (no injection via tool args)?

### AG03 — Inadequate Human Oversight
- [ ] Are critical agent decisions reviewable by humans?
- [ ] Is there an approval workflow for high-impact actions?
- [ ] Can human operators interrupt or override agent actions?

### AG04 — Memory and Context Manipulation
- [ ] Can external inputs manipulate the agent's memory or context?
- [ ] Are memory/context stores integrity-protected?

### AG05 — Unsafe Tool Chaining
- [ ] Can tool outputs be used as inputs to other tools without validation?
- [ ] Are tool chain depths limited?

### AG06 — Cross-Agent Trust
- [ ] Are agent-to-agent communications authenticated?
- [ ] Are delegated tasks scoped and validated?

### AG07 — Privilege Escalation Through Tools
- [ ] Can an agent gain elevated privileges by chaining tool calls?
- [ ] Are tool permissions checked at each invocation, not just at session start?

### AG08 — Insufficient Audit Trail
- [ ] Are all agent actions logged with timestamps and context?
- [ ] Are logs tamper-resistant?
- [ ] Can actions be traced back to the originating request?

### AG09 — Goal Misalignment
- [ ] Are agent goals explicitly defined and bounded?
- [ ] Are there guardrails preventing off-task behavior?

### AG10 — Emergent Behavior
- [ ] Are multi-agent interactions tested for unexpected emergent patterns?
- [ ] Are monitoring alerts in place for anomalous agent behavior?

---

## OWASP Agentic AI Threats (2025)

Broader agentic AI threat landscape:

### Multi-Agent Orchestration Risks
- [ ] Can a compromised agent propagate malicious instructions to other agents?
- [ ] Are inter-agent messages validated and sanitized?

### Tool Poisoning
- [ ] Can tool responses be tampered with to mislead agents?
- [ ] Are tool outputs integrity-verified?

### Goal Misalignment and Reward Hacking
- [ ] Can the agent optimize for proxy metrics instead of actual goals?
- [ ] Are goal boundaries tested with adversarial inputs?

---

## OWASP Machine Learning Security Top 10

For ML pipeline changes:

### ML01 — Input Manipulation Attack
- [ ] Are model inputs validated for adversarial perturbations?
- [ ] Are input bounds enforced?

### ML02 — Data Poisoning Attack
- [ ] Is training data provenance tracked?
- [ ] Are data integrity checks in place?

### ML03 — Model Inversion Attack
- [ ] Can model outputs be used to reconstruct training data?
- [ ] Are differential privacy techniques applied?

### ML04 — Membership Inference Attack
- [ ] Can an attacker determine if a specific record was in the training set?

### ML05 — Model Theft
- [ ] Are model weights and architectures access-controlled?
- [ ] Are API rate limits sufficient to prevent model extraction?

### ML06 — AI Supply Chain Attacks
- [ ] Are pre-trained models verified before use?
- [ ] Are model hosting platforms trusted?

### ML07-10
- [ ] Are transfer learning sources validated?
- [ ] Are model outputs monitored for distribution shift?
- [ ] Are output integrity checks in place?
- [ ] Are model update pipelines protected?

---

## Additional Standards

### CWE Top 25 Most Dangerous Software Weaknesses (2024)
Key items to check: CWE-79 (XSS), CWE-89 (SQL Injection), CWE-416 (Use After Free), CWE-78 (OS Command Injection), CWE-20 (Improper Input Validation), CWE-125 (Out-of-bounds Read), CWE-22 (Path Traversal), CWE-352 (CSRF), CWE-434 (Unrestricted Upload), CWE-862 (Missing Authorization).

### NIST Secure Software Development Framework (SSDF)
- [ ] Is secure development training current?
- [ ] Are security requirements defined before implementation?
- [ ] Is third-party software assessed for security?
- [ ] Are security tests automated in CI/CD?

### NIST AI Risk Management Framework (AI RMF)
- [ ] Are AI system risks mapped and documented?
- [ ] Are AI outputs monitored for bias and fairness?
- [ ] Is AI system behavior explainable and accountable?
- [ ] Are incident response procedures defined for AI failures?

---

## How to Use During Lifecycle

### At Step 5 (Design Quality Alignment)

1. Check the OWASP relevance matrix in the project's quality attributes file (e.g., `framework/QUALITY_SCORE.md`)
2. For each APPLICABLE standard, check each item against the proposed design
3. Record PASS/FAIL/N-A per item
4. Any FAIL → STOP, address before proceeding

### At Step 10b (Final Principle Verification)

1. Re-run the same checks against the actual git diff
2. Check for risks introduced during implementation that weren't in the design
3. Any FAIL → STOP, return to Step 8
