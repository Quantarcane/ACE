---
name: ace:research-technical-solution
description: COMPREHENSIVE Technical Solution Design for a Story — Architecture, Patterns, Algorithms, Sequence Diagrams, and Implementation Plan
argument-hint: "story=<file-path|github-url>"
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
            <trigger>After /ace:plan-story — once story requirements (pass 1-2) are complete</trigger>
            <trigger>After /ace:research-integration-solution — integration analysis (pass 4) MUST exist</trigger>
            <trigger>Optionally after /ace:research-external-solution — external analysis (pass 3) if applicable</trigger>
        </runs-after>
        <use-when>
            <condition>Story requirements, wiki references, and integration analysis are available (passes 1-4 complete)</condition>
            <condition>Need to design a concrete technical solution for the story</condition>
            <condition>Want a detailed implementation blueprint with class diagrams, sequence diagrams, algorithms, and file structure</condition>
            <condition>Need a comprehensive technical design to guide AI agents implementing the story</condition>
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
                    Contains the user story, acceptance criteria, and Relevant Wiki references
                    that define what to design a technical solution for.

                    **All context is extracted from the story document:**
                    - Feature file (from story description/metadata)
                    - Story requirements (User Story, Description, AC)
                    - Wiki references (from Relevant Wiki section — pass 2)
                    - External analysis (auto-detected in story directory — OPTIONAL)
                    - Integration analysis (auto-detected in story directory — MANDATORY)

                    If not valid, stop and prompt the user.
                </param>
            </required>

            <optional>
                <!-- No optional parameters.
                     All context is extracted from the story document and story directory:
                     - Feature file (from story description/metadata)
                     - Story requirements (User Story, Description, AC)
                     - Wiki references (from Relevant Wiki section — pass 2)
                     - External analysis (auto-detected in story directory)
                     - Integration analysis (auto-detected in story directory)
                -->
            </optional>
        </parameters>
    </input>

    <execution-context>
        <research-technical-workflow>@~/.claude/agile-context-engineering/workflows/research-technical-solution.xml</research-technical-workflow>
        <technical-solution-template>@~/.claude/agile-context-engineering/templates/product/story-technical-solution.xml</technical-solution-template>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Use business requirements, integration analysis, and optionally external/industry-standard
            analysis to create a CONCRETE TECHNICAL SOLUTION DESIGN for the story, following Clean
            Architecture principles, SOLID patterns, OOP best practices, considering external analysis
            for approach, algorithms and formulas (when most efficient and performant), while following
            the integration analysis so that we don't break our already complex codebase.

            **CRITICAL**: The technical solution MUST include detailed sequence diagrams for EVERY
            scenario in the Acceptance Criteria, showing the complete flow of data and control
            through all architectural layers.

            The analysis covers:
            - Complete component and boundary architecture
            - Design patterns and technical decisions
            - Full class diagrams and interfaces (one per file!)
            - Data models and structures
            - Algorithms and business logic
            - Event flow and entry points
            - MANDATORY sequence diagrams for ALL AC scenarios
            - Complete file structure tree
            - DI container configuration
            - Testing strategy (unit, integration, e2e)
            - Implementation order and dependencies

            **Output**: The entire technical solution is written INTO the story document
            (appended as the Technical Solution section) AND updated in the GitHub issue.
            No separate output file is created.
        </objective>

        <artifacts>
            Written directly into the story file and GitHub issue — pass 5 of the story specification pipeline.
            See story.xml: &lt;section name="technical-solution" pass="5" template="story-technical-solution.xml"&gt;
        </artifacts>
    </output>

    <process>
        For this command use the `ace-technical-application-architect` agent
        that's specialized in application architecture and is intimate with the codebase.

        Execute the research-technical-solution workflow from
        `@~/.claude/agile-context-engineering/workflows/research-technical-solution.xml` end-to-end.
        Preserve all workflow gates (validation, approvals, commits).
    </process>

    <example-usage>
        ```
        # Example with file path story
        /ace:research-technical-solution \
          story=.ace/artifacts/product/e1-auth/f3-oauth/s1-buttons/s1-buttons.md

        # Example with GitHub story
        /ace:research-technical-solution \
          story=https://github.com/owner/repo/issues/83

        # Example with just issue number (uses current repo)
        /ace:research-technical-solution \
          story=83
        ```
    </example-usage>

    <next-steps>
        **After this command:**
        - The story is now fully refined (pass 5 complete) — ready for implementation
        - `/ace:execute-story story=...` — Execute the story implementation
        - `/ace:refine-story story=...` — Re-refine if scope changes
        - `/ace:help` — Check project initialization status
    </next-steps>

</command>
```
