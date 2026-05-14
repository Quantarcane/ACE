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

describe('plan-story script', () => {

  describe('init', () => {
    let tmpDir;

    before(() => { tmpDir = createTestProject(); });
    after(() => { cleanup(tmpDir); });

    it('returns valid JSON with environment detection for a story file', () => {
      const storyContent = [
        '# S1: Add Login Button',
        '**Feature**: F1 User Auth | **Epic**: E1 Platform',
        '**Status**: Todo | **Size**: 3 | **Sprint**: — | **Link**: —',
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
        '## Technical Direction',
        '',
        'Prefer reusing the existing header action component.',
        '',
        '## Acceptance Criteria',
        '',
        '### Scenario: Click login button',
        '',
        '**Given** the user is on the homepage',
        '**When** they click "Login"',
        '**Then** they see the login form',
      ].join('\n');

      const storyPath = createStoryFile(
        tmpDir,
        '.ace/artifacts/product/e1-platform/f1-user-auth/s1-add-login-button/s1-add-login-button.md',
        storyContent
      );

      const result = JSON.parse(runScript('init', storyPath, tmpDir));

      assert.ok(result.product_owner_model, 'should have product_owner_model');
      assert.strictEqual(result.story_valid, true, 'story should be valid');
      assert.strictEqual(result.story_source, 'file');
      assert.strictEqual(result.story.id, 'S1');
      assert.strictEqual(result.story.title, 'Add Login Button');
      assert.strictEqual(result.story.status, 'Todo');
      assert.strictEqual(result.technical_direction, 'Prefer reusing the existing header action component.');
      assert.strictEqual(result.acceptance_criteria_count, 1);
      assert.ok(result.paths, 'should have computed paths');
      assert.ok(result.paths.story_file.includes('s1-add-login-button'));
      assert.strictEqual(result.has_story_file, true);
      assert.strictEqual(typeof result.commit_docs, 'boolean');
      assert.strictEqual(typeof result.has_git, 'boolean');
    });

    it('returns valid result for new story mode (no params)', () => {
      const result = JSON.parse(runScript('init', '', tmpDir));

      assert.strictEqual(result.story_source, 'new');
      assert.strictEqual(result.story_valid, true);
      assert.strictEqual(result.story_content, null);
      assert.strictEqual(result.story.id, null);
      assert.strictEqual(result.paths, null);
    });

    it('returns valid result for text mode', () => {
      const result = JSON.parse(runScript('init', 'text="User can reset password"', tmpDir));

      assert.strictEqual(result.story_source, 'text');
      assert.strictEqual(result.story_valid, true);
      assert.strictEqual(result.story_content, 'User can reset password');
      assert.strictEqual(result.description, 'User can reset password');
      assert.strictEqual(result.story.id, null);
    });

    it('handles non-existent story file gracefully', () => {
      const result = JSON.parse(runScript('init', 'nonexistent/story.md', tmpDir));

      assert.strictEqual(result.story_valid, false);
      assert.ok(result.story_error.includes('not found'));
    });

    it('returns brownfield detection fields', () => {
      const result = JSON.parse(runScript('init', '', tmpDir));

      assert.strictEqual(typeof result.is_brownfield, 'boolean');
      assert.strictEqual(typeof result.is_greenfield, 'boolean');
      assert.strictEqual(result.is_brownfield, !result.is_greenfield);
    });
  });

  describe('resolve-model', () => {
    let tmpDir;

    before(() => { tmpDir = createTestProject(); });
    after(() => { cleanup(tmpDir); });

    it('returns a model string with --raw', () => {
      const result = runScript('resolve-model', 'ace-product-owner --raw', tmpDir).trim();
      assert.match(result, /^(opus|sonnet|haiku)$/);
    });

    it('returns JSON without --raw', () => {
      const result = JSON.parse(runScript('resolve-model', 'ace-product-owner', tmpDir));
      assert.ok(result.model);
      assert.strictEqual(result.agent, 'ace-product-owner');
    });

    it('returns sonnet for unknown agent type', () => {
      const result = runScript('resolve-model', 'unknown-agent --raw', tmpDir).trim();
      assert.strictEqual(result, 'sonnet');
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
        '**Status**: Todo | **Size**: 3 | **Sprint**: — | **Link**: —',
      ].join('\n');

      const storyPath = createStoryFile(
        tmpDir,
        '.ace/artifacts/product/e1-test-epic/f1-test-feature/s1-test-story/s1-test-story.md',
        storyContent
      );

      const result = JSON.parse(runScript('update-state', `story=${storyPath} status=Refined`, tmpDir));

      assert.strictEqual(result.story_updated, true);
      assert.strictEqual(result.new_status, 'Refined');

      // Verify file was actually updated
      const updated = fs.readFileSync(path.join(tmpDir, storyPath), 'utf-8');
      assert.ok(updated.includes('**Status**: Refined'));
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
