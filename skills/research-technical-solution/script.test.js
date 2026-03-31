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

describe('research-technical-solution script', () => {

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

      assert.ok(result.analyst_model, 'should have analyst_model');
      assert.ok(result.mapper_model, 'should have mapper_model');
      assert.strictEqual(result.story_valid, true, 'story should be valid');
      assert.strictEqual(result.story_source, 'file');
      assert.strictEqual(result.story.id, 'S1');
      assert.strictEqual(result.story.title, 'Add Login Button');
      assert.strictEqual(result.acceptance_criteria_count, 1);
      assert.ok(result.paths, 'should have computed paths');
      assert.ok(result.wiki_references, 'should have wiki_references');
      assert.ok(result.wiki_docs_exist, 'should have wiki_docs_exist');
    });

    it('errors on init without story param', () => {
      const result = JSON.parse(runScript('init', '', tmpDir));
      assert.strictEqual(result.story_valid, false);
    });

    it('handles non-existent story file gracefully', () => {
      const result = JSON.parse(runScript('init', 'nonexistent/story.md', tmpDir));
      assert.strictEqual(result.story_valid, false);
      assert.ok(result.story_error.includes('not found'));
    });
  });

  describe('error handling', () => {
    it('errors on unknown command', () => {
      assert.throws(() => {
        execSync(`node "${SCRIPT}" bogus`, { encoding: 'utf-8', stdio: 'pipe' });
      });
    });
  });
});
