---
name: help
description: Check project initialization status and suggest next steps
argument-hint: ""
disable-model-invocation: false
allowed-tools: Read, Bash, Write, AskUserQuestion
model: sonnet
effort: medium
---

## Supporting Resources (auto-loaded)

!`cat "${CLAUDE_SKILL_DIR}/workflow.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/questioning.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md"`

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>At any time — to check which ACE documents exist and what to do next</trigger>
            <trigger>At the start of a new project — to see the initialization checklist</trigger>
        </runs-after>
        <use-when>
            <condition>Starting a new project and want to see what needs to be set up</condition>
            <condition>Returning to a project and want to check initialization status</condition>
            <condition>Unsure which ACE command to run next</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
            </required>

            <optional>
            </optional>
        </parameters>
    </input>

    <execution-context>
        <!-- All supporting files are auto-loaded in the Supporting Resources section above.
             The model does NOT need to Read these files — they are already in context. -->
    </execution-context>

    <output>
        <objective>
            Detect which ACE documents exist (product vision, system architecture, system structure,
            coding standards, testing framework). Display a status dashboard showing what's done
            and what's missing. Suggest the next command to run based on gaps.
        </objective>

        <artifacts>
            - .ace/settings.json (created on first run if missing)
        </artifacts>
    </output>

    <process>
        Execute the help workflow from
        `workflow.xml` end-to-end.
        This is a lightweight state-check and routing workflow.

        CRITICAL MANDATORY STEP — DO NOT SKIP:
        Before displaying the status dashboard, you MUST run:
        ```
