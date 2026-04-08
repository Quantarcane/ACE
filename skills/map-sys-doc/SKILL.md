---
name: map-sys-doc
description: Create or update a system document in .docs/wiki/subsystems/[name]/systems/ — describes WHAT exists, HOW it works, WHERE things live
argument-hint: "text='Drawing system - manages all drawing tools on chart' subsystem='qarc-charts-v2' commits=3"
disable-model-invocation: false
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

!`cat "${CLAUDE_SKILL_DIR}/system.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/questioning.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md"`

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>When a coherent domain system needs dedicated documentation</trigger>
            <trigger>After implementing a new system or significantly changing an existing one</trigger>
            <trigger>When an AI agent needs a reference doc for a domain system before implementing stories</trigger>
        </runs-after>
        <use-when>
            <condition>A logical grouping of components delivers one domain capability</condition>
            <condition>The system spans multiple files with entry points, data flow, and state</condition>
            <condition>A system doc would benefit from dedicated focused analysis outside map-story</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
                <param name="text" type="text">
                    Natural language description of the system to document. Describes WHAT
                    the system does, its domain concern, and key components.

                    E.g.:
                    - "Drawing system - manages all drawing tools on the chart"
                    - "User authentication and authorization system"
                    - "Order processing pipeline from cart to confirmation"

                    If not provided, pause and ask the user.
                </param>
                <param name="subsystem" type="path | text">
                    Subsystem where this system doc belongs.
                    Wiki location: `.docs/wiki/subsystems/[subsystem]/systems/`.
                    If not provided, pause and ask the user.
                </param>
            </required>

            <optional>
                <param name="story-context" type="path | GitHub issue">
                    Path to story artifacts folder (in `.ace/artifacts/`) OR GitHub issue
                    number/URL. Provides intent context for WHY the system was built/changed.
                    When not provided, the agent relies solely on code analysis.
                </param>
                <param name="commits" type="number | comma-separated commit SHAs">
                    Specifies which commits to analyze for understanding what was built/changed.
                    As a number: analyze the N most recent commits (e.g., commits=3).
                    As commit SHAs: analyze specific commits (e.g., commits='abc123,def456').
                    When not provided: search the codebase directly using the text description.
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
            Create or update a system document that describes a coherent domain system —
            WHAT exists, HOW it works, WHERE things live. Includes file tree, system boundary
            diagram, class hierarchy, entry points, data flow sequence diagrams (mandatory),
            components, key behaviors, state management, error propagation, and constants/enums.

            The primary document an AI agent reads before implementing a related story.
        </objective>

        <artifacts>
            .docs/wiki/subsystems/[subsystem-name]/systems/[system-name].md
        </artifacts>
    </output>

    <process>
        For this command use the `ace-wiki-mapper` agent
        that's specialized in wiki exploration and documentation writing.

        Execute the map-sys-doc workflow from
        `workflow.xml` end-to-end.
        Preserve all workflow gates (validation, user questions, commits).
    </process>

    <next-steps>
        <step>/clear first for a fresh context window</step>
        <step>/ace:map-sys-doc — create another system document</step>
        <step>/ace:map-pattern — document a pattern used by this system</step>
        <step>/ace:map-guide — create a how-to guide for this system</step>
        <step>/ace:map-cross-cutting — document a cross-cutting concern</step>
        <step>Review file at .docs/wiki/subsystems/[subsystem-name]/systems/</step>
    </next-steps>

</command>
```
