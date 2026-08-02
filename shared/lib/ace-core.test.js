const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  loadConfig, pathExists, safeReadFile, generateSlug, currentTimestamp,
  resolveModel, detectBrownfieldStatus,
  loadSettings, writeSettings, parseKeyValueArgs, MODEL_PROFILES,
  normalizeDocsPath, resolveDocsPath, docsPath, detectDocsCandidates,
} = require('./ace-core');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ace-core-test-'));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── generateSlug ────────────────────────────────────────────────────────────

describe('generateSlug', () => {
  it('converts text to lowercase slug', () => {
    assert.strictEqual(generateSlug('Hello World'), 'hello-world');
  });

  it('handles special characters', () => {
    assert.strictEqual(generateSlug('User Authentication & Login!!!'), 'user-authentication-login');
  });

  it('trims leading and trailing dashes', () => {
    assert.strictEqual(generateSlug('---hello---'), 'hello');
  });

  it('returns null for empty input', () => {
    assert.strictEqual(generateSlug(''), null);
    assert.strictEqual(generateSlug(null), null);
    assert.strictEqual(generateSlug(undefined), null);
  });

  it('handles multi-word input', () => {
    assert.strictEqual(generateSlug('Platform Foundation Setup'), 'platform-foundation-setup');
  });

  it('handles numeric IDs in text', () => {
    assert.strictEqual(generateSlug('E1-Platform Foundation'), 'e1-platform-foundation');
    assert.strictEqual(generateSlug('#45-User Auth'), '45-user-auth');
  });
});

// ─── currentTimestamp ────────────────────────────────────────────────────────

describe('currentTimestamp', () => {
  it('returns full ISO timestamp by default', () => {
    const ts = currentTimestamp('full');
    assert.match(ts, /^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns date-only format', () => {
    const ts = currentTimestamp('date');
    assert.match(ts, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns filename-safe format', () => {
    const ts = currentTimestamp('filename');
    assert.ok(!ts.includes(':'), 'should not contain colons');
    assert.ok(ts.includes('_'), 'should contain underscore separator');
  });
});

// ─── loadConfig ──────────────────────────────────────────────────────────────

describe('loadConfig', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  it('returns defaults when no config file exists', () => {
    const config = loadConfig(tmpDir);
    assert.strictEqual(config.version, '0.1.0');
    assert.strictEqual(config.projectName, '');
    assert.strictEqual(config.storage, 'local');
    assert.strictEqual(config.commit_docs, true);
    assert.strictEqual(config.github.enabled, false);
    assert.strictEqual(config.github.labels.epic, 'ace:epic');
  });

  it('reads existing config and merges with defaults', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ace', 'config.json'), JSON.stringify({
      projectName: 'Test Project',
      github: { enabled: true, repo: 'owner/repo' },
    }));

    const config = loadConfig(tmpDir);
    assert.strictEqual(config.projectName, 'Test Project');
    assert.strictEqual(config.github.enabled, true);
    assert.strictEqual(config.github.repo, 'owner/repo');
    assert.strictEqual(config.version, '0.1.0'); // default
    assert.strictEqual(config.github.labels.epic, 'ace:epic'); // default
  });

  it('handles malformed JSON gracefully', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ace', 'config.json'), 'not json');

    const config = loadConfig(tmpDir);
    assert.strictEqual(config.version, '0.1.0');
  });
});

// ─── pathExists ──────────────────────────────────────────────────────────────

describe('pathExists', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  it('returns true for existing directory', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    assert.strictEqual(pathExists(tmpDir, '.ace'), true);
  });

  it('returns false for non-existent path', () => {
    assert.strictEqual(pathExists(tmpDir, '.ace/config.json'), false);
  });

  it('returns true for existing file', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ace', 'config.json'), '{}');
    assert.strictEqual(pathExists(tmpDir, '.ace/config.json'), true);
  });
});

// ─── safeReadFile ────────────────────────────────────────────────────────────

describe('safeReadFile', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  it('reads file content', () => {
    const fp = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(fp, 'hello');
    assert.strictEqual(safeReadFile(fp), 'hello');
  });

  it('returns null for non-existent file', () => {
    assert.strictEqual(safeReadFile(path.join(tmpDir, 'nope.txt')), null);
  });
});

// ─── resolveModel ────────────────────────────────────────────────────────────

