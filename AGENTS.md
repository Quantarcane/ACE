# ACE Development Guidelines

## CRITICAL: Deployment After Changes

This repo is the SOURCE CODE of the ACE framework. It is installed as a **Codex plugin** via a local marketplace.

**After ANY change to files in this repo, you MUST re-deploy:**

```bash
node bin/install.js --Codex --global
```

Then in Codex, run `/reload-plugins` to pick up changes.

The installer registers this repo as a local marketplace and installs/updates the `ace` plugin. Codex copies the plugin to its internal cache. Skills are invoked as `/ace:skill-name`.

## Project Structure

- `bin/install.js` — Installer that registers ACE as a local marketplace and installs via `Codex plugin`
- `.Codex-plugin/plugin.json` — Plugin manifest (provides `ace:` namespace)
- `.Codex-plugin/marketplace.json` — Local marketplace catalog
- `skills/` — Skill directories (each has `SKILL.md` + `workflow.xml` + templates + optional `script.js`)
- `shared/lib/` — Shared libraries (`ace-core.js`, `ace-story.js`, `ace-github.js`)
- `shared/utils/` — Shared formatting and utility guides
- `agents/` — Agent definitions (`.md` files)
- `hooks/hooks.json` — Plugin hook registration (SessionStart for update check)
- `hooks/` — Hook scripts (`ace-check-update.js`, `ace-statusline.js`)

## Key Rules

- NEVER add new functions when existing ones can be reused. Read existing code FIRST.
- GitHub functions (`createIssue`, `updateIssue`) use `--body-file` (not `--body`) to avoid shell escaping issues with complex markdown content.
- All init functions provide `story.issue_number` and `feature.issue_number` — workflows use these directly, no manual header parsing.
- Each skill's `script.js` is the ONLY entry point for ace-tools operations. Workflows call `node ${CLAUDE_SKILL_DIR}/script.js <subcommand>`.
- SKILL.md preprocesses the init call via `!` backtick syntax — workflows must NOT duplicate it.
- Agents are referenced by name only — Codex resolves them from the `agents/` directory.
- ONE commit per story — after ALL work is done.
- Hook scripts use `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` environment variables, NOT hardcoded `~/.Codex/` paths.
