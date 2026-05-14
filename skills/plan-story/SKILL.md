---
name: plan-story
description: Plan a story through deep questioning to create CRYSTAL-CLEAR acceptance criteria with ZERO assumptions, then dispatch wiki research, external analysis, integration analysis, and technical solution design. Use this whenever the user wants to plan a story, specify a story, create acceptance criteria, refine story requirements, or take a story stub and turn it into a full specification — whether from a feature stub, GitHub issue, inline text, or from scratch.
argument-hint: "[story=<file-path|github-url>] [text=<inline-description>] [external-codebase=<source-path|github-url>] [external-docs=<weblink|filepath>] [lib-docs=<weblinks-and-filepaths>]"
disable-model-invocation: true
allowed-tools: Read, Bash, Write, Edit, AskUserQuestion, Glob, Grep, Agent
model: opus
effort: high
---

## Environment Context (preprocessed)

!`node "${CLAUDE_SKILL_DIR}/script.js" init "$ARGUMENTS" 2>/dev/null`

## Supporting Resources (auto-loaded)

!`cat "${CLAUDE_SKILL_DIR}/workflow.xml"`

!`cat "${CLAUDE_SKILL_DIR}/story-template.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/questioning.xml"`

!`cat "${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md"`

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
            <condition>You have a new story idea (text or no input) and need it placed in the backlog</condition>
        </use-when>
    </execution-time>

    <input>
        <flags>
        </flags>

        <parameters>
            <required>
            </required>

            <optional>
                <param name="story" type="file | github-url">
                    Story source — can be either:
                    - **File path**: Path to an existing markdown file containing the story seed
                      (typically a stub from plan-feature, or any markdown with a description)
                    - **GitHub URL or issue number**: GitHub story reference
                    When omitted, the workflow enters "new story" mode and guides the user
                    through backlog placement before proceeding to specification.
                    If provided but invalid, stop and prompt the user.
                </param>
                <param name="text" type="text">
                    Inline story description to seed the planning session.
                    Used when no story file exists yet — the text becomes the initial description
                    and the workflow asks where in the backlog this story belongs.
                    Ignored if `story` is provided.
                </param>
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
        <!-- All supporting files are auto-loaded in the Supporting Resources section above.
             The model does NOT need to Read these files — they are already in context. -->
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
        ╔══════════════════════════════════════════════════════════════╗
        ║  THREE-PHASE ORCHESTRATION                                  ║
        ║  Phase 1: Requirements workflow (steps 1-7)                 ║
        ║  Phase 2: Research pass dispatch                            ║
        ║  Phase 3: State updates + commit                            ║
        ╚══════════════════════════════════════════════════════════════╝

        **You are the Agile Product Owner AND the skill orchestrator.**
        Execute all three phases yourself — do NOT spawn a sub-agent for the entire workflow.
        You own requirements (Phase 1), dispatch research agents (Phase 2), and finalize (Phase 3).

        ═══════════════════════════════════════════════════════════
        PHASE 1: REQUIREMENTS (execute steps 1-7 from workflow above)
        ═══════════════════════════════════════════════════════════

        Execute steps 1-7 of the workflow loaded in the Supporting Resources above.
        This covers: setup, backlog placement, story seed loading, foundation context,
        deep questioning, writing the story spec, and user review/approval.

        **You ARE the product owner.** Follow the questioning guide and story template.
        Use AskUserQuestion for ALL user interactions — never dump questions as text.
        Write acceptance criteria with ZERO ASSUMPTIONS — every behavior explicitly specified.

        After the user approves (step 7 "Approve"), continue to Phase 2.
        If the user chose "Skip to research" (step 3), skip directly to Phase 2.

        Store STORY_FILE = path to the story file (from INIT.paths.story_file).

        ═══════════════════════════════════════════════════════════
        PHASE 2: RESEARCH PASSES (YOU dispatch agents directly)
        ═══════════════════════════════════════════════════════════

        **YOU dispatch these agents using the Agent tool. This is MANDATORY.**
        **Do NOT write the Relevant Wiki or Technical Solution sections yourself.**
        **Do NOT skip this phase. Do NOT improvise. Dispatch exactly as specified.**

        Each agent writes output directly to files. After each agent completes,
        verify the output files exist before dispatching the next pass.

        **2a. Re-run init to get fresh paths:**
        ```bash
        node "${CLAUDE_SKILL_DIR}/script.js" init "story={STORY_FILE}" 2>/dev/null
        ```
        Parse result as INIT JSON.

        **2b. Determine external analysis:**
        Extract EXTERNAL_CODEBASE, EXTERNAL_DOCS, LIB_DOCS from $ARGUMENTS.
        If EXTERNAL_CODEBASE was provided: set RUN_EXTERNAL = true.
        If not provided:
        Use AskUserQuestion:
        - header: "External"
        - question: "Does this story reference an external system you'd like to analyze?"
        - options:
          - "No external system" — Skip external analysis
          - "Yes, provide path" — I have an external codebase to analyze
        If "Yes": ask for path. Set EXTERNAL_CODEBASE, RUN_EXTERNAL = true.
        If "No": RUN_EXTERNAL = false.

        **2c. Dispatch Pass 2 — Wiki Research:**
        If INIT.has_wiki is false: skip, display:
        ```
          i  No wiki found. Skipping pass 2 (wiki research).
        ```
        If INIT.has_wiki is true:
        Display:
        ```
          i  Pass 2: Dispatching wiki research...
        ```
        Agent(
            description="Pass 2: Wiki research",
            prompt="Your FIRST and ONLY action: use the Skill tool to invoke skill='ace:research-story-wiki' with args='story={INIT.paths.story_file}'. Do NOT improvise. Do NOT write wiki content yourself. The skill has its own workflow and templates. Just invoke it.",
            model="{PO_MODEL}",
        )

        **2d. Dispatch Pass 3 — External Analysis (if RUN_EXTERNAL):**
        If RUN_EXTERNAL is false: skip.
        Display:
        ```
          i  Pass 3: Dispatching external analysis...
        ```
        Agent(
            description="Pass 3: External analysis",
            prompt="Your FIRST and ONLY action: use the Skill tool to invoke skill='ace:research-external-solution' with args='story={INIT.paths.story_file} external-codebase={EXTERNAL_CODEBASE} {external-docs={EXTERNAL_DOCS} if provided}'. Do NOT improvise. The skill has its own workflow. Just invoke it.",
            model="{PO_MODEL}"
        )

        **2e. Verify passes 2+3 outputs.**
        Verify:
        ```bash
        wc -l {INIT.paths.story_file}
        ```
        Display:
        ```
          +  Pass 2 complete. Story file updated with Relevant Wiki section.
          {+  Pass 3 complete. External analysis written. (if applicable)}
        ```

        **2f. Inject Library Documentation (if LIB_DOCS provided):**
        If LIB_DOCS is not null/empty:
        Read story file, find `## Relevant Wiki` section, append `### Library Documentation`
        subsection BEFORE the next `##` heading. Format each LIB_DOCS entry:
        - Weblinks (http/https): `- [{url}]({url}) — Library/API documentation`
        - File paths: `` - `{path}` — Local documentation reference ``
        Use Edit tool to insert. Display:
        ```
          +  Library documentation ({count} entries) added to Relevant Wiki section.
        ```

        **2g. Dispatch Pass 4 — Integration Analysis:**
        Display:
        ```
          i  Pass 4: Dispatching integration analysis...
        ```
        Agent(
            description="Pass 4: Integration analysis",
            prompt="Your FIRST and ONLY action: use the Skill tool to invoke skill='ace:research-integration-solution' with args='story={INIT.paths.story_file}'. Do NOT improvise. Do NOT write integration analysis yourself. The skill has its own workflow. Just invoke it.",
            model="{PO_MODEL}"
        )
        Verify:
        ```bash
        wc -l {INIT.paths.integration_analysis_file}
        ```
        Display:
        ```
          +  Pass 4 complete. Integration analysis written.
        ```

        **2h. Dispatch Pass 5 — Technical Solution:**
        Display:
        ```
          i  Pass 5: Dispatching technical solution design...
        ```
        Agent(
            description="Pass 5: Technical solution",
            prompt="Your FIRST and ONLY action: use the Skill tool to invoke skill='ace:research-technical-solution' with args='story={INIT.paths.story_file}'. Do NOT improvise. Do NOT write technical solution yourself. The skill has its own workflow. Just invoke it.",
            model="{PO_MODEL}"
        )
        Verify:
        ```bash
        wc -l {INIT.paths.story_file}
        ```
        Display:
        ```
          +  Pass 5 complete. Technical solution appended to story file.
        ```

        **2i. Verification:**
        Read the story file and verify it contains BOTH:
        1. `## Relevant Wiki` section with actual wiki references (not just placeholder)
        2. `## Technical Solution` section with actual technical design (not just placeholder)
        If either section is missing or still a placeholder, re-dispatch the failing pass.

        ═══════════════════════════════════════════════════════════
        PHASE 3: FINALIZE
        ═══════════════════════════════════════════════════════════

        **3a. State updates:**
        ```bash
        node "${CLAUDE_SKILL_DIR}/script.js" update-state \
          story={INIT.paths.story_file} \
          status=Refined
        ```
        Parse result for: story_updated, feature_updated, backlog_updated.
        Display:
        ```
          +  Story status updated to Refined
          {+  Feature file updated (if feature_updated)}
          {+  Product backlog updated (if backlog_updated)}
        ```

        **3b. GitHub sync (if enabled):**
        If INIT.github_project.enabled is false OR INIT.has_gh_cli is false:
        ```
          —  GitHub sync skipped (not configured or gh CLI unavailable).
        ```
        If enabled:
        ```bash
        node "${CLAUDE_SKILL_DIR}/script.js" sync-github \
          repo={INIT.github_project.repo} \
          story_file={INIT.paths.story_file} \
          feature_file={INIT.paths.feature_file} \
          owner={INIT.github_project.owner} \
          project={INIT.github_project.project_number}
        ```

        **3c. Commit (if commit_docs):**
        If INIT.commit_docs is false: skip commit.
        ```bash
        git add {INIT.paths.story_dir}/
        git add {INIT.paths.feature_file} .ace/artifacts/product/product-backlog.md
        ```
        Commit:
        - CREATE mode: `git commit -m "docs: plan story {STORY_ID} — {STORY_TITLE}"`
        - REFINE mode: `git commit -m "docs: refine story {STORY_ID} — {brief summary}"`

        **3d. Completion banner:**
        ```
        ╔══════════════════════════════════════════════════╗
        ║  ACE > Story [Planned | Refined]                 ║
        ║  {STORY_ID} "{STORY_TITLE}"                      ║
        ╚══════════════════════════════════════════════════╝

          +  Story specification complete. All passes finished.

          Artifacts:
          ────────
          Story file:            {INIT.paths.story_file}
          {External analysis:    {external_analysis_file} (if created)}
          Integration analysis:  {INIT.paths.integration_analysis_file}

          Summary:
          ────────
          Acceptance criteria: {N} scenarios
          Size: {estimate}
          Passes completed: {count}

          Next > /ace:execute-story story={INIT.paths.story_file}
                 Execute the story implementation.
               > /ace:plan-story story={next story}
                 Plan the next story in the feature.
        ```

        **Pass execution order:**
        Pass 2 + Pass 3 (if applicable) → wait → Pass 4 → wait → Pass 5 → wait → finalize
    </process>

    <example-usage>
        ```