describe('resolveModel', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  it('returns quality model for ace-product-owner', () => {
    assert.strictEqual(resolveModel(tmpDir, 'ace-product-owner'), 'opus');
  });

  it('returns quality model for ace-code-reviewer', () => {
    assert.strictEqual(resolveModel(tmpDir, 'ace-code-reviewer'), 'sonnet');
  });

  it('respects budget profile from config', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ace', 'config.json'), JSON.stringify({
      model_profile: 'budget',
    }));
    assert.strictEqual(resolveModel(tmpDir, 'ace-product-owner'), 'sonnet');
  });

  it('returns sonnet for unknown agent type', () => {
    assert.strictEqual(resolveModel(tmpDir, 'unknown-agent'), 'sonnet');
  });
});

// ─── detectCodeFiles & detectBrownfieldStatus ────────────────────────────────

describe('detectBrownfieldStatus', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  it('detects greenfield (empty project)', () => {
    const result = detectBrownfieldStatus(tmpDir);
    assert.strictEqual(result.is_greenfield, true);
    assert.strictEqual(result.is_brownfield, false);
  });

  it('detects brownfield with code files', () => {
    fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");');
    const result = detectBrownfieldStatus(tmpDir);
    assert.strictEqual(result.is_brownfield, true);
    assert.strictEqual(result.has_existing_code, true);
  });

  it('detects brownfield with package file only', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
    const result = detectBrownfieldStatus(tmpDir);
    assert.strictEqual(result.is_brownfield, true);
    assert.strictEqual(result.has_package_file, true);
  });

  it('ignores node_modules', () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg', 'index.js'), '');
    const result = detectBrownfieldStatus(tmpDir);
    assert.strictEqual(result.has_existing_code, false);
  });

  it('detects nested code files up to depth 3', () => {
    const nested = path.join(tmpDir, 'src', 'lib', 'utils');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, 'helper.ts'), 'export const x = 1;');
    const result = detectBrownfieldStatus(tmpDir);
    assert.strictEqual(result.has_existing_code, true);
  });

  it('detects .csproj as package file', () => {
    fs.writeFileSync(path.join(tmpDir, 'App.csproj'), '<Project />');
    const result = detectBrownfieldStatus(tmpDir);
    assert.strictEqual(result.has_package_file, true);
  });
});

// ─── loadSettings / writeSettings ────────────────────────────────────────────

describe('loadSettings / writeSettings', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  it('returns defaults when no settings file exists', () => {
    const settings = loadSettings(tmpDir);
    assert.strictEqual(settings.model_profile, 'balanced');
    assert.strictEqual(settings.commit_docs, true);
    assert.strictEqual(settings.docs_path, '.docs');
    assert.strictEqual(settings.github_project.enabled, false);
  });

  it('backfills docs_path for settings written by an older ACE version', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ace', 'settings.json'), JSON.stringify({
      model_profile: 'quality',
      commit_docs: true,
    }));
    assert.strictEqual(loadSettings(tmpDir).docs_path, '.docs');
  });

  it('reads existing settings', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ace', 'settings.json'), JSON.stringify({
      model_profile: 'quality',
      github_project: { enabled: true, repo: 'owner/repo' },
    }));
    const settings = loadSettings(tmpDir);
    assert.strictEqual(settings.model_profile, 'quality');
    assert.strictEqual(settings.github_project.enabled, true);
  });

  it('writes settings and creates .ace directory', () => {
    const settings = { model_profile: 'budget', commit_docs: false };
    writeSettings(tmpDir, settings);

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, '.ace', 'settings.json'), 'utf-8'));
    assert.strictEqual(written.model_profile, 'budget');
    assert.strictEqual(written.commit_docs, false);
  });
});

// ─── Docs Root ───────────────────────────────────────────────────────────────

describe('normalizeDocsPath', () => {
  it('normalizes separators and strips trailing slashes', () => {
    assert.strictEqual(normalizeDocsPath('ProcerERP\\.docs\\'), 'ProcerERP/.docs');
    assert.strictEqual(normalizeDocsPath('  .docs/  '), '.docs');
  });

  it('returns null for values that carry no location', () => {
    assert.strictEqual(normalizeDocsPath(''), null);
    assert.strictEqual(normalizeDocsPath('   '), null);
    assert.strictEqual(normalizeDocsPath('.'), null);
    assert.strictEqual(normalizeDocsPath(null), null);
    assert.strictEqual(normalizeDocsPath(42), null);
  });
});

