---
name: init-coding-standards
description: Generate a tailored coding-standards.md through codebase detection and user interview
argument-hint: "[optional: context='existing standards doc or notes to build on']"
disable-model-invocation: true
allowed-tools: Read, Bash, Glob, Grep, Write, Task, AskUserQuestion
model: sonnet
effort: high
---

## Environment Context (preprocessed)

!`node "${CLAUDE_SKILL_DIR}/script.js" init 2>/dev/null`

## Supporting Resources (auto-loaded)

!`cat "${CLAUDE_SKILL_DIR}/workflow.xml"`

!`cat "${CLAUDE_SKILL_DIR}/coding-standards-template.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/questioning.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md"`

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>During /ace:help — as part of initial project setup</trigger>
            <trigger>After /ace:map-system — once codebase is mapped, add prescriptive standards</trigger>
            <trigger>Anytime — to create or refresh coding standards for a project</trigger>
        </runs-after>
        <use-when>
            <condition>Starting a new project and want to establish coding standards upfront (greenfield or brownfield)</condition>
            <condition>Onboarding AI agents to an existing codebase (prevents common AI mistakes)</condition>
            <condition>Current coding standards are outdated or missing</condition>
            <condition>Team has pain points with AI-generated code quality</condition>
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
                    Existing coding standards document, style guide, or notes
                    to use as a starting point. Will be refined through the interview process.
                </param>
            </optional>
        </parameters>
    </input>

    <execution-context>
        <!-- All supporting files are auto-loaded in the Supporting Resources section above.
             The model does NOT need to Read these files — they are already in context. -->
    </execution-context>

    <output>
        <objective>
            Detect the project's language, paradigm, and frameworks (brownfield) or gather
            this from the user (greenfield). Interview the user about their coding philosophy
            and pain points. Generate a tailored, prescriptive coding-standards.md that prevents
            common AI and developer mistakes.
        </objective>

        <artifacts>
            .docs/wiki/system-wide/coding-standards.md
        </artifacts>
    </output>

    <process>
        Execute the init-coding-standards workflow from
        `workflow.xml` end-to-end.
        Preserve all workflow gates (validation, approvals, commits).
    </process>

    <next-steps>
        **After this command:**
        - `/ace:map-system` — Map codebase structure and architecture
        - `/ace:help` — Check project initialization status and next steps
        - Review and edit `.docs/wiki/system-wide/coding-standards.md` anytime
    </next-steps>

</command>
```
