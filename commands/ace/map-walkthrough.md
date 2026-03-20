---
name: ace:map-walkthrough
description: Create deep tutorial-style flow walkthroughs in .docs/wiki/subsystems/[name]/walkthroughs/
argument-hint: "flow='tick data from bybit websocket to timescaledb' subsystem='data-ingestion' emphasis-frameworks='SignalR,Redis Streams'"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Edit
  - LSP
  - AskUserQuestion
  - WebSearch
  - WebFetch
  - mcp__context7__resolve-library-id
  - mcp__context7__query-docs
---

```xml
<command>

    <execution-time>
        <runs-after>
            <trigger>After /ace:map-subsystem — to create deep walkthroughs for complex flows</trigger>
            <trigger>Anytime a complex multi-class flow needs human-readable documentation</trigger>
            <trigger>When onboarding new developers who need to understand specific flows</trigger>
        </runs-after>
        <use-when>
            <condition>A flow spans 3+ classes across multiple architectural layers</condition>
            <condition>External frameworks/libraries are involved that need explanation</condition>
            <condition>An intern reading the code alone would not understand what's happening</condition>
            <condition>A system doc would need paragraphs of explanation with code snippets</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
                <param name="flow" type="text">
                    Natural language description of the end-to-end flow — WHERE it starts
                    and WHERE it ends. The agent finds the entry point, follows every call
                    through the entire code, and traces it to the exit point.

                    E.g.:
                    - "tick data from bybit websocket to timescaledb"
                    - "user message from SignalR hub until LLM response is sent back"
                    - "order placement from API endpoint to payment confirmation"

                    If not provided, pause and ask the user.
                </param>
                <param name="subsystem" type="path | text">
                    Subsystem where the walkthrough wiki file is placed.
                    The flow itself may span MULTIPLE subsystems — the agent follows
                    the code wherever it goes. This parameter only determines the
                    wiki location: `.docs/wiki/subsystems/[subsystem]/walkthroughs/`.
                    If not provided, pause and ask the user.
                </param>
            </required>

            <optional>
                <param name="emphasis-frameworks" type="csv">
                    Comma-separated frameworks/libraries/APIs/SDKs that should receive deep
                    explanation throughout the walkthrough. When specified:
                    - EVERY step touching the framework gets a framework info box
                    - ALL code interacting with the framework is shown and explained
                    - The Framework Concepts Reference table becomes MANDATORY

                    Each entry is EITHER:
                    - A name (agent researches via WebSearch/context7):
                      "SignalR" or "SignalR,EF Core"
                    - A file path or URL to documentation (agent reads the page, follows
                      internal links to find pages covering the specific concepts used in
                      the code, and infers the framework name from content):
                      "https://learn.microsoft.com/aspnet/signalr/overview" or "docs/signalr-guide.md"
                    - A mix of both:
                      "SignalR,docs/custom-redis-wrapper.md,EF Core"
                </param>
            </optional>
        </parameters>
    </input>

    <execution-context>
        <map-walkthrough-workflow>@~/.claude/agile-context-engineering/workflows/map-walkthrough.xml</map-walkthrough-workflow>
        <walkthrough-template>@~/.claude/agile-context-engineering/templates/wiki/walkthrough.xml</walkthrough-template>
        <questioning>@~/.claude/agile-context-engineering/utils/questioning.xml</questioning>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>

    <output>
        <objective>
            Create or update a deep tutorial-style walkthrough that traces a flow end-to-end.

            The agent reads the flow description, finds the entry point in the codebase,
            then follows EVERY SINGLE CALL through the entire code — handler to service
            to repository to database (or whatever the flow touches) — using LSP and code
            reading. It discovers all files automatically, extracts emphasis framework
            usages from the actual code, researches those specific concepts, and writes
            the walkthrough with real code snippets and framework info boxes.
        </objective>

        <artifacts>
            .docs/wiki/subsystems/[subsystem-name]/walkthroughs/[flow-name].md
        </artifacts>
    </output>

    <process>
        For this command use the `ace-wiki-mapper` agent
        that's specialized in wiki exploration and documentation writing.

        Execute the map-walkthrough workflow from
        `@~/.claude/agile-context-engineering/workflows/map-walkthrough.xml` end-to-end.
        Preserve all workflow gates (validation, user questions, commits).
    </process>

    <next-steps>
        <step>/clear first for a fresh context window</step>
        <step>/ace:map-walkthrough — create another walkthrough</step>
        <step>/ace:map-subsystem [subsystem] — map or refresh an entire subsystem</step>
        <step>Review and edit files in .docs/wiki/subsystems/[subsystem-name]/walkthroughs/</step>
    </next-steps>

</command>
```