describe('resolveDocsPath / docsPath', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  it('defaults to .docs when nothing is configured', () => {
    assert.strictEqual(resolveDocsPath(tmpDir), '.docs');
    assert.strictEqual(docsPath(tmpDir, 'wiki/system-wide'), '.docs/wiki/system-wide');
  });

  it('honours a nested docs root from settings.json', () => {
    writeSettings(tmpDir, { docs_path: 'ProcerERP/.docs' });
    assert.strictEqual(resolveDocsPath(tmpDir), 'ProcerERP/.docs');
    assert.strictEqual(
      docsPath(tmpDir, 'wiki/system-wide/coding-standards.md'),
      'ProcerERP/.docs/wiki/system-wide/coding-standards.md'
    );
  });

  it('joins multiple segments with forward slashes and no doubling', () => {
    writeSettings(tmpDir, { docs_path: 'apps/api/.docs/' });
    assert.strictEqual(docsPath(tmpDir, '/wiki/', 'subsystems/auth'), 'apps/api/.docs/wiki/subsystems/auth');
  });

  it('returns the bare root when no segments are given', () => {
    writeSettings(tmpDir, { docs_path: 'ProcerERP/.docs' });
    assert.strictEqual(docsPath(tmpDir), 'ProcerERP/.docs');
  });
});

describe('detectDocsCandidates', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir(); });
  afterEach(() => { cleanup(tmpDir); });

  it('finds nested .docs directories', () => {
    fs.mkdirSync(path.join(tmpDir, 'ProcerERP', '.docs', 'wiki'), { recursive: true });
    assert.deepStrictEqual(detectDocsCandidates(tmpDir), ['ProcerERP/.docs']);
  });

  it('orders shallowest first', () => {
    fs.mkdirSync(path.join(tmpDir, '.docs'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'apps', 'api', '.docs'), { recursive: true });
    assert.deepStrictEqual(detectDocsCandidates(tmpDir), ['.docs', 'apps/api/.docs']);
  });

  it('ignores dependency and build directories', () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'pkg', '.docs'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'dist', '.docs'), { recursive: true });
    assert.deepStrictEqual(detectDocsCandidates(tmpDir), []);
  });

  it('returns an empty list when nothing exists', () => {
    assert.deepStrictEqual(detectDocsCandidates(tmpDir), []);
  });
});

// ─── parseKeyValueArgs ───────────────────────────────────────────────────────

describe('parseKeyValueArgs', () => {
  it('parses key=value pairs', () => {
    const result = parseKeyValueArgs(['story=path/to/file', 'status=Refined']);
    assert.strictEqual(result.story, 'path/to/file');
    assert.strictEqual(result.status, 'Refined');
  });

  it('handles values with equals signs', () => {
    const result = parseKeyValueArgs(['query=a=b']);
    assert.strictEqual(result.query, 'a=b');
  });

  it('ignores args without equals', () => {
    const result = parseKeyValueArgs(['--raw', 'story=file.md']);
    assert.strictEqual(result.story, 'file.md');
    assert.strictEqual(result['--raw'], undefined);
  });

  it('returns empty object for empty input', () => {
    const result = parseKeyValueArgs([]);
    assert.deepStrictEqual(result, {});
  });
});

// ─── MODEL_PROFILES ──────────────────────────────────────────────────────────

describe('MODEL_PROFILES', () => {
  it('has entries for all known agent types', () => {
    const agents = [
      'ace-product-owner', 'ace-project-researcher', 'ace-research-synthesizer',
      'ace-wiki-mapper', 'ace-code-integration-analyst', 'ace-code-discovery-analyst',
      'ace-executor', 'ace-code-reviewer',
    ];
    for (const agent of agents) {
      assert.ok(MODEL_PROFILES[agent], `Missing profile for ${agent}`);
      assert.ok(MODEL_PROFILES[agent].quality, `Missing quality for ${agent}`);
      assert.ok(MODEL_PROFILES[agent].balanced, `Missing balanced for ${agent}`);
      assert.ok(MODEL_PROFILES[agent].budget, `Missing budget for ${agent}`);
    }
  });
});
