---
name: ace:research-external-solution
description: COMPREHENSIVE, IN-DEPTH, CODE-LEVEL Analysis of User Story Implementation in External Repository
argument-hint: "story=<file-path|github-url> external-codebase=<source-path|github-url> [external-docs=<weblink|filepath>]"
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
  - Glob
  - Grep
  - WebFetch
---

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>After /ace:plan-story — once story requirements (pass 1-2) are complete</trigger>
            <trigger>Anytime — when a story references an external system or reference implementation</trigger>
        </runs-after>
        <use-when>
            <condition>Story or feature references an external codebase to learn from</condition>
            <condition>Need to understand how an industry-standard system implements specific functionality</condition>
            <condition>Want to extract algorithms, patterns, and implementation details from reference code</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
                <param name="story" type="file | github-url">
                    Story source — can be either:
                    - **File path**: Path to a markdown file containing the story (from plan-story command)
                    - **GitHub URL or issue number**: GitHub story reference
                    Must be a valid, accessible file or GitHub issue.
                    Contains the user story and acceptance criteria that define what to analyze.
                    **Requirements for the analysis are extracted from this story.**
                    If not valid, stop and prompt the user.
                </param>
                <param name="external-codebase" type="filepath | github-url">
                    Path or GitHub repo to the external industry-standard system to analyze.
                    - If local path: Confirm folder exists and contains source code
                    - If GitHub URL: Verify repository accessibility
                    The external repository to analyze for implementation patterns,
                    algorithms, formulas, and architectural decisions.
                    If not valid, stop and prompt the user.
                </param>
            </required>

            <optional>
                <param name="external-docs" type="weblink | filepath">
                    Link or path to external industry-standard system documentation.
                    Provides supplementary context when available.
                    - If weblink: Verify URL is accessible
                    - If filepath: Verify file exists and is readable
                    **PREFER using context7 MCP server** when installed — it provides
                    up-to-date library documentation automatically. Use context7 whenever
                    the external system is a known library/framework.
                </param>
            </optional>
        </parameters>
    </input>

    <execution-context>
        <research-external-workflow>@~/.claude/agile-context-engineering/workflows/research-external-solution.xml</research-external-workflow>
        <external-solution-template>@~/.claude/agile-context-engineering/templates/product/external-solution.xml</external-solution-template>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Perform a COMPREHENSIVE, IN-DEPTH, CODE-LEVEL ANALYSIS of how a specific
            story's functionality is implemented in an external reference system.
            This is NOT a high-level overview — it's a DEEP DIVE into:
            - EXACT code implementations with line-by-line analysis
            - COMPLETE algorithms and formulas extracted verbatim from code
            - ALL design patterns with actual code examples
            - EVERY file, function, and constant involved in the story
            - FULL execution paths traced 5+ levels deep minimum

            The analysis ensures our implementation:
            - Follows established patterns and best practices (with code proof)
            - Uses exact algorithms and formulas (copied from their code)
            - Maintains compatibility with industry standards (matching their APIs)

            All output is written ONLY to the analysis file — no GitHub updates,
            no modifications to the story file. This artifact is consumed by
            pass 5 (technical solution) of the story specification pipeline.
        </objective>

        <artifacts>
            .ace/artifacts/product/&lt;id-epic_name&gt;/&lt;id-feature_name&gt;/&lt;id-story_name&gt;/external-analysis.md
        </artifacts>
    </output>

    <process>
        For this command use the `ace-code-discovery-analyst` agent
        that's specialized in code discovery.

        Execute the research-external-solution workflow from
        `@~/.claude/agile-context-engineering/workflows/research-external-solution.xml` end-to-end.
        Preserve all workflow gates (validation, approvals, commits).
    </process>

    <example-usage>
        ```
        # Example with file path story and GitHub external repo
        /ace:research-external-solution \
          story=.ace/artifacts/product/e1-auth/f3-oauth/s1-buttons/s1-buttons.md \
          external-codebase=https://github.com/tradingview/lightweight-charts \
          external-docs=https://tradingview.github.io/lightweight-charts/

        # Example with GitHub story and local external repo
        /ace:research-external-solution \
          story=https://github.com/owner/repo/issues/83 \
          external-codebase=src/external/lightweight-charts/

        # Example with context7 (no external-docs needed)
        /ace:research-external-solution \
          story=.ace/artifacts/product/e1-charts/f2-rendering/s3-canvas/s3-canvas.md \
          external-codebase=https://github.com/tradingview/lightweight-charts
        ```
    </example-usage>

    <next-steps>
        **After this command:**
        - Continue with story refinement — integration analysis (pass 4) and technical solution (pass 5)
        - `/ace:research-external-solution story=... external-codebase=...` — Analyze another story
        - `/ace:help` — Check project initialization status
    </next-steps>

</command>
```
