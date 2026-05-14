const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SCRIPT = path.join(__dirname, 'script.js');

/**
 * Create a minimal ACE project structure in a temp directory.
 */
function createTestProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-test-'));

  // .ace/config.json
  const aceDir = path.join(tmpDir, '.ace');
  fs.mkdirSync(aceDir, { recursive: true });
  fs.writeFileSync(path.join(aceDir, 'config.json'), JSON.stringify({
    version: '0.1.0',
    projectName: 'test-project',
    model_profile: 'quality',
    commit_docs: true,
    github: { enabled: false },
  }, null, 2));

  // .ace/settings.json
  fs.writeFileSync(path.join(aceDir, 'settings.json'), JSON.stringify({
    model_profile: 'quality',
    commit_docs: true,
    agent_teams: false,
    github_project: { enabled: false, gh_installed: false, repo: '', project_number: null, owner: '' },
  }, null, 2));

  return tmpDir;
}

/**
 * Create a story file in the test project.
 */
function createStoryFile(tmpDir, relPath, content) {
  const fullPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  return relPath;
}

function runScript(subcommand, args, cwd) {
  return execSync(`node "${SCRIPT}" ${subcommand} ${args}`, {
    cwd,
    encoding: 'utf-8',
    timeout: 10000,
  });
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('execute-story script', () => {

  describe('init', () => {
    let tmpDir;

    before(() => { tmpDir = createTestProject(); });
    after(() => { cleanup(tmpDir); });

    it('returns valid JSON with environment detection for a story file', () => {
      const storyContent = [
        '# S1: Add Login Button',
        '**Feature**: F1 User Auth | **Epic**: E1 Platform',
        '**Status**: Refined | **Size**: 3 | **Sprint**: — | **Link**: —',
        '',
        '## User Story',
        '',
        '> As a user,',
        '> I want to click a login button,',
        '> so that I can access my account.',
        '',
        '## Description',
        '',
        'Adds a login button to the header.',
        '',
        '## Acceptance Criteria',
        '',
        '### Scenario: Click login button',
        '',
        '**Given** the user is on the homepage',
        '**When** they click "Login"',
        '**Then** they see the login form',
        '',
        '## Technical Solution',
        '',
        '### Architecture',
        '',
        'Simple button component in the header.',
        '',
        '### Implementation Plan',
        '',
        '1. Create LoginButton component',
        '2. Add to Header',
      ].join('\n');

      const storyPath = createStoryFile(
        tmpDir,
        '.ace/artifacts/product/e1-platform/f1-user-auth/s1-add-login-button/s1-add-login-button.md',
        storyContent
      );

      const result = JSON.parse(runScript('init', storyPath, tmpDir));

      assert.ok(result.executor_model, 'should have executor_model');
      assert.ok(result.reviewer_model, 'should have reviewer_model');
      assert.strictEqual(result.story_valid, true, 'story should be valid');
      assert.strictEqual(result.story_source, 'file');
      assert.strictEqual(result.story.id, 'S1');
      assert.strictEqual(result.story.title, 'Add Login Button');
      assert.strictEqual(result.story.status, 'Refined');
      assert.strictEqual(result.has_acceptance_criteria, true);
      assert.strictEqual(result.acceptance_criteria_count, 1);
      assert.strictEqual(result.has_technical_solution, true);
      assert.ok(result.paths, 'should have computed paths');
      assert.ok(result.paths.story_file.includes('s1-add-login-button'));
      assert.ok(result.paths.product_backlog);
      assert.ok(result.paths.coding_standards);
      assert.strictEqual(result.has_story_file, true);
      assert.strictEqual(typeof result.commit_docs, 'boolean');
      assert.strictEqual(typeof result.has_git, 'boolean');
      assert.ok(['claude', 'codex', 'opencode', 'unknown'].includes(result.runtime));
      assert.strictEqual(typeof result.supports_agent_teams, 'boolean');
      assert.strictEqual(typeof result.agent_teams, 'boolean');
      assert.strictEqual(result.agent_teams, result.supports_agent_teams && result.agent_teams);
    });

    it('returns invalid when story has no AC', () => {
      const storyContent = [
        '# S2: No AC Story',
        '**Feature**: F1 Test Feature | **Epic**: E1 Test Epic',
        '**Status**: Todo | **Size**: 3 | **Sprint**: — | **Link**: —',
        '',
        '## Description',
        '',
        'A story without acceptance criteria.',
      ].join('\n');

      const storyPath = createStoryFile(
        tmpDir,
        '.ace/artifacts/product/e1-test-epic/f1-test-feature/s2-no-ac/s2-no-ac.md',
        storyContent
      );

      const result = JSON.parse(runScript('init', storyPath, tmpDir));

      assert.strictEqual(result.story_valid, true);
      assert.strictEqual(result.has_acceptance_criteria, false);
      assert.strictEqual(result.acceptance_criteria_count, 0);
      assert.strictEqual(result.has_technical_solution, false);
    });

    it('handles non-existent story file gracefully', () => {
      const result = JSON.parse(runScript('init', 'nonexistent/story.md', tmpDir));

      assert.strictEqual(result.story_valid, false);
      assert.ok(result.story_error.includes('not found'));
    });

    it('returns invalid with no story parameter', () => {
      const result = JSON.parse(runScript('init', '', tmpDir));

      assert.strictEqual(result.story_valid, false);
      assert.ok(result.story_error);
    });
  });

  describe('resolve-model', () => {
    let tmpDir;

    before(() => { tmpDir = createTestProject(); });
    after(() => { cleanup(tmpDir); });

    it('returns a model string with --raw', () => {
      const result = runScript('resolve-model', 'ace-executor --raw', tmpDir).trim();
      assert.match(result, /^(opus|sonnet|haiku)$/);
    });

    it('returns JSON without --raw', () => {
      const result = JSON.parse(runScript('resolve-model', 'ace-executor', tmpDir));
      assert.ok(result.model);
      assert.strictEqual(result.agent, 'ace-executor');
    });

    it('returns correct model for reviewer', () => {
      const result = runScript('resolve-model', 'ace-code-reviewer --raw', tmpDir).trim();
      assert.match(result, /^(opus|sonnet|haiku)$/);
    });
  });

  describe('update-state', () => {
    let tmpDir;

    before(() => { tmpDir = createTestProject(); });
    after(() => { cleanup(tmpDir); });

    it('updates story status in the story file', () => {
      const storyContent = [
        '# S1: Test Story',
        '**Feature**: F1 Test Feature | **Epic**: E1 Test Epic',
        '**Status**: Refined | **Size**: 3 | **Sprint**: — | **Link**: —',
      ].join('\n');

      const storyPath = createStoryFile(
        tmpDir,
        '.ace/artifacts/product/e1-test-epic/f1-test-feature/s1-test-story/s1-test-story.md',
        storyContent
      );

      const result = JSON.parse(runScript('update-state', `story=${storyPath} status=Done`, tmpDir));

      assert.strictEqual(result.story_updated, true);
      assert.strictEqual(result.new_status, 'Done');

      // Verify file was actually updated
      const updated = fs.readFileSync(path.join(tmpDir, storyPath), 'utf-8');
      assert.ok(updated.includes('**Status**: Done'));
    });

    it('normalizes InProgress to "In Progress"', () => {
      const storyContent = [
        '# S2: Another Story',
        '**Feature**: F1 Test Feature | **Epic**: E1 Test Epic',
        '**Status**: Refined | **Size**: 2 | **Sprint**: — | **Link**: —',
      ].join('\n');

      const storyPath = createStoryFile(
        tmpDir,
        '.ace/artifacts/product/e1-test-epic/f1-test-feature/s2-another-story/s2-another-story.md',
        storyContent
      );

      const result = JSON.parse(runScript('update-state', `story=${storyPath} status=InProgress`, tmpDir));

      assert.strictEqual(result.new_status, 'In Progress');

      const updated = fs.readFileSync(path.join(tmpDir, storyPath), 'utf-8');
      assert.ok(updated.includes('**Status**: In Progress'));
    });
  });

  describe('error handling', () => {
    it('errors on unknown command', () => {
      assert.throws(() => {
        execSync(`node "${SCRIPT}" bogus`, { encoding: 'utf-8', stdio: 'pipe' });
      });
    });

    it('errors on resolve-model without agent type', () => {
      assert.throws(() => {
        execSync(`node "${SCRIPT}" resolve-model`, { encoding: 'utf-8', stdio: 'pipe' });
      });
    });
  });
});
