# ACE Deployment Guide

## Architecture

ACE is distributed as a **Claude Code plugin** via a local marketplace, and as native skills for Codex and Crush. The Claude installer:

1. Registers the ACE package directory as a local marketplace (`claude plugin marketplace add`)
2. Installs the `ace` plugin from that marketplace (`claude plugin install ace@ace-marketplace`)
3. Skills are then available as `/ace:help`, `/ace:plan-story`, etc.

For Codex and Crush (OpenCode), files are copied directly into the runtime config directory.

---

## Local Development & Testing

### Test the installer locally (without npm)

```bash
# Run directly from source
node bin/install.js

# With flags
node bin/install.js --claude --local
node bin/install.js --claude --global
node bin/install.js --codex --local
node bin/install.js --codex --global
node bin/install.js --all --global
node bin/install.js --help
```

### Install from npm

```bash
npx agile-context-engineering --claude --global
```

Both paths use the same marketplace mechanism for Claude Code.

### Where files get installed

**Claude Code (plugin system):**

The installer registers ACE as a local marketplace. Claude Code copies the plugin to its internal cache at `~/.claude/plugins/cache/`. The plugin structure includes:

```
skills/                        # Skill directories (SKILL.md + workflow + templates + script.js)
shared/                        # Shared libraries and utils
  lib/                         # ace-core.js, ace-story.js, ace-github.js
  utils/                       # Formatting & utility guides
agents/                        # Agent definitions
hooks/                         # Plugin hooks (hooks.json + ace-check-update.js + ace-statusline.js)
.claude-plugin/                # Plugin manifest (plugin.json + marketplace.json)
```

Additionally, a statusline wrapper is written to `~/.claude/hooks/ace-statusline-wrapper.js`.

**Crush (legacy copy):**

| Scope | Location |
|-------|----------|
| Global | `~/.opencode/` |
| Local | `./.opencode/` |

**Codex (native skills):**

| Scope | Location |
|-------|----------|
| Global | `~/.codex/` or `$CODEX_HOME` |
| Local | `./.codex/` |

Codex gets:

```
skills/ace-*/                  # Codex skills, invoked as $ace-help, $ace-plan-story, etc.
shared/                        # Shared ACE libraries and utils
agents/ace-*.toml              # Codex agent configs
config.toml                    # Managed [agents.ace-*] block appended/updated by installer
```

### Remove installed files (clean slate)

```bash
# Claude Code: uninstall via plugin system
claude plugin uninstall ace@ace-marketplace
claude plugin marketplace remove ace-marketplace

# Also clean statusline wrapper
rm -f ~/.claude/hooks/ace-statusline-wrapper.js

# Codex: remove direct install files
rm -rf ~/.codex/skills/ace-* ~/.codex/shared ~/.codex/agents/ace-*
# Then remove the managed ACE block from ~/.codex/config.toml

# Crush: remove directly
rm -rf ~/.opencode/skills ~/.opencode/shared ~/.opencode/agents/ace-* ~/.opencode/.claude-plugin
```

### After making source code changes

```bash
# Claude Code: re-run the installer to update the marketplace + plugin
node bin/install.js --claude --global

# Then in Claude Code, run:
# /reload-plugins

# Codex: re-run the installer to copy native skills and agents
node bin/install.js --codex --global

# Then restart Codex. Codex does not provide /reload-plugins.
```

---

## Publishing to npm

### Prerequisites

1. npm account at https://www.npmjs.com/signup
2. Create a Granular Access Token:
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click **"Generate New Token"** → **"Granular Access Token"**
   - Enable **"Bypass 2FA for automation"**
   - Packages: "All packages" or select `agile-context-engineering`
   - Permissions: **Read and write**
   - Copy the token

3. Configure npm with your token:
   ```bash
   npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN_HERE
   ```

### Publish a new version

```bash
# 1. Navigate to project
cd C:\Coding\repos\ACE

# 2. Update version in package.json
npm version patch   # 0.1.0 → 0.1.1 (bug fixes)
npm version minor   # 0.1.0 → 0.2.0 (new features)
npm version major   # 0.1.0 → 1.0.0 (breaking changes)

# 3. Publish
npm publish
```

### First-time publish

```bash
cd C:\Coding\repos\ACE
npm publish
```

### Alternative: Publish with OTP (if not using token)

```bash
npm publish --otp=YOUR_6_DIGIT_CODE
```

### Fix package.json warnings

If npm shows warnings during publish:
```bash
npm pkg fix
```

---

## Testing the Published Package

### Clear caches and test fresh

```bash
# Clear npx cache
npx clear-npx-cache

# Or manually on Windows
rmdir /s /q %LOCALAPPDATA%\npm-cache\_npx

# Test the published version
npx agile-context-engineering@latest
```

### Test specific version

```bash
npx agile-context-engineering@0.1.0
npx agile-context-engineering@latest
```

### Skip confirmation prompt

```bash
npx --yes agile-context-engineering
```

---

## Version Management

### Check current version

```bash
npm view agile-context-engineering version
```

### Check all published versions

```bash
npm view agile-context-engineering versions
```

### Unpublish (within 72 hours only)

```bash
npm unpublish agile-context-engineering@0.1.0 --otp=YOUR_CODE
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Test locally | `node bin/install.js --claude --global` or `node bin/install.js --codex --global` |
| Bump patch version | `npm version patch` |
| Bump minor version | `npm version minor` |
| Publish | `npm publish --otp=CODE` |
| Test from npm | `npx agile-context-engineering@latest` |
| View published version | `npm view agile-context-engineering version` |
| Reload after install | `/reload-plugins` (Claude Code) or restart Codex |
| Uninstall | `claude plugin uninstall ace@ace-marketplace` |
