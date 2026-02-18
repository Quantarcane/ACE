# DEFINITION-OF-DONE.md Template

Template for `.artifacts/product-overview/DEFINITION-OF-DONE.md` — the team's shared quality standard that every Increment must meet before it's considered releasable. This is a living document owned by the Developers.

<template>

```markdown
# Definition of Done

## Code Quality

- [ ] Code reviewed and approved by at least [N] peer(s)
- [ ] Follows agreed coding standards and conventions
- [ ] No known defects introduced
- [ ] Static analysis / linting passes with no new warnings
- [ ] No TODO/FIXME added without a linked issue

## Testing

- [ ] Unit tests written for new/changed logic
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Acceptance criteria verified
- [ ] Edge cases and error paths covered
- [ ] Regression suite green

## Documentation

- [ ] API documentation updated (if applicable)
- [ ] User-facing changes documented (if applicable)
- [ ] README / setup instructions current
- [ ] Inline comments for non-obvious logic only

## Build & Deploy

- [ ] CI pipeline passes
- [ ] No new build warnings introduced
- [ ] Deployable to target environment
- [ ] Environment-specific configuration handled
- [ ] Database migrations tested (if applicable)

## Security & Performance

- [ ] No new vulnerabilities introduced
- [ ] Sensitive data handled properly (no secrets in code)
- [ ] Performance within acceptable thresholds
- [ ] Input validation at system boundaries

## Product

- [ ] All acceptance criteria met
- [ ] Product Owner has reviewed
- [ ] UX matches agreed designs (if applicable)
- [ ] Accessible to target users (if applicable)

---
*Owned by: Developers*
*Last updated: [date] after [trigger]*
```

</template>

<guidelines>

**Overall Principles:**
- The DoD is universal — it applies to ALL work, every Sprint, without exception
- Work is Done or it isn't. There is no "partially done" or "done except for..."
- If it meets the DoD, it could ship. Whether it does ship is a business decision
- The DoD is the minimum bar, not the ceiling — teams can exceed it

**Code Quality:**
- Standards the team agrees on, not imposed from outside
- Review requirements should match team size (solo dev can use self-review checklists)
- "No known defects" means the team is confident, not that bugs are impossible
- Tailor to your stack — add type checking, formatting, etc. as relevant

**Testing:**
- Cover new and changed logic, not arbitrary coverage targets
- Acceptance criteria verification is functional — does it do what was asked?
- Edge cases and error paths prevent "works on happy path" releases
- Regression suite protects existing functionality

**Documentation:**
- Only documentation that has a reader — don't document for documentation's sake
- API docs matter when others consume your APIs
- User-facing docs matter when behavior changes
- Keep the bar realistic — overly ambitious doc requirements slow delivery

**Build & Deploy:**
- CI must pass — no "it works on my machine"
- Zero new warnings prevents gradual quality erosion
- "Deployable" means actually deployable, not theoretically deployable
- Migration testing prevents deployment surprises

**Security & Performance:**
- Not a full security audit per Sprint — but no regressions
- Secrets in code is a hard no, always
- Performance thresholds should be defined and measurable
- Scope this to what's realistic for your team and product stage

**Product:**
- Acceptance criteria are item-specific — the DoD wraps around them
- Product Owner review is a verification step, not a gate for approval
- Design conformance matters when designs exist
- Accessibility scope depends on your product and audience

**Tailoring the DoD:**
- Remove items that don't apply to your context (no API? remove API docs)
- Add items specific to your domain (regulated industry? add compliance checks)
- Every item must be verifiable — if you can't check it, remove it
- Start lean, add rigor as the team matures

</guidelines>

<evolution>

The Definition of Done evolves as the team matures and the product grows.

**At each Sprint Retrospective:**
1. Did the DoD catch quality issues before release?
2. Did anything slip through that the DoD should have caught? → Add it
3. Is any DoD item slowing delivery without adding value? → Discuss removing
4. Is the team ready to raise the bar? → Add stricter criteria

**When the team matures:**
- Early: basic checks (tests pass, code reviewed, CI green)
- Growing: add security, performance, documentation standards
- Mature: add accessibility, observability, deployment verification
- Never lower the bar without explicit team discussion and reasoning

**When the product context changes:**
- New compliance requirements? → Add to DoD
- New deployment target? → Update Build & Deploy section
- New team members? → Review DoD for clarity — can a newcomer follow it?

**Anti-patterns to watch for:**
- DoD so long nobody reads it → Trim to what matters
- DoD items nobody checks → Either enforce or remove
- DoD negotiated away per item → That's acceptance criteria, not DoD
- DoD unchanged for months → Team isn't inspecting and adapting

</evolution>

<dod_vs_acceptance_criteria>

The Definition of Done and Acceptance Criteria serve different purposes:

```
Product Backlog Item
  ├── Acceptance Criteria (specific to THIS item)
  │     "User can filter results by date range"
  │     "Filter persists across page navigation"
  │     Defined by: Product Owner
  │
  └── Definition of Done (applies to ALL items)
        "Tests passing, code reviewed, CI green..."
        Defined by: Developers
```

- **Acceptance Criteria** answer: "Does this item do what was asked?"
- **Definition of Done** answers: "Is this item built to our quality standard?"
- Both must be satisfied. Meeting acceptance criteria with broken tests is not Done.
- Meeting DoD without acceptance criteria is quality code that does the wrong thing.

</dod_vs_acceptance_criteria>

<state_reference>

STATE.md references DEFINITION-OF-DONE.md:

```markdown
## Quality Standard Reference

See: .artifacts/product-overview/DEFINITION-OF-DONE.md (updated [date])

**Summary:** [Brief description of DoD scope, e.g., "Code review, tests, CI, PO review"]
**Last raised:** [When the team last added stricter criteria]
```

This ensures Claude applies the team's quality standard when verifying work.

</state_reference>
