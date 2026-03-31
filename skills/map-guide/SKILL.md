---
name: map-guide
description: Create or update a step-by-step guide in .docs/wiki/subsystems/[name]/guides/ — recipes for common implementation tasks
argument-hint: "text='How to add a new drawing tool' subsystem='qarc-charts-v2' commits=3"
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

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>When a recurring implementation task needs a step-by-step recipe</trigger>
            <trigger>After discovering a repeatable process that combines multiple patterns/systems</trigger>
            <trigger>When onboarding developers who need to perform common tasks</trigger>
        </runs-after>
        <use-when>
            <condition>A task is done repeatedly (add new endpoint, add new tool, add new entity)</condition>
            <condition>The task spans multiple files, registrations, and configuration steps</condition>
            <condition>An agent following the guide can complete the task end-to-end without guessing</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
                <param name="text" type="text">
                    Natural language description of the guide to create. Describes the
                    recurring task and what the guide should teach.

                    E.g.:
                    - "How to add a new drawing tool"
                    - "How to add a new CRUD endpoint with validation"
                    - "How to add a new indicator to the chart"

                    If not provided, pause and ask the user.
                </param>
                <param name="subsystem" type="path | text">
                    Subsystem where this guide belongs.
                    Wiki location: `.docs/wiki/subsystems/[subsystem]/guides/`.
                    If not provided, pause and ask the user.
                </param>
            </required>

            <optional>
                <param name="story-context" type="path | GitHub issue">
                    Path to story artifacts folder (in `.ace/artifacts/`) OR GitHub issue
                    number/URL. Provides context about a specific implementation that
                    exemplifies the task this guide describes.
                    When not provided, the agent discovers the recipe from codebase patterns.
                </param>
                <param name="commits" type="number | comma-separated commit SHAs">
                    Specifies which commits to analyze for understanding an example implementation.
                    As a number: analyze the N most recent commits (e.g., commits=3).
                    As commit SHAs: analyze specific commits (e.g., commits='abc123,def456').
                    When not provided: search the codebase directly to find existing implementations
                    and derive the recipe from them.
                </param>
            </optional>
        </parameters>
    </input>

    <execution-context>
        <map-guide-workflow>workflow.xml</map-guide-workflow>
        <guide-template>guide.xml</guide-template>
        <questioning>${CLAUDE_SKILL_DIR}/../../shared/utils/questioning.xml</questioning>
        <ui-formatting>${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Create or update a step-by-step guide that combines knowledge from multiple
            systems, patterns, and cross-cutting concerns into one actionable recipe.
            Includes prerequisites, numbered ordered steps with "copy from" references,
            verification checklist, and common mistakes.

            The document an AI agent follows when performing a recurring task end-to-end.
        </objective>

        <artifacts>
            .docs/wiki/subsystems/[subsystem-name]/guides/[guide-name].md
        </artifacts>
    </output>

    <process>
        For this command use the `ace-wiki-mapper` agent
        that's specialized in wiki exploration and documentation writing.

        Execute the map-guide workflow from
        `workflow.xml` end-to-end.
        Preserve all workflow gates (validation, user questions, commits).
    </process>

    <next-steps>
        <step>/clear first for a fresh context window</step>
        <step>/ace:map-guide — create another guide</step>
        <step>/ace:map-pattern — document a pattern referenced by this guide</step>
        <step>/ace:map-sys-doc — document a system referenced by this guide</step>
        <step>Review file at .docs/wiki/subsystems/[subsystem-name]/guides/</step>
    </next-steps>

</command>
```
