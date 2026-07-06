# Design Review Checklist (UI/UX)

UI/UX design principle checklists for all project changes. Referenced by the requirement lifecycle at Steps 5 and 10b. Project-specific quality discovery determines which standards are applicable.

---

## Nielsen's 10 Usability Heuristics

### H01 — Visibility of System Status
- [ ] Does the system inform users about what's happening through feedback?
- [ ] Are loading states, progress indicators, and status messages present?
- [ ] Is feedback provided within reasonable time?

### H02 — Match Between System and Real World
- [ ] Does the interface use language and concepts familiar to the user?
- [ ] Are icons and metaphors intuitive?
- [ ] Does information appear in a natural, logical order?

### H03 — User Control and Freedom
- [ ] Can users undo and redo actions?
- [ ] Are there clear exit paths from unwanted states?
- [ ] Are destructive actions confirmed before execution?

### H04 — Consistency and Standards
- [ ] Does this change follow existing UI patterns in the project?
- [ ] Are the same words, actions, and visuals used for the same concepts?
- [ ] Does it follow platform conventions (web, mobile, desktop)?

### H05 — Error Prevention
- [ ] Are error-prone conditions eliminated or checked before commit?
- [ ] Are confirmation dialogs used for irreversible actions?
- [ ] Are inputs constrained to valid values where possible?

### H06 — Recognition Rather Than Recall
- [ ] Are options, actions, and instructions visible or easily retrievable?
- [ ] Is the user required to memorize information between steps?

### H07 — Flexibility and Efficiency of Use
- [ ] Are shortcuts available for expert users?
- [ ] Can frequent actions be customized or automated?

### H08 — Aesthetic and Minimalist Design
- [ ] Does every element serve a purpose?
- [ ] Is irrelevant or rarely needed information hidden?
- [ ] Is visual noise minimized?

### H09 — Help Users Recognize, Diagnose, and Recover from Errors
- [ ] Are error messages written in plain language (not error codes)?
- [ ] Do error messages suggest a solution?
- [ ] Are errors clearly distinguishable from normal content?

### H10 — Help and Documentation
- [ ] Is help available and easy to find?
- [ ] Is documentation task-oriented and concise?

---

## WCAG 2.2 Accessibility

### Level A (minimum)
- [ ] Are all non-text elements given text alternatives (alt text, aria-label)?
- [ ] Is content navigable by keyboard alone (no mouse dependency)?
- [ ] Are focus indicators visible?
- [ ] Is color not the sole means of conveying information?

### Level AA (standard target)
- [ ] Is text contrast ratio at least 4.5:1 (3:1 for large text)?
- [ ] Can text be resized to 200% without loss of content?
- [ ] Are interactive elements at least 24x24 CSS pixels?
- [ ] Are forms labeled and error messages associated with inputs?

### Level AAA (enhanced)
- [ ] Is text contrast ratio at least 7:1?
- [ ] Is sign language interpretation available for media?
- [ ] Are reading level and pronunciation aids provided?

---

## Responsive Design

- [ ] Is the layout mobile-first (smallest viewport designed first)?
- [ ] Are breakpoints consistent with the project's existing breakpoint system?
- [ ] Are touch targets at least 48x48 CSS pixels on mobile?
- [ ] Does content reflow without horizontal scrolling at 320px width?
- [ ] Are images responsive (srcset or CSS-based)?

---

## Information Hierarchy

- [ ] Does the typography follow the project's established scale (from the project design system)?
- [ ] Is visual weight used to guide the reading flow (headings > body > metadata)?
- [ ] Is whitespace rhythm consistent (same spacing patterns as existing pages)?
- [ ] Are primary actions visually prominent over secondary actions?

---

## Component Consistency

- [ ] Does this change reuse existing components instead of creating new ones?
- [ ] If a new component is created: does it follow the same structure as existing ones?
- [ ] Are design tokens used for all values (colors, spacing, fonts from the project design system)?
- [ ] Are component states complete (default, hover, active, disabled, focus, error)?

---

## Interaction Patterns

- [ ] Is feedback provided for every user action (click, submit, navigate)?
- [ ] Are loading states defined (skeleton, spinner, progress)?
- [ ] Are error states defined with recovery paths?
- [ ] Are empty states defined (no data, first use, search with no results)?
- [ ] Are transitions/animations consistent with existing patterns (duration, easing)?
- [ ] Are destructive actions visually distinct (red, confirmation dialog)?

---

## Semantic HTML and ARIA

- [ ] Are semantic HTML elements used (nav, main, article, section, aside)?
- [ ] Are ARIA roles and labels used only where native semantics are insufficient?
- [ ] Is focus trapped in modals and restored on close?
- [ ] Is skip navigation available for repeated content?
- [ ] Are live regions (aria-live) used for dynamic content updates?

---

## How to Use During Lifecycle

### At quality discovery (bootstrap)

Determine which design standards apply:

| Standard | Applicable? | Rationale |
|----------|-------------|-----------|
| Nielsen's Heuristics | YES/NO | [has UI? has user interaction?] |
| WCAG 2.2 | YES/NO | [has web UI? legal requirements?] |
| Responsive Design | YES/NO | [multi-device? mobile users?] |
| Information Hierarchy | YES/NO | [has content layout?] |
| Component Consistency | YES/NO | [has component library?] |
| Interaction Patterns | YES/NO | [has interactive features?] |
| Semantic HTML/ARIA | YES/NO | [has web UI?] |

For CLI tools, APIs, and backend services: most design standards are N/A. Mark accordingly.

### At Step 5 (Design Quality Alignment)

1. Check the design relevance matrix in the project's quality attributes file (e.g., `framework/QUALITY_SCORE.md`)
2. For each APPLICABLE standard, check relevant items against the proposed design
3. Record PASS/FAIL/N-A per item
4. Any FAIL → STOP, address before proceeding

### At Step 10b (Final Principle Verification)

1. Re-run applicable checks against the actual code/markup
2. Check for design violations introduced during implementation
3. Any FAIL → STOP, return to Step 8
