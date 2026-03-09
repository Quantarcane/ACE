# GSD Execution Flow — Deep Analysis

> Analysis of GSD's execution system to inform ACE's `execute-story` command design.
> Source files analyzed:
> - `.gsd/commands/gsd/execute-phase.md` (command definition)
> - `.gsd/get-shit-done/workflows/execute-phase.md` (orchestrator workflow)
> - `.gsd/get-shit-done/workflows/execute-plan.md` (plan execution workflow)
> - `.gsd/agents/gsd-executor.md` (executor agent)
> - `.gsd/get-shit-done/templates/phase-prompt.md` (PLAN.md template)
> - `.gsd/get-shit-done/templates/summary.md` (SUMMARY.md template)
> - `.gsd/get-shit-done/references/checkpoints.md` (checkpoint reference)

---

## 1. Hierarchy Mapping: GSD → ACE

| GSD Concept | ACE Equivalent | Description |
|---|---|---|
| **Milestone** | Epic | Top-level grouping of work |
| **Phase** | Feature | A cohesive chunk within a milestone |
| **Plan** | Story | An individual executable unit within a phase |

A **Phase has multiple Plans** (like a Feature has multiple Stories).
GSD **executes the entire phase at once** via `/gsd:execute-phase`, which loops through all plans in that phase.

**There is NO `/gsd:execute-plan` command** — only `execute-plan.md` as a workflow file.
It's consumed internally by the `execute-phase` orchestrator. Users never invoke it directly.

---

## 2. The Three-Layer Architecture

GSD's execution is split into 3 distinct layers:

### Layer 1: Command + Orchestrator (`execute-phase.md`)

**What the user invokes:** `/gsd:execute-phase 3`

Its job is purely **coordination** — it never touches code:

1. **Discover** — Find all PLAN.md files in the phase directory
2. **Analyze** — Parse frontmatter (`wave`, `depends_on`) for dependency graph
3. **Group** — Organize plans into waves (same wave = parallelizable)
4. **Spawn** — Launch executor subagents (one per plan, fresh 200k context each)
5. **Handle checkpoints** — This is a multi-step dance between 3 actors (orchestrator, executor agent, user):

   **The problem:** Executor agents run as subagents via `Task()`. Subagents **cannot interact
   with the user directly**. When an executor hits a checkpoint task (`type="checkpoint:*"`),
   it needs human input but has no way to ask for it.

   **The solution — a relay pattern:**

   ```
   Step A: Executor agent hits checkpoint → STOPS immediately
           Returns structured state to orchestrator (not the user):
           - Completed tasks table (task names, commit hashes, files)
           - Current task number + name + blocker reason
           - Checkpoint type + details (what to verify / what to decide / what to do)
           - Awaiting section (what's needed from user)

   Step B: Orchestrator receives the return → parses it
           Presents checkpoint to user in formatted display:
           ╔═══════════════════════════════════════════════╗
           ║  CHECKPOINT: Verification Required             ║
           ╚═══════════════════════════════════════════════╝
           Progress: 2/3 tasks complete
           [checkpoint details + awaiting section]

   Step C: User responds ("approved" / describes issues / selects option / "done")

   Step D: Orchestrator spawns a FRESH continuation agent (NOT resume)
           Passes to it:
           - The completed tasks table from Step A (so it knows what's done)
           - The resume task number + name (where to pick up)
           - The user's response from Step C
           - Resume instructions based on checkpoint type:
             • After human-verify: "User approved, continue to next task"
             • After decision: "User selected option-b, implement that"
             • After human-action: "User completed action, verify it worked first"

   Step E: Continuation agent verifies previous commits exist (git log --oneline -5)
           Does NOT redo completed tasks
           Starts from resume point
           If it hits ANOTHER checkpoint → repeat from Step A
           (accumulated completed tasks = previous + new)
   ```

   **Why fresh agent instead of resume?**
   GSD discovered that the `resume` parameter relies on internal serialization that
   breaks when the original agent used parallel tool calls. Fresh agents with explicit
   state passed in the prompt are more reliable. The tradeoff is losing the agent's
   "memory" of execution context, but the completed tasks table + commit hashes +
   plan file provide enough context to continue accurately.

   **Checkpoints in parallel waves:**
   When multiple agents run in parallel (same wave) and one hits a checkpoint:
   - The checkpoint agent pauses and returns
   - Other parallel agents may still be running or may have completed
   - Orchestrator waits for ALL agents in the wave
   - Presents checkpoint to user
   - Spawns continuation
   - Only proceeds to next wave when ALL agents (including continuations) complete
