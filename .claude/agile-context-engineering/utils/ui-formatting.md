<ui_patterns>

# ACE UI Formatting Guide

All agent output MUST follow these patterns. Consistency is the product.

---

## Brand Identity

- **Prefix**: `ACE` — used in all banners and headers
- **Separator**: `>` — routes context after prefix
- **Hierarchy**: `Epic > Feature > Story > Task`
- **Voice**: Precise, confident, structured. No fluff. No filler.

---

## Banners

Banners frame every major output block. They signal phase transitions.

### Primary Banner (phase start/end)

```
╔══════════════════════════════════════════════════╗
║  ACE > Plan Project                              ║
╚══════════════════════════════════════════════════╝
```

### Section Banner (within a phase)

```
┌──────────────────────────────────────────────────┐
│  ACE > Refine Story > E1-F2-S3                   │
└──────────────────────────────────────────────────┘
```

### Completion Banner

```
╔══════════════════════════════════════════════════╗
║  ACE > Story Verified                            ║
║  E1-F2-S3 "User can reset password"              ║
╚══════════════════════════════════════════════════╝
```

### Rules

- Banner width: **exactly 52 characters** inner width
- Left-pad content with **2 spaces** inside the border
- Right-pad to fill the border width
- NEVER mix border styles (`═══` for primary, `───` for section)
- ALWAYS include the `ACE >` prefix

---

## Progress Indicators

### Phase Progress Bar

```
  Progress  [████████████░░░░░░░░]  60%  (3/5 tasks)
```

- Bar width: **20 characters** fixed
- `█` = completed, `░` = remaining
- Always show percentage AND fraction

### Sprint Progress Table

```
  Story       Status   Tasks    Progress
  ─────────   ──────   ──────   ────────
  E1-F1-S1    done     4/4      ████ 100%
  E1-F1-S2    active   2/6      █░░░  33%
  E1-F1-S3    queued   0/3      ░░░░   0%
```

### Story Task Tracker

```
  Tasks for E1-F2-S3:
  ────────────────────
  [x] Set up password reset endpoint
  [x] Create email template
  [ ] Add rate limiting              << active
  [ ] Write integration tests
  [ ] Update API documentation
```

- `[x]` = done, `[ ]` = pending
- `<< active` marker on current task
- Indented with **2 spaces**

### Status Symbols

| Symbol | Meaning       | When to use                    |
|--------|---------------|--------------------------------|
| `[x]`  | Done          | Task/story completed           |
| `[ ]`  | Pending       | Task/story not started         |
| `[~]`  | In progress   | Currently executing            |
| `[!]`  | Blocked       | Cannot proceed, dependency     |
| `[?]`  | Needs input   | Waiting on user decision       |

---

## Hierarchy Display

### Backlog Tree

```
  E1  Platform Foundation
  ├── F1  User Authentication          3 stories
  │   ├── S1  Sign up flow             [x] done
  │   ├── S2  Login flow               [~] active
  │   └── S3  Password reset           [ ] queued
  ├── F2  Dashboard                    2 stories
  │   ├── S1  Layout scaffolding       [ ] queued
  │   └── S2  Data widgets             [ ] queued
  └── F3  Settings Page                0 stories
```

- Tree characters: `├──`, `└──`, `│`
- ID left-aligned, name after **2 spaces**, metadata right-aligned
- Leaf nodes show status symbol

### Breadcrumb Navigation

```
  ACE > E1 Platform Foundation > F2 Dashboard > S1 Layout scaffolding
```

- Always show full path from Epic down
- Separate levels with ` > `

---

## Content Blocks

### Info Block

```
  i  Story E1-F1-S2 has 6 tasks estimated at ~4 hours total.
     Prerequisites: E1-F1-S1 must be complete.
```

- Prefix: `i` (lowercase, 2-space indent)
- Continuation lines aligned under text, not under prefix

### Warning Block

```
  !  Story E1-F2-S3 has no acceptance criteria defined.
     Run /ace:refine-story E1-F2-S3 before executing.
```

- Prefix: `!`
- Include actionable next step

### Success Block

```
  +  All 4 tasks completed. Story E1-F1-S1 is done.
     Commit: a3f7c2d "feat(auth): implement sign-up flow"
```

- Prefix: `+`
- Include commit hash when relevant

### Error Block

```
  x  Task 3 failed: test suite has 2 failing assertions.
     See output above. Fix and re-run /ace:execute-story E1-F1-S2.
```

- Prefix: `x`
- Always include recovery instruction

---

## Decision Points

When presenting choices to the user:

```
┌──────────────────────────────────────────────────┐
│  ACE > Decision Required                         │
└──────────────────────────────────────────────────┘

  This feature has two possible approaches:

  [A]  API-first — Build endpoints, then UI
       Faster backend iteration, frontend blocked initially.

  [B]  Vertical slice — Build one flow end-to-end
       Slower start, but validates assumptions early.

  Recommendation: [B] for new domains, [A] for well-understood ones.
```

- Options labeled `[A]`, `[B]`, `[C]` — never more than 4
- Each option: label + short name + description on next line
- Recommendation line at the end if applicable

---

## Transitions & Flow

### Next Action Block

Every phase completion MUST end with a "Next" block:

```
  Next > /ace:plan-feature E1-F1
         Break this epic into features and stories.
```

- Format: `Next >` followed by the command
- Second line: brief description of what it does
- This is MANDATORY after every completion

### Phase Transition

```
╔══════════════════════════════════════════════════╗
║  ACE > Story Refined                             ║
║  E1-F1-S2 ready for execution                    ║
╚══════════════════════════════════════════════════╝

  Summary:
  ────────
  6 tasks defined, all acceptance criteria mapped.
  Estimated effort: ~4 hours.

  Next > /ace:execute-story E1-F1-S2
         Execute this story with atomic commits.
```

---

## Commit Messages

ACE enforces conventional commits tied to the hierarchy:

```
  feat(auth): implement email verification flow

  Story: E1-F1-S2
  Task: 3/6 — Add verification endpoint
```

- First line: conventional commit format
- Blank line, then `Story:` and `Task:` metadata
- Keep first line under 72 characters

---

## Spacing & Indentation Rules

| Element              | Indentation  |
|----------------------|-------------|
| Banner content       | 2 spaces    |
| Body text            | 2 spaces    |
| Nested list items    | 4 spaces    |
| Code/command blocks  | 4 spaces    |
| Table content        | 2 spaces    |
| Continuation lines   | Align under text start |

- **One blank line** between sections
- **Two blank lines** before a new banner
- **No trailing whitespace**
- **No more than 3 consecutive blank lines** anywhere

---

## Typography

- IDs are **always monospace-styled**: `E1`, `F2`, `S3`
- Commands are **always code-formatted**: `/ace:plan-story`
- File paths are **always code-formatted**: `.ace/backlog/E1/F1-auth.md`
- Emphasis for key terms: **bold** only, never *italic* in output
- Numbers: use digits, not words (`3 stories`, not `three stories`)

---

## Anti-Patterns

- Varying banner widths or border styles within a session
- Missing `ACE >` prefix in banners
- Random emoji in output — ACE uses **zero emoji** in structured output
- Skipping the `Next >` block after a phase completion
- Using prose paragraphs where a table or list would be clearer
- Inconsistent ID formatting (`e1-f1` vs `E1-F1` — always uppercase)
- Status text without a symbol (`done` alone — use `[x] done`)
- Banners for trivial messages — only use banners for phase boundaries
- Mixing `ACE >` with other prefix styles
- Omitting the hierarchy breadcrumb when context is ambiguous

</ui_patterns>