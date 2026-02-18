# ACE Deployment Guide

## Local Development & Testing

### Test the installer locally (without npm)

```bash
# Run directly from source
node bin/install.js

# With flags
node bin/install.js --claude --local
node bin/install.js --all --global
node bin/install.js --help
```

### Where files get installed

| Scope | Runtime | Location |
|-------|---------|----------|
| Global | Claude Code | `~/.claude/` |
| Global | OpenCode | `~/.opencode/` |
| Local | Claude Code | `./.claude/` |
| Local | OpenCode | `./.opencode/` |

Each location gets the following structure:

```
commands/ace/                  # Slash commands
agents/                        # Agent definitions
agile-context-engineering/     # Reference material
  templates/                   # Project & artifact templates
  utils/                       # Formatting & utility guides
  workflows/                   # Workflow definitions
```

### Remove installed files (clean slate)

```bash
# Global installations
rm -rf ~/.claude/commands/ace* ~/.claude/agents/* ~/.claude/agile-context-engineering
rm -rf ~/.opencode/commands/ace* ~/.opencode/agents/* ~/.opencode/agile-context-engineering

# Local installations (from project root)
rm -rf .claude .opencode
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
cd C:\Users\razva\WebstormProjects\ACE

# 2. Update version in package.json
npm version patch   # 0.1.0 → 0.1.1 (bug fixes)
npm version minor   # 0.1.0 → 0.2.0 (new features)
npm version major   # 0.1.0 → 1.0.0 (breaking changes)

# 3. Publish
npm publish
```

### First-time publish

```bash
cd C:\Users\razva\WebstormProjects\ACE
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
| Test locally | `node bin/install.js` |
| Bump patch version | `npm version patch` |
| Bump minor version | `npm version minor` |
| Publish | `npm publish --otp=CODE` |
| Test from npm | `npx agile-context-engineering@latest` |
| View published version | `npm view agile-context-engineering version` |
