---
name: ace:map-codebase
description: Analyze codebase with parallel mapper agents to produce .docs/engineering/ documents
argument-hint: "[optional: specific area to map, e.g., 'api' or 'auth']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
---

```xml
<command>
    
    <execution-time>
        **This command can run:**
        - Before /ace:new-project (brownfield codebases) - creates codebase map first
        - After /ace:new-project (greenfield codebases) - updates codebase map as code evolves
        - Anytime to refresh codebase understanding

        **Use map-codebase for:**
        - Brownfield projects before initialization (understand existing code first)
        - Refreshing codebase map after significant changes
        - Onboarding to an unfamiliar codebase
        - Before major refactoring (understand current state)
        - When STATE.md references outdated codebase info
    </execution-time>
    
    <input>
        <flags></flags>
        <parameters>
            <required></required>
            <optional>
                Focus area: $ARGUMENTS (optional - if provided, tells agents to focus on specific subsystem)
            </optional>
        </parameters>
    </input>

    <execution-context>
        <project-state>
            **Load project state if exists:**
            Check for .planning/STATE.md - loads context if project already initialized
        </project-state>
        <map-codebase-workflow>
            @~/.claude/agile-context-engineering/workflows/map-codebase.xml
        </map-codebase-workflow>
    </execution-context>

    <output>
        <objective>
            Analyze existing codebase using parallel ace-codebase-mapper agents to produce structured codebase documents.

            Each mapper agent explores a focus area and **writes documents directly** to `.docs/engineering/`. The orchestrator only receives confirmations, keeping context usage minimal.
        </objective>

        <artifacts>
            .docs/engineering/ folder with structured documents about the codebase state.
        </artifacts>
    </output>

    <process>
        1. Check if .docs/engineering/ already exists (offer to refresh or skip)
        2. Create .docs/engineering/ directory structure
        3. Spawn 4 parallel gsd-codebase-mapper agents:
        - Agent 1: tech focus → writes STACK.md, INTEGRATIONS.md
        - Agent 2: arch focus → writes ARCHITECTURE.md, STRUCTURE.md
        - Agent 3: quality focus → writes CONVENTIONS.md, TESTING.md
        - Agent 4: concerns focus → writes CONCERNS.md
        4. Wait for agents to complete, collect confirmations (NOT document contents)
        5. Verify all 7 documents exist with line counts
        6. Commit codebase map
    </process>

    <success_criteria>
        - [ ] .docs/engineering/ directory created
        - [ ] All 7 codebase documents written by mapper agents
        - [ ] Documents follow template structure
        - [ ] Parallel agents completed without errors
        - [ ] User knows next steps
    </success_criteria>
    
    <next-steps>
        Offer next steps (typically: /ace:new-project or /ace:plan-feature or /ace:plan-story)
    </next-steps>
</command>
```