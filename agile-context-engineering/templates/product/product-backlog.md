# PRODUCT-BACKLOG.md Template

Template for `.artifacts/product-overview/PRODUCT-BACKLOG.md` — the single ordered list of everything the product might need. Owned by the Product Owner. The Product Goal is the backlog's commitment.

<template>

```markdown
# Product Backlog

## Product Goal

[The current Product Goal this backlog is ordered toward.]

See: [link to PRODUCT-GOAL.md]

## Backlog

<!-- Ordered by value, risk, dependencies, and learning needs. -->
<!-- Top items are refined and ready. Bottom items are rough and exploratory. -->

### Ready for Sprint

<!-- Well-defined items with acceptance criteria, estimates, and no blockers. -->

| # | Item | Type | Size | Acceptance Criteria Summary |
|---|------|------|------|-----------------------------|
| 1 | [Item name] | [Feature/Fix/Tech Debt/Spike] | [S/M/L or points] | [Brief AC summary] |
| 2 | [Item name] | [Feature/Fix/Tech Debt/Spike] | [S/M/L or points] | [Brief AC summary] |
| 3 | [Item name] | [Feature/Fix/Tech Debt/Spike] | [S/M/L or points] | [Brief AC summary] |

### Needs Refinement

<!-- Items with clear intent but incomplete details. Not yet ready for a Sprint. -->

| # | Item | Type | Open Questions |
|---|------|------|----------------|
| 4 | [Item name] | [Feature/Fix/Tech Debt/Spike] | [What needs clarification] |
| 5 | [Item name] | [Feature/Fix/Tech Debt/Spike] | [What needs clarification] |

### Future / Exploratory

<!-- Rough ideas, low-priority items, things worth capturing but not refining yet. -->

- [Item idea] — [brief context]
- [Item idea] — [brief context]

## Refinement Log

<!-- Track refinement sessions and what was refined. -->

| Date | Items Refined | Key Decisions |
|------|---------------|---------------|
| [date] | [Item names] | [What was decided] |

---
*Owned by: Product Owner*
*Last updated: [date] after [trigger]*
```

</template>

<guidelines>

**Product Goal:**
- The backlog exists to serve the Product Goal
- Ordering decisions should trace back to "does this move us toward the goal?"
- When the Product Goal changes, the backlog needs re-ordering

**Ordering (not prioritizing):**
- Order by value, risk, dependencies, and learning needs — not just "importance"
- High-value + high-risk items go near the top (learn early, fail cheap)
- Dependencies may force ordering regardless of individual value
- The Product Owner makes the final ordering call

**Ready for Sprint:**
- Items the Developers could pull into a Sprint right now
- Must have: clear description, acceptance criteria, estimate, no blockers
- Aim for 1-2 Sprints worth of ready items at all times
- "Ready" is a team agreement, not a checkbox

**Needs Refinement:**
- Clear intent but incomplete details
- Open questions documented so refinement sessions are focused
- Items move up as they get refined, not by waiting
- Refinement is ongoing, not a single event

**Future / Exploratory:**
- Rough ideas worth capturing but not worth refining yet
- Low-cost to maintain — a line item, not a spec
- Regularly prune — delete items that have sat here too long
- Some will never be built, and that's fine

**Item Types:**
- Feature = new user-facing capability
- Fix = correcting broken behavior
- Tech Debt = improving internal quality without changing behavior
- Spike = time-boxed research to reduce uncertainty

**Estimation:**
- Sized by Developers, never assigned by others
- Used for forecasting, not commitment
- Relative sizing (S/M/L or points) works better than hours
- Don't estimate items in Future/Exploratory — waste of time

**Refinement Log:**
- Track what was refined and what was decided
- Prevents re-discussing the same questions
- Helps absent team members catch up
- Keep it brief — decisions, not meeting minutes

</guidelines>

<evolution>

The Product Backlog is the most frequently changing artifact.

**Continuously:**
- New items added as they're discovered
- Items re-ordered as priorities shift
- Completed items removed (they live in the Increment)
- Stale items pruned

**Before each Sprint Planning:**
- Ensure enough "Ready for Sprint" items for the upcoming Sprint
- Refinement gaps? → Schedule focused refinement
- Ordering still reflects current Product Goal priorities?

**After each Sprint Review:**
- Stakeholder feedback → new items or re-ordering
- Incomplete items → re-assess and re-order (not auto-top)
- Product Goal progress → does backlog ordering still serve it?

**When Product Goal changes:**
- Full re-ordering against the new goal
- Some items may move to Future/Exploratory or be removed
- New items may be needed to serve the new goal

**Anti-patterns to watch for:**
- Backlog growing unbounded → prune ruthlessly
- Everything is "high priority" → ordering is broken, escalate to Product Owner
- Items sitting in "Needs Refinement" for months → delete or refine now
- Developers surprised by items in Sprint Planning → refinement is failing

</evolution>

<state_reference>

STATE.md references PRODUCT-BACKLOG.md:

```markdown
## Backlog Reference

See: .artifacts/product-overview/PRODUCT-BACKLOG.md (updated [date])

**Items ready for Sprint:** [count]
**Items needing refinement:** [count]
**Top item:** [Name of highest-ordered item]
```

This ensures Claude understands current backlog state and priorities.

</state_reference>
