# ACE Development Guidelines

## CRITICAL: Deployment After Changes

This repo is the SOURCE CODE of the ACE framework. Claude Code runs ACE from `~/.claude/`, which is a SEPARATE COPY — NOT a symlink.

**After ANY change to files in this repo, you MUST re-deploy:**

```bash
node bin/install.js --claude --global
```

This copies commands, agents, workflows, templates, utils, and src (ace-tools.js) from the repo to `~/.claude/`. Without this step, changes are NOT live.

## Project Structure

- `bin/install.js` — Installer that copies repo files to `~/.claude/` (or `~/.opencode/` for Crush)
- `commands/ace/` — Slash command definitions (`.md` files)
- `agents/` — Agent definitions (`.md` files)
- `agile-context-engineering/` — Core framework:
  - `src/ace-tools.js` — CLI tool for init, state updates, GitHub operations
  - `workflows/` — XML workflow definitions
  - `templates/` — Document templates
  - `utils/` — Formatting and utility guides

## Key Rules

- NEVER add new functions when existing ones can be reused. Read existing code FIRST.
- `github update-issue` and `github create-issue` use `--body-file` (not `--body`) to avoid shell escaping issues with complex markdown content.
- All init functions provide `story.issue_number` and `feature.issue_number` — workflows use these directly, no manual header parsing.
- Agent specifications go at the top of `<process>`, NOT in `<execution-context>`.
- Agents are referenced by name only — Claude Code already knows about loaded agents.
- ONE commit per story — after ALL work is done.
