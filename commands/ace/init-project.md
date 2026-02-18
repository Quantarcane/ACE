---
name: gsd:init-project
description: Initialize a new project with deep context gathering and product-vision.xml
argument-hint: "[--auto]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---

```xml
<command>

    <execution-time></execution-time>
    
    <input>
        <flags></flags>
        <parameters>
            <required></required>
            <optional>
                - **context** (file|text) Context text or file containing initial specs as a starting point that need to be refined by this command
            </optional>
        </parameters>
    </input>

    <output>
        <objective>
            Initialize the project following the flow: questioning → [TODO]research (optional) → [TODO]requirements → [TODO]roadmap.
            Create the documents outlined in "artifacts" tag.
        </objective>
        
        <artifacts>
            <product-vision>.docs/product/product-vision.md</product-vision>
            <config-settings>.ace/settings.json</config-settings>
            <domain-research>.ace/artifacts/research/ [TODO]</domain-research>
            <state>.ace/artifacts/state.md [TODO]</state>
        </artifacts>
    </output>

    <execution-context>
        <init-project>@~/.claude/agile-context-engineering/workflows/init-project.xml</init-project>
        <questioning>@~/.claude/agile-context-engineering/utils/questioning.xml</questioning>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
        <product-vision>@~/.claude/agile-context-engineering/templates/product-vision.xml</product-vision>
        <product-vision></product-vision>
    </execution-context>
    
    <process>
        Execute the init-project workflow from `@~/.claude/agile-context-engineering/workflows/init-project.xml` end-to-end.
        Preserve all workflow gates (validation, approvals, commits, routing).
    </process>

    <success_criteria>
    </success_criteria>
    
    <next-steps>
        **After this command:** Run `/ace:plan-phase 1` to start execution. [TODO] 
    </next-steps>

</command>
```