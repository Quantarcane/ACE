---
name: ace:help
description: Check project initialization status and suggest next steps
argument-hint: ""
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---

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
        <help-workflow>@~/.claude/agile-context-engineering/workflows/help.xml</help-workflow>
        <questioning>@~/.claude/agile-context-engineering/utils/questioning.xml</questioning>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
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
        `@~/.claude/agile-context-engineering/workflows/help.xml` end-to-end.
        This is a lightweight state-check and routing workflow.
    </process>

    <next-steps>
        **Specialized commands for each document:**
        - `/ace:plan-product-vision` — Create or update the product vision
        - `/ace:map-system` — Map codebase structure, architecture, and testing framework
        - `/ace:init-coding-standards` — Generate tailored coding standards
    </next-steps>

</command>
```
