---
name: ace:plan-story
description: Plan a story through deep questioning to create CRYSTAL-CLEAR acceptance criteria with ZERO assumptions, then dispatch wiki research, external analysis, integration analysis, and technical solution design
argument-hint: "story=<file-path|github-url> [external-codebase=<source-path|github-url>] [external-docs=<weblink|filepath>] [lib-docs=<weblinks-and-filepaths>]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
  - AskUserQuestion
  - Glob
  - Grep
  - Agent
---

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>After /ace:plan-feature — once a feature's story breakdown exists with stub story files</trigger>
            <trigger>Anytime — to create or refine a story specification from a description or GitHub issue</trigger>
        </runs-after>
        <use-when>
            <condition>A story stub exists (from plan-feature) and needs formal specification</condition>
            <condition>A GitHub issue describes work that needs INVEST-compliant acceptance criteria</condition>
            <condition>An existing story needs refinement — scope changed, AC gaps found</condition>
            <condition>You want to create a complete story specification from any text description</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
                <param name="story" type="file | github-url">
                    Story source — can be either:
                    - **File path**: Path to a markdown file containing the story seed
                      (typically a stub from plan-feature, or any markdown with a description)
                    - **GitHub URL or issue number**: GitHub story reference
                    Must be a valid, accessible file or GitHub issue.
                    Contains the story description that will be refined through deep questioning.
                    If not valid, stop and prompt the user.
                </param>
            </required>

            <optional>
                <param name="external-codebase" type="filepath | github-url">
                    Path or GitHub repo to an external industry-standard system to analyze.
                    When provided, pass 3 (external analysis) runs automatically.
                    When NOT provided, the user is offered the option to provide it or skip.
                </param>
                <param name="external-docs" type="weblink | filepath">
                    Link or path to external system documentation.
                    Only used when external-codebase is also provided.
                    Provides supplementary context for external analysis.
                </param>
                <param name="lib-docs" type="weblinks and/or filepaths">
                    Space-separated string of weblinks and/or file paths to library or API documentation.
                    These are injected into the story's Relevant Wiki section as a
                    `### Library Documentation` subsection after pass 2 completes,
                    so that passes 4-5 (integration analysis, technical solution) can
                    reference them when designing the implementation.
                    Useful for third-party libraries, SDK docs, or API references
                    that inform how the story should be built.
                </param>
            </optional>
        </parameters>
    </input>

    <execution-context>
        <plan-story-workflow>@~/.claude/agile-context-engineering/workflows/plan-story.xml</plan-story-workflow>
        <story-template>@~/.claude/agile-context-engineering/templates/product/story.xml</story-template>
        <questioning>@~/.claude/agile-context-engineering/utils/questioning.xml</questioning>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Take a story seed (stub file, GitHub issue, or any text description) and produce
            a COMPLETE story specification through deep questioning that ensures:
            - ZERO ASSUMPTIONS — every behavior is explicitly specified
            - CRYSTAL-CLEAR acceptance criteria with exact triggers, preconditions, outcomes
            - INVEST compliance — Independent, Negotiable, Valuable, Estimable, Small, Testable
            - Gherkin scenarios cover happy paths, edge cases, AND error paths

            After story requirements are defined (pass 1), dispatch research passes 2-5
            as background agents:
            - Pass 2: Wiki research (updates story file with Relevant Wiki section)
            - Pass 3: External analysis (OPTIONAL — creates external-analysis.md)
            - Pass 4: Integration analysis (creates integration-analysis.md)
            - Pass 5: Technical solution (appends to story file)

            Each research pass writes directly to disk. The orchestrator context window
            contains ONLY story requirements — research outputs do NOT flow back.
        </objective>

        <artifacts>
            .ace/artifacts/product/&lt;id-epic_name&gt;/&lt;id-feature_name&gt;/&lt;id-story_name&gt;/&lt;id-story_name&gt;.md
            .ace/artifacts/product/&lt;id-epic_name&gt;/&lt;id-feature_name&gt;/&lt;id-story_name&gt;/external-analysis.md (OPTIONAL)
            .ace/artifacts/product/&lt;id-epic_name&gt;/&lt;id-feature_name&gt;/&lt;id-story_name&gt;/integration-analysis.md
        </artifacts>
    </output>

    <process>
        For this command use the `ace-product-owner` agent
        that's specialized in requirements gathering, deep questioning, and story specification.

        Execute the plan-story workflow from
        `@~/.claude/agile-context-engineering/workflows/plan-story.xml` end-to-end.
        Preserve all workflow gates (validation, approvals, commits).

        **CRITICAL — Context Window Protection:**
        Passes 2-5 run as background agents. Each agent writes output directly to files.
        The orchestrator MUST NOT call TaskOutput on any background agent.
        The orchestrator only needs to know when each pass finishes to start the next one.

        **Pass execution order:**
        Pass 2 + Pass 3 (if applicable) → wait → Pass 4 → wait → Pass 5 → wait → done
    </process>

    <example-usage>
        ```
        # From a plan-feature stub file
        /ace:plan-story \
          story=.ace/artifacts/product/e1-auth/f3-oauth/s1-buttons/s1-buttons.md

        # From a GitHub issue
        /ace:plan-story \
          story=https://github.com/owner/repo/issues/95

        # With external system analysis
        /ace:plan-story \
          story=.ace/artifacts/product/e1-charts/f2-rendering/s3-canvas/s3-canvas.md \
          external-codebase=src/external/lightweight-charts/ \
          external-docs=https://tradingview.github.io/lightweight-charts/

        # With library documentation references
        /ace:plan-story \
          story=.ace/artifacts/product/e1-charts/f2-rendering/s3-canvas/s3-canvas.md \
          lib-docs="https://docs.some-lib.io/api src/vendor/some-lib/README.md"

        # With just an issue number (uses configured repo)
        /ace:plan-story story=#95
        ```
    </example-usage>

    <next-steps>
        **After this command:**
        - `/ace:execute-story story=...` — Execute the story implementation
        - `/ace:plan-story story=...` — Plan the next story in the feature
        - `/ace:verify-story story=...` — Verify a completed story
        - `/ace:help` — Check project initialization status
    </next-steps>

</command>
```
