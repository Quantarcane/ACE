# ACE Development Guidelines

## CRITICAL: Deployment After Changes

This repo is the SOURCE CODE of the ACE framework. It is installed as a **Claude Code plugin** via a local marketplace.

**After ANY change to files in this repo, you MUST re-deploy:**

```bash
node bin/install.js --claude --global
```

Then in Claude Code, run `/reload-plugins` to pick up changes.

The installer registers this repo as a local marketplace and installs/updates the `ace` plugin. Claude Code copies the plugin to its internal cache. Skills are invoked as `/ace:skill-name`.

## Project Structure

- `bin/install.js` — Installer that registers ACE as a local marketplace and installs via `claude plugin`
- `.claude-plugin/plugin.json` — Plugin manifest (provides `ace:` namespace)
- `.claude-plugin/marketplace.json` — Local marketplace catalog
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
- Agents are referenced by name only — Claude Code resolves them from the `agents/` directory.
- ONE commit per story — after ALL work is done.
- Hook scripts use `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` environment variables, NOT hardcoded `~/.claude/` paths.
- NEVER hardcode `.docs` anywhere. The documentation root lives in `.ace/settings.json` as `docs_path` (default `.docs`, commonly nested in monorepos e.g. `ProcerERP/.docs`).
  - JS: resolve via `resolveDocsPath(cwd)` / `docsPath(cwd, 'wiki/system-wide/...')` from `shared/lib/ace-core.js`.
  - Every skill's `script.js init` MUST include `docs_path` in its JSON output.
  - Workflows, SKILL.md files, templates and agents use the `{docs_path}` placeholder plus the `<docs-root>` contract block — never a literal `.docs`.
  - `/ace:help` owns detection and persistence (`detect-docs-path` / `write-docs-path`).
