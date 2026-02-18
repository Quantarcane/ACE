# INCREMENT.md Template

Template for `.artifacts/sprints/sprint-[N]/INCREMENT.md` — the sum of all completed Product Backlog Items that meet the Definition of Done. The Increment is the tangible output of a Sprint, inspected at the Sprint Review.

<template>

```markdown
# Sprint [N] Increment

## Summary

[2-3 sentences describing what this Increment delivers. Written for stakeholders, not developers.
What can users do now that they couldn't before?]

## Completed Items

<!-- All PBIs that meet the Definition of Done. -->
<!-- If it doesn't meet the DoD, it's not in the Increment — no exceptions. -->

| # | Item | Type | Acceptance Criteria | DoD |
|---|------|------|---------------------|-----|
| 1 | [Item name] | [Feature/Fix/Tech Debt/Spike] | [✓ Met / summary] | ✓ |
| 2 | [Item name] | [Feature/Fix/Tech Debt/Spike] | [✓ Met / summary] | ✓ |
| 3 | [Item name] | [Feature/Fix/Tech Debt/Spike] | [✓ Met / summary] | ✓ |

## Release Notes

<!-- User-facing summary of what changed. Understandable by non-developers. -->

### New

- [What users can now do]

### Improved

- [What works better than before]

### Fixed

- [What was broken and is now resolved]

## Product Goal Progress

[How this Increment moves the team closer to the current Product Goal.]

- **Product Goal**: [Name / one-liner]
- **Before this Sprint**: [Where we were]
- **After this Sprint**: [Where we are now]
- **Remaining**: [What's left to achieve the goal]

## Known Issues

<!-- Discovered during the Sprint but not addressed. -->
<!-- These should be added to the Product Backlog for ordering by the PO. -->

| Issue | Severity | Added to Backlog? |
|-------|----------|-------------------|
| [Issue 1] | [H/M/L] | [Yes — item #X / No — reason] |

## Sprint Review Feedback

<!-- Captured during Sprint Review from stakeholders and team. -->

| Feedback | Source | Action |
|----------|--------|--------|
| [Feedback 1] | [Who] | [New backlog item / adjust / noted] |
| [Feedback 2] | [Who] | [New backlog item / adjust / noted] |

## Metrics

<!-- Optional: quantifiable outcomes from this Increment. -->

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| [Metric 1] | [Baseline] | [Current] | [Goal] |

---
*Sprint dates: [start] — [end]*
*Increment status: [Released / Ready to Release / Held]*
*Last updated: [date]*
```

</template>

<guidelines>

**Summary:**
- Written for stakeholders, not the team
- Focus on outcomes, not implementation details
- "Users can now reset their passwords via email" not "Added password reset endpoint and email service integration"
- Should be understandable by anyone in the organization

**Completed Items:**
- Only items that fully meet the Definition of Done
- Partially done items are NOT part of the Increment — they return to the Product Backlog
- Both Acceptance Criteria and DoD must be satisfied
- This list is the source of truth for what was delivered

**Release Notes:**
- Categorized by New / Improved / Fixed for clarity
- Written in user language, not developer language
- Stakeholders read this — make it useful to them
- Omit internal changes (tech debt, refactors) unless they affect users

**Product Goal Progress:**
- Connects this Sprint's output to the bigger picture
- Shows momentum — are we getting closer?
- "Remaining" helps forecast how many more Sprints
- If progress is stalling, this makes it visible

**Known Issues:**
- Honesty about what was discovered but not fixed
- Every known issue should become a Product Backlog item (or have a reason why not)
- Severity helps the Product Owner order them
- Hiding known issues erodes stakeholder trust

**Sprint Review Feedback:**
- Captured live during the Sprint Review
- Every piece of feedback gets an action: new backlog item, adjustment, or acknowledged
- Feedback without action is feedback ignored
- This feeds directly into Product Backlog refinement

**Metrics:**
- Optional but valuable for data-driven teams
- Before/After shows the impact of this Increment
- Compare against targets from Success Criteria
- Trends across Increments are more useful than single data points

**Increment Status:**
- Released = deployed to users
- Ready to Release = meets DoD, deployment decision pending
- Held = meets DoD but deliberately not released (with reasoning)
- The Increment is always potentially releasable; whether it ships is a business decision

</guidelines>

<evolution>

The Increment is created each Sprint and accumulates over time.

**During the Sprint:**
1. Items move to "Done" as they meet the DoD
2. The Increment grows as more items complete
3. Partially done items are excluded — no partial credit

**At Sprint Review:**
1. Increment is inspected by stakeholders
2. Feedback captured and actioned
3. Product Goal progress assessed
4. Product Backlog adapted based on what was learned

**After Sprint Review:**
1. Release decision made (ship now, hold, or bundle)
2. Known issues added to Product Backlog
3. Feedback items added to Product Backlog
4. Increment archived to `.artifacts/sprints/sprint-[N]/`

**Across Sprints:**
- Each Increment is additive — it includes all prior Increments
- Sprint [N] Increment = Sprint [N] completed items + all previous Increments
- This means the product is always in a usable, potentially releasable state
- Gaps between Increments (nothing Done in a Sprint) are a serious warning signal

</evolution>

<relationship_to_other_artifacts>

The Increment is the end result of the Sprint:

```
Sprint Planning
  └── Sprint Backlog (plan)
        └── Daily Scrums (adapt)
              └── Increment (result)
                    └── Sprint Review (inspect)
                          └── Product Backlog (adapt)
```

- The Sprint Backlog's Done items become the Increment
- The Increment is inspected at the Sprint Review
- Sprint Review feedback flows back into the Product Backlog
- The Definition of Done determines what qualifies for the Increment
- The Increment is the only artifact stakeholders can trust — it's verified, not promised

</relationship_to_other_artifacts>

<state_reference>

STATE.md references the latest INCREMENT.md:

```markdown
## Latest Increment Reference

See: .artifacts/sprints/sprint-[N]/INCREMENT.md (updated [date])

**Summary:** [One-liner from Summary]
**Items delivered:** [count]
**Status:** [Released / Ready to Release / Held]
**Product Goal progress:** [Brief assessment]
```

This ensures Claude understands what has been delivered and what state the product is in.

</state_reference>
