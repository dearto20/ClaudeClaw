# Browser Validation

## Purpose
- UI and browser-facing projects require visual and interaction evidence.
- The framework requires target projects to define how agents drive and inspect browser surfaces.

## Target Project Contract
Browser-facing projects must define:
- Startup command and URL.
- Browser automation command.
- Required journeys.
- Screenshot or video artifact location.
- DOM or accessibility checks where applicable.
- Mobile and desktop viewport expectations.
- Failure evidence format.

## Non-Browser Projects
- Projects without browser surfaces must record `not applicable` with a short rationale.
- Replacement evidence must be listed, such as CLI output, rendered files, or API smoke tests.
