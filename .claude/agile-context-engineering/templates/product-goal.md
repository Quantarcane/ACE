# PRODUCT-GOAL.md Template

Template for `.artifacts/product-overview/PRODUCT-GOAL.md` — the current long-term objective the Scrum Team is working toward. A team pursues only one Product Goal at a time.

<template>

```markdown
# Product Goal: [Goal Name]

## Goal Statement

[A clear description of the desired future state of the product.
Outcome-oriented, not a feature list. 1-2 sentences.
"When this goal is achieved, [who] will be able to [what], resulting in [measurable outcome]."]

## Current State

[Where the product is today relative to this goal.
The baseline you're measuring progress from.
What exists, what's missing, what's broken.]

## Strategic Alignment

[How this goal connects to the broader product vision and business strategy.
Why this goal, why now?]

- **Product Vision link**: [Which part of the vision does this advance?]
- **Business objective**: [What organizational goal does this serve?]

## Target Audience

[Who benefits when this goal is achieved?]

- **[Persona/Segment 1]**: [How they benefit]
- **[Persona/Segment 2]**: [How they benefit]

## Success Criteria

<!-- Measurable indicators that the goal has been met. -->
<!-- Without these, the goal is just a wish. -->

| Criterion | Target | Current | Measurement Method |
|-----------|--------|---------|--------------------|
| [KR 1] | [Target value] | [Baseline] | [How measured] |
| [KR 2] | [Target value] | [Baseline] | [How measured] |
| [KR 3] | [Target value] | [Baseline] | [How measured] |

## Scope & Boundaries

### In Scope

- [Area of work included]
- [Area of work included]

### Out of Scope

- [Exclusion] — [why excluded from this goal]
- [Exclusion] — [why excluded from this goal]

## Time Horizon

- **Target date**: [When the team aims to achieve this goal]
- **Evaluation checkpoint**: [When to assess if the goal is still worth pursuing]

## Assumptions

<!-- What must be true for this goal to be achievable. -->

- [Assumption 1]
- [Assumption 2]

## Risks & Dependencies

| Risk / Dependency | Type | Likelihood | Impact | Mitigation |
|-------------------|------|-----------|--------|------------|
| [Risk 1] | Risk | [H/M/L] | [H/M/L] | [Strategy] |
| [Dependency 1] | Dependency | — | [H/M/L] | [Owner / plan] |

## Related Epics

<!-- High-level work areas contributing to this goal. Directional, not a backlog. -->

- [Epic 1] — [how it contributes to the goal]
- [Epic 2] — [how it contributes to the goal]

---
*Status: [Active / Achieved / Abandoned]*
*Last updated: [date] after [trigger]*
```

</template>

<guidelines>

**Goal Statement:**
- Describes a future state, not a feature to build
- "Users can self-serve account management" not "Build settings page"
- Should be achievable but ambitious — spanning multiple Sprints
- One sentence test: if you can't say it in one breath, simplify it

**Current State:**
- Honest assessment of where things stand today
- Provides the baseline against which success is measured
- Include quantitative data where available
- Update as progress is made

**Strategic Alignment:**
- Connects the goal to the product vision and business strategy
- Answers "why this goal, why now?"
- If you can't articulate the link, the goal may not be the right priority
- Helps the team understand purpose beyond the work itself

**Target Audience:**
- Who specifically benefits when this goal is met
- Frame benefit from their perspective, not yours
- Primary beneficiaries drive prioritization of backlog items
- May be a subset of the broader product audience

**Success Criteria:**
- Measurable, observable outcomes — not outputs
- Include current baseline and target value
- Specify how each will be measured
- 3-5 criteria max — more means the goal is too broad
- These determine when the goal is "done"

**Scope & Boundaries:**
- In Scope = work areas the team will pursue for this goal
- Out of Scope = explicit exclusions with reasoning
- Prevents scope creep and re-litigating decisions
- When in doubt, put it out of scope — you can always add later

**Time Horizon:**
- Realistic target date informed by team capacity
- Include an evaluation checkpoint before the target date
- At the checkpoint: is this goal still worth pursuing?
- Goals without deadlines drift indefinitely

**Assumptions:**
- Unvalidated beliefs the goal depends on
- Each assumption is a risk if proven wrong
- Validate assumptions early — they're the cheapest thing to test
- Move to "confirmed" or "invalidated" as you learn

**Risks & Dependencies:**
- Risks = uncertainties that could prevent achievement
- Dependencies = external factors the team doesn't control
- Every risk needs a mitigation strategy
- Every dependency needs an owner

**Related Epics:**
- Directional mapping, not a detailed backlog
- Shows how the goal decomposes into work streams
- Helps the Product Owner prioritize the Product Backlog
- Updated as epics are completed or new ones emerge

**Status:**
- Active = team is currently pursuing this goal
- Achieved = success criteria met, goal fulfilled
- Abandoned = goal no longer makes sense, with reasoning documented

</guidelines>

<evolution>

PRODUCT-GOAL.md evolves as the team makes progress toward the goal.

**Each Sprint Review:**
1. Success Criteria progress? → Update "Current" column
2. Current State changed? → Reflect new reality
3. New risks or blockers? → Add to Risks & Dependencies
4. Assumptions validated or invalidated? → Update accordingly
5. Scope creeping? → Enforce boundaries or discuss adjustment

**At Evaluation Checkpoint:**
1. Are we on track to meet Success Criteria by target date?
2. Is this goal still strategically aligned?
3. Have assumptions held up?
4. Should we adjust scope, timeline, or abandon?

**When Goal is Fulfilled:**
1. Mark status as "Achieved"
2. Move Success Criteria to confirmed results
3. Document lessons learned
4. Archive and start next Product Goal

**When Goal is Abandoned:**
1. Mark status as "Abandoned"
2. Document why — what changed?
3. Note what was learned
4. Archive and define new Product Goal

</evolution>

<relationship_to_vision>

The Product Goal bridges Product Vision and Sprint work:

```
Product Vision (stable, long-term)
  └── Product Goal (one at a time, multi-Sprint)
        └── Sprint Goals (per Sprint, contributing to Product Goal)
              └── Product Backlog Items (tasks, stories)
```

- The Product Vision defines *where we're going*
- The Product Goal defines *what milestone we're pursuing next*
- Sprint Goals define *what we're doing this Sprint to get closer*

A Product Goal should always trace back to the Product Vision. If it doesn't, either the goal is wrong or the vision needs updating.

</relationship_to_vision>

<state_reference>

STATE.md references PRODUCT-GOAL.md:

```markdown
## Product Goal Reference

See: .artifacts/product-overview/PRODUCT-GOAL.md (updated [date])

**Goal:** [One-liner from Goal Statement]
**Status:** [Active / Achieved / Abandoned]
**Target date:** [From Time Horizon]
**Progress:** [Brief summary of Success Criteria status]
```

This ensures Claude reads the current Product Goal context.

</state_reference>
