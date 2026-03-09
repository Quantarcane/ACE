# ACE Execute-Story — Design Plan

> Design document for building the `execute-story` command, workflow, and supporting artifacts.
> References: [gsd-execution-analysis.md](gsd-execution-analysis.md) | [agent-teams.md](agent-teams.md)

---

## Table of Contents

1. [What We're Building](#1-what-were-building)
2. [Key Differences from GSD](#2-key-differences-from-gsd)
3. [Agent Teams — How They Actually Work](#3-agent-teams--how-they-actually-work)
4. [Architecture Overview](#4-architecture-overview)
5. [Artifacts to Create/Modify](#5-artifacts-to-createmodify)
6. [Detailed Flow — Step by Step](#6-detailed-flow--step-by-step)
7. [Agent Teams Mode — Deep Dive](#7-agent-teams-mode--deep-dive)
8. [Solo Mode — Deep Dive](#8-solo-mode--deep-dive)
9. [Code Review](#9-code-review)
10. [Quality Enforcement Pipeline](#10-quality-enforcement-pipeline)
11. [State Updates](#11-state-updates)
12. [Wiki Update](#12-wiki-update)
13. [ace-tools.js Changes](#13-ace-toolsjs-changes)
14. [Story Template Changes](#14-story-template-changes)
15. [Open Questions — Resolved](#15-open-questions--resolved)
16. [Implementation Order](#16-implementation-order)

---

## 1. What We're Building

A single command `/ace:execute-story story=<path|github-url>` that:

1. Loads a fully-planned story (with AC + Technical Solution)
2. Uses Claude Code **Plan Mode** to create an execution plan
3. Executes the plan — either solo or with Agent Teams
4. Runs code review (catch TODOs, stubs, placeholders, hardcoded values)
5. Presents results to user for verification/approval
6. Updates state (story file, feature file, product-backlog, GitHub)
7. Runs wiki mapper to update engineering wiki

**Two execution modes:**
- **Solo Mode** (default, or `--agent-teams-off`): Single context window, plan mode → execute
- **Agent Teams Mode** (when enabled + plan recommends it): Lead + teammates for parallel work

---

## 2. Key Differences from GSD

| Aspect | GSD | ACE |
|--------|-----|-----|
| **Scope** | `execute-phase` runs ALL plans in a phase | `execute-story` runs ONE story |
| **Planning** | Plans are pre-written PLAN.md files (created by `/gsd:plan-phase`) | Story file IS the plan (AC + Technical Solution = GSD's PLAN.md equivalent). Claude Code Plan Mode creates the final execution plan on top of that — a tactical breakdown of the already-designed solution. |
| **Parallelism** | Wave-based subagent spawning | Agent Teams (full Claude Code sessions with peer communication) |
| **Checkpoints** | Relay pattern: agent → orchestrator → user → fresh agent | Agent Teams: user talks directly to teammates. Solo: main context handles it |
| **State tracking** | STATE.md + ROADMAP.md via gsd-tools.js | Story file (summary-and-state section) + feature file + product-backlog + GitHub — all via ace-tools.js |
| **Summary** | Separate SUMMARY.md per plan | Inline `<section name="summary-and-state">` in story file |
| **Executor agent** | Dedicated gsd-executor agent with full protocol | No dedicated executor agent — Claude Code itself + Plan Mode |
| **Verification** | Separate gsd-verifier agent post-phase | ace-code-reviewer agent (inline during or after execution) |

**Why no dedicated executor agent?**
GSD needs an executor agent because it pre-writes PLAN.md files with XML task structures. ACE uses Claude Code's native Plan Mode which creates and executes plans natively — there's no need for a separate agent to parse and follow XML tasks. The plan IS the execution.

**Why no execute-feature?**
In ACE, stories are executed one at a time. The feature is just a grouping — there's no batch execution across stories. This keeps context focused and allows the user to steer between stories.

---

## 3. Agent Teams — How They Actually Work

### Architecture (from official docs research)

Agent Teams are **NOT subagents**. They are fully independent Claude Code sessions:

| Component | What It Is |
|-----------|------------|
| **Team Lead** | The main Claude Code session that creates the team |
| **Teammates** | Separate, independent Claude Code instances (each with own 200k context) |
| **Task List** | Shared file-based task list with dependency tracking (pending → in_progress → completed) |
| **Mailbox** | Peer-to-peer messaging between any agents (no relay through lead needed) |

### Key Behaviors

- **User can talk to ANY teammate directly** via `Shift+Down` to cycle
- **Teammates message each other** — no bottleneck through the lead
- **Lead does NOT automatically create teams** — Claude may suggest it, but user confirms
- **Teammates can be required to plan before implementing** (lead approves their plans)
- **No nested teams** — teammates cannot spawn their own teams
- **Task dependency auto-resolution** — when a task completes, blocked tasks unblock
- **File locking** prevents race conditions on task claiming

### Limitations Relevant to ACE

1. **No session resumption** with in-process teammates (`/resume` won't restore them)
2. **Task status can lag** — teammates sometimes fail to mark tasks completed
3. **One team per session** — clean up before starting a new one
4. **Split pane NOT supported on Windows Terminal** — must use in-process mode
5. **~7x token cost** compared to standard sessions
6. **Cleanup must go through lead** — teammates should not run cleanup

### What This Means for Checkpoints

**Agent Teams mode eliminates the GSD relay pattern entirely.** The user can:
- Cycle to the teammate doing the work (`Shift+Down`)
- Give feedback directly to that teammate
- The teammate continues without spawning a fresh agent

This is a massive simplification over GSD's orchestrator → user → fresh continuation agent dance.

---

## 4. Architecture Overview

```
/ace:execute-story story=path/to/story.md
         │
         ▼
┌─────────────────────────────┐
│  STEP 1: Init & Validate    │  ace-tools.js init execute-story
│  Load story, check AC,      │  Validate: AC exists, Tech Solution exists
│  check tech solution,       │  Detect: agent_teams enabled?
│  detect agent teams         │  Extract: all story sections
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  STEP 2: Enter Plan Mode    │  Claude Code native Plan Mode
│  Feed technical solution    │  Create execution plan from story spec
│  + AC + wiki + coding stds  │  Decide: agent teams beneficial?
│  Generate execution plan    │  Output: approved plan
└─────────┬───────────────────┘
          │
          ▼
    ┌─────┴─────┐
    │  Teams?   │
    ├───Yes─────┼───No──────┐
    ▼           ▼           │
┌────────┐  ┌────────┐     │
│ STEP 3a│  │ STEP 3b│     │
│ Agent  │  │ Solo   │     │
│ Teams  │  │ Execute│     │
│ Execute│  │        │     │
└───┬────┘  └───┬────┘     │
    │           │           │
    └─────┬─────┘           │
          ▼                 │
┌─────────────────────────────┐
│  STEP 4: Code Review        │  ace-code-reviewer agent
│  Check for TODOs, stubs,    │  Solo: post-execution review
│  placeholders, hardcoded    │  Teams: reviewer teammate during execution
│  values, implementation gaps│
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  STEP 5: User Verification  │  Present results to user
│  Show what was built        │  User approves or reports issues
│  AC scenario walkthrough    │  If issues → fix cycle
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  STEP 6: State Updates      │  Story file: summary-and-state section
│  Update story, feature,     │  Feature file: story status
│  product-backlog, GitHub    │  Product-backlog: story/feature status
│                             │  GitHub: issues updated
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  STEP 7: Wiki Update        │  ace-wiki-mapper agent (background)
│  Update engineering wiki    │  Add wiki-updates tag to story
│  based on what changed      │
└─────────────────────────────┘
```

---

## 5. Artifacts to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `commands/ace/execute-story.md` | Command definition (like plan-story.md) |
| `agile-context-engineering/workflows/execute-story.xml` | Full workflow (like plan-story.xml) |
| `agents/ace-code-reviewer.md` | Code reviewer agent (currently empty file) |

### Files to Modify

| File | Change |
|------|--------|
| `agile-context-engineering/templates/product/story.xml` | Add `<section name="summary-and-state">` and `<section name="wiki-updates">` |
| `agile-context-engineering/src/ace-tools.js` | Add `init execute-story` command, add state update helpers |

---

## 6. Detailed Flow — Step by Step

### STEP 1: Init & Validate

```bash
INIT=$(node ~/.claude/agile-context-engineering/src/ace-tools.js init execute-story {story_param})
```

**New `init execute-story` command in ace-tools.js.** Returns:

```json
{
  "executor_model": "opus",
  "reviewer_model": "sonnet",
  "commit_docs": true,
  "has_git": true,
  "has_gh_cli": true,
  "github_project": { "enabled": true, "repo": "owner/repo", ... },
  "agent_teams": true,

  "story_valid": true,
  "story_source": "file",
  "story_content": "...",

  "story": { "id": "S3", "title": "Display OAuth Buttons", "status": "Refined", "size": 3 },
  "feature": { "id": "F3", "title": "OAuth2 Login Flow" },
  "epic": { "id": "#45", "title": "User Authentication" },

  "has_acceptance_criteria": true,
  "acceptance_criteria_count": 5,
  "has_technical_solution": true,
  "has_wiki_refs": true,
  "has_coding_standards": true,

  "paths": {
    "story_file": ".ace/artifacts/product/e1-auth/f3-oauth/s3-buttons/s3-buttons.md",
    "story_dir": ".ace/artifacts/product/e1-auth/f3-oauth/s3-buttons",
    "feature_file": ".ace/artifacts/product/e1-auth/f3-oauth/f3-oauth.md",
    "product_backlog": ".ace/artifacts/product/product-backlog.md",
    "coding_standards": ".docs/wiki/system-wide/coding-standards.md",
    "external_analysis_file": "...",
    "integration_analysis_file": "..."
  }
}
```

**Validation gates:**
- `has_acceptance_criteria` must be true → STOP if false ("Story has no AC. Run /ace:plan-story first.")
- `has_technical_solution` must be true → STOP if false ("Story has no technical solution. Run /ace:plan-story first.")
- `story.status` should be "Refined" → WARN if "In Progress" (already started), STOP if "Done" (already done)

**Check `--agent-teams-off` flag:**
- If flag present → force `agent_teams = false` regardless of setting
- If not present → use `INIT.agent_teams` value from settings

### STEP 2: Enter Plan Mode

This is where ACE diverges fundamentally from GSD. Instead of pre-written PLAN.md files,
we use Claude Code's **native Plan Mode** to generate the execution plan dynamically.

**What gets fed into Plan Mode:**

1. **Story AC** — the Gherkin scenarios (WHAT to build)
2. **Technical Solution** — from the story file (HOW to build it)
3. **Relevant Wiki** — from the story file (WHERE things live in the codebase)
4. **Coding Standards** — from `.docs/wiki/system-wide/coding-standards.md` (HOW to write code)
5. **Out of Scope** — explicit exclusions (what NOT to build)
6. **Dependencies** — what must exist before this story
7. **DoD** — quality checklist

**Plan Mode instructions (injected into plan mode context):**

```
Create an execution plan for this story based on the technical solution.

RULES:
- Follow the technical solution's component breakdown and sequence diagrams
- Each task must map to one or more AC scenarios
- Include verification steps (tests, build checks) after implementation tasks
- Follow coding standards from wiki
- Per-task atomic commits with conventional format: feat(story-id): description
- DO NOT implement anything outside the AC scenarios (respect Out of Scope)

AGENT TEAMS DECISION (only if agent_teams enabled):
Assess whether this story would benefit from Agent Teams:
- Story size >= 5 SP AND touches multiple subsystems → RECOMMEND teams
- Technical solution shows 3+ independent components → RECOMMEND teams
- Estimated implementation would exceed ~140k tokens (70% of 200k) → RECOMMEND teams
- Otherwise → Solo execution is sufficient

If recommending teams, specify:
- Number of teammates (2-4)
- Role per teammate (e.g., "backend API", "frontend UI", "test suite")
- Which tasks each teammate handles
- Dependencies between teammates' work
```

**User approves the plan** (standard Plan Mode approval flow).

### STEP 3a: Agent Teams Execution

See [Section 7](#7-agent-teams-mode--deep-dive) for full details.

### STEP 3b: Solo Execution

See [Section 8](#8-solo-mode--deep-dive) for full details.

### STEP 4: Code Review

See [Section 9](#9-code-review) for full details.

### STEP 5: User Verification

After implementation + code review:

```
╔══════════════════════════════════════════════════╗
║  ACE > Execute Story > Verification               ║
╚══════════════════════════════════════════════════╝

Story: S3 — Display OAuth Provider Buttons

Implementation complete. Please verify:

  Acceptance Criteria Walkthrough:
  ────────────────────────────────
  1. ✓ Successful Google login — [auto-verified: tests pass]
  2. ? Provider unavailable — [needs manual check: visit /login, disable network]
  3. ✓ Button styling matches design — [needs visual check]
  ...

  Code Review Results:
  ────────────────────
  ✓ No TODOs or placeholders found
  ✓ No hardcoded values
  ⚠ 1 warning: Missing error boundary in OAuthButton component
```

Use AskUserQuestion:
- header: "Verify"
- question: "Implementation and code review complete. Does everything look correct?"
- options:
  - "Approve (Done)" — All AC verified, mark story as Done
  - "Approve (DevReady)" — Implementation done but needs manual testing later
  - "Fix issues" — Something needs to be changed
  - "Show details" — Show full code review report

If "Fix issues" → loop back to fix → re-review → re-verify.

### STEP 6: State Updates

See [Section 11](#11-state-updates) for full details.

### STEP 7: Wiki Update

See [Section 12](#12-wiki-update) for full details.

---

## 7. Agent Teams Mode — Deep Dive

When agent teams is enabled AND the plan recommends teams:

### Team Creation

The lead (our command's main context) instructs Claude Code to create a team:

```
Create an agent team for implementing story S3 — Display OAuth Provider Buttons.

Teammates:
1. "backend" — Implement OAuth API endpoints and middleware
   Tasks: [tasks from plan]
   Plan approval required before implementation.

2. "frontend" — Implement OAuth button components and login page
   Tasks: [tasks from plan]
   Plan approval required before implementation.

3. "reviewer" — Review code written by backend and frontend teammates
   Watches for: TODOs, stubs, placeholders, hardcoded values, missing tests,
   deviation from coding standards, missing error handling.
   Messages teammates directly when issues found.

All teammates must follow:
- Coding standards from .docs/wiki/system-wide/coding-standards.md
- Per-task atomic commits: feat(S3): description
- Technical solution from story file
```

### How It Flows

1. **Lead creates team** with 2-4 teammates based on plan
2. **Each teammate receives their task subset** from the plan
3. **Teammates plan independently** → lead approves each plan
4. **Teammates execute in parallel** — they message each other for coordination
5. **Reviewer teammate monitors** — checks code as it's committed, messages others about issues
6. **User can interact with any teammate** via `Shift+Down`
7. **When all teammates idle** → lead collects results
8. **Lead runs final verification** → presents to user

### Checkpoints in Teams Mode

No relay pattern needed! If a teammate needs user input:
- The teammate asks directly (it's a full Claude Code session)
- User navigates to that teammate with `Shift+Down`
- User responds directly
- Teammate continues

### Reviewer as Teammate

The reviewer teammate is the ACE equivalent of GSD's verifier, but it runs **concurrently**:

```
You are a code reviewer teammate. Your job:

1. Watch for file changes from other teammates (check git diff / new files periodically)
2. For each batch of changes, review for:
   - TODO/FIXME/HACK/PLACEHOLDER comments
   - Hardcoded values that should be configurable
   - Missing error handling
   - Stubs or placeholder implementations
   - Deviations from coding standards
   - Missing tests for new functionality
   - Dead code (unused imports, unreferenced functions, orphaned files)
   - Backwards-compatible shims (old variable names re-exported, deprecated wrappers, "// removed" comments)
3. If you find issues, message the responsible teammate directly
4. Keep a running tally of issues found and resolved
5. When all teammates are done, do a final sweep

You are NOT implementing code. You are only reviewing.
```

### Reviewer Creates Tasks for Teammates

The reviewer doesn't just flag issues — it **creates tasks** in the shared task list when it
finds problems that need fixing. This happens while other teammates are still working:

```
┌─────────────┐     reviews changes      ┌─────────────┐
│  backend    │ ◄─────────────────────── │  reviewer   │
│  teammate   │                          │  teammate   │
└─────────────┘                          └──────┬──────┘
                                                │
                                          finds dead code
                                          in auth.service.ts
                                                │
                                                ▼
                                    ┌──────────────────────┐
                                    │  Shared Task List     │
                                    │  NEW: "Remove unused  │
                                    │  validateLegacy() in  │
                                    │  auth.service.ts"     │
                                    │  assigned: backend    │
                                    └──────────────────────┘
```

**How it works:**

1. **Reviewer finds issue** → creates a new task in the shared task list with:
   - Clear description of what's wrong
   - File path and location
   - Assigned to the responsible teammate
   - Severity: `blocker` (must fix) or `warning` (should fix)
2. **Reviewer messages the teammate** with the issue context
3. **Teammate picks up the task** alongside their other work
4. **Reviewer verifies the fix** when the task is marked complete

**TaskCompleted hook integration:** When a teammate marks a task complete, the reviewer
can use the `TaskCompleted` hook to validate the fix was actually applied (not just claimed).

**This creates a continuous quality feedback loop** during execution, not just a post-hoc review.

---

## 8. Solo Mode — Deep Dive

When agent teams is disabled OR plan says solo is sufficient:

### Execution

1. Plan Mode creates the plan
2. User approves the plan
3. Claude Code executes the plan natively (this is just standard Claude Code plan execution)
4. Per-task atomic commits with conventional format
5. GSD-inspired deviation rules apply (auto-fix bugs, missing critical, blocking issues; ask for architectural changes)

### Deviation Rules (Adapted from GSD)

Same 4 rules as GSD, adapted for ACE context. These are instructions baked into the
**workflow**, not a separate agent.

**RULE 1: Auto-fix Bugs (Auto — no user approval)**
- **Trigger:** Broken behavior, errors, wrong queries, type errors, null pointer exceptions,
  security vulnerabilities, race conditions, memory leaks
- **Action:** Fix inline → add/update tests if applicable → verify fix → continue → track as `[Rule 1 - Bug]`
- **Examples:** Logic error in OAuth callback, wrong API URL, missing await on async call

**RULE 2: Auto-add Missing Critical Functionality (Auto — no user approval)**
- **Trigger:** Code missing essentials for correctness, security, or basic operation
- **Action:** Add → test → verify → continue → track as `[Rule 2 - Missing Critical]`
- **Examples:** Missing input validation, no error handling on API call, missing CSRF token,
  no auth check on protected route, missing rate limiting
- **"Critical" = required for correct/secure/performant operation.** These aren't features — they're correctness requirements.

**RULE 3: Auto-fix Blocking Issues (Auto — no user approval)**
- **Trigger:** Something prevents completing the current task
- **Action:** Fix blocker → verify unblocked → continue → track as `[Rule 3 - Blocking]`
- **Examples:** Missing dependency, wrong types, broken imports, missing env var, circular dep

**RULE 4: Ask About Architectural Changes (STOP — user decision required)**
- **Trigger:** Fix requires significant structural modification beyond story scope
- **Action:** STOP → present: what found, proposed change, why needed, impact, alternatives → wait for user
- **Examples:** New DB table (not column), major schema changes, new service layer, switching
  libraries, breaking API changes, new infrastructure

**Priority:** Rule 4 (STOP) > Rules 1-3 (auto-fix) > Unsure → Rule 4 (ask)

**Heuristic:** "Does this affect correctness, security, or ability to complete the task?"
- YES → Rules 1-3 (auto-fix)
- MAYBE → Rule 4 (ask user)

**All deviations documented in Summary & State section** regardless of which rule applied.

### Self-Verification During Execution

Adapted from GSD's self-check protocol. After each significant implementation step:

1. **Build check:** `npm run build` (or equivalent) — must pass
2. **Test check:** Run relevant tests — must pass
3. **File existence:** Verify files you created actually exist
4. **Import check:** Verify new modules are actually imported/used where expected

**After ALL implementation is complete (before code review):**

```bash
# Verify all files from technical solution exist
for file in [files_from_plan]; do
  [ -f "$file" ] && echo "FOUND: $file" || echo "MISSING: $file"
done

# Verify commits exist
git log --oneline --all --grep="feat(S3):" | head -20

# Run full build + test suite
npm run build && npm test
```

If self-verification fails → fix before proceeding to code review.

### Commit Protocol

**CRITICAL CHANGE FROM GSD: NO intermediary commits during implementation.**

GSD commits after every task. ACE does NOT. Implementation changes accumulate as
unstaged/staged work. Only ONE commit happens — after the user approves the implementation.

**Why?** Cleaner git history, easier to revert an entire story, and the user gets final
say before anything is committed.

**The single implementation commit:**
```
feat(S3): Display OAuth Provider Buttons

- Add GoogleLoginButton with provider config
- Add GitHubLoginButton with provider config
- Add shared OAuthButton base component
- Add OAuth button test suite
- Add login page with provider buttons
```

**Separate docs commit (after state updates):**
```
docs(S3): update story state to Done
```

**Separate wiki commit (after wiki update):**
```
docs(S3): update wiki after implementation
```

Types: `feat`, `fix`, `test`, `refactor`, `chore`, `docs`
Scope: Story ID (e.g., `S3` or `#95`)

---

## 9. Code Review

### ace-code-reviewer Agent

New agent at `agents/ace-code-reviewer.md`. Performs **3-level verification** (adapted from
GSD's gsd-verifier) plus anti-pattern detection.

#### Checklist (Priority Order)

**BLOCKERS (must fix before approval):**

1. **Dead code** — unused imports, unreferenced functions, orphaned files, variables assigned but never read
2. **Backwards-compatible shims** — old variable names re-exported, deprecated wrappers kept "just in case",
   `// removed` or `// old` comments, renamed `_unused` variables left behind. **ZERO TOLERANCE: these must be DELETED, not kept.**
3. **Stub implementations** — `return null`, `return {}`, `return []`, `=> {}`, placeholder `<div>Component</div>`
4. **TODO/FIXME/HACK/PLACEHOLDER/XXX comments** — must be zero in new/modified code
5. **Hardcoded values** — magic numbers, hardcoded URLs, embedded credentials, hardcoded ports
6. **Missing error handling** — try/catch gaps, unhandled promise rejections, unchecked API responses
7. **AC coverage gaps** — implementation doesn't cover ALL Gherkin scenarios from the story
8. **Coding standards violations** — naming, patterns, structure, error handling per `.docs/wiki/system-wide/coding-standards.md`. **MANDATORY CHECK.** Every new/modified file must comply. This is not optional.

**WARNINGS (should fix):**

9. **Console.log debugging** — leftover debug logging
10. **Missing tests** — new functionality without corresponding tests
11. **Out of scope work** — agent built something NOT in the AC

#### 3-Level Artifact Verification (Adapted from GSD gsd-verifier)

For each artifact mentioned in the Technical Solution:

| Level | Check | What It Catches |
|-------|-------|----------------|
| **Level 1: Exists** | File exists at expected path | Missing files, wrong paths |
| **Level 2: Substantive** | File has real implementation (not stub) | Placeholder components, empty handlers, static returns |
| **Level 3: Wired** | File is imported AND used by consuming code | Orphaned modules, created but never connected |

**Level 2 — Stub Detection Patterns:**

```javascript
// React component stubs (RED FLAGS):
return <div>Component</div>
return <div>Placeholder</div>
return null
return <></>
onClick={() => {}}
onChange={() => console.log('clicked'))
onSubmit={(e) => e.preventDefault()}  // Only prevents default

// API route stubs (RED FLAGS):
export async function POST() {
  return Response.json({ message: "Not implemented" });
}
export async function GET() {
  return Response.json([]);  // Empty array with no DB query
}

// General stubs:
return null; return {}; return [];
throw new Error("Not implemented");
console.log("TODO");
```

**Level 3 — Wiring Red Flags:**

```javascript
// Fetch exists but response ignored:
fetch('/api/messages')  // No await, no .then, no assignment

// Query exists but result not returned:
await prisma.message.findMany()
return Response.json({ ok: true })  // Returns static, not query result

// State exists but not rendered:
const [messages, setMessages] = useState([])
return <div>No messages</div>  // Always shows static text
```

#### Dead Code Detection Patterns

**CRITICAL MANDATE: Dead code is NEVER acceptable. It must be DELETED, not commented out,
not renamed with `_` prefix, not wrapped in `if (false)`. DELETED.**

```bash
# Unused imports (grepped per file)
grep -E "^import .* from" "$file" | extract_identifiers | check_usage_in_file

# Unreferenced exports (module exports nothing uses)
grep -E "^export (function|const|class|interface|type)" "$file" | check_external_imports

# Commented-out code blocks (not comments — actual code that was commented)
grep -n -E "^\s*//" "$file" | detect_code_vs_comment

# Backwards-compatible re-exports
grep -E "export \{.*as.*\}" "$file"  # { oldName as newName }
grep -E "export default.*=.*// (old|legacy|deprecated|backwards)" "$file"

# Renamed-but-kept variables
grep -E "const _\w+ = " "$file"  # _unusedVar = something
grep -E "// (removed|old|legacy|deprecated|was:)" "$file"
```

#### Backwards-Compatible Code Detection

**ZERO TOLERANCE.** If code was replaced, the old code GOES. No shims, no wrappers, no "keep for now":

| Pattern | What It Looks Like | Action |
|---------|-------------------|--------|
| Re-export alias | `export { newFn as oldFn }` | DELETE the alias |
| Deprecated wrapper | `function oldFn() { return newFn() }` | DELETE the wrapper, update callers |
| Commented old code | `// const oldVar = ...` | DELETE the comment |
| Rename with underscore | `const _oldVar = ...` | DELETE entirely |
| "Removed" markers | `// REMOVED: oldFunction` | DELETE the comment |
| Conditional dead path | `if (false) { oldLogic() }` | DELETE the dead branch |

#### Tech Debt Discovery

During review, the code reviewer also identifies **tech debt** — items that aren't blockers
for this story but represent accumulated quality issues. These get passed to the wiki mapper.

**What counts as tech debt:**
- Existing code (not written by this story) that violates coding standards
- Missing tests for pre-existing functionality touched by this story
- Deprecated dependencies discovered during review
- TODO/FIXME in pre-existing code (not new code — new code TODOs are blockers)
- Complex/fragile code the story had to work around
- Missing abstractions that forced duplication
- Hardcoded values in pre-existing code

**Tech debt output format (structured for wiki mapper consumption):**

```yaml
tech_debt:
  - file: "src/services/auth.ts"
    subsystem: "auth"
    items:
      - description: "validateToken() has no error handling for expired tokens"
        severity: medium
        discovered_during: "S3 — Display OAuth Buttons"
      - description: "Hardcoded JWT secret in line-level constant"
        severity: high
        discovered_during: "S3 — Display OAuth Buttons"
  - file: "src/utils/http.ts"
    subsystem: "shared"
    items:
      - description: "No request timeout configured — can hang indefinitely"
        severity: medium
        discovered_during: "S3 — Display OAuth Buttons"
```

### Solo Mode: Post-Execution Review

After implementation completes, spawn reviewer as a subagent:

```
Agent(
    prompt="Review the implementation of story {story_id}.

    Story AC: {acceptance_criteria}
    Technical Solution: {technical_solution}
    Out of Scope: {out_of_scope}
    Coding Standards: @.docs/wiki/system-wide/coding-standards.md

    REVIEW ALL files modified/created since story execution started.

    VERIFICATION (3 levels per artifact from Technical Solution):
    1. EXISTS — file at expected path?
    2. SUBSTANTIVE — real implementation, not stub?
    3. WIRED — imported and used by consuming code?

    CRITICAL RULES:
    - Dead code must be DELETED. Not commented, not renamed, not kept.
    - Backwards-compatible shims must be DELETED. Update callers instead.
    - Every TODO/FIXME/HACK/PLACEHOLDER = blocker.
    - Every stub = blocker.
    - Every coding standards violation = blocker.

    TECH DEBT DISCOVERY:
    While reviewing, note any pre-existing tech debt you encounter in
    files touched by this story. These are NOT blockers — they are
    recorded for the wiki. Only flag debt in EXISTING code, not new code.

    Report format:
    REVIEW COMPLETE
    Status: passed | issues_found
    - Blockers: {count}
    - Warnings: {count}
    - Files reviewed: {count}
    - Artifacts verified: {passed}/{total} (3-level)
    - AC coverage: {covered}/{total} scenarios
    - Tech debt items discovered: {count}

    [Blocker list with file:line, description, severity, suggested fix]
    [Warning list with file:line, description, severity, suggested fix]
    [Tech debt list in YAML format — file, subsystem, items with description+severity]",
    subagent_type="ace-code-reviewer",
    description="Code review for {story_id}"
)
```

**If blockers found → auto-fix cycle:**
1. Reviewer reports blockers
2. Executor fixes them (deviation rules 1-3 apply — most blocker fixes are auto-approved)
3. Re-run review (focused on previously-failed items only, like GSD's re-verification mode)
4. Repeat until zero blockers
5. Warnings presented to user alongside verification prompt

### Teams Mode: Reviewer Teammate

The reviewer is a full teammate (see Section 7). It reviews concurrently, creates tasks for
other teammates when issues found, and messages them directly. At the end, it does a final
sweep and reports to the lead. See **Section 7 > Reviewer Creates Tasks for Teammates**
for the task-creation pattern.

### Standalone Command: `/ace:review-story`

Same agent and checklist, but invoked independently:

```bash
/ace:review-story story=path/to/story.md
```

Useful for:
- Re-checking after manual changes
- Verifying stories implemented outside ACE
- Running a second review after fixing issues
- Pre-merge quality gate

---

## 10. Quality Enforcement Pipeline

The full quality pipeline, adapted from GSD's multi-layered verification system.
This section ties together deviation handling, self-verification, code review, and
the fix-verify loop into one coherent pipeline.

### Pipeline Overview

```
Implementation → Self-Verify → Code Review → Fix Cycle → User Approval → Commit
     │               │              │             │
     │          build+test      3-level        auto-fix
     │          per step       artifact      (Rules 1-3)
     │                        verification     or ask
     │                        + anti-pattern    (Rule 4)
     │                          detection
     │
     └── Deviation Rules active throughout
```

### Stage 1: During Implementation — Self-Verification

Inline checks after each significant step (see Section 8 > Self-Verification):

| Check | When | Failure Action |
|-------|------|---------------|
| Build | After creating/modifying files | Fix immediately (Rule 1) |
| Tests | After implementing a feature | Fix immediately (Rule 1) |
| File existence | After file creation step | Re-create (Rule 3) |
| Import wiring | After creating new module | Wire it (Rule 3) |

### Stage 2: During Implementation — Deviation Handling

Active throughout implementation (see Section 8 > Deviation Rules):

| Rule | Trigger | Action | User? |
|------|---------|--------|-------|
| R1: Bug | Broken behavior, errors | Auto-fix + track | No |
| R2: Missing critical | Security, validation, error handling | Auto-add + track | No |
| R3: Blocking | Can't complete task | Auto-fix + track | No |
| R4: Architectural | Schema/service/library change | STOP + ask | Yes |

**All deviations documented** in the Summary & State section regardless of rule.

### Stage 3: Post-Implementation — Code Review

Full review by ace-code-reviewer (see Section 9 for detailed checklist):

1. **3-Level Artifact Verification** — EXISTS → SUBSTANTIVE → WIRED
2. **Anti-Pattern Detection** — TODOs, stubs, hardcoded values, console.logs
3. **Dead Code Scan** — unused imports, unreferenced functions, orphaned files
4. **Backwards-Compatible Code Scan** — re-exports, deprecated wrappers, renamed vars
5. **AC Coverage Check** — all Gherkin scenarios covered?
6. **Coding Standards Check** — naming, patterns, structure

### Stage 4: Fix-Verify Loop (Gap Closure)

Adapted from GSD's verify → gaps → plan gaps → execute gaps → re-verify cycle:

```
┌─────────────────────┐
│  Code Review        │
│  (Stage 3)          │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    │ Blockers? │
    ├──Yes──────┤
    │           │
    ▼           │
┌───────────┐   │
│ Auto-fix  │   │
│ blockers  │   │
│ (R1-R3)   │   │
└─────┬─────┘   │
      │         │
      ▼         │
┌───────────┐   │
│ Re-review │   │
│ (focused  │   │
│  on fixed │   │
│  items)   │──►│
└───────────┘   │
                │
    ├──No───────┘
    ▼
┌───────────────────┐
│ Present to user   │
│ (warnings only)   │
└───────────────────┘
```

**Key rules for the fix-verify loop:**
- **Max 3 iterations.** If blockers persist after 3 rounds, escalate to user (Rule 4 behavior).
- **Re-review is focused**, not full — only check previously-failed items + regression on passed items.
  This mirrors GSD's re-verification mode.
- **Warnings don't block** — they're presented to user alongside the verification prompt.
- **Each fix round is tracked** as a deviation in the summary.

### Stage 5: User Approval Gate

Nothing is committed until the user approves (see Step 5 in Section 6):
- User sees: AC walkthrough, code review results (warnings), deviation summary
- User decides: Approve (Done) / Approve (DevReady) / Fix issues
- "Fix issues" → loop back to implementation → re-verify → re-review

### Quality Enforcement in Agent Teams Mode

Same pipeline, but distributed across teammates:

| Stage | Solo Mode | Agent Teams Mode |
|-------|-----------|-----------------|
| Self-verification | Main context checks | Each teammate self-checks |
| Deviation handling | Main context decides | Each teammate follows rules; R4 goes to user via teammate |
| Code review | Post-execution subagent | Reviewer teammate runs concurrently |
| Fix-verify loop | Main context fixes | Reviewer creates tasks for responsible teammate |
| User approval | Main context presents | Lead collects all results, presents to user |

**The reviewer teammate advantage:** Issues found earlier, fixes happen in parallel
with ongoing implementation, no waiting for post-hoc review.

### What We Adapted from GSD vs. What We Changed

| GSD Pattern | ACE Adaptation | Why Changed |
|-------------|---------------|-------------|
| 3-level artifact verification | Kept as-is | Catches stubs effectively |
| Anti-pattern scanning (TODO, FIXME) | Kept + added dead code + backwards-compat | User requirement: ZERO TOLERANCE |
| Gap closure cycle (verify → plan → execute → re-verify) | Simplified to fix-verify loop (max 3 rounds) | ACE executes single stories, not phases — simpler scope |
| Separate gsd-verifier agent | Merged into ace-code-reviewer | One agent handles all quality checks |
| Hotfix/decimal phases (06.1) | Not needed | ACE doesn't have phase numbering |
| Plan checker (pre-execution) | Replaced by Plan Mode approval | User reviews plan in native Plan Mode |
| SUMMARY.md per plan | Inline in story file | ACE's story IS the plan — summary lives there |

---

## 11. State Updates

After user verification (either "Done" or "DevReady"):

### 10a. Story File — Summary & State Section

Write `<section name="summary-and-state">` into the story file:

```markdown
## Summary & State

**Status**: Done | DevReady
**Executed**: 2026-03-08
**Duration**: 23 min
**Commits**: 5 (4 feat, 1 test)

### Implementation Summary
[Substantive one-liner — "OAuth buttons with Google/GitHub using next-auth providers"]

### Commits
| # | Hash    | Type     | Description                          |
|---|---------|----------|--------------------------------------|
| 1 | abc123f | feat     | OAuth button base component          |
| 2 | def456g | feat     | Google provider integration          |
| 3 | ghi789k | feat     | GitHub provider integration          |
| 4 | jkl012m | test     | OAuth button test suite              |
| 5 | mno345p | feat     | Login page with provider buttons     |

### Deviations
[None — plan executed as written]
OR
[1. [Rule 2] Added missing CSRF token validation on OAuth callback]

### Code Review
- Issues found: 0
- AC coverage: 5/5 scenarios covered
```

### 10b. GitHub Story Issue

If GitHub is configured, update the story issue body with the full story file content
(including the new summary-and-state section):

```bash
node ace-tools.js github update-issue number={issue} repo={repo} body_file={story_file}
```

Also update the GitHub issue status/fields if applicable.

### 10c. Feature File

Update the story's status in the parent feature file's story index table:
- Change story status from "Refined" to "Done" (or "DevReady")

Check: if ALL stories in the feature are "Done", update the feature status to "Done" as well.

### 10d. GitHub Feature Issue

If the feature has a GitHub issue, update its body with the updated feature file.
If feature status changed to Done, also close the GitHub issue.

### 10e. Product Backlog

Update the story status in `product-backlog.md`.
If the feature status changed to Done, update the feature status in the backlog too.

### 10f. Commit State Changes

```bash
git add {story_file} {feature_file} .ace/artifacts/product/product-backlog.md
git commit -m "docs(S3): update story state to {Done|DevReady}"
```

---

## 12. Wiki Update

After state updates, spawn the wiki mapper as a background agent.
The wiki mapper now has **two jobs**: update structural wiki docs AND integrate tech debt.

### Wiki Mapper Invocation

```
Agent(
    prompt="/ace:map-implementation story={story_file}

    Update the engineering wiki based on this story's implementation.
    Check changed files to determine which wiki documents need updating.
    Update only wiki documents whose evolution triggers were hit.

    TECH DEBT INTEGRATION:
    The code reviewer discovered the following tech debt items:
    {tech_debt_yaml from code review output}

    For each tech debt item:
    1. Find or create the wiki doc for the affected subsystem
    2. Add/update the '## Tech Debt' section in that wiki doc
    3. Update .docs/wiki/system-wide/tech-debt-index.md

    Return format:
    WIKI UPDATE COMPLETE
    - Updated: {list of updated wiki docs}
    - Created: {list of new wiki docs}
    - Tech debt added: {count} items across {count} wiki docs
    - No change needed: {list}",
    subagent_type="ace-wiki-mapper",
    run_in_background=true,
    description="Wiki update for {story_id}"
)
```

### Tech Debt in Wiki Documents

Every subsystem wiki doc and system-wide wiki doc (except tech-debt-index.md itself)
can have a `## Tech Debt` section appended. Format:

```markdown
## Tech Debt

| # | Description | Severity | Discovered | Story |
|---|-------------|----------|------------|-------|
| 1 | `validateToken()` has no error handling for expired tokens | medium | 2026-03-09 | S3 |
| 2 | Hardcoded JWT secret in line-level constant | high | 2026-03-09 | S3 |
```

**Rules:**
- Items accumulate across stories — each story execution may add new items
- When a tech debt item is fixed (by a future story), the wiki mapper removes it
- Severity: `high` (security, data loss risk), `medium` (quality, maintainability), `low` (cosmetic, minor)
- Items are always linked to the discovering story for traceability

### Tech Debt Index

`.docs/wiki/system-wide/tech-debt-index.md` — a cross-cutting index of all tech debt
across the entire codebase. The wiki mapper creates/updates this file.

```markdown
# Tech Debt Index

**Last updated**: 2026-03-09
**Total items**: 5 (2 high, 2 medium, 1 low)

## By Subsystem

### auth (2 items)
**Wiki doc**: `.docs/wiki/subsystems/auth/structure.md`
1. **[high]** Hardcoded JWT secret in line-level constant — `src/services/auth.ts`
2. **[medium]** `validateToken()` has no error handling for expired tokens — `src/services/auth.ts`

### shared (1 item)
**Wiki doc**: `.docs/wiki/system-wide/system-architecture.md`
1. **[medium]** No request timeout configured in HTTP client — `src/utils/http.ts`

### payments (2 items)
**Wiki doc**: `.docs/wiki/subsystems/payments/structure.md`
1. **[high]** Missing idempotency key on charge creation — `src/services/payments.ts`
2. **[low]** Deprecated Stripe API version in use — `src/config/stripe.ts`
```

**Index rules:**
- Grouped by subsystem, sorted by severity (high → medium → low)
- Each entry: severity tag, short description, file path
- References the wiki doc where the full Tech Debt section lives
- Summary counts at the top (total, by severity)
- Wiki mapper updates this on every story execution (add new, remove fixed)

### Story Wiki-Updates Section

After wiki mapper completes, add `<section name="wiki-updates">` to story file:

```markdown
## Wiki Updates

**Updated**: 2026-03-09

| Document | Action | Path |
|----------|--------|------|
| Auth subsystem structure | Updated | .docs/wiki/subsystems/auth/structure.md |
| Tech debt index | Updated (+3 items) | .docs/wiki/system-wide/tech-debt-index.md |
| System architecture | No change | .docs/wiki/system-wide/system-architecture.md |
```

Also update GitHub issue with the wiki-updates section.

Final commit:
```bash
git add {story_file} .docs/wiki/
git commit -m "docs(S3): update wiki after implementation"
```

---

## 13. ace-tools.js Changes

### New Command: `init execute-story <story-param>`

Similar to `init plan-story` but with additional fields:

- Everything from `init plan-story` (story validation, metadata, paths)
- `agent_teams`: boolean (from sync-agent-teams)
- `has_technical_solution`: boolean
- `has_acceptance_criteria`: boolean
- `has_coding_standards`: boolean
- `has_wiki_refs`: boolean
- `executor_model`: resolved model for execution
- `reviewer_model`: resolved model for code review

### New Command: `story update-state <story-param> --status <Done|DevReady|InProgress>`

Updates the story status in:
1. Story file header
2. Feature file story index
3. Product backlog

Returns: `{ story_updated, feature_updated, backlog_updated, feature_status_changed }`

### New Model Profiles

Add to MODEL_PROFILES table:
```javascript
'ace-executor':       { quality: 'opus',   balanced: 'sonnet', budget: 'sonnet' },
'ace-code-reviewer':  { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
```

---

## 14. Story Template Changes

Add two new sections to `story.xml`:

### `<section name="summary-and-state">`

Added after `<section name="technical-solution">`, before `<section name="metadata">`.
Written by execute-story after implementation.

### `<section name="wiki-updates">`

Added after `<section name="summary-and-state">`.
Written by execute-story after wiki mapper completes.

Both sections start as placeholders:
```markdown
## Summary & State
<!-- Populated by /ace:execute-story after implementation. -->

## Wiki Updates
<!-- Populated by /ace:execute-story after wiki mapping. -->
```

---

## 15. Open Questions — Resolved

All 5 original questions have been resolved.

### Q1: Do we need an ace-executor agent? — ✅ RESOLVED: No

No dedicated executor agent. Claude Code's native Plan Mode creates and executes plans directly.
Deviation rules and commit protocol are instructions in the **workflow**, not a separate agent.

### Q2: Should the reviewer be a separate command? — ✅ RESOLVED: Both

Code review is part of execute-story flow AND available standalone as `/ace:review-story`.
Useful for re-checking after manual changes or verifying stories implemented outside ACE.

### Q3: Context window overflow in Solo Mode? — ✅ RESOLVED: Plan must fit

**The plan should be designed to fit.** During Plan Mode (Step 2), the workflow must:
1. Estimate Technical Solution size (count sections, components, files to create/modify)
2. Estimate implementation token cost based on story size
3. If remaining context after plan + story + wiki + coding standards does NOT leave a
   **generous buffer** (at least ~80k tokens free for implementation) → **suggest Agent Teams**
   even if the story seems small enough for solo
4. If Agent Teams not available, break the plan into checkpointed segments

### Q4: How does the plan interact with agent teams? — ✅ RESOLVED: Full spec

When agent teams is recommended, the Plan Mode output MUST include:
- **Team structure**: Number of teammates (2-4), role per teammate
- **Task assignment**: Which tasks each teammate handles
- **Dependencies**: Which teammate's work blocks another's
- **Shared interfaces**: Types/contracts teammates must agree on before parallel work

The plan becomes the **lead's instructions** for team setup.

### Q5: Partial execution detection? — ✅ RESOLVED: Read story state

Follow GSD patterns — detect partial execution from the story file itself:
1. Check `<section name="summary-and-state">` for existing content (status, progress)
2. Check story `status` in metadata (if "In Progress" = partially executed)
3. Check for unstaged/uncommitted changes related to the story
4. Offer: "Continue from where we left off" / "Start fresh" / "Review what's done"

**NO intermediary commits.** Implementation changes accumulate as working tree changes.
Only ONE commit after user approval. This means partial execution is detected via
story file state + working tree, NOT via commit history.

---

## 16. Implementation Order

### Phase 1: Core Infrastructure
1. Add `init execute-story` to ace-tools.js
2. Add `story update-state` to ace-tools.js
3. Add new sections to story.xml template
4. Add model profiles for executor and reviewer

### Phase 2: Command & Workflow (Solo Mode)
5. Create `commands/ace/execute-story.md` (command definition)
6. Create `agile-context-engineering/workflows/execute-story.xml` (workflow — solo path only)
7. Implement: init → validate → plan mode → execute → state updates → commit

### Phase 3: Code Review
8. Create `agents/ace-code-reviewer.md` (full agent definition)
9. Integrate code review into execute-story workflow (post-execution)

### Phase 4: Agent Teams Mode
10. Add agent teams decision logic to plan mode step
11. Add team creation and coordination flow to workflow
12. Add reviewer-as-teammate path
13. Test both modes end-to-end

### Phase 5: Wiki & Polish
14. Integrate wiki mapper step into workflow
15. Add wiki-updates section writing
16. Add resume/continuation detection
17. End-to-end testing of full flow

---

*This plan is a living document. Sections marked with open questions need resolution before implementation.*
