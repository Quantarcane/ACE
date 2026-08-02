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

describe('help script', () => {

  describe('init', () => {
    let tmpDir;

    before(() => { tmpDir = createTestProject(); });
    after(() => { cleanup(tmpDir); });

    it('returns valid JSON with environment detection', () => {
      const result = JSON.parse(runScript('init', '', tmpDir));

      assert.strictEqual(typeof result.commit_docs, 'boolean');
      assert.strictEqual(typeof result.has_git, 'boolean');
      assert.strictEqual(typeof result.has_product_vision, 'boolean');
      assert.strictEqual(typeof result.has_system_architecture, 'boolean');
      assert.strictEqual(typeof result.has_system_structure, 'boolean');
      assert.strictEqual(typeof result.has_coding_standards, 'boolean');
      assert.strictEqual(typeof result.has_testing_framework, 'boolean');
      assert.strictEqual(typeof result.is_brownfield, 'boolean');
      assert.strictEqual(typeof result.is_greenfield, 'boolean');
      assert.ok(result.product_owner_model, 'should have product_owner_model');
    });

    it('detects brownfield vs greenfield correctly', () => {
      const result = JSON.parse(runScript('init', '', tmpDir));
      assert.strictEqual(result.is_brownfield, !result.is_greenfield);
    });
  });

  describe('ensure-settings', () => {
    let tmpDir;

    before(() => { tmpDir = createTestProject(); });
    after(() => { cleanup(tmpDir); });

    it('reports settings already exist when they do', () => {
      const result = JSON.parse(runScript('ensure-settings', '', tmpDir));
      assert.strictEqual(result.created, false);
      assert.ok(result.settings);
    });

    it('creates settings when they do not exist', () => {
      const freshDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-test-'));
      const aceDir = path.join(freshDir, '.ace');
      fs.mkdirSync(aceDir, { recursive: true });
      fs.writeFileSync(path.join(aceDir, 'config.json'), JSON.stringify({
        version: '0.1.0',
        projectName: 'test',
        model_profile: 'balanced',
        commit_docs: true,
        github: { enabled: false },
      }, null, 2));

      const result = JSON.parse(runScript('ensure-settings', '', freshDir));
      assert.strictEqual(result.created, true);
      assert.ok(result.settings);
      assert.strictEqual(result.settings.model_profile, 'balanced');

      cleanup(freshDir);
    });
  });

  describe('sync-agent-teams', () => {
    let tmpDir;

    before(() => { tmpDir = createTestProject(); });
    after(() => { cleanup(tmpDir); });

    it('returns agent_teams boolean', () => {
      const result = JSON.parse(runScript('sync-agent-teams', '', tmpDir));
      assert.strictEqual(typeof result.agent_teams, 'boolean');
      assert.strictEqual(typeof result.synced, 'boolean');
    });
  });

  describe('write-agent-teams', () => {
    let tmpDir;

    before(() => { tmpDir = createTestProject(); });
    after(() => { cleanup(tmpDir); });

    it('enables agent teams', () => {
      const result = JSON.parse(runScript('write-agent-teams', 'true', tmpDir));
      assert.strictEqual(result.written, true);
      assert.strictEqual(result.agent_teams, true);

      // Verify .ace/settings.json updated
      const settings = JSON.parse(fs.readFileSync(path.join(tmpDir, '.ace', 'settings.json'), 'utf-8'));
      assert.strictEqual(settings.agent_teams, true);
    });

    it('disables agent teams', () => {
      const result = JSON.parse(runScript('write-agent-teams', 'false', tmpDir));
      assert.strictEqual(result.written, true);
      assert.strictEqual(result.agent_teams, false);

      const settings = JSON.parse(fs.readFileSync(path.join(tmpDir, '.ace', 'settings.json'), 'utf-8'));
      assert.strictEqual(settings.agent_teams, false);
    });
  });

  describe('verify-path-exists', () => {
    let tmpDir;

    before(() => { tmpDir = createTestProject(); });
    after(() => { cleanup(tmpDir); });

    it('returns true for existing path', () => {
      const result = runScript('verify-path-exists', '.ace/config.json --raw', tmpDir).trim();
      assert.strictEqual(result, 'true');
    });

    it('returns false for non-existing path', () => {
      const result = runScript('verify-path-exists', 'nonexistent/file.md --raw', tmpDir).trim();
      assert.strictEqual(result, 'false');
    });
  });

  describe('docs root', () => {
    let tmpDir;

    before(() => { tmpDir = createTestProject(); });
    after(() => { cleanup(tmpDir); });

    it('reports the default root and no candidates for a bare project', () => {
      const result = JSON.parse(runScript('detect-docs-path', '', tmpDir));
      assert.strictEqual(result.docs_path, '.docs');
      assert.strictEqual(result.is_explicitly_configured, false);
      assert.strictEqual(result.has_candidates, false);
    });

    it('detects a nested .docs directory as a candidate', () => {
      const nested = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-docs-'));
      fs.mkdirSync(path.join(nested, '.ace'), { recursive: true });
      fs.mkdirSync(path.join(nested, 'ProcerERP', '.docs', 'wiki'), { recursive: true });

      const result = JSON.parse(runScript('detect-docs-path', '', nested));
      assert.deepStrictEqual(result.candidates, ['ProcerERP/.docs']);
      assert.strictEqual(result.has_candidates, true);

      fs.rmSync(nested, { recursive: true, force: true });
    });

    it('persists a nested root and resolves paths against it afterwards', () => {
      const written = JSON.parse(runScript('write-docs-path', 'path=ProcerERP/.docs', tmpDir));
      assert.strictEqual(written.docs_path, 'ProcerERP/.docs');

      const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, '.ace', 'settings.json'), 'utf-8'));
      assert.strictEqual(onDisk.docs_path, 'ProcerERP/.docs');

      // init must now resolve every documentation check against the new root
      const init = JSON.parse(runScript('init', '', tmpDir));
      assert.strictEqual(init.docs_path, 'ProcerERP/.docs');

      const detected = JSON.parse(runScript('detect-docs-path', '', tmpDir));
      assert.strictEqual(detected.is_explicitly_configured, true);
    });

    it('normalizes backslashes and trailing slashes', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-docs-'));
      fs.mkdirSync(path.join(dir, '.ace'), { recursive: true });
      const written = JSON.parse(runScript('write-docs-path', 'path=apps\\\\api\\\\.docs\\\\', dir));
      assert.strictEqual(written.docs_path, 'apps/api/.docs');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('rejects an absolute path', () => {
      assert.throws(() => {
        execSync(`node "${SCRIPT}" write-docs-path path=/tmp/elsewhere`, {
          cwd: tmpDir, encoding: 'utf-8', stdio: 'pipe',
        });
      });
    });

    it('errors on write-docs-path without a path', () => {
      assert.throws(() => {
        execSync(`node "${SCRIPT}" write-docs-path`, {
          cwd: tmpDir, encoding: 'utf-8', stdio: 'pipe',
        });
      });
    });
  });

  describe('error handling', () => {
    it('errors on unknown command', () => {
      assert.throws(() => {
        execSync(`node "${SCRIPT}" bogus`, { encoding: 'utf-8', stdio: 'pipe' });
      });
    });

    it('errors on verify-path-exists without path', () => {
      assert.throws(() => {
        execSync(`node "${SCRIPT}" verify-path-exists`, { encoding: 'utf-8', stdio: 'pipe' });
      });
    });
  });
});
