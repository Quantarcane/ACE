/**
 * ACE Tools Tests
 *
 * Inspired by GSD's gsd-tools.test.js (https://github.com/gsd-build/get-shit-done).
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOOLS_PATH = path.join(__dirname, 'ace-tools.js');

// Helper to run ace-tools command
function runAceTools(args, cwd = process.cwd()) {
  try {
    const result = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}

// Create temp directory structure
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ace-test-'));
  return tmpDir;
}

function createTempProjectWithAce() {
  const tmpDir = createTempProject();
  fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
  return tmpDir;
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ─── generate-slug ────────────────────────────────────────────────────────────

describe('generate-slug command', () => {
  test('converts text to lowercase slug', () => {
    const result = runAceTools('generate-slug "Hello World"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.slug, 'hello-world');
  });

  test('handles special characters', () => {
    const result = runAceTools('generate-slug "User Authentication & Login!!!"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.slug, 'user-authentication-login');
  });

  test('trims leading and trailing dashes', () => {
    const result = runAceTools('generate-slug "---hello---"');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.slug, 'hello');
  });

  test('returns raw slug with --raw flag', () => {
    const result = runAceTools('generate-slug "My Epic Name" --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.strictEqual(result.output, 'my-epic-name');
  });

  test('errors when no text provided', () => {
    const result = runAceTools('generate-slug');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('text required'), `Expected error about text, got: ${result.error}`);
  });

  test('handles multi-word args without quotes', () => {
    const result = runAceTools('generate-slug Platform Foundation Setup');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.slug, 'platform-foundation-setup');
  });
});

// ─── current-timestamp ────────────────────────────────────────────────────────

describe('current-timestamp command', () => {
  test('returns full ISO timestamp by default', () => {
    const result = runAceTools('current-timestamp');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.format, 'full');
    assert.ok(parsed.timestamp.match(/^\d{4}-\d{2}-\d{2}T/), `Expected ISO format, got: ${parsed.timestamp}`);
  });

  test('returns date-only with date format', () => {
    const result = runAceTools('current-timestamp date');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.format, 'date');
    assert.ok(parsed.timestamp.match(/^\d{4}-\d{2}-\d{2}$/), `Expected date format, got: ${parsed.timestamp}`);
  });

  test('returns filename-safe with filename format', () => {
    const result = runAceTools('current-timestamp filename');
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.format, 'filename');
    assert.ok(!parsed.timestamp.includes(':'), `Filename format should not contain colons: ${parsed.timestamp}`);
    assert.ok(parsed.timestamp.includes('_'), `Filename format should contain underscore separator: ${parsed.timestamp}`);
  });

  test('returns raw value with --raw flag', () => {
    const result = runAceTools('current-timestamp date --raw');
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.match(/^\d{4}-\d{2}-\d{2}$/), `Expected raw date, got: ${result.output}`);
  });
});

// ─── resolve-model ────────────────────────────────────────────────────────────

describe('resolve-model command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns quality model for ace-project-researcher', () => {
    const result = runAceTools('resolve-model ace-project-researcher', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.model, 'opus');
    assert.strictEqual(parsed.agent, 'ace-project-researcher');
    assert.strictEqual(parsed.profile, 'quality');
  });

  test('returns quality model for ace-research-synthesizer', () => {
    const result = runAceTools('resolve-model ace-research-synthesizer', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.model, 'sonnet');
    assert.strictEqual(parsed.profile, 'quality');
  });

  test('returns quality model for ace-product-owner', () => {
    const result = runAceTools('resolve-model ace-product-owner', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.model, 'opus');
    assert.strictEqual(parsed.profile, 'quality');
  });

  test('respects budget profile from config', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ace', 'config.json'), JSON.stringify({
      model_profile: 'budget',
    }));

    const result = runAceTools('resolve-model ace-product-owner', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.model, 'sonnet');
    assert.strictEqual(parsed.profile, 'budget');
  });

  test('returns sonnet for unknown agent type', () => {
    const result = runAceTools('resolve-model unknown-agent', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.model, 'sonnet');
  });

  test('returns raw model name with --raw flag', () => {
    const result = runAceTools('resolve-model ace-product-owner --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.strictEqual(result.output, 'opus');
  });

  test('errors when no agent type provided', () => {
    const result = runAceTools('resolve-model');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('agent-type required'), `Expected error about agent-type, got: ${result.error}`);
  });
});

// ─── verify-path-exists ───────────────────────────────────────────────────────

describe('verify-path-exists command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns true for existing directory', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    const result = runAceTools('verify-path-exists .ace', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.exists, true);
    assert.strictEqual(parsed.path, '.ace');
  });

  test('returns false for non-existent path', () => {
    const result = runAceTools('verify-path-exists .ace/config.json', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.exists, false);
  });

  test('returns true for existing file', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ace', 'config.json'), '{}');
    const result = runAceTools('verify-path-exists .ace/config.json', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.exists, true);
  });

  test('returns raw true/false with --raw flag', () => {
    const result = runAceTools('verify-path-exists nonexistent --raw', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.strictEqual(result.output, 'false');
  });

  test('errors when no path provided', () => {
    const result = runAceTools('verify-path-exists', tmpDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('path required'), `Expected error about path, got: ${result.error}`);
  });
});

// ─── load-config ──────────────────────────────────────────────────────────────

describe('load-config command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns defaults when no config file exists', () => {
    const result = runAceTools('load-config', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const config = JSON.parse(result.output);
    assert.strictEqual(config.version, '0.1.0');
    assert.strictEqual(config.projectName, '');
    assert.strictEqual(config.storage, 'local');
    assert.strictEqual(config.commit_docs, true);
    assert.strictEqual(config.github.enabled, false);
    assert.strictEqual(config.github.repo, null);
    assert.strictEqual(config.github.labels.epic, 'ace:epic');
  });

  test('reads existing config and merges with defaults', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ace', 'config.json'), JSON.stringify({
      projectName: 'Test Project',
      storage: 'github',
      github: { enabled: true, repo: 'owner/repo' },
    }));

    const result = runAceTools('load-config', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const config = JSON.parse(result.output);
    assert.strictEqual(config.projectName, 'Test Project');
    assert.strictEqual(config.storage, 'github');
    assert.strictEqual(config.github.enabled, true);
    assert.strictEqual(config.github.repo, 'owner/repo');
    // Defaults still applied for unset fields
    assert.strictEqual(config.version, '0.1.0');
    assert.strictEqual(config.github.labels.epic, 'ace:epic');
  });

  test('handles malformed JSON gracefully', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ace', 'config.json'), 'not json');

    const result = runAceTools('load-config', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const config = JSON.parse(result.output);
    // Should return defaults
    assert.strictEqual(config.version, '0.1.0');
    assert.strictEqual(config.projectName, '');
  });
});

// ─── init new-project ─────────────────────────────────────────────────────────

describe('init new-project command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects empty project (greenfield)', () => {
    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.project_exists, false);
    assert.strictEqual(data.has_codebase_map, false);
    assert.strictEqual(data.planning_exists, false);
    assert.strictEqual(data.is_brownfield, false);
    assert.strictEqual(data.has_existing_code, false);
    assert.strictEqual(data.has_package_file, false);
    assert.strictEqual(data.needs_codebase_map, false);
    assert.strictEqual(data.has_git, false);
    assert.strictEqual(data.commit_docs, true);
  });

  test('detects existing code files (brownfield)', () => {
    fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_existing_code, true);
    assert.strictEqual(data.has_package_file, true);
    assert.strictEqual(data.is_brownfield, true);
    assert.strictEqual(data.needs_codebase_map, true);
  });

  test('detects package file without code files', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_existing_code, false);
    assert.strictEqual(data.has_package_file, true);
    assert.strictEqual(data.is_brownfield, true);
  });

  test('detects nested code files up to depth 3', () => {
    const nested = path.join(tmpDir, 'src', 'lib', 'utils');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, 'helper.ts'), 'export const x = 1;');

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_existing_code, true);
    assert.strictEqual(data.needs_codebase_map, true);
  });

  test('ignores node_modules directory', () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'pkg', 'index.js'), 'module.exports = {};');

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_existing_code, false);
    assert.strictEqual(data.needs_codebase_map, false);
  });

  test('detects ACE already initialized', () => {
    fs.mkdirSync(path.join(tmpDir, '.docs', 'product'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.docs', 'product', 'product-vision.md'), '# My Product');

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.project_exists, true);
  });

  test('detects git repository', () => {
    fs.mkdirSync(path.join(tmpDir, '.git'), { recursive: true });

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_git, true);
  });

  test('commit_docs defaults to true', () => {
    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.commit_docs, true);
  });

  test('includes pre-resolved models for init agents', () => {
    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.product_owner_model, 'opus');
    assert.strictEqual(data.researcher_model, 'opus');
    assert.strictEqual(data.synthesizer_model, 'sonnet');
  });

  test('models respect config profile', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ace', 'config.json'), JSON.stringify({
      model_profile: 'budget',
    }));

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.product_owner_model, 'sonnet');
    assert.strictEqual(data.researcher_model, 'haiku');
    assert.strictEqual(data.synthesizer_model, 'haiku');
  });

  test('detects Python project files', () => {
    fs.writeFileSync(path.join(tmpDir, 'requirements.txt'), 'flask==2.0');
    fs.writeFileSync(path.join(tmpDir, 'app.py'), 'from flask import Flask');

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_existing_code, true);
    assert.strictEqual(data.has_package_file, true);
    assert.strictEqual(data.is_brownfield, true);
  });

  test('detects Go project files', () => {
    fs.writeFileSync(path.join(tmpDir, 'go.mod'), 'module example.com/foo');
    fs.writeFileSync(path.join(tmpDir, 'main.go'), 'package main');

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_existing_code, true);
    assert.strictEqual(data.has_package_file, true);
  });

  test('detects Rust project files', () => {
    fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '[package]');
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'main.rs'), 'fn main() {}');

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_existing_code, true);
    assert.strictEqual(data.has_package_file, true);
  });

  test('needs_codebase_map is false when codebase dir exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace', 'codebase'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'index.js'), 'console.log("hello");');

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_existing_code, true);
    assert.strictEqual(data.has_codebase_map, true);
    assert.strictEqual(data.needs_codebase_map, false);
  });

  test('commit_docs respects config override', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.ace', 'config.json'), JSON.stringify({
      commit_docs: false,
    }));

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.commit_docs, false);
  });

  test('detects C# project files', () => {
    fs.writeFileSync(path.join(tmpDir, 'App.cs'), 'namespace App {}');

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_existing_code, true);
    assert.strictEqual(data.needs_codebase_map, true);
  });

  test('detects .csproj as package file', () => {
    fs.writeFileSync(path.join(tmpDir, 'MyApp.csproj'), '<Project Sdk="Microsoft.NET.Sdk" />');

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_package_file, true);
    assert.strictEqual(data.is_brownfield, true);
  });

  test('detects .sln as package file', () => {
    fs.writeFileSync(path.join(tmpDir, 'MyApp.sln'), 'Microsoft Visual Studio Solution File');

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_package_file, true);
    assert.strictEqual(data.is_brownfield, true);
  });

  test('detects Java project with build.gradle', () => {
    fs.writeFileSync(path.join(tmpDir, 'build.gradle'), 'plugins {}');

    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_package_file, true);
  });

  test('has_gh_cli is boolean', () => {
    const result = runAceTools('init new-project', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(typeof data.has_gh_cli, 'boolean');
  });
});

// ─── ensure-settings ──────────────────────────────────────────────────────────

describe('ensure-settings command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates settings.json with defaults when missing', () => {
    const result = runAceTools('ensure-settings', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.created, true);
    assert.strictEqual(data.settings.model_profile, 'balanced');
    assert.strictEqual(data.settings.commit_docs, true);
    assert.strictEqual(data.settings.github_project.enabled, false);
    assert.strictEqual(data.settings.github_project.gh_installed, false);
    assert.strictEqual(data.settings.github_project.repo, '');
    assert.strictEqual(data.settings.github_project.project_number, null);
    assert.strictEqual(data.settings.github_project.owner, '');

    // Verify file was actually created
    const settingsPath = path.join(tmpDir, '.ace', 'settings.json');
    assert.ok(fs.existsSync(settingsPath), 'settings.json should exist on disk');
    const onDisk = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    assert.strictEqual(onDisk.model_profile, 'balanced');
  });

  test('creates .ace directory if it does not exist', () => {
    const aceDir = path.join(tmpDir, '.ace');
    assert.ok(!fs.existsSync(aceDir), '.ace dir should not exist yet');

    const result = runAceTools('ensure-settings', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.created, true);
    assert.ok(fs.existsSync(aceDir), '.ace dir should be created');
  });

  test('does not overwrite existing settings.json', () => {
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
    const customSettings = {
      model_profile: 'quality',
      commit_docs: false,
      github_project: {
        enabled: true,
        gh_installed: true,
        repo: 'owner/repo',
        project_number: 5,
        owner: 'owner',
      },
    };
    fs.writeFileSync(path.join(tmpDir, '.ace', 'settings.json'), JSON.stringify(customSettings, null, 2));

    const result = runAceTools('ensure-settings', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.created, false);
    assert.strictEqual(data.settings.model_profile, 'quality');
    assert.strictEqual(data.settings.commit_docs, false);
    assert.strictEqual(data.settings.github_project.enabled, true);
    assert.strictEqual(data.settings.github_project.project_number, 5);
  });
});

// ─── init setup-github ────────────────────────────────────────────────────────

describe('init setup-github command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns gh_installed as boolean', () => {
    const result = runAceTools('init setup-github', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(typeof data.gh_installed, 'boolean');
  });

  test('returns projects as array', () => {
    const result = runAceTools('init setup-github', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok(Array.isArray(data.projects), 'projects should be an array');
  });

  test('returns current_settings object', () => {
    const result = runAceTools('init setup-github', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok(data.current_settings !== undefined, 'current_settings should be present');
    assert.strictEqual(typeof data.current_settings.enabled, 'boolean');
  });

  test('returns repo and owner as strings', () => {
    const result = runAceTools('init setup-github', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(typeof data.repo, 'string');
    assert.strictEqual(typeof data.owner, 'string');
  });
});

// ─── write-github-settings ────────────────────────────────────────────────────

describe('write-github-settings command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProjectWithAce();
    // Seed a settings.json with defaults
    const defaults = {
      model_profile: 'balanced',
      commit_docs: true,
      github_project: {
        enabled: false,
        gh_installed: false,
        repo: '',
        project_number: null,
        owner: '',
      },
    };
    fs.writeFileSync(path.join(tmpDir, '.ace', 'settings.json'), JSON.stringify(defaults, null, 2));
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('writes key=value pairs to settings.json', () => {
    const result = runAceTools('write-github-settings enabled=true repo=owner/repo project_number=3 owner=owner gh_installed=true', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.written, true);
    assert.strictEqual(data.settings.github_project.enabled, true);
    assert.strictEqual(data.settings.github_project.repo, 'owner/repo');
    assert.strictEqual(data.settings.github_project.project_number, 3);
    assert.strictEqual(data.settings.github_project.owner, 'owner');
    assert.strictEqual(data.settings.github_project.gh_installed, true);

    // Verify persisted to disk
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmpDir, '.ace', 'settings.json'), 'utf-8'));
    assert.strictEqual(onDisk.github_project.enabled, true);
    assert.strictEqual(onDisk.github_project.project_number, 3);
  });

  test('preserves non-github settings when writing', () => {
    const result = runAceTools('write-github-settings enabled=true', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.settings.model_profile, 'balanced');
    assert.strictEqual(data.settings.commit_docs, true);
  });

  test('handles project_number=null', () => {
    // First set a number
    runAceTools('write-github-settings project_number=5', tmpDir);
    // Then reset to null
    const result = runAceTools('write-github-settings project_number=null', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.settings.github_project.project_number, null);
  });
});

// ─── init research-story ─────────────────────────────────────────────────────

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

## Dependencies

### Blocked By
- S1 Auth service foundation

### Blocks
- S4 Token exchange flow

### External
- Google OAuth API — available

## Definition of Done

- [ ] All acceptance criteria scenarios pass
- [ ] Code reviewed and approved
- [ ] Tests written and passing
- [ ] CI pipeline green
- [ ] Documentation updated (if applicable)
- [ ] Product Owner verified

## Relevant Wiki

### System-Wide

- \`.docs/wiki/system-wide/system-structure.md\` — Mandatory system-wide context
- \`.docs/wiki/system-wide/system-architecture.md\` — Mandatory system-wide context
- \`.docs/wiki/system-wide/coding-standards.md\` — Mandatory system-wide context
- \`.docs/wiki/system-wide/testing-framework.md\` — Mandatory system-wide context

### Systems
- \`.docs/wiki/subsystems/auth/systems/oauth-provider.md\` — Implements the provider abstraction this story extends

### Patterns
- \`.docs/wiki/subsystems/auth/patterns/strategy-pattern.md\` — Each OAuth provider is a strategy; new provider must follow this

### Decisions
- \`.docs/wiki/subsystems/auth/decisions/adr-003-jwt-over-sessions.md\` — Constrains token format to JWT
`;

describe('init research-story command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.mkdirSync(path.join(tmpDir, '.ace'), { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('parses story from file and extracts metadata', () => {
    // Create story directory structure
    const storyDir = path.join(tmpDir, '.ace', 'artifacts', 'product', '45-user-authentication', 'f3-oauth2-login-flow', 's3-display-oauth-provider-buttons');
    fs.mkdirSync(storyDir, { recursive: true });
    const storyFile = path.join(storyDir, 's3-display-oauth-provider-buttons.md');
    fs.writeFileSync(storyFile, SAMPLE_STORY);

    const relPath = path.relative(tmpDir, storyFile).replace(/\\/g, '/');
    const result = runAceTools(`init research-story ${relPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.story_valid, true);
    assert.strictEqual(data.story_error, null);
    assert.strictEqual(data.story_source, 'file');
    assert.strictEqual(data.story.id, 'S3');
    assert.strictEqual(data.story.title, 'Display OAuth Provider Buttons');
    assert.strictEqual(data.story.status, 'Refined');
    assert.strictEqual(data.story.size, '3');
    assert.strictEqual(data.feature.id, 'F3');
    assert.strictEqual(data.feature.title, 'OAuth2 Login Flow');
    assert.strictEqual(data.epic.id, '#45');
    assert.strictEqual(data.epic.title, 'User Authentication');
  });

  test('extracts user story and description', () => {
    const storyDir = path.join(tmpDir, '.ace', 'artifacts', 'product', 'epic', 'feat', 'story');
    fs.mkdirSync(storyDir, { recursive: true });
    const storyFile = path.join(storyDir, 'story.md');
    fs.writeFileSync(storyFile, SAMPLE_STORY);

    const relPath = path.relative(tmpDir, storyFile).replace(/\\/g, '/');
    const result = runAceTools(`init research-story ${relPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok(data.user_story.includes('As a returning customer'), `user_story should contain persona: ${data.user_story}`);
    assert.ok(data.user_story.includes('authenticate without remembering'), `user_story should contain benefit`);
    assert.ok(data.description.includes('OAuth provider buttons'), `description should contain story details: ${data.description}`);
    assert.strictEqual(data.acceptance_criteria_count, 3);
  });

  test('extracts wiki references with categories', () => {
    const storyDir = path.join(tmpDir, '.ace', 'artifacts', 'product', 'epic', 'feat', 'story');
    fs.mkdirSync(storyDir, { recursive: true });
    const storyFile = path.join(storyDir, 'story.md');
    fs.writeFileSync(storyFile, SAMPLE_STORY);

    const relPath = path.relative(tmpDir, storyFile).replace(/\\/g, '/');
    const result = runAceTools(`init research-story ${relPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.wiki_references.system_wide.length, 4);
    assert.ok(data.wiki_references.system_wide.includes('.docs/wiki/system-wide/system-structure.md'));
    assert.ok(data.wiki_references.system_wide.includes('.docs/wiki/system-wide/coding-standards.md'));

    assert.strictEqual(data.wiki_references.subsystem_docs.length, 3);
    const oauthDoc = data.wiki_references.subsystem_docs.find(d => d.path.includes('oauth-provider'));
    assert.ok(oauthDoc, 'Should find oauth-provider doc');
    assert.strictEqual(oauthDoc.category, 'systems');

    const strategyDoc = data.wiki_references.subsystem_docs.find(d => d.path.includes('strategy-pattern'));
    assert.ok(strategyDoc, 'Should find strategy-pattern doc');
    assert.strictEqual(strategyDoc.category, 'patterns');

    const adrDoc = data.wiki_references.subsystem_docs.find(d => d.path.includes('adr-003'));
    assert.ok(adrDoc, 'Should find ADR doc');
    assert.strictEqual(adrDoc.category, 'decisions');

    assert.strictEqual(data.wiki_references.total_count, 7);
  });

  test('computes paths from file location', () => {
    const storyDir = path.join(tmpDir, '.ace', 'artifacts', 'product', 'e1-auth', 'f3-oauth', 's3-buttons');
    fs.mkdirSync(storyDir, { recursive: true });
    const storyFile = path.join(storyDir, 's3-buttons.md');
    fs.writeFileSync(storyFile, SAMPLE_STORY);

    const relPath = path.relative(tmpDir, storyFile).replace(/\\/g, '/');
    const result = runAceTools(`init research-story ${relPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok(data.paths, 'paths should be present');
    assert.ok(data.paths.story_dir.includes('s3-buttons'), `story_dir should contain story slug: ${data.paths.story_dir}`);
    assert.ok(data.paths.external_analysis_file.endsWith('external-analysis.md'), `external_analysis_file: ${data.paths.external_analysis_file}`);
    assert.ok(data.paths.integration_analysis_file.endsWith('integration-analysis.md'));
    assert.ok(data.paths.feature_file.endsWith('f3-oauth.md'), `feature_file: ${data.paths.feature_file}`);
  });

  test('detects existing artifacts', () => {
    const storyDir = path.join(tmpDir, '.ace', 'artifacts', 'product', 'epic', 'feat', 'story');
    fs.mkdirSync(storyDir, { recursive: true });
    const storyFile = path.join(storyDir, 'story.md');
    fs.writeFileSync(storyFile, SAMPLE_STORY);
    // Create external analysis
    fs.writeFileSync(path.join(storyDir, 'external-analysis.md'), '# External Analysis');

    const relPath = path.relative(tmpDir, storyFile).replace(/\\/g, '/');
    const result = runAceTools(`init research-story ${relPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.has_external_analysis, true);
    assert.strictEqual(data.has_integration_analysis, false);
  });

  test('verifies wiki doc existence', () => {
    const storyDir = path.join(tmpDir, '.ace', 'artifacts', 'product', 'epic', 'feat', 'story');
    fs.mkdirSync(storyDir, { recursive: true });
    const storyFile = path.join(storyDir, 'story.md');
    fs.writeFileSync(storyFile, SAMPLE_STORY);

    // Create some wiki docs but not all
    fs.mkdirSync(path.join(tmpDir, '.docs', 'wiki', 'system-wide'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.docs', 'wiki', 'system-wide', 'system-structure.md'), '# Structure');
    fs.writeFileSync(path.join(tmpDir, '.docs', 'wiki', 'system-wide', 'coding-standards.md'), '# Standards');

    const relPath = path.relative(tmpDir, storyFile).replace(/\\/g, '/');
    const result = runAceTools(`init research-story ${relPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok(data.wiki_docs_exist.existing.length >= 2, `Should find at least 2 existing: ${JSON.stringify(data.wiki_docs_exist.existing)}`);
    assert.ok(data.wiki_docs_exist.missing.length >= 2, `Should find at least 2 missing: ${JSON.stringify(data.wiki_docs_exist.missing)}`);
    assert.ok(data.wiki_docs_exist.existing.includes('.docs/wiki/system-wide/system-structure.md'));
  });

  test('returns error for non-existent file', () => {
    const result = runAceTools('init research-story nonexistent.md', tmpDir);
    assert.ok(result.success, `Command should still succeed with error in JSON: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.story_valid, false);
    assert.ok(data.story_error.includes('not found'), `story_error: ${data.story_error}`);
  });

  test('returns error for no parameter', () => {
    const result = runAceTools('init research-story', tmpDir);
    assert.ok(result.success, `Command should still succeed with error in JSON: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.story_valid, false);
    assert.ok(data.story_error !== null, 'Should have a story_error');
  });

  test('includes model and environment fields', () => {
    const storyDir = path.join(tmpDir, '.ace', 'artifacts', 'product', 'epic', 'feat', 'story');
    fs.mkdirSync(storyDir, { recursive: true });
    const storyFile = path.join(storyDir, 'story.md');
    fs.writeFileSync(storyFile, SAMPLE_STORY);

    const relPath = path.relative(tmpDir, storyFile).replace(/\\/g, '/');
    const result = runAceTools(`init research-story ${relPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.ok(typeof data.analyst_model === 'string', 'analyst_model should be a string');
    assert.ok(typeof data.mapper_model === 'string', 'mapper_model should be a string');
    assert.ok(typeof data.has_git === 'boolean', 'has_git should be boolean');
    assert.ok(typeof data.has_gh_cli === 'boolean', 'has_gh_cli should be boolean');
    assert.ok(typeof data.commit_docs === 'boolean', 'commit_docs should be boolean');
    assert.ok(data.github_project !== undefined, 'github_project should be present');
  });

  test('handles story without Relevant Wiki section', () => {
    const minimalStory = `# S1: Basic Story

**Feature**: F1 Auth | **Epic**: E1 Security
**Status**: Todo | **Size**: 2

## User Story

> As a user,
> I want to log in,
> so that I can access my account.

## Description

Basic login functionality.

## Acceptance Criteria

### Scenario: Successful login

**Given** valid credentials
**When** user submits login form
**Then** user is redirected to dashboard

## Definition of Done

- [ ] All AC pass
`;
    const storyDir = path.join(tmpDir, '.ace', 'artifacts', 'product', 'epic', 'feat', 'story');
    fs.mkdirSync(storyDir, { recursive: true });
    const storyFile = path.join(storyDir, 'story.md');
    fs.writeFileSync(storyFile, minimalStory);

    const relPath = path.relative(tmpDir, storyFile).replace(/\\/g, '/');
    const result = runAceTools(`init research-story ${relPath}`, tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.story_valid, true);
    assert.strictEqual(data.wiki_references.total_count, 0);
    assert.strictEqual(data.acceptance_criteria_count, 1);
    assert.strictEqual(data.story.id, 'S1');
  });

  test('classifies GitHub URL correctly', () => {
    // We can't actually fetch from GitHub in tests, but we can verify it tries
    const result = runAceTools('init research-story https://github.com/owner/repo/issues/123', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.story_source, 'github');
    // It will either fail due to no gh cli or fail to fetch — both are valid
    // The point is it classified correctly
  });

  test('classifies issue number correctly', () => {
    const result = runAceTools('init research-story 42', tmpDir);
    assert.ok(result.success, `Command should succeed: ${result.error}`);
    const data = JSON.parse(result.output);

    assert.strictEqual(data.story_source, 'github');
  });
});

// ─── CLI error handling ───────────────────────────────────────────────────────

describe('CLI error handling', () => {
  test('errors on unknown command', () => {
    const result = runAceTools('nonexistent');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Unknown command'), `Expected unknown command error, got: ${result.error}`);
  });

  test('errors when no command provided', () => {
    const result = runAceTools('');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Usage'), `Expected usage message, got: ${result.error}`);
  });

  test('errors on unknown init subcommand', () => {
    const result = runAceTools('init nonexistent');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Unknown init subcommand'), `Expected subcommand error, got: ${result.error}`);
  });
});
