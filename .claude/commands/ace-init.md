# /ace:init - Initialize ACE in Your Project

Initialize Agile Context Engineering (ACE) for spec-driven development with Claude Code or OpenCode.

## Usage

```
/ace:init [--github]
```

### Options

- `--github` - Create items as GitHub issues instead of local files (requires `gh` CLI)

## Behavior

When invoked, this command will:

1. **Check prerequisites**
   - Verify you're in a git repository
   - Check if ACE is already initialized
   - If `--github` flag is used, verify `gh` CLI is authenticated

2. **Create ACE directory structure**
   ```
   .ace/
   ├── config.json          # ACE configuration
   ├── backlog/             # Epic and feature definitions
   ├── sprints/             # Sprint planning and tracking
   └── research/            # Domain research and findings
   ```

3. **Create initial project files**
   - `PROJECT.md` - Project vision and goals
   - `BACKLOG.md` - Product backlog overview
   - `STATE.md` - Current project state and decisions

4. **Configure GitHub integration** (if `--github` flag used)
   - Create GitHub labels for epics, features, stories
   - Set up issue templates

## Instructions for Claude

<ace-init>

### Step 1: Verify Prerequisites

Check if we're in a git repository:
```bash
git rev-parse --is-inside-work-tree
```

Check if ACE is already initialized:
- Look for `.ace/config.json` file
- If exists, ask user if they want to reinitialize

### Step 2: Gather Project Information

Ask the user for:
1. **Project name** - What is this project called?
2. **Project description** - One-line description of what this project does
3. **Storage preference** - Local files or GitHub issues?
4. **GitHub integration** - If GitHub, which repo? (auto-detect from git remote if possible)

### Step 3: Create Directory Structure

Create the following structure:

```
.ace/
├── config.json
├── backlog/
├── sprints/
└── research/
```

### Step 4: Create Configuration File

Create `.ace/config.json`:

```json
{
  "version": "0.1.0",
  "projectName": "<project-name>",
  "description": "<project-description>",
  "storage": "local|github",
  "github": {
    "enabled": false,
    "repo": null,
    "labels": {
      "epic": "ace:epic",
      "feature": "ace:feature",
      "story": "ace:story",
      "task": "ace:task"
    }
  },
  "createdAt": "<timestamp>",
  "hierarchy": {
    "levels": ["epic", "feature", "story", "task"],
    "current": {
      "epic": null,
      "feature": null,
      "story": null,
      "sprint": null
    }
  }
}
```

### Step 5: Create PROJECT.md

Create `PROJECT.md` in the repository root:

```markdown
# <Project Name>

> <One-line description>

## Vision

<!-- Describe the long-term vision for this project -->

## Goals

<!-- List 3-5 key goals this project aims to achieve -->

## Non-Goals

<!-- What is explicitly out of scope -->

## Success Criteria

<!-- How will you measure success? -->

---

*Managed with [ACE](https://github.com/agile-context-engineering/ace) - Agile Context Engineering*
```

### Step 6: Create BACKLOG.md

Create `BACKLOG.md` in the repository root:

```markdown
# Product Backlog

## Epics

<!-- Epics are large bodies of work that can be broken down into features -->

| ID | Epic | Status | Features |
|----|------|--------|----------|
| - | - | - | - |

## Prioritized Features

<!-- Features ready for sprint planning -->

| Priority | Feature | Epic | Stories | Status |
|----------|---------|------|---------|--------|
| - | - | - | - | - |

---

*Use `/ace:plan-epic` to add epics, `/ace:plan-feature` to break them into features*
```

### Step 7: Create STATE.md

Create `STATE.md` in the repository root:

```markdown
# Project State

> Last updated: <timestamp>

## Current Sprint

**Sprint:** None
**Goal:** N/A
**Status:** Not started

## Active Work

<!-- Currently in-progress items -->

| Item | Type | Assignee | Status |
|------|------|----------|--------|
| - | - | - | - |

## Decisions Log

<!-- Important decisions made during development -->

| Date | Decision | Context | Alternatives Considered |
|------|----------|---------|------------------------|
| - | - | - | - |

## Blockers

<!-- Current blockers and their status -->

| Blocker | Impact | Owner | Status |
|---------|--------|-------|--------|
| - | - | - | - |

## Context Notes

<!-- Important context for future sessions -->

---

*Updated automatically by ACE commands*
```

### Step 8: GitHub Setup (if enabled)

If GitHub integration is enabled:

1. Create labels:
```bash
gh label create "ace:epic" --color "7057ff" --description "ACE Epic - large body of work"
gh label create "ace:feature" --color "0075ca" --description "ACE Feature - deliverable functionality"
gh label create "ace:story" --color "008672" --description "ACE Story - user-facing work item"
gh label create "ace:task" --color "d73a4a" --description "ACE Task - technical work item"
gh label create "ace:blocked" --color "b60205" --description "ACE Blocked - waiting on dependency"
gh label create "ace:sprint" --color "fbca04" --description "ACE Sprint - current sprint item"
```

2. Update config.json with GitHub settings

### Step 9: Confirm Success

Output a summary:

```
✓ ACE initialized successfully!

Created:
  - .ace/config.json
  - .ace/backlog/
  - .ace/sprints/
  - .ace/research/
  - PROJECT.md
  - BACKLOG.md
  - STATE.md

Next steps:
  1. Edit PROJECT.md to define your vision and goals
  2. Run /ace:plan-project to create your initial epics
  3. Run /ace:plan-epic to break epics into features
```

</ace-init>
