---
name: map-system
description: Map system-wide codebase structure, architecture, and testing framework into .docs/wiki/system-wide/
argument-hint: "[optional: references='existing artifacts and documents to be considered alongside the codebase']"
disable-model-invocation: true
allowed-tools: Read, Bash, Glob, Grep, Write, Task, AskUserQuestion
model: opus
effort: max
---

## Environment Context (preprocessed)

!`node "${CLAUDE_SKILL_DIR}/script.js" init "$ARGUMENTS" 2>/dev/null`

## Supporting Resources (auto-loaded)

!`cat "${CLAUDE_SKILL_DIR}/workflow.xml"`

!`cat "${CLAUDE_SKILL_DIR}/templates/system-structure.xml"`

!`cat "${CLAUDE_SKILL_DIR}/templates/system-architecture.xml"`

!`cat "${CLAUDE_SKILL_DIR}/templates/testing-framework.xml"`

!`cat "${CLAUDE_SKILL_DIR}/templates/wiki-readme.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/questioning.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md"`

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>Before /ace:help (brownfield codebases) — understand existing code first</trigger>
            <trigger>After /ace:help (greenfield codebases) — document architecture decisions</trigger>
            <trigger>Anytime to refresh system-wide wiki documents</trigger>
        </runs-after>
        <use-when>
            <condition>Onboarding to an existing codebase (brownfield — analyzes code automatically)</condition>
            <condition>Starting a new project and need to document architecture decisions (greenfield — interviews you)</condition>
            <condition>System-wide documents are stale or missing</condition>
            <condition>After major refactoring that changed subsystem boundaries or tech stack</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
            </required>

            <optional>
                <param name="references" type="file | text">
                    Existing architecture docs, ADRs, or design notes
                    to consider alongside the codebase analysis. Absorbed before analysis begins.
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
            Detect brownfield/greenfield status and existing wiki state. For each system-wide
            document (structure, architecture, testing), determine whether to create, update,
            recreate, scaffold, or skip. Spawn ace-wiki-mapper agents to produce documents.
            For greenfield architecture, conduct deep questioning before generating.
            Add CLAUDE.md instructions to keep wiki current with future code changes.
        </objective>

        <artifacts>
            - .docs/wiki/wiki-readme.md (created if not already present)
            - .docs/wiki/system-wide/system-structure.md
            - .docs/wiki/system-wide/system-architecture.md
            - .docs/wiki/system-wide/testing-framework.md
            - CLAUDE.md (wiki maintenance instructions appended)
        </artifacts>
    </output>

    <process>
        Execute the map-system workflow from
        `workflow.xml` end-to-end.
        Preserve all workflow gates (validation, user questions, commits).
    </process>

    <next-steps>
        **After this command, `/clear` first for a fresh context window, then:**
        - `/ace:map-subsystems` — Map individual subsystem internals (structure, dependencies)
        - `/ace:init-coding-standards` — Define prescriptive coding standards
        - `/ace:help` — Check project initialization status and next steps
        - Review and edit files in `.docs/wiki/system-wide/` anytime
    </next-steps>

</command>
```