6. **Spot-check** — The orchestrator does NOT blindly trust that agents succeeded.
   After each wave completes, it verifies each plan's results before moving on.

   **What is SUMMARY.md?**
   There is **one SUMMARY.md per plan** (NOT per phase). It's the executor agent's
   "receipt" — proof of what was done, what was committed, what deviated from the plan.
   Located at `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md`
   (e.g., `03-01-SUMMARY.md`, `03-02-SUMMARY.md`).

   **Who writes it?** The executor agent (gsd-executor), as its final act after all
   tasks complete. It's part of the agent's workflow — not the orchestrator's job.

   **When is it written?** After all tasks in a plan are executed and committed.
   The executor:
   1. Finishes all tasks (each committed atomically)
   2. Runs overall `<verification>` checks from the plan
   3. Confirms `<success_criteria>` are met
   4. Creates SUMMARY.md with frontmatter + documentation
   5. Runs a **self-check** against its own claims:
      - `[ -f "path/to/file" ]` for each file it claims to have created
      - `git log --oneline --all --grep="{hash}"` for each commit hash it claims
      - Appends `## Self-Check: PASSED` or `## Self-Check: FAILED`
   6. Updates STATE.md (position, decisions, metrics)
   7. Makes a final metadata commit: `docs({phase}-{plan}): complete [plan-name] plan`

   **What does SUMMARY.md contain?**
   ```yaml
   ---
   # Machine-readable frontmatter (for future context assembly)
   phase: 03-features
   plan: 01
   subsystem: auth                    # primary category
   tags: [jwt, bcrypt, jose]          # searchable tech keywords

   # Dependency graph — enables transitive closure for context selection
   requires:
     - phase: 02-foundation
       provides: User model
   provides:
     - JWT authentication middleware
     - Login/logout endpoints
   affects: [dashboard, api-routes]

   # Tech tracking
   tech-stack:
     added: [jose, bcrypt]
     patterns: [middleware-chain, httpOnly-cookies]
   key-files:
     created: [src/lib/auth.ts, src/middleware.ts]
     modified: [prisma/schema.prisma]
   key-decisions:
     - "Used jose over jsonwebtoken (ESM-native)"
     - "15-min access tokens, 7-day refresh tokens"

   # Metrics
   duration: 28min
   completed: 2025-01-15
   ---
   ```

   Body sections:
   - **Substantive one-liner** ("JWT auth with refresh rotation using jose" NOT "Auth done")
   - **Performance** — duration, start/end timestamps, task count, file count
   - **Accomplishments** — key outcomes (human-readable)
   - **Task Commits** — per-task: task name + commit hash + type (feat/fix/test/refactor)
   - **Files Created/Modified** — paths + what each does
   - **Decisions Made** — key decisions with rationale
   - **Deviations from Plan** — each auto-fix cited with Rule number, what was found,
     what was done, files modified, verification, commit hash
   - **Issues Encountered** — problems during planned work (distinct from deviations)
   - **Self-Check: PASSED/FAILED** — the executor's own verification of its claims

   **What does the orchestrator spot-check?**
   The orchestrator does 3 quick checks per completed plan (it does NOT read the full
   SUMMARY — that would bloat its context):

   ```
   For each SUMMARY.md in the wave:
     1. Verify first 2 files from `key-files.created` exist on disk
        → [ -f "src/lib/auth.ts" ] && echo "FOUND" || echo "MISSING"

     2. Check git log for plan-scoped commits
        → git log --oneline --all --grep="{phase}-{plan}" returns ≥1 commit

     3. Check for self-check failure marker
        → grep "## Self-Check: FAILED" SUMMARY.md
   ```

   If ANY spot-check fails → report which plan failed → ask user:
   "Retry plan?" or "Continue with remaining waves?"

   If all pass → report wave completion with what was built (extracted from SUMMARY
   one-liners) and what this enables for the next wave.

   **Why SUMMARY.md matters beyond spot-checking:**
   - **Resumability**: Re-running `/gsd:execute-phase` skips plans that have a SUMMARY.md
   - **Context assembly**: Future plans reference prior SUMMARY frontmatter for dependencies
   - **Fast scanning**: Frontmatter is ~25 lines, cheap to scan across all summaries
   - **Knowledge capture**: Decisions, patterns, and deviations are preserved for future phases

