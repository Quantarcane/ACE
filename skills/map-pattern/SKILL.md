---
name: map-pattern
description: Create or update a pattern document in .docs/wiki/subsystems/[name]/patterns/ — reusable implementation patterns
argument-hint: "text='Template Method pattern used by all drawing paths' subsystem='qarc-charts-v2' commits=3"
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

!`cat "${CLAUDE_SKILL_DIR}/pattern.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/questioning.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md"`

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>When a reusable structural pattern needs documentation</trigger>
            <trigger>After identifying a recurring approach used by 2+ implementations</trigger>
            <trigger>When agents need to understand HOW to implement something following an established pattern</trigger>
        </runs-after>
        <use-when>
            <condition>A structural approach appears across 2+ implementations</condition>
            <condition>New code must follow the same pattern for consistency</condition>
            <condition>An agent needs to know the abstract structure + concrete steps to add a new implementation</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
                <param name="text" type="text">
                    Natural language description of the pattern to document. Describes WHAT
                    the pattern is and WHERE it appears in the codebase.

                    E.g.:
                    - "Template Method pattern used by all drawing paths"
                    - "Repository pattern for all database access"
                    - "CQRS command/query handler pattern"

                    If not provided, pause and ask the user.
                </param>
                <param name="subsystem" type="path | text">
                    Subsystem where this pattern doc belongs.
                    Wiki location: `.docs/wiki/subsystems/[subsystem]/patterns/`.
                    If not provided, pause and ask the user.
                </param>
            </required>

            <optional>
                <param name="story-context" type="path | GitHub issue">
                    Path to story artifacts folder (in `.ace/artifacts/`) OR GitHub issue
                    number/URL. Provides context about a story that introduced or modified
                    this pattern.
                    When not provided, the agent discovers the pattern from codebase analysis.
                </param>
                <param name="commits" type="number | comma-separated commit SHAs">
                    Specifies which commits to analyze for understanding pattern changes.
                    As a number: analyze the N most recent commits (e.g., commits=3).
                    As commit SHAs: analyze specific commits (e.g., commits='abc123,def456').
                    When not provided: search the codebase directly to find all implementations
                    and extract the pattern structure.
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
            Create or update a pattern document that describes a reusable structural approach —
            structure diagram (mermaid classDiagram), how it works step-by-step, how to apply
            it for new implementations, current implementations list, and gotchas.

            The document an AI agent reads to ensure new code follows established conventions.
        </objective>

        <artifacts>
            .docs/wiki/subsystems/[subsystem-name]/patterns/[pattern-name].md
        </artifacts>
    </output>

    <process>
        For this command use the `ace-wiki-mapper` agent
        that's specialized in wiki exploration and documentation writing.

        Execute the map-pattern workflow from
        `workflow.xml` end-to-end.
        Preserve all workflow gates (validation, user questions, commits).
    </process>

    <next-steps>
        <step>/clear first for a fresh context window</step>
        <step>/ace:map-pattern — create another pattern document</step>
        <step>/ace:map-guide — create a guide that uses this pattern</step>
        <step>/ace:map-sys-doc — document a system that uses this pattern</step>
        <step>Review file at .docs/wiki/subsystems/[subsystem-name]/patterns/</step>
    </next-steps>

</command>
```
