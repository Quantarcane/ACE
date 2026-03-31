---
name: research-story-wiki
description: Research and curate wiki references relevant to a story's technical solution
argument-hint: "story=<file-path|github-url>"
disable-model-invocation: true
allowed-tools: Read, Bash, Write, Edit, AskUserQuestion, Glob, Grep, Agent
model: opus
effort: max
context: fork
agent: ace-wiki-mapper
---

## Environment Context (preprocessed)

!`node "${CLAUDE_SKILL_DIR}/script.js" init "$ARGUMENTS" 2>/dev/null`

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>After /ace:plan-story pass 1 — once story business requirements (sections 1-8) are complete</trigger>
            <trigger>Anytime — when a story needs its Relevant Wiki section populated or refreshed</trigger>
        </runs-after>
        <use-when>
            <condition>Story has sections 1-8 complete but no Relevant Wiki section</condition>
            <condition>Story scope changed and wiki references need re-evaluation</condition>
            <condition>Called as part of /ace:plan-story pipeline (pass 2)</condition>
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
                    Contains the user story, description, and acceptance criteria.
                    **The story's requirements define which wiki docs are relevant.**
                    If not valid, stop and prompt the user.
                </param>
            </required>
        </parameters>
    </input>

    <execution-context>
        <research-story-wiki-workflow>workflow.xml</research-story-wiki-workflow>
        <story-wiki-template>story-wiki-template.xml</story-wiki-template>
        <ui-formatting>${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Research the project's engineering wiki to identify documents that are
            directly relevant to implementing this story. The output is a curated
            `## Relevant Wiki` section that gets written into the story file
            (and GitHub issue if applicable).

            This section serves as the implementation context index — when an agent
            starts implementing this story, it loads every document listed here.

            The research process:
            1. ALWAYS curates the four system-wide docs with story-specific reasons
            2. Identifies affected subsystems from story content and feature context
            3. Spawns parallel ace-wiki-mapper agents to scan subsystem wiki docs
            4. Compiles a categorized, deduplicated list of relevant references

            All output is written to the story file — populating the Relevant Wiki
            section placeholder left by pass 1.
        </objective>

        <artifacts>
            Modifies in-place: the story file at
            .ace/artifacts/product/&lt;id-epic_name&gt;/&lt;id-feature_name&gt;/&lt;id-story_name&gt;/&lt;id-story_name&gt;.md
            (adds/replaces the ## Relevant Wiki section)
        </artifacts>
    </output>

    <process>
        For this command use the `ace-wiki-mapper` agent
        that's specialized in wiki exploration and curation.

        Execute the research-story-wiki workflow from
        `workflow.xml` end-to-end.
        Preserve all workflow gates (validation, approvals, commits).
    </process>

    <example-usage>
        ```
