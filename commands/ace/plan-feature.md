---
name: ace:plan-feature
description: Plan a feature through backlog-aware questioning, story decomposition, and guided feature specification
argument-hint: "[feature-id] [optional: context='text or file with feature description prompt']"
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
            <trigger>After /ace:plan-backlog — once the backlog exists, plan individual features</trigger>
            <trigger>Anytime — to create or refine a feature and its story breakdown</trigger>
        </runs-after>
        <use-when>
            <condition>Product backlog exists and you want to break a feature into stories</condition>
            <condition>Starting feature-level planning and need to decompose into stories</condition>
            <condition>Refining an existing feature with updated acceptance criteria or scope</condition>
            <condition>Adding a new feature to an existing epic</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
            </required>

            <optional>
                <param name="feature-id" type="text">
                    Feature identifier from the product backlog (e.g., F3, #78).
                    If provided, locates existing feature for planning or refinement.
                    If omitted, presents the backlog for selection or allows creating
                    a new feature.
                </param>
                <param name="context" type="file | text">
                    Feature description, acceptance criteria, user stories, or any
                    context to seed the feature planning process. Will be absorbed and
                    refined through questioning, not used as-is.
                </param>
            </optional>
        </parameters>
    </input>

    <execution-context>
        <plan-feature-workflow>@~/.claude/agile-context-engineering/workflows/plan-feature.xml</plan-feature-workflow>
        <feature-template>@~/.claude/agile-context-engineering/templates/product/feature.xml</feature-template>
        <questioning>@~/.claude/agile-context-engineering/utils/questioning.xml</questioning>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Detect the project environment, load the product backlog and epic context,
            absorb any user-provided feature description, conduct deep questioning to
            define feature scope and acceptance criteria, decompose the feature into
            stories, and generate feature and story artifact files.
            Optionally create GitHub issues if github-project.enabled=true.
        </objective>

        <artifacts>
            .ace/artifacts/product/<id-epic_name>/<id-feature_name>/<id-feature_name>.md
            .ace/artifacts/product/<id-epic_name>/<id-feature_name>/<id-story_name>/<id-story_name>.md
        </artifacts>
    </output>

    <process>
        Execute the plan-feature workflow from
        `@~/.claude/agile-context-engineering/workflows/plan-feature.xml` end-to-end.
        Preserve all workflow gates (validation, approvals, commits).
    </process>

    <next-steps>
        **After this command:**
        - `/ace:plan-story story-id` — Plan a story
        - `/ace:plan-feature feature-id` — Plan another feature
        - `/ace:help` — Check project initialization status
    </next-steps>

</command>
```
