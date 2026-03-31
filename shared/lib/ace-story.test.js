const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  classifyStoryParam, extractMarkdownSection, extractStoryMetadata,
  extractIssueNumber, extractStoryRequirements, extractWikiReferences,
  computeStoryPaths,
} = require('./ace-story');

const SAMPLE_STORY = `# S3: Display OAuth Provider Buttons

**Feature**: F3 OAuth2 Login Flow | **Epic**: #45 User Authentication
**Status**: Refined | **Size**: 3 | **Sprint**: Sprint 2 | **Link**: [#95](https://github.com/owner/repo/issues/95)

## User Story

> As a returning customer,
> I want to click a Google or GitHub login button,
> so that I can authenticate without remembering a site-specific password.

## Description

This story adds OAuth provider buttons to the login page. It builds on the
auth service foundation (S1) and enables the token exchange flow (S4).

## Acceptance Criteria

### Scenario: Successful Google login

**Given** the user is on the login page and has a valid Google account
**When** they click the "Sign in with Google" button and complete Google's OAuth flow
**Then** they are redirected to the dashboard and see their Google profile name

### Scenario: Provider unavailable

**Given** the user is on the login page and the Google OAuth service is unreachable
**When** they click the "Sign in with Google" button
**Then** they see an error message "Login service temporarily unavailable. Please try again."

### Scenario: GitHub login button displayed

**Given** the user navigates to the login page
**When** the page loads
**Then** they see a "Sign in with GitHub" button alongside the Google button

## Out of Scope

- Token refresh logic (handled by S4)
- Account linking (future feature)

## Definition of Done

- [ ] All acceptance criteria scenarios pass
- [ ] Code reviewed and approved

## Relevant Wiki

### System-Wide

- \`.docs/wiki/system-wide/system-structure.md\` — Mandatory system-wide context
- \`.docs/wiki/system-wide/coding-standards.md\` — Mandatory system-wide context

### Systems
- \`.docs/wiki/subsystems/auth/systems/oauth-provider.md\` — Implements the provider abstraction

### Patterns
- \`.docs/wiki/subsystems/auth/patterns/strategy-pattern.md\` — Each OAuth provider is a strategy
`;

// ─── classifyStoryParam ──────────────────────────────────────────────────────

describe('classifyStoryParam', () => {
  it('classifies file path', () => {
    const result = classifyStoryParam('.ace/artifacts/product/e1/f1/s1/s1.md');
    assert.strictEqual(result.type, 'file');
    assert.ok(result.filePath.includes('s1.md'));
  });

  it('classifies GitHub URL', () => {
    const result = classifyStoryParam('https://github.com/owner/repo/issues/123');
    assert.strictEqual(result.type, 'github-url');
    assert.strictEqual(result.repo, 'owner/repo');
    assert.strictEqual(result.issueNumber, 123);
  });

  it('classifies issue number', () => {
    const result = classifyStoryParam('42');
    assert.strictEqual(result.type, 'issue-number');
    assert.strictEqual(result.issueNumber, 42);
  });

  it('returns null type for empty input', () => {
    assert.strictEqual(classifyStoryParam(null).type, null);
    assert.strictEqual(classifyStoryParam('').type, null);
    assert.strictEqual(classifyStoryParam(undefined).type, null);
  });

  it('returns invalid for unrecognized GitHub URL', () => {
    const result = classifyStoryParam('https://github.com/owner/repo/pulls/5');
    assert.strictEqual(result.type, 'invalid');
  });
});

// ─── extractMarkdownSection ──────────────────────────────────────────────────

describe('extractMarkdownSection', () => {
  it('extracts section content', () => {
    const result = extractMarkdownSection(SAMPLE_STORY, 'Description', 2);
    assert.ok(result.includes('OAuth provider buttons'));
  });

  it('returns null for non-existent section', () => {
    assert.strictEqual(extractMarkdownSection(SAMPLE_STORY, 'Nonexistent', 2), null);
  });

  it('stops at next heading of same level', () => {
    const result = extractMarkdownSection(SAMPLE_STORY, 'Out of Scope', 2);
    assert.ok(result.includes('Token refresh'));
    assert.ok(!result.includes('Definition of Done'));
  });
});

// ─── extractStoryMetadata ────────────────────────────────────────────────────