7. **Verify goal** — Spawn verifier agent to check `must_haves` against codebase

8. **Update state** — After all waves complete and verification passes, the orchestrator
   updates two files:

   **ROADMAP.md updates:**
   The roadmap contains a table/list of all phases in the milestone. The orchestrator:
   - Finds the current phase entry
   - Changes its status from "In progress" to "Complete"
   - Adds the completion date
   - If more plans remain (not last plan in phase): updates the plan progress count
     but keeps status as "In progress"

   Example before:
   ```markdown
   | Phase | Name           | Status      | Date       |
   |-------|----------------|-------------|------------|
   | 1     | Foundation     | Complete    | 2025-01-10 |
   | 2     | Auth           | Complete    | 2025-01-12 |
   | 3     | Features       | In progress |            |
   | 4     | Polish         | Planned     |            |
   ```

   Example after executing phase 3:
   ```markdown
   | Phase | Name           | Status      | Date       |
   |-------|----------------|-------------|------------|
   | 1     | Foundation     | Complete    | 2025-01-10 |
   | 2     | Auth           | Complete    | 2025-01-12 |
   | 3     | Features       | Complete    | 2025-01-15 |
   | 4     | Polish         | Planned     |            |
   ```

   **STATE.md updates** (done by executor agent per-plan, AND by orchestrator at end):

   The executor updates after each plan:
   ```bash
   # Advance plan counter (increments "Current Plan: 2 of 5" → "3 of 5")
   # Handles edge cases: last plan sets status to phase-complete
   node gsd-tools.js state advance-plan

   # Recalculate progress bar from SUMMARY.md counts on disk
   # e.g., [████████░░░░░░░░░░░░] 40% (2/5 plans)
   node gsd-tools.js state update-progress

   # Record execution metrics (duration, tasks, files)
   node gsd-tools.js state record-metric --phase 03 --plan 01 --duration "28min" ...

   # Add decisions discovered during execution
   node gsd-tools.js state add-decision --phase 03 --summary "Used jose over jsonwebtoken"

   # Update session continuity (resume point if context resets)
   node gsd-tools.js state record-session --stopped-at "Completed 03-01-PLAN.md"
   ```

   STATE.md sections affected:
   - **Current Position**: Phase X, Plan Y of Z
   - **Progress Bar**: Visual `[████░░░░]` recalculated from disk
   - **Decisions**: Accumulated list from all plans (extracted from SUMMARY key-decisions)
   - **Performance Metrics**: Table with duration/tasks/files per plan
   - **Session Info**: Last session timestamp + "Stopped At" for resume

   **Final metadata commit:**
   ```bash
   git commit -m "docs(phase-03): complete phase execution"
   # Includes: ROADMAP.md, STATE.md, VERIFICATION.md
   ```

   **Then the orchestrator routes to next action:**
   - More phases remaining → suggest `/gsd:plan-phase {X+1}`
   - All phases done → suggest `/gsd:complete-milestone`

