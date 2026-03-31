const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SCRIPT = path.join(__dirname, 'script.js');

function createTestProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-test-'));

  const aceDir = path.join(tmpDir, '.ace');
  fs.mkdirSync(aceDir, { recursive: true });
  fs.writeFileSync(path.join(aceDir, 'config.json'), JSON.stringify({
    version: '0.1.0',
    projectName: 'test-project',
    model_profile: 'quality',
    commit_docs: true,
    github: { enabled: false },
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

describe('init-coding-standards script', () => {
  it('errors on unknown command', () => {
    assert.throws(() => {
      execSync(`node "${SCRIPT}" bogus`, { encoding: 'utf-8', stdio: 'pipe' });
    });
  });

  describe('init', () => {
    let tmpDir;

    before(() => { tmpDir = createTestProject(); });
    after(() => { cleanup(tmpDir); });

    it('init returns valid JSON', () => {
      const result = JSON.parse(runScript('init', '', tmpDir));
      assert.ok(typeof result === 'object');
      assert.strictEqual(typeof result.commit_docs, 'boolean');
      assert.strictEqual(typeof result.has_git, 'boolean');
      assert.strictEqual(typeof result.is_brownfield, 'boolean');
      assert.strictEqual(typeof result.has_coding_standards, 'boolean');
      assert.strictEqual(typeof result.wiki_dir_exists, 'boolean');
      assert.strictEqual(typeof result.has_system_architecture, 'boolean');
      assert.strictEqual(typeof result.has_system_structure, 'boolean');
    });

    it('returns brownfield detection fields', () => {
      const result = JSON.parse(runScript('init', '', tmpDir));
      assert.strictEqual(typeof result.is_brownfield, 'boolean');
      assert.strictEqual(typeof result.is_greenfield, 'boolean');
      assert.strictEqual(result.is_brownfield, !result.is_greenfield);
    });
  });
});
