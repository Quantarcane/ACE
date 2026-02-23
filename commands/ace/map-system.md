---
name: ace:map-system
description: Map system-wide codebase structure, architecture, and testing framework into .docs/wiki/system-wide/
argument-hint: "[optional: references='existing artifacts and documents to be considered alongside the codebase']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
  - AskUserQuestion
---

```xml
<command>

    <execution-time>
        **This command can run:**
        - Before /ace:init-project (brownfield codebases) — understand existing code first
        - After /ace:init-project (greenfield codebases) — document architecture decisions
        - Anytime to refresh system-wide wiki documents

        **Use this command when:**
        - Onboarding to an existing codebase (brownfield — analyzes code automatically)
        - Starting a new project and need to document architecture decisions (greenfield — interviews you)
        - System-wide documents are stale or missing
        - After major refactoring that changed subsystem boundaries or tech stack
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
            </required>

            <optional>
                - **references** (file|text) — Existing architecture docs, ADRs, or design notes
                  to consider alongside the codebase analysis. Absorbed before analysis begins.
            </optional>
        </parameters>
    </input>

    <execution-context>
        <map-system-workflow>@~/.claude/agile-context-engineering/workflows/map-system.xml</map-system-workflow>
        <system-structure-template>@~/.claude/agile-context-engineering/templates/wiki/system-structure.xml</system-structure-template>
        <system-architecture-template>@~/.claude/agile-context-engineering/templates/wiki/system-architecture.xml</system-architecture-template>
        <testing-framework-template>@~/.claude/agile-context-engineering/templates/wiki/testing-framework.xml</testing-framework-template>
        <questioning>@~/.claude/agile-context-engineering/utils/questioning.xml</questioning>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Detect brownfield/greenfield status and existing wiki state. For each system-wide
            document (structure, architecture, testing), determine whether to create, update,
            recreate, scaffold, or skip. Spawn ace-wiki-mapper agents to produce documents.
            For greenfield architecture, conduct deep questioning before generating.
            Add CLAUDE.md instructions to keep wiki current with future code changes.
        </objective>

        <artifacts>
            - .docs/wiki/system-wide/system-structure.md
            - .docs/wiki/system-wide/system-architecture.md
            - .docs/wiki/system-wide/testing-framework.md
            - CLAUDE.md (wiki maintenance instructions appended)
        </artifacts>
    </output>

    <process>
        Execute the map-system workflow from
        `@~/.claude/agile-context-engineering/workflows/map-system.xml` end-to-end.
        Preserve all workflow gates (validation, user questions, commits).
    </process>

    <next-steps>
        **After this command, `/clear` first for a fresh context window, then:**
        - `/ace:map-subsystems` — Map individual subsystem internals (structure, dependencies)
        - `/ace:init-coding-standards` — Define prescriptive coding standards
        - `/ace:init-project` — Initialize full project with product vision
        - Review and edit files in `.docs/wiki/system-wide/` anytime
    </next-steps>

</command>
```
