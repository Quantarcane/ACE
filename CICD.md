# ACE CI/CD & Release Process

## Overview

ACE uses a **tag-driven release pipeline**. When you push a version tag (`v*`) to GitHub, a GitHub Actions workflow automatically creates a GitHub Release (with changelog notes) and publishes the package to npm.

## Architecture

```
Developer workflow                    Automated pipeline
──────────────────                    ──────────────────

1. Write code + update CHANGELOG.md
2. npm version patch|minor|major
   └─ bumps package.json
   └─ creates commit "vX.Y.Z"
   └─ creates git tag "vX.Y.Z"
3. git push origin main --tags
   └─ pushes commit + tag ──────────► GitHub Actions detects tag push
                                       ├─ Extracts changelog for this version
                                       ├─ Creates GitHub Release with notes
                                       └─ Publishes to npm registry

4. Users see update via statusline    ◄── npm registry has new version
5. Users run /ace:update
   └─ Fetches CHANGELOG.md
   └─ Shows "What's New"
   └─ Installs update
```

## Prerequisites (One-Time Setup)

### 1. npm Token

Create an npm access token for publishing:

1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Click "Generate New Token" > "Classic Token"
3. Select "Automation" type (no 2FA prompt on CI)
4. Copy the token

Add it to your GitHub repo:

1. Go to https://github.com/Quantarcane/ACE/settings/secrets/actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: paste the npm token

### 2. GitHub Actions Permissions

The workflow uses `GITHUB_TOKEN` (automatic) for creating releases. No additional setup needed — just ensure Actions are enabled in the repo settings.

## Release Steps

### Step 1: Update CHANGELOG.md

Add entries under `## [Unreleased]` as you develop. When ready to release, rename it to the new version with today's date:

```markdown
## [0.3.0] - 2026-03-20

### Added
- New feature X
- New feature Y

### Fixed
- Bug fix Z

### Changed
- Improvement W
```

Add a new empty `## [Unreleased]` section above it, and add the comparison link at the bottom of the file:

```markdown
[Unreleased]: https://github.com/agile-context-engineering/ace/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/agile-context-engineering/ace/releases/tag/v0.3.0
```

### Step 2: Bump Version

Use `npm version` which atomically:
- Updates `version` in `package.json`
- Creates a git commit
- Creates a git tag

```bash
# For bug fixes (0.2.2 → 0.2.3)
npm version patch

# For new features (0.2.2 → 0.3.0)
npm version minor

# For breaking changes (0.2.2 → 1.0.0)
npm version major
```

### Step 3: Push

```bash
git push origin main --tags
```

This pushes the version commit AND the tag. The tag push triggers the GitHub Actions workflow.

### Step 4: Verify (Automated)

The workflow (`.github/workflows/release.yml`) runs automatically:

1. **Checkout** — clones the repo at the tagged commit
2. **Setup Node.js** — configures Node 20 with npm registry
3. **Extract changelog** — parses `CHANGELOG.md` to find the section matching the tag version (everything between `## [X.Y.Z]` and the next `## [`)
4. **Create GitHub Release** — uses `gh release create` with the extracted notes
5. **Publish to npm** — runs `npm publish` using the `NPM_TOKEN` secret

### Step 5: Confirm

After the workflow completes (~1-2 minutes):

- Check the release: https://github.com/Quantarcane/ACE/releases
- Check npm: `npm view agile-context-engineering version`
- Check Actions: https://github.com/Quantarcane/ACE/actions

## How Users Receive Updates

### Background Detection

On every Claude Code session start, `hooks/ace-check-update.js` runs in a detached background process:

1. Reads installed version from `~/.claude/agile-context-engineering/VERSION`
2. Checks npm: `npm view agile-context-engineering version`
3. Compares versions
4. Writes result to `~/.claude/cache/ace-update-check.json`:
   ```json
   {
     "update_available": true,
     "installed": "0.2.2",
     "latest": "0.3.0",
     "checked": 1711000000
   }
   ```

### Statusline Indicator

`hooks/ace-statusline.js` reads the cache file and shows a yellow `⬆ /ace:update` indicator when `update_available` is true.

### Update Flow

When the user runs `/ace:update`:

1. Detects installation type (local/global, Claude/Crush)
2. Checks npm for latest version
3. **Fetches CHANGELOG.md** (local copy first, falls back to GitHub raw URL)
4. **Extracts and displays "What's New"** — all entries between installed and latest versions
5. Shows clean install warning (what gets wiped vs preserved)
6. Asks user for confirmation
7. Runs `npx agile-context-engineering --{runtime} --{scope}`
8. Clears update cache
9. Shows restart reminder with link to full changelog

## Files Involved

| File | Purpose |
|------|---------|
| `CHANGELOG.md` | Source of truth for release notes |
| `package.json` | Version field, npm metadata, files list |
| `.github/workflows/release.yml` | Automated release + npm publish on tag push |
| `bin/install.js` | Copies CHANGELOG.md to install directory |
| `hooks/ace-check-update.js` | Background update checker (SessionStart hook) |
| `hooks/ace-statusline.js` | Statusline update indicator |
| `commands/ace/update.md` | User-facing `/ace:update` command |
| `agile-context-engineering/workflows/update.xml` | Update workflow with changelog display |

## Troubleshooting

### GitHub Release not created
- Check that the tag starts with `v` (e.g., `v0.3.0`, not `0.3.0`)
- Check Actions tab for workflow run errors
- Ensure the version has an entry in CHANGELOG.md

### npm publish fails
- Verify `NPM_TOKEN` secret is set in repo settings
- Check the token hasn't expired
- Ensure `package.json` version matches the tag (npm rejects duplicate versions)

### Users don't see update
- The background check runs once per session — user needs to restart Claude Code
- Check that `npm view agile-context-engineering version` returns the new version
- npm registry propagation can take a few minutes