describe('extractStoryMetadata', () => {
  it('extracts full metadata from sample story', () => {
    const meta = extractStoryMetadata(SAMPLE_STORY);
    assert.strictEqual(meta.id, 'S3');
    assert.strictEqual(meta.title, 'Display OAuth Provider Buttons');
    assert.strictEqual(meta.status, 'Refined');
    assert.strictEqual(meta.size, '3');
    assert.strictEqual(meta.sprint, 'Sprint 2');
    assert.strictEqual(meta.feature.id, 'F3');
    assert.strictEqual(meta.feature.title, 'OAuth2 Login Flow');
    assert.strictEqual(meta.epic.id, '#45');
    assert.strictEqual(meta.epic.title, 'User Authentication');
  });

  it('returns nulls for empty content', () => {
    const meta = extractStoryMetadata(null);
    assert.strictEqual(meta.id, null);
    assert.strictEqual(meta.title, null);
    assert.strictEqual(meta.feature.id, null);
  });

  it('extracts link field', () => {
    const meta = extractStoryMetadata(SAMPLE_STORY);
    assert.ok(meta.link.includes('#95'));
  });
});

// ─── extractIssueNumber ──────────────────────────────────────────────────────

describe('extractIssueNumber', () => {
  it('extracts from markdown link format', () => {
    assert.strictEqual(extractIssueNumber('[#187](https://github.com/owner/repo/issues/187)'), 187);
  });

  it('extracts from hash format', () => {
    assert.strictEqual(extractIssueNumber('#95'), 95);
  });

  it('returns null for null input', () => {
    assert.strictEqual(extractIssueNumber(null), null);
  });

  it('returns null for no match', () => {
    assert.strictEqual(extractIssueNumber('no number here'), null);
  });
});

// ─── extractStoryRequirements ────────────────────────────────────────────────

describe('extractStoryRequirements', () => {
  it('extracts user story, description, and AC count', () => {
    const req = extractStoryRequirements(SAMPLE_STORY);
    assert.ok(req.user_story.includes('returning customer'));
    assert.ok(req.description.includes('OAuth provider buttons'));
    assert.strictEqual(req.acceptance_criteria_count, 3);
  });

  it('strips blockquote prefix from user story', () => {
    const req = extractStoryRequirements(SAMPLE_STORY);
    assert.ok(!req.user_story.startsWith('>'));
  });

  it('returns zeros/nulls for empty content', () => {
    const req = extractStoryRequirements(null);
    assert.strictEqual(req.user_story, null);
    assert.strictEqual(req.description, null);
    assert.strictEqual(req.acceptance_criteria_count, 0);
  });
});

// ─── extractWikiReferences ───────────────────────────────────────────────────

describe('extractWikiReferences', () => {
  it('extracts system-wide references', () => {
    const refs = extractWikiReferences(SAMPLE_STORY);
    assert.strictEqual(refs.system_wide.length, 2);
    assert.ok(refs.system_wide.includes('.docs/wiki/system-wide/system-structure.md'));
  });

  it('extracts subsystem docs with categories', () => {
    const refs = extractWikiReferences(SAMPLE_STORY);
    assert.strictEqual(refs.subsystem_docs.length, 2);

    const oauthDoc = refs.subsystem_docs.find(d => d.path.includes('oauth-provider'));
    assert.ok(oauthDoc);
    assert.strictEqual(oauthDoc.category, 'systems');

    const strategyDoc = refs.subsystem_docs.find(d => d.path.includes('strategy-pattern'));
    assert.ok(strategyDoc);
    assert.strictEqual(strategyDoc.category, 'patterns');
  });

  it('computes total count', () => {
    const refs = extractWikiReferences(SAMPLE_STORY);
    assert.strictEqual(refs.total_count, 4);
  });

  it('returns empty for content without wiki section', () => {
    const refs = extractWikiReferences('# No wiki here');
    assert.strictEqual(refs.total_count, 0);
    assert.deepStrictEqual(refs.system_wide, []);
  });
});

// ─── computeStoryPaths ───────────────────────────────────────────────────────

describe('computeStoryPaths', () => {
  it('generates correct slugs and paths', () => {
    const paths = computeStoryPaths('E1', 'Platform', 'F3', 'OAuth Login', 'S1', 'Add Button');
    assert.strictEqual(paths.epic_slug, 'e1-platform');
    assert.strictEqual(paths.feature_slug, 'f3-oauth-login');
    assert.strictEqual(paths.story_slug, 's1-add-button');
    assert.strictEqual(paths.story_dir, '.ace/artifacts/product/e1-platform/f3-oauth-login/s1-add-button');
    assert.strictEqual(paths.story_file, '.ace/artifacts/product/e1-platform/f3-oauth-login/s1-add-button/s1-add-button.md');
    assert.ok(paths.external_analysis_file.endsWith('external-analysis.md'));
    assert.ok(paths.integration_analysis_file.endsWith('integration-analysis.md'));
    assert.ok(paths.feature_file.endsWith('f3-oauth-login.md'));
  });

  it('handles missing titles with fallback slugs', () => {
    const paths = computeStoryPaths('', '', '', '', '', '');
    assert.strictEqual(paths.epic_slug, 'unknown-epic');
    assert.strictEqual(paths.feature_slug, 'unknown-feature');
    assert.strictEqual(paths.story_slug, 'unknown-story');
  });
});
