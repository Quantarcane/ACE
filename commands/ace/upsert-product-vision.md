---
name: ace:upsert-product-vision
description: Create or update the product vision through architecture-aware questioning and guided writing
argument-hint: "[optional: context='PRD, specs, or notes to build on']"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---

```xml
<command>

    <execution-time>
        **This command can run:**
        - During /ace:init-project — as part of initial project setup
        - After /ace:map-system — once codebase is mapped, leverage architecture context
        - Anytime — to create or refresh the product vision for a project

        **Use this command when:**
        - Starting a new project and want to define the product vision (greenfield or brownfield)
        - Existing product vision is outdated or missing
        - System architecture has been mapped and you want to align vision with subsystem capabilities
        - Pivoting the product direction and need to rewrite the vision
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
            </required>

            <optional>
                - **context** (file|text) — Existing PRD, specs, or notes to use as a starting point.
                  Will be refined through the interview process, not used as-is.
            </optional>
        </parameters>
    </input>

    <execution-context>
        <upsert-product-vision-workflow>@~/.claude/agile-context-engineering/workflows/upsert-product-vision.xml</upsert-product-vision-workflow>
        <product-vision-template>@~/.claude/agile-context-engineering/templates/product/product-vision.xml</product-vision-template>
        <questioning>@~/.claude/agile-context-engineering/utils/questioning.xml</questioning>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Detect the project's brownfield/greenfield status and architecture context.
            If brownfield with system architecture, use the Subsystem Responsibility Matrix
            to inform high-level capabilities. Interview the user about their product vision,
            goals, and audience. Generate a comprehensive product-vision.md.
        </objective>

        <artifacts>
            .docs/product/product-vision.md
        </artifacts>
    </output>

    <process>
        Execute the upsert-product-vision workflow from
        `@~/.claude/agile-context-engineering/workflows/upsert-product-vision.xml` end-to-end.
        Preserve all workflow gates (validation, approvals, commits).
    </process>

    <next-steps>
        **After this command:**
        - `/ace:init-coding-standards` — Establish coding standards for the project
        - `/ace:map-system` — Map codebase structure and architecture
        - `/ace:init-project` — Check overall project initialization status
    </next-steps>

</command>
```
