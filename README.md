# ACE - Agile Context Engineering

A spec-driven development system for AI coding assistants with Agile workflows.

## Supported Runtimes

- **Claude Code** - Anthropic's Claude Code CLI
- **OpenCode** - OpenCode AI coding assistant

## Installation

```bash
npx agile-context-engineering
```

### Options

```bash
npx agile-context-engineering --claude --local   # Claude Code, local install
npx agile-context-engineering --opencode --global # OpenCode, global install
npx agile-context-engineering --all --global      # All runtimes, global install
```

## Commands

| Command | Description |
|---------|-------------|
| `/ace:init` | Initialize ACE in your project |
| `/ace:plan-project` | Plan your project with epics and features |
| `/ace:plan-epic` | Break an epic into features |
| `/ace:plan-feature` | Break a feature into stories |
| `/ace:plan-story` | Create a new user story |
| `/ace:refine-story` | Prepare a story for execution |
| `/ace:execute-story` | Execute a story with atomic commits |
| `/ace:verify-story` | Verify a completed story |

## Workflow

```
Epic → Feature → Story → Tasks
  ↓       ↓        ↓       ↓
Plan → Refine → Execute → Verify
```

### Agile Hierarchy

- **Epic**: Large body of work (1-3 months)
- **Feature**: Deliverable functionality (1-2 sprints)
- **Story**: User-facing work item (1-3 days)
- **Task**: Atomic implementation step (30 min - 2 hours)

## Getting Started

1. Install ACE in your project:
   ```bash
   npx agile-context-engineering --claude --local
   ```

2. Initialize ACE:
   ```
   /ace:init
   ```

3. Plan your project:
   ```
   /ace:plan-project
   ```

4. Continue planning down the hierarchy:
   ```
   /ace:plan-epic E1
   /ace:plan-feature E1-F1
   /ace:plan-story E1-F1 "User can sign up"
   ```

5. Execute and verify:
   ```
   /ace:refine-story E1-F1-S1
   /ace:execute-story E1-F1-S1
   /ace:verify-story E1-F1-S1
   ```

## GitHub Integration

ACE can store epics, features, and stories as GitHub issues instead of local files.

Initialize with GitHub:
```
/ace:init --github
```

This creates GitHub labels and uses `gh` CLI for issue management.

## Installed Structure

The installer copies ACE files into your runtime's config directory:

```
~/.claude/                          # (or .opencode, or ./.claude for local)
├── commands/ace/                   # Slash commands
├── agents/                         # Agent definitions
└── agile-context-engineering/      # Reference material
    ├── templates/                  # Project & artifact templates
    ├── utils/                      # Formatting & utility guides
    └── workflows/                  # Workflow definitions
```

## Project Structure

```
.ace/
├── config.json      # ACE configuration
├── backlog/         # Epics and features
│   ├── E1-epic-name.md
│   └── E1/
│       └── F1-feature-name.md
├── sprints/         # Sprint planning
└── research/        # Research findings

PROJECT.md           # Project vision
BACKLOG.md          # Product backlog overview
STATE.md            # Current state and decisions
```

## License

MIT
