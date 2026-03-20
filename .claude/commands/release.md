---
name: release
description: Release a new version of ACE — updates changelog from commits, bumps version, pushes tag, monitors CI, verifies npm publish
argument-hint: "<patch|minor|major>"
allowed-tools:
  - Bash
  - AskUserQuestion
  - Read
  - Edit
  - Grep
  - Glob
---

Automate the full ACE release pipeline as documented in `CICD.md`.

You MUST follow every step below in order. Do NOT skip any step. Do NOT proceed past a failing step.

## Input

The user provides the release type as `$ARGUMENTS`:
- `patch` — bug fixes (0.3.0 → 0.3.1)
- `minor` — new features (0.3.0 → 0.4.0)
- `major` — breaking changes (0.3.0 → 1.0.0)

If `$ARGUMENTS` is empty, ask the user which type they want (patch/minor/major).

## Step 1: Pre-flight Checks

Run ALL of these checks. If ANY fail, stop and report the issue.

```bash
# Must be on main branch
git branch --show-current
```
Abort if not on `main`.

```bash
# Must have clean working tree (npm version requires this)
git status --porcelain
```
Abort if there are uncommitted changes — tell the user to commit or stash first.

```bash
# Must be up to date with remote
git fetch origin main
git rev-list --count HEAD..origin/main
```
Abort if behind remote — tell the user to pull first.

```bash
# Get current version
node -p "require('./package.json').version"
```
Save as `CURRENT_VERSION`.

## Step 2: Determine New Version

Run `npm version $ARGUMENTS --dry-run` to calculate the new version WITHOUT applying it.
If that doesn't work, calculate it manually from `CURRENT_VERSION` based on the release type.

Save as `NEW_VERSION` (without the `v` prefix).

## Step 3: Gather Commits Since Last Release

```bash
# Find the latest version tag
git describe --tags --abbrev=0 2>/dev/null || echo "none"
```

If a tag exists, get all commits since that tag:
```bash
git log <last_tag>..HEAD --oneline --no-merges
```

If no tag exists, get all commits:
```bash
git log --oneline --no-merges
```

Save the commit list — you'll use it to write the changelog.

## Step 4: Generate Changelog Entry

Read `CHANGELOG.md` to understand the existing format and sections.

Analyze each commit message and categorize into:
- **Added** — new features, new commands, new files (commits starting with feat:, add, added, new, etc.)
- **Changed** — modifications to existing features (commits starting with update, change, adjust, improve, refactor, etc.)
- **Fixed** — bug fixes (commits starting with fix:, fixed, etc.)
- **Removed** — removed features or files (commits starting with remove, delete, etc.)

Write clear, user-facing bullet points (not raw commit messages). Group related commits into single entries where appropriate.

Replace the `## [Unreleased]` section in `CHANGELOG.md` with:

```markdown
## [Unreleased]

## [X.Y.Z] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

Only include sections (Added/Changed/Fixed/Removed) that have entries.

Also update the comparison links at the bottom of `CHANGELOG.md`:
- Change the `[Unreleased]` link to compare against the new version tag
- Add a new link for the new version

Show the user the generated changelog entry and ask for confirmation:
- "Looks good, proceed with release"
- "Let me edit it first" (if chosen, pause and let the user make edits, then continue)
- "Cancel release"

## Step 5: Commit Changelog

```bash
git add CHANGELOG.md
git commit -m "docs: update changelog for v$NEW_VERSION"
```

## Step 6: Bump Version

```bash
npm version $ARGUMENTS
```

This updates `package.json`, creates a commit, and creates the `v$NEW_VERSION` tag.

## Step 7: Push

```bash
git push origin main --tags
```

This pushes both commits and the tag, which triggers the GitHub Actions release workflow.

## Step 8: Monitor GitHub Actions

Wait a few seconds for the workflow to register, then find the run:

```bash
gh api repos/Quantarcane/ACE/actions/runs -q '.workflow_runs[0] | {id, name: .name, status, conclusion}'
```

If no run appears after 10 seconds, the workflow may not have triggered. Check and report the issue.

Once the run appears, watch it until completion:

```bash
gh run watch <RUN_ID> -R Quantarcane/ACE
```

**If the workflow fails:**
- Fetch the logs: `gh run view <RUN_ID> -R Quantarcane/ACE --log-failed`
- Report the failure to the user with the relevant error
- Do NOT proceed to verification

## Step 9: Verify GitHub Release

```bash
gh release view v$NEW_VERSION -R Quantarcane/ACE
```

Confirm the release exists and has the changelog notes in the body.

## Step 10: Verify npm Publish

```bash
npm view agile-context-engineering version
```

Confirm the version returned matches `$NEW_VERSION`.

If it doesn't match, wait 10 seconds and try again (npm registry propagation delay). If it still doesn't match after 3 attempts, report the failure.

## Step 11: Deploy Locally

Run the installer to update the local development copy:

```bash
node bin/install.js --claude --global
```

## Step 12: Report Success

Display a summary:

```
============================================================
  ACE v$NEW_VERSION Released Successfully
============================================================

  Changelog:  Updated with N entries
  Git tag:    v$NEW_VERSION
  GitHub:     https://github.com/Quantarcane/ACE/releases/tag/v$NEW_VERSION
  npm:        agile-context-engineering@$NEW_VERSION
  Local:      Deployed to ~/.claude/

============================================================
```
