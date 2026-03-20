---
name: ace:execute-story
description: Execute a fully-planned story — loads AC + Technical Solution, creates execution plan via Plan Mode, implements (solo or agent teams), runs code review, updates state, and triggers wiki mapping
argument-hint: "story=<file-path|github-url> [--agent-teams-off]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
  - AskUserQuestion
  - Glob
  - Grep
  - Agent
  - EnterPlanMode
  - ExitPlanMode
---

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>After /ace:plan-story — once a story has AC + Technical Solution</trigger>
            <trigger>Anytime — to execute a fully-planned story specification</trigger>
        </runs-after>
        <use-when>
            <condition>A story has both Acceptance Criteria AND Technical Solution sections</condition>
            <condition>Story status is "Refined" (ready for implementation)</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
            <flag name="--agent-teams-off">
                Force solo execution mode regardless of agent_teams setting.
                Overrides the agent_teams flag in settings.json.
                Use when you want single-context execution even if teams are enabled.
            </flag>
        </flags>

        <parameters>
            <required>
                <param name="story" type="file | github-url">
                    Story source — can be either:
                    - **File path**: Path to a fully-planned story markdown file
                      (must have AC + Technical Solution sections)
                    - **GitHub URL or issue number**: GitHub story reference
                    Must be a valid, accessible file or GitHub issue.
                    The story MUST have been through /ace:plan-story (has AC + Technical Solution).
                </param>
            </required>
        </parameters>
    </input>

    <execution-context>
        <execute-story-workflow>@~/.claude/agile-context-engineering/workflows/execute-story.xml</execute-story-workflow>
        <story-template>@~/.claude/agile-context-engineering/templates/product/story.xml</story-template>
        <walkthrough-template>@~/.claude/agile-context-engineering/templates/wiki/walkthrough.xml</walkthrough-template>
        <questioning>@~/.claude/agile-context-engineering/utils/questioning.xml</questioning>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Take a fully-planned story (with AC + Technical Solution) and:
            1. Create an execution plan via Claude Code Plan Mode
            2. Execute the plan — solo or with Agent Teams
            3. Run code review (3-level verification, anti-pattern detection, coding standards)
            4. Present results to user for verification/approval
            5. Commit implementation (single commit after approval)
            6. Update state: story file, feature file, product backlog, GitHub
            7. Trigger wiki mapping (background) with tech debt integration

            Two execution modes:
            - **Solo Mode** (default or --agent-teams-off): Single context, plan mode → execute
            - **Agent Teams Mode** (when enabled + plan recommends): Lead + teammates for parallel work
        </objective>

        <artifacts>
            Story file updated with Summary &amp; State section and Wiki Updates section.
            Feature file updated with story status.
            Product backlog updated with story (and possibly feature) status.
            Wiki documents updated/created based on implementation changes.
        </artifacts>
    </output>

    <process>
        **STRICT WORKFLOW EXECUTION — Follow the execute-story workflow STEP BY STEP.
        Do NOT skip steps. Do NOT improvise. Do NOT start reading code or planning
        until step 1 (init &amp; validate) is fully complete with the init command output parsed.**

        Execute the execute-story workflow from
        `@~/.claude/agile-context-engineering/workflows/execute-story.xml` end-to-end.

        **MANDATORY FIRST ACTION: Run the init command (step 1.2) BEFORE doing anything else.
        Do NOT read the story file manually. Do NOT explore the codebase. Do NOT start planning.
        The init command validates the story and provides all paths and context needed.**

        **CRITICAL REQUIREMENTS:**
        - Story MUST have Acceptance Criteria — STOP if missing
        - Story MUST have Technical Solution — STOP if missing
        - NO intermediary commits during implementation
        - ONE single commit per story after user approval (code + state + docs)
        - Code review is MANDATORY — blockers must be fixed before approval
        - Coding standards violations are BLOCKERS, not warnings
        - Dead code and backwards-compatible shims must be DELETED
    </process>

    <example-usage>
        ```
        # Execute a story from a file path
        /ace:execute-story \
          story=.ace/artifacts/product/e1-auth/f3-oauth/s1-buttons/s1-buttons.md

        # Execute from a GitHub issue
        /ace:execute-story \
          story=https://github.com/owner/repo/issues/95

        # Force solo mode (no agent teams)
        /ace:execute-story \
          story=.ace/artifacts/product/e1-auth/f3-oauth/s1-buttons/s1-buttons.md \
          --agent-teams-off

        # With just an issue number
        /ace:execute-story story=#95
        ```
    </example-usage>

    <next-steps>
        **After this command:**
        - `/ace:execute-story story=...` — Execute the next story in the feature
        - `/ace:review-story story=...` — Re-run code review (standalone)
        - `/ace:plan-story story=...` — Plan the next story
        - `/ace:help` — Check project status
    </next-steps>

</command>
```
