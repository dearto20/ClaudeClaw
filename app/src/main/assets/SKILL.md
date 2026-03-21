# ClaudeClaw Skills

Skills are reusable workflows that orchestrate tools to accomplish specific tasks.
Each skill defines which tools it needs — tools are only loaded when a skill is activated.

---

## rapid-prototype

Build a complete app from scratch. Takes an idea and delivers a working app with UI, interactions, and persistence.

- tools: design, layout, add_feature, persist, deploy
- trigger: user wants to create a new app, describes features or screens
- approach:
  1. Analyze requirements and identify UI patterns
  2. Design a cohesive visual system with dark theme
  3. Create app structure with appropriate navigation
  4. Build each feature as a distinct component
  5. Configure data persistence scoped by usage pattern
  6. Package and deploy to device

---

## feature-sprint

Add new features to an existing app. Extends functionality without rebuilding from scratch.

- tools: add_feature, persist, deploy
- trigger: user wants to add something, says "add", "include", "also need"
- approach:
  1. Understand the existing app structure
  2. Add features that integrate with existing navigation
  3. Update persistence if new data needs storing
  4. Redeploy the updated app

---

## visual-refresh

Redesign an app's look and feel. Changes colors, typography, and visual style.

- tools: design, deploy
- trigger: user wants to change theme, colors, or visual style
- approach:
  1. Understand desired visual direction
  2. Create new design system with updated palette
  3. Redeploy with new visual identity

---

## data-migrate

Change how an app stores data. Switch between daily, session, or permanent persistence.

- tools: persist, deploy
- trigger: user wants data to persist differently, "keep data", "reset daily"
- approach:
  1. Understand current and desired persistence behavior
  2. Configure new storage strategy
  3. Redeploy with updated data layer
