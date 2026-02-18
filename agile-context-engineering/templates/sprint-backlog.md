# SPRINT-BACKLOG.md Template

Template for `.artifacts/sprints/sprint-[N]/SPRINT-BACKLOG.md` — the Developers' plan for delivering the Sprint Goal. Contains the Sprint Goal (why), selected PBIs (what), and the action plan (how). Owned by the Developers.

<template>

```markdown
# Sprint [N] Backlog

## Sprint Goal

[The single objective for this Sprint.]

See: [link to SPRINT-GOAL.md]

## Selected Items

<!-- Product Backlog Items pulled into this Sprint to achieve the Sprint Goal. -->
<!-- This is a forecast — items can be renegotiated with the Product Owner. -->
<!-- The Sprint Goal cannot be renegotiated. -->

| # | Item | Type | Size | Status |
|---|------|------|------|--------|
| 1 | [Item name] | [Feature/Fix/Tech Debt/Spike] | [S/M/L or points] | [To Do / In Progress / Done] |
| 2 | [Item name] | [Feature/Fix/Tech Debt/Spike] | [S/M/L or points] | [To Do / In Progress / Done] |
| 3 | [Item name] | [Feature/Fix/Tech Debt/Spike] | [S/M/L or points] | [To Do / In Progress / Done] |

## Action Plan

<!-- How the Developers will deliver each selected item. -->
<!-- Broken into tasks small enough to track daily progress. -->

### [Item 1 name]

- [ ] [Task 1]
- [ ] [Task 2]
- [ ] [Task 3]

### [Item 2 name]

- [ ] [Task 1]
- [ ] [Task 2]

### [Item 3 name]

- [ ] [Task 1]
- [ ] [Task 2]

## Retrospective Improvement

<!-- At least one actionable improvement from the last Sprint Retrospective. -->

- [ ] [Improvement action] — [from Retro on date]

## Capacity & Availability

<!-- Known absences, reduced capacity, or other factors affecting this Sprint. -->

| Team Member | Availability | Notes |
|-------------|-------------|-------|
| [Name] | [Full / Partial / Absent] | [Details if not full] |

## Daily Progress

<!-- Updated during Daily Scrums. Brief notes on progress and impediments. -->

| Day | Progress | Impediments |
|-----|----------|-------------|
| Day 1 | [What moved forward] | [Blockers, if any] |
| Day 2 | | |
| Day 3 | | |

---
*Owned by: Developers*
*Sprint dates: [start] — [end]*
*Last updated: [date]*
```

</template>

<guidelines>

**Sprint Goal:**
- The "why" — gives coherence to the selected items
- Negotiated during Sprint Planning between PO and Developers
- Cannot be changed mid-Sprint (items can, the goal cannot)
- If the goal becomes obsolete, the Product Owner can cancel the Sprint

**Selected Items:**
- The "what" — PBIs pulled from the top of the Product Backlog
- Selected by the Developers based on capacity and the Sprint Goal
- This is a forecast, not a commitment to specific items
- Items can be renegotiated with the PO if the plan changes
- Status tracked throughout the Sprint

**Action Plan:**
- The "how" — tasks the Developers create to deliver each item
- Emergent — the plan evolves as the team learns during the Sprint
- Tasks should be small enough to show daily progress (ideally < 1 day)
- Not assigned upfront — the team self-manages who works on what

**Retrospective Improvement:**
- At least one concrete improvement carried into this Sprint
- Makes the Retro actionable, not just a venting session
- Track it like any other Sprint Backlog item
- If the team can't point to one improvement per Sprint, Retros need fixing

**Capacity & Availability:**
- Honest accounting of who's available and how much
- Prevents overcommitting during Sprint Planning
- Includes holidays, meetings, on-call rotations, part-time allocations
- Better to undercommit and overdeliver

**Daily Progress:**
- Updated during or after Daily Scrums
- Brief — not meeting minutes, just movement and blockers
- Impediments logged here get visibility and action
- Pattern of no progress = early warning signal

</guidelines>

<evolution>

The Sprint Backlog changes frequently within a Sprint but doesn't survive beyond it.

**During Sprint Planning:**
1. Sprint Goal agreed with Product Owner
2. Developers select PBIs they forecast they can deliver
3. Developers break items into tasks (Action Plan)
4. Capacity assessed, Retro improvement added

**During the Sprint (Daily):**
1. Update task completion in Action Plan
2. Update item status in Selected Items
3. Log progress and impediments in Daily Progress
4. Adapt the plan — add/remove/modify tasks as needed
5. If scope must change, renegotiate items (not goal) with PO

**Mid-Sprint signals to watch:**
- Too many items "In Progress", none "Done" → WIP problem
- Action Plan tasks growing instead of shrinking → scope creep or discovery
- Same impediment listed multiple days → escalation needed
- Retro improvement not being worked on → team discipline issue

**At Sprint end:**
1. Done items → move to Increment
2. Not Done items → return to Product Backlog (re-ordered by PO, not auto-top)
3. Archive Sprint Backlog to `.artifacts/sprints/sprint-[N]/`
4. Lessons feed into Sprint Retrospective

</evolution>

<relationship_to_other_artifacts>

The Sprint Backlog connects the Product Backlog to the Increment:

```
Product Backlog (ordered, ongoing)
  │
  ├── Sprint Planning ──→ Sprint Backlog (plan for this Sprint)
  │                           ├── Sprint Goal (why)
  │                           ├── Selected PBIs (what)
  │                           └── Action Plan (how)
  │
  └── Sprint Review ──→ Increment (what was delivered)
                           └── Done items from Sprint Backlog
```

- Product Backlog feeds items into the Sprint Backlog
- Sprint Backlog produces Done items that form the Increment
- Undone items return to the Product Backlog
- The Sprint Backlog is the only artifact the Developers fully own

</relationship_to_other_artifacts>

<state_reference>

STATE.md references the current SPRINT-BACKLOG.md:

```markdown
## Sprint Backlog Reference

See: .artifacts/sprints/sprint-[N]/SPRINT-BACKLOG.md (updated [date])

**Sprint Goal:** [One-liner]
**Items:** [X selected, Y done, Z in progress]
**Impediments:** [Any active blockers]
```

This ensures Claude understands current Sprint work and progress.

</state_reference>