The orchestrator stays **extremely lean** (~10-15% context usage).
It passes file paths to agents — it never reads plan details itself.

### Layer 2: Execution Logic (`execute-plan.md`)

This is the **workflow reference** loaded into the executor agent's context.
It's NOT a standalone command — it's the instruction manual for how to execute a plan.

Contains:
- **Execution pattern detection** (3 patterns based on checkpoint presence)
- **Deviation rules** (4 rules for handling unplanned work)
- **Commit protocol** (per-task atomic commits)
- **Checkpoint protocol** (stop, return state, enable continuation)
- **TDD execution** (RED-GREEN-REFACTOR cycle)
- **Summary creation** (post-execution documentation)
- **State updates** (progress, decisions, metrics → STATE.md)

### Layer 3: Executor Agent (`gsd-executor.md`)

The **subagent** that actually touches code:

1. Loads the PLAN.md file assigned to it
2. Reads STATE.md for project context
3. Executes each task sequentially within the plan
4. Commits after each task (atomic commits)
5. Handles deviations automatically (Rules 1-3) or stops (Rule 4)
6. Creates SUMMARY.md with frontmatter + documentation
7. Updates STATE.md with position, decisions, metrics
8. Returns completion status to orchestrator

---

## 3. Execution Patterns (How the Executor Decides What To Do)

When the executor loads a plan, it checks for checkpoint tasks:

```bash
grep -n "type=\"checkpoint" [plan-path]
```

This determines one of 3 patterns:

| Pattern | Condition | Execution |
|---|---|---|
| **A: Fully Autonomous** | No checkpoints | Single subagent: execute all tasks + SUMMARY + commit |
| **B: Segmented** | Has verify-only checkpoints | Segments between checkpoints; auto segments → subagent, checkpoints → main |
| **C: Main Context** | Has decision checkpoints | Execute entirely in main context (needs user interaction) |

### Pattern A (Most Common)
Agent runs all tasks start-to-finish. No pauses. Creates SUMMARY.md. Commits everything. Returns.

### Pattern B
Plan split into segments at checkpoint boundaries. Autonomous segments run in subagents.
Checkpoint segments execute in main context where user interaction is possible.
After ALL segments: aggregate results → create SUMMARY.md → commit → self-check.

### Pattern C
Entire plan runs in main context because it requires architectural decisions from user.

---

## 4. Wave-Based Parallel Execution

Plans declare their `wave` number and `depends_on` at **planning time** (in PLAN.md frontmatter):

```yaml
# Plan 01 — wave 1, no deps → runs immediately
wave: 1
depends_on: []
files_modified: [src/models/user.ts, src/api/users.ts]

# Plan 02 — wave 1, no deps → runs IN PARALLEL with Plan 01
wave: 1
depends_on: []
files_modified: [src/models/product.ts, src/api/products.ts]

# Plan 03 — wave 2, depends on Plan 01 → waits for wave 1
wave: 2
depends_on: ["01"]
files_modified: [src/features/dashboard.ts]
```

**Orchestrator execution loop:**

```
Wave 1 → spawn agents for Plan 01 + Plan 02 (parallel)
       → wait for both to complete
       → spot-check both SUMMARY.md files
Wave 2 → spawn agent for Plan 03 (depends on wave 1)
       → wait for completion
       → spot-check SUMMARY.md
Done   → verify phase goal → update roadmap
```

Parallelization can be disabled (`parallelization: false` in config) — plans in same wave then run sequentially.

---

## 5. The PLAN.md Structure (What Gets Executed)

Each plan is a `.planning/phases/XX-name/{phase}-{plan}-PLAN.md` file with:

### Frontmatter
```yaml
---
phase: 03-features
plan: 01
type: execute          # or "tdd"
wave: 1                # pre-computed at plan time
depends_on: []         # plan IDs this requires
files_modified: []     # files this plan touches
autonomous: true       # false if has checkpoints
user_setup: []         # human-required setup (accounts, secrets)

must_haves:
  truths: []           # observable behaviors that must be true
  artifacts: []        # files that must exist with real implementation
  key_links: []        # critical connections between artifacts
---
```

