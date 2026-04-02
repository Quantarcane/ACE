---
name: map-subsystem
description: Map a subsystem's structure, architecture, and knowledge docs into .docs/wiki/subsystems/[name]/
argument-hint: "subsystem='src/api' (or subsystem name) existing-docs=comma separated paths | directory"
disable-model-invocation: true
allowed-tools: Read, Bash, Glob, Grep, Write, Task, AskUserQuestion
model: opus
effort: max
---

## Environment Context (preprocessed)

!`node "${CLAUDE_SKILL_DIR}/script.js" init "$ARGUMENTS" 2>/dev/null`

## Supporting Resources (auto-loaded)

!`cat "${CLAUDE_SKILL_DIR}/workflow.xml"`

!`cat "${CLAUDE_SKILL_DIR}/templates/subsystem-structure.xml"`

!`cat "${CLAUDE_SKILL_DIR}/templates/subsystem-architecture.xml"`

!`cat "${CLAUDE_SKILL_DIR}/templates/module-discovery.xml"`

!`cat "${CLAUDE_SKILL_DIR}/templates/system.xml"`

!`cat "${CLAUDE_SKILL_DIR}/templates/system-cross-cutting.xml"`

!`cat "${CLAUDE_SKILL_DIR}/templates/pattern.xml"`

!`cat "${CLAUDE_SKILL_DIR}/templates/guide.xml"`

!`cat "${CLAUDE_SKILL_DIR}/templates/walkthrough.xml"`

!`cat "${CLAUDE_SKILL_DIR}/templates/decizions.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/questioning.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md"`

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>After /ace:map-system — drill into individual subsystems</trigger>
            <trigger>Anytime to refresh an existing subsystem's wiki documents</trigger>
            <trigger>When a new subsystem is added and needs to be documented</trigger>
        </runs-after>
        <use-when>
            <condition>A subsystem has not yet been documented in `.docs/wiki/subsystems/`</condition>
            <condition>An existing subsystem's docs are stale after a significant refactor</condition>
            <condition>You want a deep-dive view of a specific subsystem's internals (components, flows, data)</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
                <param name="subsystem" type="path | text">
                    Path to the subsystem (e.g., `src/api`) or its name.
                    If not provided, pause execution and ask the user for it.
                    If provided but ambiguous, or not found in the codebase, ask clarifying questions.
                </param>
            </required>

            <optional>
                <param name="existing-docs" type="comma-separated paths or directories">
                    Pre-existing documentation relevant to this subsystem. Accepts file paths,
                    directory paths, or a mix of both. When a directory is provided, recursively
                    discover all files within it (including nested subdirectories).
                    All resolved file paths are passed through to every map-story invocation
                    (file mode) alongside any per-module docs discovered during module-discovery.
                    Use this when the caller already knows about documentation that should
                    inform knowledge-doc generation.
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
            Resolve the target subsystem, load system-wide wiki context, and determine whether
            to create, update, or recreate per-subsystem wiki documents. Then:

            1. Spawn ace-wiki-mapper agents to produce structure and architecture documents.
            2. Update system-structure.md if this subsystem was not previously listed there.
            3. Update the subsystem responsibility matrix in system-architecture.md if missing.
            4. Run module discovery — trace E2E flows, identify patterns, find cross-cutting
               concerns by reading actual source code. Produce module-discovery.md artifact.
            5. For EACH discovered module, run map-story in file mode to create or update
               knowledge documentation (systems/, patterns/, cross-cutting/, guides/, walkthroughs/, decisions/).
        </objective>

        <artifacts>
            - .docs/wiki/subsystems/[subsystem-name]/structure.md
            - .docs/wiki/subsystems/[subsystem-name]/architecture.md
            - .docs/wiki/subsystems/[subsystem-name]/systems/*.md (created/updated by map-story)
            - .docs/wiki/subsystems/[subsystem-name]/patterns/*.md (created/updated by map-story)
            - .docs/wiki/subsystems/[subsystem-name]/cross-cutting/*.md (created/updated by map-story)
            - .docs/wiki/subsystems/[subsystem-name]/guides/*.md (created/updated by map-story)
            - .docs/wiki/subsystems/[subsystem-name]/walkthroughs/*.md (created/updated by map-story)
            - .docs/wiki/subsystems/[subsystem-name]/decisions/*.md (created/updated by map-story)
            - .ace/artifacts/subsystems/[subsystem-name]/module-discovery/module-discovery.md
            - .ace/artifacts/subsystems/[subsystem-name]/module-discovery/existing-docs-inventory.md (if existing-docs directory provided)
            - .docs/wiki/system-wide/system-structure.md (subsystem entry added if new)
            - .docs/wiki/system-wide/system-architecture.md (subsystem responsibility matrix updated if missing)
        </artifacts>
    </output>

    <process>
        Execute the map-subsystem workflow from
        `workflow.xml` end-to-end.
        Preserve all workflow gates (validation, user questions, commits).

        The workflow has 13 steps:
        1-5: Setup, context loading, subsystem resolution, document triage, directory creation
        6-8: Structure + architecture agents (parallel) + collect results
        9: Update system-wide docs (system-structure.md, system-architecture.md)
        10: Module discovery (3 parallel discovery agents + 1 synthesis agent)
        11: Knowledge documentation — run map-story for EACH discovered module (sequential)
        12: Verify and commit all documents
        13: Completion report

        Steps 10-11 are CRITICAL — they produce the knowledge docs (systems/, patterns/,
        cross-cutting/, guides/, walkthroughs/, decisions/) that AI agents need for future implementations.
        Do NOT skip them.
    </process>

     <next-steps>
        **After this command, `/clear` first for a fresh context window, then:**

        For each subsystem found and defined in the Subsystem Responsibility Matrix,
        suggest a `/ace:map-subsystem` command. Example:
        - `/ace:map-subsystem subsystem="src/api"` — Map the API subsystem
        - `/ace:map-subsystem subsystem="src/auth"` — Map the Auth subsystem
        - `/ace:map-subsystem subsystem="src/db"` — Map the DB subsystem
        (list one per subsystem discovered during this command's execution)

        Also suggest:
        - `/ace:init-coding-standards` — Define prescriptive coding standards
        - `/ace:help` — Check project initialization status and next steps
        - Review and edit files in `.docs/wiki/system-wide/` anytime
    </next-steps>

</command>
```
