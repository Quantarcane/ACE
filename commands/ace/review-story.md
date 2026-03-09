---
name: ace:review-story
description: Standalone code review — performs 3-level artifact verification, anti-pattern detection, coding standards enforcement, and tech debt discovery against a story's implementation
argument-hint: "story=<file-path|github-url>"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>After /ace:execute-story — to re-run code review after manual changes</trigger>
            <trigger>Anytime — to review a story implementation standalone</trigger>
        </runs-after>
        <use-when>
            <condition>A story has been implemented and needs code review</condition>
            <condition>Re-checking after manual changes post-execution</condition>
            <condition>Verifying stories implemented outside ACE</condition>
            <condition>Pre-merge quality gate</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
                <param name="story" type="file | github-url">
                    Story source — can be either:
                    - **File path**: Path to a fully-planned story markdown file
                      (must have AC + Technical Solution sections)
                    - **GitHub URL or issue number**: GitHub story reference
                    Must be a valid, accessible file or GitHub issue.
                    The story MUST have Acceptance Criteria and Technical Solution.
                </param>
            </required>
        </parameters>
    </input>

    <execution-context>
        <review-story-workflow>@~/.claude/agile-context-engineering/workflows/review-story.xml</review-story-workflow>
        <story-template>@~/.claude/agile-context-engineering/templates/product/story.xml</story-template>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Review a story's implementation directly (the session IS the reviewer):
            1. Load story context (AC, Technical Solution, Out of Scope)
            2. Identify changed/created files related to the story
            3. Run 3-level artifact verification (EXISTS → SUBSTANTIVE → WIRED)
            4. Detect anti-patterns (dead code, stubs, TODOs, hardcoded values)
            5. Enforce coding standards (mandatory, blocker-level)
            6. Check AC coverage (all Gherkin scenarios implemented)
            7. Discover pre-existing tech debt in touched files
            8. Report results with structured format
        </objective>

        <artifacts>
            No files modified — this command is read-only.
            Outputs a structured review report to the conversation.
        </artifacts>
    </output>

    <process>
        For this command use the `ace-code-reviewer` agent
        that's specialized in code review.

        Execute the review-story workflow from
        `@~/.claude/agile-context-engineering/workflows/review-story.xml` end-to-end.

        **CRITICAL REQUIREMENTS:**
        - Story MUST have Acceptance Criteria — STOP if missing
        - Story MUST have Technical Solution — STOP if missing
        - This is a READ-ONLY command — do NOT modify any code
        - Coding standards violations are BLOCKERS, not warnings
        - Dead code and backwards-compatible shims must be flagged for DELETION
    </process>

    <example-usage>
        ```
        # Review a story from a file path
        /ace:review-story \
          story=.ace/artifacts/product/e1-auth/f3-oauth/s1-buttons/s1-buttons.md

        # Review from a GitHub issue
        /ace:review-story \
          story=https://github.com/owner/repo/issues/95

        # With just an issue number
        /ace:review-story story=#95
        ```
    </example-usage>

    <next-steps>
        **After this command:**
        - `/ace:execute-story story=...` — Re-execute to fix reported issues
        - `/ace:review-story story=...` — Re-run review after fixes
        - `/ace:help` — Check project status
    </next-steps>

</command>
```
