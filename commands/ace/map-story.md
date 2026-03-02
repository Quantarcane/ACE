---
name: ace:map-story
description: Update living knowledge docs — either after a story implementation (git-based) or for existing undocumented code (file-based, called by map-subsystem)
argument-hint: "story-context='.ace/artifacts/...' commits=3  |  files='a.ts,b.ts' module-name='User Management' subsystem-name='api'"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Edit
  - Task
  - AskUserQuestion
---

```xml
<command>

    <execution-time>
        <mode name="story" invoked-by="user">
            <trigger>After a story is implemented and tested</trigger>
            <trigger>Analyzes git changes (diff) to determine what was built</trigger>
            <trigger>Reads story artifacts for intent context</trigger>
            <trigger>Detects affected subsystem(s) from changed file paths</trigger>
            <trigger>Creates or updates living knowledge docs to reflect the CURRENT system state</trigger>
        </mode>
        <mode name="file" invoked-by="map-subsystem Step 8.7">
            <trigger>Called automatically during subsystem mapping</trigger>
            <trigger>Receives a curated file list + module metadata from module-discovery</trigger>
            <trigger>Documents existing undocumented code — no git diff needed</trigger>
            <trigger>Receives pre-curated existing documentation as additional context</trigger>
        </mode>
        <use-when mode="story">
            <condition>You just finished implementing and testing a story</condition>
            <condition>You want to update docs to reflect recent code changes</condition>
            <condition>You want to capture decisions and patterns from a recent implementation</condition>
        </use-when>
        <use-when mode="file">
            <condition>/ace:map-subsystem — for each module row in module-discovery.md</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <mode-detection>
                <rule>If `files` is provided -> file mode</rule>
                <rule>If `story-context` is provided -> story mode</rule>
                <rule>If neither is provided -> story mode (staged + unstaged changes)</rule>
            </mode-detection>

            <story-mode>
                <required></required>
                <optional>
                    <param name="story-context" type="path">
                        Path to story artifacts folder (in `.ace/artifacts/` or legacy `documentation/features/`).
                        Used to understand WHAT the story intended to build.
                        If not provided, the agent relies solely on git changes.
                    </param>
                    <param name="commits" type="number | comma-separated commit SHAs">
                        Specifies which commits to analyze.
                        As a number: analyze the N most recent commits (e.g., commits=3).
                        As commit SHAs: analyze specific commits (e.g., commits='abc123,def456').
                        When not provided: analyze staged + unstaged changes (git diff + git diff --cached).
                    </param>
                </optional>
            </story-mode>

            <file-mode>
                <required>
                    <param name="files" type="comma-separated paths">
                        Source code files to document. These are the files discovered by
                        module-discovery (Step 8.5) that together form one coherent module.
                    </param>
                    <param name="module-name" type="text">
                        Human-readable name of the module (e.g., "User Management", "Repository Pattern").
                    </param>
                    <param name="subsystem-name" type="text">
                        Name of the subsystem this module belongs to.
                    </param>
                </required>
                <optional>
                    <param name="existing-docs" type="comma-separated paths or directories">
                        Pre-existing documentation relevant to this module. Accepts file paths,
                        directory paths, or a mix of both. When a directory is provided,
                        recursively discover all files within it (including nested subdirectories).
                        Typically curated by module-discovery's synthesis agent or passed through
                        from map-subsystem. Read these FIRST for additional context about intent,
                        decisions, and history. The actual source code remains the source of truth;
                        existing docs provide the WHY.
                    </param>
                </optional>
            </file-mode>
        </parameters>
    </input>

    <execution-context>
        <map-story-workflow>@~/.claude/agile-context-engineering/workflows/map-story.xml</map-story-workflow>

        <system>@~/.claude/agile-context-engineering/templates/wiki/system.xml</system>
        <system-cross-cutting>@~/.claude/agile-context-engineering/templates/wiki/system-cross-cutting.xml</system-cross-cutting>
        <pattern>@~/.claude/agile-context-engineering/templates/wiki/pattern.xml</pattern>
        <guide>@~/.claude/agile-context-engineering/templates/wiki/guide.xml</guide>
        <decizions>@~/.claude/agile-context-engineering/templates/wiki/decizions.xml</decizions>

        <questioning>@~/.claude/agile-context-engineering/utils/questioning.xml</questioning>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Read the provided source code files (and any existing docs for context),
            then autonomously create or update living knowledge documents.
            One call may produce multiple docs across different categories
            (systems/, patterns/, cross-cutting/, guides/, decisions/).

            In story mode: analyze git changes to determine what was built, detect
            affected subsystem(s), and update/create docs to reflect the CURRENT system state.

            In file mode: document existing undocumented code from the provided file list.
        </objective>

        <artifacts>
            .docs/wiki/subsystems/[subsystem-name]/systems/[system-name].md
            .docs/wiki/subsystems/[subsystem-name]/patterns/[pattern-name].md
            .docs/wiki/subsystems/[subsystem-name]/cross-cutting/[concern-name].md
            .docs/wiki/subsystems/[subsystem-name]/guides/[guide-name].md
            .docs/wiki/subsystems/[subsystem-name]/decisions/[decision-name].md
        </artifacts>
    </output>

    <process>
        Execute the map-story workflow from
        `@~/.claude/agile-context-engineering/workflows/map-story.xml` end-to-end.
        Preserve all workflow gates (validation, user questions, commits).
    </process>

    <next-steps>
        <step>/clear first for a fresh context window</step>
        <step>/ace:map-story — document another story or module</step>
        <step>/ace:map-subsystem [subsystem] — map or refresh an entire subsystem</step>
        <step>Review and edit files in .docs/wiki/subsystems/[subsystem-name]/</step>
    </next-steps>

</command>
```
