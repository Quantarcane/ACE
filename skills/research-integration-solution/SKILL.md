---
name: research-integration-solution
description: COMPREHENSIVE, IN-DEPTH System Integration Analysis for Integrating a New Story into the Existing Codebase
argument-hint: "story=<file-path|github-url>"
disable-model-invocation: false
allowed-tools: Read, Bash, Write, AskUserQuestion, Glob, Grep, Agent
model: opus
effort: max
context: fork
agent: ace-code-integration-analyst
---

## Environment Context (preprocessed)

!`node "${CLAUDE_SKILL_DIR}/script.js" init "$ARGUMENTS" 2>/dev/null`

## Supporting Resources (auto-loaded)

!`cat "${CLAUDE_SKILL_DIR}/workflow.xml"`

!`cat "${CLAUDE_SKILL_DIR}/integration-solution-template.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md"`

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>After /ace:plan-story — once story requirements (pass 1-2) are complete</trigger>
            <trigger>After /ace:research-external-solution — if external analysis was performed (pass 3)</trigger>
            <trigger>Anytime — when you need to understand how a story integrates with the existing codebase</trigger>
        </runs-after>
        <use-when>
            <condition>Story requirements and wiki references are available (passes 1-2 complete)</condition>
            <condition>Need to understand how new functionality integrates with existing codebase</condition>
            <condition>Want to identify refactoring needs, integration points, and hardcoded values to replace</condition>
            <condition>Need a comprehensive analysis to guide AI agents implementing the story</condition>
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
                    that define what to analyze and which wiki docs to load.
                    **Requirements and wiki references are extracted from this story.**
                    If not valid, stop and prompt the user.
                </param>
            </required>

            <optional>
                <!-- No optional parameters.
                     All context is extracted from the story document:
                     - Feature file (from story description/metadata)
                     - Story requirements (User Story, Description, AC)
                     - Wiki references (from Relevant Wiki section — pass 2)
                     - External analysis (auto-detected in story directory)
                -->
            </optional>
        </parameters>
    </input>

    <execution-context>
        <!-- All supporting files are auto-loaded in the Supporting Resources section above.
             The model does NOT need to Read these files — they are already in context. -->
    </execution-context>

    <output>
        <objective>
            Perform a COMPREHENSIVE, IN-DEPTH System Integration Analysis that ensures new
            story implementations integrate seamlessly with existing systems without breaking
            functionality or violating architectural principles.

            **[MANDATORY]** Identify how a new story would PROPERLY integrate with the existing
            codebase while maintaining architectural integrity, maintainability, and extensibility
            while strictly following CODING STANDARDS.

            You are operating within a PRODUCTION-GRADE, CLEAN, COMPLEX CODEBASE — new code
            must be added thoughtfully and systematically. The purpose is to analyze HOW TO ADD
            NEW FUNCTIONALITY WHILE KEEPING THE CODE MAINTAINABLE AND EXTENSIBLE.

            The analysis covers:
            - Architecture compatibility with Clean Architecture layers
            - Existing patterns to follow (with specific file references)
            - Required refactoring (with justification)
            - CRITICAL: Hardcoded values and placeholder code that MUST be replaced
            - Integration points across all architectural layers
            - Impact analysis on existing code flows
            - Implementation guidelines and testing strategy
            - Complete AI implementation context for the executing agent

            All output is written ONLY to the analysis file — no GitHub updates,
            no modifications to the story file. This artifact is consumed by
            pass 5 (technical solution) of the story specification pipeline.
        </objective>

        <artifacts>
            .ace/artifacts/product/&lt;id-epic_name&gt;/&lt;id-feature_name&gt;/&lt;id-story_name&gt;/integration-analysis.md
        </artifacts>
    </output>

    <process>
        For this command use the `ace-code-integration-analyst` agent
        that's specialized in code integration.

        Execute the research-integration-solution workflow from
        `workflow.xml` end-to-end.
        Preserve all workflow gates (validation, approvals, commits).
    </process>

    <example-usage>
        ```
