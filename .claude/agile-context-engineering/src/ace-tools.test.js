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
