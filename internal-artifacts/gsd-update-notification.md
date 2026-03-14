# GSD Update Notification System — Analysis

How GSD notifies users about available updates via a yellow status bar indicator.

## Architecture Overview

Three components working together through a **cache file bridge**:

1. **SessionStart hook** — background version check on session start
2. **Statusline command** — reads cache and renders yellow indicator
3. **Update command** — installs update and clears cache to dismiss indicator

```
Session Start → SessionStart hook fires
  → gsd-check-update.js spawns background process
  → Compares local VERSION file vs npm registry
  → Writes ~/.claude/cache/gsd-update-check.json

Every statusline render → gsd-statusline.js reads cache
  → If update_available: true → yellow "⬆ /gsd:update" prepended to statusline

User runs /gsd:update → installs new version → deletes cache file → notification gone
```

---

## Component 1: Version Check — `gsd-check-update.js`

**Source:** `.gsd/hooks/gsd-check-update.js`
**Trigger:** `SessionStart` hook (runs once per session)

### What it does

1. Spawns a **detached background Node.js process** (`windowsHide: true` for Windows)
2. Reads the installed version from a `VERSION` file:
   - Checks project-local first: `{cwd}/.claude/get-shit-done/VERSION`
   - Falls back to global: `~/.claude/get-shit-done/VERSION`
   - Defaults to `'0.0.0'` if neither exists
3. Fetches latest version from npm: `npm view get-shit-done-cc version` (10s timeout)
4. Compares: `update_available = latest && installed !== latest`
5. Writes result to cache: `~/.claude/cache/gsd-update-check.json`

### Cache file format

```json
{
  "update_available": true,
  "installed": "1.18.0",
  "latest": "1.18.1",
  "checked": 1708234567
}
```

### Key implementation details

- Runs as a **detached child process** (`child.unref()`) so it doesn't block session startup
- The entire check logic is passed as an inline `-e` script to `spawn(process.execPath, ['-e', ...])`
- Creates `~/.claude/cache/` directory if it doesn't exist
- Silently catches all errors — never breaks the session

---

## Component 2: Statusline Rendering — `gsd-statusline.js`

**Source:** `.gsd/hooks/gsd-statusline.js`
**Trigger:** Registered as `settings.statusLine` command (renders on every output cycle)

### What it does

1. Reads JSON from stdin (Claude Code provides model, workspace, session, context usage)
2. Checks for update cache at `~/.claude/cache/gsd-update-check.json`
3. If `update_available: true`, **prepends** yellow ANSI text to the statusline:
   ```
   \x1b[33m⬆ /gsd:update\x1b[0m │
   ```
4. Renders the rest of the statusline: model name, current task (from todos), directory, context bar

### Statusline output format

```
⬆ /gsd:update │ Claude Opus 4 │ Current Task │ my-project ██████░░░░ 60%
```

The update indicator is simply prepended — if no update is available, it's an empty string and the statusline renders without it.

### Additional features in the statusline

- **Current task**: Reads from `~/.claude/todos/` — finds the most recent agent todo file for the session and shows the `in_progress` task's `activeForm`
- **Context bar**: Color-coded progress bar scaled to Claude Code's 80% context limit:
  - Green (`\x1b[32m`): < 63% used
  - Yellow (`\x1b[33m`): 63-80%
  - Orange (`\x1b[38;5;208m`): 81-94%
  - Blinking red skull (`\x1b[5;31m💀`): 95%+

---

## Component 3: Hook Registration — `bin/install.js`

**Source:** `.gsd/bin/install.js` (lines ~1430-1500)

### How hooks get wired into settings.json

```js
// Build hook commands (handles global vs local paths)
const statuslineCommand = isGlobal
  ? buildHookCommand(targetDir, 'gsd-statusline.js')
  : 'node ' + dirName + '/hooks/gsd-statusline.js';
const updateCheckCommand = isGlobal
  ? buildHookCommand(targetDir, 'gsd-check-update.js')
  : 'node ' + dirName + '/hooks/gsd-check-update.js';

// Register SessionStart hook for background update check
settings.hooks.SessionStart.push({
  hooks: [{ type: 'command', command: updateCheckCommand }]
});

// Register statusline command
settings.statusLine = { type: 'command', command: statuslineCommand };
```

### Installer safeguards

- **Deduplication**: Checks `hasGsdUpdateHook` before adding to prevent duplicate SessionStart entries
- **Orphan cleanup**: Removes old hook files and registrations (e.g., `statusline.js` renamed to `gsd-statusline.js` in v1.9.0)
- **Existing statusline handling**: If a statusline already exists, prompts the user (interactive) or skips with a message (non-interactive). `--force-statusline` flag overrides.
- **Uninstall support**: The uninstall flow removes hooks, statusline, and cache files cleanly

---

## Component 4: Clearing the Notification — `/gsd:update`

**Source:** `.gsd/commands/gsd/update.md` → routes to `workflows/update.md`

When the user runs `/gsd:update`:
1. Shows changelog from GitHub
2. Gets user confirmation
3. Runs installer: `npx get-shit-done-cc --local` or `--global`
4. **Deletes the cache file**: `rm -f ~/.claude/cache/gsd-update-check.json`
5. Next statusline render finds no cache file → yellow indicator disappears

---

## Key Takeaways for ACE

### What to replicate

1. **SessionStart hook** for background version checking — non-blocking, detached process
2. **Cache file as bridge** between the async check and the synchronous statusline render
3. **Statusline command** that reads the cache and conditionally prepends an indicator
4. **Update command** that clears the cache after successful update

### Settings.json integration points

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [{ "type": "command", "command": "node path/to/check-update.js" }]
      }
    ]
  },
  "statusLine": {
    "type": "command",
    "command": "node path/to/statusline.js"
  }
}
```

### Design considerations

- The version check is a **simple string inequality** (`installed !== latest`), not semver comparison — any difference triggers the notification
- The `VERSION` file is written by the installer at install time, not read from `package.json` at runtime
- The npm registry query has a 10-second timeout to avoid hanging on slow/offline networks
- All errors are silently caught — the system degrades gracefully (no check = no notification)
