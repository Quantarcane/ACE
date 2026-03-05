---
name: ace:plan-backlog
description: Create or refine the product backlog through vision-aware questioning, wiki analysis, and guided epic/feature planning
argument-hint: "[optional: context='text, file, or URL with product description and suggested epics/features']"
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
        <runs-after>
            <trigger>After /ace:plan-product-vision — once the vision exists, plan what to build</trigger>
            <trigger>After /ace:map-system — once architecture is mapped, leverage wiki context for richer backlog</trigger>
            <trigger>Anytime — to create or refresh the product backlog</trigger>
        </runs-after>
        <use-when>
            <condition>Product vision exists and you want to break it into epics and features</condition>
            <condition>Starting implementation planning and need a structured backlog</condition>
            <condition>Brownfield project where features need to be inventoried from existing code</condition>
            <condition>Updating the backlog after scope changes or new discoveries</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
            </required>

            <optional>
                <param name="context" type="file | text">
                    Product description, suggested epics/features, PRD excerpts, or any
                    context to seed the backlog planning process. Will be absorbed and
                    refined through questioning, not used as-is.
                </param>
            </optional>
        </parameters>
    </input>

    <execution-context>
        <plan-backlog-workflow>@~/.claude/agile-context-engineering/workflows/plan-backlog.xml</plan-backlog-workflow>
        <product-backlog-template>@~/.claude/agile-context-engineering/templates/product/product-backlog.xml</product-backlog-template>
        <questioning>@~/.claude/agile-context-engineering/utils/questioning.xml</questioning>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Detect the project environment, load the product vision as the north-star input,
            optionally analyze the wiki for existing capabilities and feature status,
            optionally research the domain ecosystem for standard features,
            absorb any user-provided context, conduct deep questioning to discover all
            epics and features, and generate a comprehensive product-backlog.md.
        </objective>

        <artifacts>
            .ace/artifacts/product/product-backlog.md
        </artifacts>
    </output>

    <process>
        Execute the plan-backlog workflow from
        `@~/.claude/agile-context-engineering/workflows/plan-backlog.xml` end-to-end.
        Preserve all workflow gates (validation, approvals, commits).
    </process>

    <next-steps>
        **After this command:**
        - `/ace:plan-feature E1` — Break an feature into detailed stories
        - `/ace:help` — Check project initialization status
        - `/ace:plan-product-vision` — Update the product vision if priorities shifted
    </next-steps>

</command>
```
