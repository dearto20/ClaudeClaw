// Single source for the Claude Code runtime-adapter wiring: statusline plus
// visibility hooks. Used by bootstrap (install), upgrade (ensure), and
// validate-runtime-adapters.mjs (gate) so "wired" has exactly one definition.
// Merge semantics are additive-only: target-owned settings keys are never
// modified or removed — a target's own statusLine or hooks always win space;
// harness entries are appended only when absent.

export const STATUSLINE_COMMAND = "node harness/scripts/harness.mjs status --line";

export const HOOK_EVENTS = {
  UserPromptSubmit: "node harness/scripts/runtime-hooks/prompt-context.mjs",
  SessionStart: "node harness/scripts/runtime-hooks/session-start-context.mjs",
  Stop: "node harness/scripts/runtime-hooks/stop-tier-line-check.mjs",
};

const hookEntryFor = (command) => ({ hooks: [{ type: "command", command }] });

// Wiring is exact, never substring: `echo '<command>'` or a suffixed wrapper
// contains the expected string without executing it. Whitespace is normalized;
// nothing else is tolerated.
const normalizeCommand = (value) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : null);

const eventHasCommand = (eventConfig, command) =>
  Array.isArray(eventConfig) &&
  eventConfig.some(
    (entry) =>
      Array.isArray(entry?.hooks) &&
      entry.hooks.some((h) => h?.type === "command" && normalizeCommand(h.command) === normalizeCommand(command)),
  );

// Returns { settings, changed }. `existing` is a parsed settings object (or
// null/undefined for a fresh install). Never mutates the input.
export const mergeHarnessRuntimeSettings = (existing) => {
  const settings = existing ? JSON.parse(JSON.stringify(existing)) : {};
  let changed = false;
  if (!settings.statusLine) {
    settings.statusLine = { type: "command", command: STATUSLINE_COMMAND };
    changed = true;
  }
  if (typeof settings.hooks !== "object" || settings.hooks === null || Array.isArray(settings.hooks)) {
    if (settings.hooks === undefined) {
      settings.hooks = {};
      changed = true;
    } else {
      // A malformed target-owned hooks value is theirs to fix; do not clobber.
      return { settings, changed };
    }
  }
  for (const [event, command] of Object.entries(HOOK_EVENTS)) {
    const existing = settings.hooks[event];
    if (existing !== undefined && !Array.isArray(existing)) {
      // A malformed target-owned per-event value is theirs to fix; never
      // clobber it — the wiring gate surfaces it as a failure instead.
      continue;
    }
    if (!eventHasCommand(existing, command)) {
      settings.hooks[event] = [...(existing ?? []), hookEntryFor(command)];
      changed = true;
    }
  }
  return { settings, changed };
};

// Gate-side check: which required wiring is missing from a parsed settings object.
export const runtimeSettingsFailures = (settings) => {
  const failures = [];
  if (settings?.statusLine?.type !== "command" || normalizeCommand(settings?.statusLine?.command) !== STATUSLINE_COMMAND) {
    failures.push(`statusLine is not wired to \`${STATUSLINE_COMMAND}\` as type "command" (exact executing shape required — wrappers, lookalikes, and non-command types do not count)`);
  }
  for (const [event, command] of Object.entries(HOOK_EVENTS)) {
    if (!eventHasCommand(settings?.hooks?.[event], command)) {
      failures.push(`${event} hook is not wired to the exact command ${command}`);
    }
  }
  return failures;
};
