---
name: ace:map-subsystem
description: Map a subsystem's structure, architecture, and knowledge docs into .docs/wiki/subsystems/[name]/
argument-hint: "subsystem='src/api' (or subsystem name) existing-docs=comma separated paths | directory"
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
        <runs-after>
            <trigger>After /ace:map-system — drill into individual subsystems</trigger>
            <trigger>Anytime to refresh an existing subsystem's wiki documents</trigger>
            <trigger>When a new subsystem is added and needs to be documented</trigger>
        </runs-after>
        <use-when>
            <condition>A subsystem has not yet been documented in `.docs/wiki/subsystems/`</condition>
            <condition>An existing subsystem's docs are stale after a significant refactor</condition>
            <condition>You want a deep-dive view of a specific subsystem's internals (components, flows, data)</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
                <param name="subsystem" type="path | text">
                    Path to the subsystem (e.g., `src/api`) or its name.
                    If not provided, pause execution and ask the user for it.
                    If provided but ambiguous, or not found in the codebase, ask clarifying questions.
                </param>
            </required>

            <optional>
                <param name="existing-docs" type="comma-separated paths or directories">
                    Pre-existing documentation relevant to this subsystem. Accepts file paths,
                    directory paths, or a mix of both. When a directory is provided, recursively
                    discover all files within it (including nested subdirectories).
                    All resolved file paths are passed through to every map-story invocation
                    (file mode) alongside any per-module docs discovered during module-discovery.
                    Use this when the caller already knows about documentation that should
                    inform knowledge-doc generation.
                </param>
            </optional>
        </parameters>
    </input>

    <execution-context>
        <map-subsystem-workflow>@~/.claude/agile-context-engineering/workflows/map-subsystem.xml</map-subsystem-workflow>
        <subsystem-structure-template>@~/.claude/agile-context-engineering/templates/wiki/subsystem-structure.xml</subsystem-structure-template>
        <subsystem-architecture-template>@~/.claude/agile-context-engineering/templates/wiki/subsystem-architecture.xml</subsystem-architecture-template>
        <module-discovery-template>@~/.claude/agile-context-engineering/templates/wiki/module-discovery.xml</module-discovery-template>
        <map-story-workflow>@~/.claude/agile-context-engineering/workflows/map-story.xml</map-story-workflow>
        <system-template>@~/.claude/agile-context-engineering/templates/wiki/system.xml</system-template>
        <pattern-template>@~/.claude/agile-context-engineering/templates/wiki/pattern.xml</pattern-template>
        <cross-cutting-template>@~/.claude/agile-context-engineering/templates/wiki/system-cross-cutting.xml</cross-cutting-template>
        <guide-template>@~/.claude/agile-context-engineering/templates/wiki/guide.xml</guide-template>
        <decisions-template>@~/.claude/agile-context-engineering/templates/wiki/decizions.xml</decisions-template>
        <questioning>@~/.claude/agile-context-engineering/utils/questioning.xml</questioning>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Resolve the target subsystem, load system-wide wiki context, and determine whether
            to create, update, or recreate per-subsystem wiki documents. Then:

            1. Spawn ace-wiki-mapper agents to produce structure and architecture documents.
            2. Update system-structure.md if this subsystem was not previously listed there.
            3. Update the subsystem responsibility matrix in system-architecture.md if missing.
            4. Run module discovery — trace E2E flows, identify patterns, find cross-cutting
               concerns by reading actual source code. Produce module-discovery.md artifact.
            5. For EACH discovered module, run map-story in file mode to create or update
               knowledge documentation (systems/, patterns/, cross-cutting/, guides/, decisions/).
        </objective>

        <artifacts>
            - .docs/wiki/subsystems/[subsystem-name]/structure.md
            - .docs/wiki/subsystems/[subsystem-name]/architecture.md
            - .docs/wiki/subsystems/[subsystem-name]/systems/*.md (created/updated by map-story)
            - .docs/wiki/subsystems/[subsystem-name]/patterns/*.md (created/updated by map-story)
            - .docs/wiki/subsystems/[subsystem-name]/cross-cutting/*.md (created/updated by map-story)
            - .docs/wiki/subsystems/[subsystem-name]/guides/*.md (created/updated by map-story)
            - .docs/wiki/subsystems/[subsystem-name]/decisions/*.md (created/updated by map-story)
            - .ace/artifacts/subsystems/[subsystem-name]/module-discovery/module-discovery.md
            - .ace/artifacts/subsystems/[subsystem-name]/module-discovery/existing-docs-inventory.md (if existing-docs directory provided)
            - .docs/wiki/system-wide/system-structure.md (subsystem entry added if new)
            - .docs/wiki/system-wide/system-architecture.md (subsystem responsibility matrix updated if missing)
        </artifacts>
    </output>

    <process>
        Execute the map-subsystem workflow from
        `@~/.claude/agile-context-engineering/workflows/map-subsystem.xml` end-to-end.
        Preserve all workflow gates (validation, user questions, commits).

        The workflow has 13 steps:
        1-5: Setup, context loading, subsystem resolution, document triage, directory creation
        6-8: Structure + architecture agents (parallel) + collect results
        9: Update system-wide docs (system-structure.md, system-architecture.md)
        10: Module discovery (3 parallel discovery agents + 1 synthesis agent)
        11: Knowledge documentation — run map-story for EACH discovered module (sequential)
        12: Verify and commit all documents
        13: Completion report

        Steps 10-11 are CRITICAL — they produce the knowledge docs (systems/, patterns/,
        cross-cutting/, guides/, decisions/) that AI agents need for future implementations.
        Do NOT skip them.
    </process>

     <next-steps>
        **After this command, `/clear` first for a fresh context window, then:**

        For each subsystem found and defined in the Subsystem Responsibility Matrix,
        suggest a `/ace:map-subsystem` command. Example:
        - `/ace:map-subsystem subsystem="src/api"` — Map the API subsystem
        - `/ace:map-subsystem subsystem="src/auth"` — Map the Auth subsystem
        - `/ace:map-subsystem subsystem="src/db"` — Map the DB subsystem
        (list one per subsystem discovered during this command's execution)

        Also suggest:
        - `/ace:init-coding-standards` — Define prescriptive coding standards
        - `/ace:init-project` — Check overall project initialization status
        - Review and edit files in `.docs/wiki/system-wide/` anytime
    </next-steps>

</command>
```