### Body Structure
```xml
<objective>What this plan accomplishes + why + output</objective>

<execution_context>
  @~/.claude/get-shit-done/workflows/execute-plan.md
  @~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
  @.planning/PROJECT.md
  @.planning/ROADMAP.md
  @.planning/STATE.md
  @src/relevant/source.ts
</context>

<tasks>
  <task type="auto">
    <name>Task 1: Action-oriented name</name>
    <files>path/to/file.ext</files>
    <action>Specific implementation instructions</action>
    <verify>Command or check to prove it worked</verify>
    <done>Measurable acceptance criteria</done>
  </task>
  <!-- more tasks... -->
</tasks>

<verification>
  - [ ] npm run build succeeds
  - [ ] Tests pass
</verification>

<success_criteria>
  - All tasks completed
  - Feature works end-to-end
</success_criteria>
```

### Plan Sizing Guidelines
- **2-3 tasks per plan** (~50% context usage max)
- **Vertical slices preferred** (model + API + UI per feature, NOT all models → all APIs → all UIs)
- Split when: different subsystems, >3 tasks, risk of context overflow, TDD candidates

---

## 6. Checkpoint Handling (Human-in-the-Loop)

### 3 Checkpoint Types

| Type | Frequency | What Happens |
|---|---|---|
| `checkpoint:human-verify` | 90% | Claude built it, human confirms it works visually |
| `checkpoint:decision` | 9% | Human makes architectural/technology choice |
| `checkpoint:human-action` | 1% | Truly unavoidable manual step (email verification, 2FA) |

### Golden Rules
1. **If Claude can run it, Claude runs it** — never ask user to execute CLI commands
2. **Claude sets up verification environment** — starts dev servers, seeds databases
3. **User only does human-judgment tasks** — visual checks, UX evaluation
4. **Secrets come from user, automation comes from Claude**

### Checkpoint Flow (Subagent Context)

When an executor agent hits a checkpoint, it **cannot interact with user directly**.
Instead it returns structured state:

```markdown
## CHECKPOINT REACHED

**Type:** human-verify
**Plan:** 03-03
**Progress:** 2/3 tasks complete

### Completed Tasks
| Task | Name        | Commit  | Files                |
|------|-------------|---------|----------------------|
| 1    | Build layout| abc123f | Dashboard.tsx        |
| 2    | Start server| def456g | (background process) |

### Checkpoint Details
Visit http://localhost:3000/dashboard and verify:
1. Desktop: Sidebar visible, content fills space
2. Mobile: Sidebar hidden, hamburger menu appears

### Awaiting
Type "approved" or describe issues
```

