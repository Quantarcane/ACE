---
name: map-cross-cutting
description: Create or update a cross-cutting concern doc in .docs/wiki/subsystems/[name]/cross-cutting/ — shared infrastructure spanning multiple systems
argument-hint: "text='Event system used across all drawing components' subsystem='qarc-charts-v2' commits=3"
disable-model-invocation: true
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Edit
  - AskUserQuestion
model: opus
effort: max
context: fork
agent: ace-wiki-mapper
---

## Supporting Resources (auto-loaded)

!`cat "${CLAUDE_SKILL_DIR}/workflow.xml"`

!`cat "${CLAUDE_SKILL_DIR}/system-cross-cutting.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/questioning.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md"`

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>When a cross-cutting concern needs dedicated documentation</trigger>
            <trigger>After implementing shared infrastructure that multiple systems depend on</trigger>
            <trigger>When agents need to understand how to register with or plug into shared concerns</trigger>
        </runs-after>
        <use-when>
            <condition>A concern spans multiple domain systems within a subsystem</condition>
            <condition>Multiple systems register with or depend on this infrastructure</condition>
            <condition>An agent needs to know WHERE to register and HOW to interact with the concern</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
                <param name="text" type="text">
                    Natural language description of the cross-cutting concern to document.
                    Describes WHAT the concern addresses, which systems it spans.

                    E.g.:
                    - "Event system used across all drawing components"
                    - "Dependency injection container and service registration"
                    - "Authentication middleware and authorization pipeline"

                    If not provided, pause and ask the user.
                </param>
                <param name="subsystem" type="path | text">
                    Subsystem where this cross-cutting doc belongs.
                    Wiki location: `.docs/wiki/subsystems/[subsystem]/cross-cutting/`.
                    If not provided, pause and ask the user.
                </param>
            </required>

            <optional>
                <param name="story-context" type="path | GitHub issue">
                    Path to story artifacts folder (in `.ace/artifacts/`) OR GitHub issue
                    number/URL. Provides context about a story that introduced or modified
                    this cross-cutting concern.
                    When not provided, the agent discovers the concern from codebase analysis.
                </param>
                <param name="commits" type="number | comma-separated commit SHAs">
                    Specifies which commits to analyze for understanding what was built/changed.
                    As a number: analyze the N most recent commits (e.g., commits=3).
                    As commit SHAs: analyze specific commits (e.g., commits='abc123,def456').
                    When not provided: search the codebase directly using the text description
                    to find all registration points, usages, and integration points.
                </param>
            </optional>
        </parameters>
    </input>

    <execution-context>
        <!-- All supporting files are auto-loaded in the Supporting Resources section above.
             The model does NOT need to Read these files — they are already in context. -->
    </execution-context>

    <output>
        <objective>
            Create or update a cross-cutting concern document that describes shared
            infrastructure spanning multiple systems — how it works, registration/setup
            points, usage patterns, current registrations, integration points, and gotchas.

            The document an AI agent reads to understand how to register with or plug
            into shared concerns when implementing new features.
        </objective>

        <artifacts>
            .docs/wiki/subsystems/[subsystem-name]/cross-cutting/[concern-name].md
        </artifacts>
    </output>

    <process>
        For this command use the `ace-wiki-mapper` agent
        that's specialized in wiki exploration and documentation writing.

        Execute the map-cross-cutting workflow from
        `workflow.xml` end-to-end.
        Preserve all workflow gates (validation, user questions, commits).
    </process>

    <next-steps>
        <step>/clear first for a fresh context window</step>
        <step>/ace:map-cross-cutting — create another cross-cutting concern doc</step>
        <step>/ace:map-sys-doc — document a system that uses this concern</step>
        <step>/ace:map-guide — create a guide that includes registration steps</step>
        <step>Review file at .docs/wiki/subsystems/[subsystem-name]/cross-cutting/</step>
    </next-steps>

</command>
```
