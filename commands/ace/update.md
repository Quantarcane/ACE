---
name: ace:update
description: Update ACE to latest version
argument-hint: ""
allowed-tools:
  - Bash
  - AskUserQuestion
---

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>When statusline shows the update indicator</trigger>
            <trigger>When user wants to check for or install ACE updates</trigger>
        </runs-after>
    </execution-time>

    <input>
        <parameters>
            <required></required>
            <optional></optional>
        </parameters>
    </input>

    <execution-context>
        <update-workflow>@~/.claude/agile-context-engineering/workflows/update.xml</update-workflow>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Check for ACE updates, install if available.
            Automatically detects local vs global installation and Claude vs Crush runtime.
        </objective>
    </output>

    <process>
        Execute the update workflow from
        `@~/.claude/agile-context-engineering/workflows/update.xml` end-to-end.

        The workflow handles all logic including:
        1. Installation detection (local/global, Claude/Crush)
        2. Latest version checking via npm
        3. Version comparison
        4. Clean install warning display
        5. User confirmation
        6. Update execution
        7. Cache clearing and restart reminder
    </process>

</command>
```