The **orchestrator** receives this, presents it to the user, collects response,
then spawns a **fresh continuation agent** (NOT resume) with:
- Completed tasks table (so it knows what's done)
- Resume task number + name
- User's response
- Resume instructions based on checkpoint type

**Why fresh agent, not resume?** GSD found that resume relies on internal serialization
that breaks with parallel tool calls. Fresh agents with explicit state are more reliable.

---

## 7. Deviation Rules — Autonomous Problem-Solving

The executor has 4 rules for handling work not in the plan:

### Rule 1: Auto-fix Bugs (Auto)
**Trigger:** Broken behavior, errors, wrong queries, type errors, security vulnerabilities, race conditions
**Action:** Fix inline → test → verify → track as `[Rule 1 - Bug]`

### Rule 2: Auto-add Missing Critical (Auto)
**Trigger:** Missing error handling, validation, auth, CSRF/CORS, rate limiting, indexes, logging
**Action:** Add → test → verify → track as `[Rule 2 - Missing Critical]`

### Rule 3: Auto-fix Blocking Issues (Auto)
**Trigger:** Missing deps, wrong types, broken imports, missing env/config, circular deps
**Action:** Fix blocker → verify → track as `[Rule 3 - Blocking]`

### Rule 4: Ask About Architectural Changes (STOP)
**Trigger:** New DB table, major schema change, switching libraries, breaking API, new infrastructure
**Action:** STOP → present decision to user → wait → implement chosen option

### Priority
Rule 4 (STOP) > Rules 1-3 (auto-fix) > Unsure → Rule 4 (ask)

### Heuristic
"Does this affect correctness, security, or ability to complete the task?"
- **YES** → Rules 1-3 (auto-fix)
- **MAYBE** → Rule 4 (ask user)

All deviations documented in SUMMARY.md regardless of which rule applied.

---

## 8. Authentication Gates

Auth errors during execution are **gates, not failures**.

**Indicators:** "Not authenticated", 401/403, "Please run X login", "Set ENV_VAR"

**Protocol:**
1. Recognize it's an auth gate (not a bug)
2. STOP current task
3. Create dynamic `checkpoint:human-action`
4. Provide exact auth steps (CLI commands, where to get keys)
5. User authenticates
6. Verify credentials work
7. Retry original task
8. Continue normally

Documented as normal flow in SUMMARY.md, NOT as deviations.

---

## 9. Commit Protocol

### Per-Task Atomic Commits

After each task (verification passed, done criteria met):

1. `git status --short` — check modified files
2. **Stage individually** (NEVER `git add .` or `git add -A`)
3. Commit with conventional format:

```
{type}({phase}-{plan}): {concise description}

- key change 1
- key change 2
```

| Type | When |
|---|---|
| `feat` | New functionality |
| `fix` | Bug fix |
| `test` | Test-only (TDD RED) |
| `refactor` | No behavior change (TDD REFACTOR) |
| `chore` | Config, deps |

4. Record hash: `git rev-parse --short HEAD` → tracked for SUMMARY

### Metadata Commit
After all tasks, a separate docs commit captures SUMMARY.md + STATE.md + ROADMAP.md.

---

## 10. SUMMARY.md — Post-Execution Documentation

Created after all tasks complete. Located at `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md`.

### Structure
```yaml
---
# Frontmatter (machine-readable for future context assembly)
phase: XX-name
plan: NN
subsystem: auth         # primary category
tags: [jwt, bcrypt]     # searchable tech
requires: [...]         # dependency graph
provides: [...]
affects: [...]
tech-stack: {added: [...], patterns: [...]}
key-files: {created: [...], modified: [...]}
key-decisions: [...]
duration: 28min
completed: 2025-01-15
---

# Phase [X] Plan [Y]: [Name] Summary

**[Substantive one-liner — "JWT auth with refresh rotation" NOT "Auth implemented"]**

## Performance (duration, timestamps, task/file counts)
## Accomplishments (key outcomes)
## Task Commits (per-task with hashes)
## Files Created/Modified
## Decisions Made
## Deviations from Plan (auto-fixed issues with rule citations)
## Issues Encountered
## Next Phase Readiness
```

### Self-Check
After writing SUMMARY.md, executor verifies its own claims:
- Check created files exist on disk with `[ -f ]`
- Check commits exist with `git log --oneline --all --grep="{hash}"`
- Append `## Self-Check: PASSED` or `## Self-Check: FAILED`

Does NOT proceed to state updates if self-check fails.

---

## 11. Post-Execution Verification (Goal-Backward)

After all plans in a phase complete, the orchestrator spawns a **gsd-verifier** agent.

It checks `must_haves` from plan frontmatter against the actual codebase:

| Field | What It Checks |
|---|---|
| `truths` | Observable behaviors verified via tests/code inspection |
| `artifacts` | Files exist with real implementation (not stubs), min lines, expected exports |
| `key_links` | Critical connections between components verified via regex pattern matching |

**Results:**

| Status | Action |
|---|---|
| `passed` | Mark phase complete in roadmap |
| `human_needed` | Present items for human testing |
| `gaps_found` | Create gap-closure plans → execute → re-verify |

**Gap closure cycle:**
`/gsd:plan-phase X --gaps` reads VERIFICATION.md → creates gap plans with `gap_closure: true`
→ `/gsd:execute-phase X --gaps-only` → verifier re-runs

This is the key insight: **task completion ≠ goal achievement**.

---

## 12. State Management

### STATE.md (Project-Wide)
Updated after each plan execution:
- **Position**: Current phase/plan being executed
- **Progress**: Visual progress bar (calculated from SUMMARY.md counts on disk)
- **Decisions**: Accumulated from all plan executions
- **Metrics**: Duration, task count, file count per plan
- **Session**: Last session timestamp, resume point

### Resumability
Re-running `/gsd:execute-phase X` skips completed plans (those with SUMMARY.md).
STATE.md tracks the last completed plan so execution resumes from the right spot.

---

## 13. Agent Tracking

GSD tracks spawned agents in `.planning/agent-history.json`:

```json
{
  "version": "1.0",
  "max_entries": 50,
  "entries": [
    {
      "agent_id": "[id]",
      "task_description": "[desc]",
      "phase": "[phase]",
      "plan": "[plan]",
      "timestamp": "[ISO]",
      "status": "spawned|completed"
    }
  ]
}
```

Also writes `current-agent-id.txt` during execution. If found on startup → interrupted agent detected → offer resume or fresh start.

---

## 14. Failure Handling

| Failure | Response |
|---|---|
| **Claude Code bug** (`classifyHandoffIfNeeded`) | Spot-check: SUMMARY exists + commits present → treat as success |
| **Agent fails mid-plan** | Missing SUMMARY.md → report, ask user |
| **Dependency chain breaks** | Wave 1 fails → Wave 2 dependents likely fail → user chooses attempt/skip |
| **All agents in wave fail** | Systemic issue → stop, report |
| **Checkpoint unresolvable** | "Skip plan?" or "Abort?" → record partial progress |

---

## 15. Key Design Decisions to Consider for ACE

1. **User calls ONE command** — `/gsd:execute-phase`. Individual plan execution is internal only.

2. **Fresh agents, not resume** — Each plan gets fresh 200k context. Checkpoints spawn fresh continuation agents. More reliable than resume.

3. **Orchestrator never executes code** — Only coordinates. Keeps context at 10-15%.

4. **Per-task atomic commits** — Each task gets its own commit with conventional format. Enables precise rollback.

5. **Spot-checking, not blind trust** — Orchestrator verifies SUMMARY.md exists and commits exist before proceeding to next wave.

6. **Goal-backward verification** — Separate from task completion. "Did we achieve the goal?" not just "Did we finish the tasks?"

7. **Resumability built-in** — Re-running the command skips completed work (detected by SUMMARY.md existence).

8. **Deviation rules are autonomous** — Agent fixes bugs, missing features, and blockers without asking. Only stops for architectural changes.

9. **Context window protection** — Orchestrator passes file paths, not file contents. Each agent reads what it needs in its own context.

10. **Wave pre-computation** — Dependencies and waves are computed at planning time, not runtime. Execute-phase just reads frontmatter.

---

## 16. ACE Differences to Account For

| Aspect | GSD | ACE Consideration |
|---|---|---|
| **Scope** | Executes entire phase (multiple plans) | Need both: execute single story AND execute entire feature |
| **Tooling** | `gsd-tools.js` CLI for state management | ACE has no equivalent tooling — pure markdown/agent based |
| **Agent Teams** | Always uses subagents | ACE needs two modes: with and without agent teams |
| **Plan format** | XML tasks in PLAN.md | ACE stories have Gherkin ACs + technical solution |
| **State tracking** | STATE.md + gsd-tools.js | ACE needs its own state tracking approach |
| **Verification** | Separate verifier agent post-phase | ACE may want story-level verification too |
