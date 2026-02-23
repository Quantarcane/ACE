# SPRINT-GOAL.md Template

Template for `.artifacts/sprints/sprint-[N]/SPRINT-GOAL.md` — the single objective the Scrum Team commits to for a Sprint. Every Sprint has exactly one Sprint Goal.

<template>

```markdown
# Sprint [N] Goal: [Goal Name]

## Goal Statement

[What the team commits to achieving this Sprint.
One sentence. Outcome-focused — what will be true at the end of this Sprint that isn't true now?
"By the end of this Sprint, [who] will be able to [what]."]

## Product Goal Contribution

[How this Sprint Goal moves the team closer to the current Product Goal.]

- **Product Goal**: [Name / one-liner]
- **Contribution**: [What progress this Sprint delivers toward it]

## Definition of Done

<!-- The Sprint Goal is met when ALL of these are true. -->

- [ ] [Condition 1 — observable, verifiable]
- [ ] [Condition 2 — observable, verifiable]
- [ ] [Condition 3 — observable, verifiable]

## Forecast

<!-- Product Backlog Items selected to achieve this goal. -->
<!-- This is a forecast, not a contract — items may be renegotiated with the Product Owner. -->

| PBI | Description | Estimate |
|-----|-------------|----------|
| [Item 1] | [What it does] | [Points / size] |
| [Item 2] | [What it does] | [Points / size] |
| [Item 3] | [What it does] | [Points / size] |

## Risks & Impediments

<!-- Known threats to achieving this Sprint Goal. -->

| Risk / Impediment | Impact | Mitigation / Action |
|--------------------|--------|---------------------|
| [Risk 1] | [H/M/L] | [Strategy or owner] |

## Notes

[Any context the team needs during the Sprint — decisions made during Sprint Planning, constraints, dependencies on other teams, etc.]

---
*Status: [Active / Achieved / Partially Achieved / Not Achieved]*
*Sprint dates: [start] — [end]*
```

</template>

<guidelines>

**Goal Statement:**
- One clear sentence — the team's commitment for this Sprint
- Outcome-focused, not task-focused
- "Users can reset their own passwords" not "Implement password reset endpoint, UI, and email flow"
- The team should be able to recite it from memory
- Provides coherence — if the Sprint had to drop items, the goal guides what stays

**Product Goal Contribution:**
- Every Sprint Goal must trace to the active Product Goal
- If it doesn't connect, either the Sprint Goal or the Product Goal is wrong
- Makes the "why" of the Sprint visible to the team
- Helps the Product Owner evaluate whether the Sprint delivered meaningful progress

**Definition of Done:**
- Observable, verifiable conditions — no ambiguity
- These are specific to this Sprint Goal, layered on top of the team's general Definition of Done
- Should be assessable at Sprint Review
- 3-5 conditions — fewer means the goal is vague, more means it's too broad

**Forecast:**
- Product Backlog Items the team believes will achieve the goal
- This is a plan, not a promise — items can be renegotiated mid-Sprint
- The Sprint Goal is the commitment, the forecast is the approach
- If the forecast changes, the goal should remain stable

**Risks & Impediments:**
- Known threats identified during Sprint Planning
- Updated during Daily Scrums as new impediments surface
- Scrum Master owns removing impediments
- If a risk materializes and threatens the goal, escalate early

**Notes:**
- Sprint Planning decisions that provide context
- Dependencies on other teams or external factors
- Technical constraints or agreed-upon approaches
- Anything the team needs to reference during the Sprint

**Status:**
- Active = Sprint is in progress
- Achieved = all Definition of Done conditions met
- Partially Achieved = some conditions met, goal not fully realized
- Not Achieved = goal was missed, with reasoning documented

</guidelines>

<evolution>

SPRINT-GOAL.md is short-lived by design — it covers one Sprint.

**During Sprint Planning:**
1. Draft Goal Statement based on Product Goal priorities
2. Select Forecast items that support the goal
3. Define Done conditions
4. Identify known risks

**During Daily Scrums:**
1. Is the team still on track toward the goal?
2. New impediments? → Add to Risks & Impediments
3. Forecast needs adjustment? → Renegotiate with Product Owner, keep goal stable

**At Sprint Review:**
1. Evaluate Definition of Done — all met?
2. Set final status (Achieved / Partially Achieved / Not Achieved)
3. Document what was learned
4. Feed insights back into Product Goal progress

**At Sprint Retrospective:**
1. Was the goal the right size? Too ambitious? Too safe?
2. Did the forecast support the goal well?
3. Were risks identified early enough?
4. Carry improvements into next Sprint's planning

**After Sprint closes:**
1. Archive to `.artifacts/sprints/sprint-[N]/`
2. Status and outcomes inform next Sprint Planning
3. Product Goal progress updated based on Sprint results

</evolution>

<relationship_to_other_artifacts>

The Sprint Goal sits in the middle of the planning hierarchy:

```
Product Vision (long-term, stable)
  └── Product Goal (multi-Sprint, one at a time)
        └── Sprint Goal (single Sprint, one per Sprint)
              └── Product Backlog Items (tasks, stories)
```

- The Sprint Goal gives the Sprint **coherence** — it's not just a random set of backlog items
- When scope must be cut mid-Sprint, the Sprint Goal decides what stays
- Multiple Sprints with achieved Sprint Goals = progress toward the Product Goal
- A missed Sprint Goal is a signal, not a failure — inspect and adapt

</relationship_to_other_artifacts>

<state_reference>

STATE.md references the current SPRINT-GOAL.md:

```markdown
## Current Sprint Reference

See: .artifacts/sprints/sprint-[N]/SPRINT-GOAL.md (updated [date])

**Sprint Goal:** [One-liner from Goal Statement]
**Status:** [Active / Achieved / Partially Achieved / Not Achieved]
**Sprint dates:** [start] — [end]
**Progress:** [Brief summary of Definition of Done status]
```

This ensures Claude reads the current Sprint Goal context.

</state_reference>
