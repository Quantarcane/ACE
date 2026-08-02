/**
 * ACE Core — Universal helpers shared across all ACE skills.
 *
 * Extracted from ace-tools.js monolith. Contains: config loading, model resolution,
 * path checks, environment detection, slug/timestamp generation, settings management,
 * and process-level output/error helpers.
 *
 * Usage: const { loadConfig, resolveModel, output, error } = require('./ace-core');
 */

const fs = require('fs');
const path = require('path');

// ─── Model Profile Table ─────────────────────────────────────────────────────

const MODEL_PROFILES = {
  'ace-product-owner':            { quality: 'opus',   balanced: 'sonnet', budget: 'sonnet' },
  'ace-project-researcher':       { quality: 'opus',   balanced: 'sonnet', budget: 'haiku' },
  'ace-research-synthesizer':     { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'ace-wiki-mapper':              { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'ace-code-integration-analyst': { quality: 'opus',   balanced: 'opus',   budget: 'sonnet' },
  'ace-code-discovery-analyst':   { quality: 'opus',   balanced: 'opus',   budget: 'sonnet' },
  'ace-executor':                 { quality: 'opus',   balanced: 'sonnet', budget: 'sonnet' },
  'ace-code-reviewer':            { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
};

// ─── Settings Defaults ───────────────────────────────────────────────────────

const SETTINGS_DEFAULTS = {
  model_profile: 'balanced',
  commit_docs: true,
  agent_teams: false,
  docs_path: '.docs',
  github_project: {
    enabled: false,
    gh_installed: false,
    repo: '',
    project_number: null,
    owner: '',
  },
};

// ─── Process Output ──────────────────────────────────────────────────────────

function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    process.stdout.write(JSON.stringify(result, null, 2));
  }
  process.exit(0);
}

function error(message) {
  process.stderr.write('Error: ' + message + '\n');
  process.exit(1);
}

// ─── Config ──────────────────────────────────────────────────────────────────

function loadConfig(cwd) {
  const configPath = path.join(cwd, '.ace', 'config.json');
  const defaults = {
    version: '0.1.0',
    projectName: '',
    description: '',
    storage: 'local',
    model_profile: 'quality',
    commit_docs: true,
    github: {
      enabled: false,
      repo: null,
      labels: {
        epic: 'ace:epic',
        feature: 'ace:feature',
        story: 'ace:story',
        task: 'ace:task',
      },
    },
    createdAt: '',
  };

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version ?? defaults.version,
      projectName: parsed.projectName ?? defaults.projectName,
      description: parsed.description ?? defaults.description,
      storage: parsed.storage ?? defaults.storage,
      model_profile: parsed.model_profile ?? defaults.model_profile,
      commit_docs: parsed.commit_docs ?? defaults.commit_docs,
      github: {
        enabled: parsed.github?.enabled ?? defaults.github.enabled,
        repo: parsed.github?.repo ?? defaults.github.repo,
        labels: {
          epic: parsed.github?.labels?.epic ?? defaults.github.labels.epic,
          feature: parsed.github?.labels?.feature ?? defaults.github.labels.feature,
          story: parsed.github?.labels?.story ?? defaults.github.labels.story,
          task: parsed.github?.labels?.task ?? defaults.github.labels.task,
        },
      },
      createdAt: parsed.createdAt ?? defaults.createdAt,
    };
  } catch {
    return defaults;
  }
}

// ─── Path Helpers ────────────────────────────────────────────────────────────

function pathExists(cwd, targetPath) {
  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
  try {
    fs.statSync(fullPath);
    return true;
  } catch {
    return false;
  }
}

function safeReadFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); }
  catch { return null; }
}

// ─── Docs Root ───────────────────────────────────────────────────────────────
//
// The wiki/product docs root is NOT always `.docs` at the repo root. Monorepos
// commonly nest it (e.g. `ProcerERP/.docs`). The location lives in
// `.ace/settings.json` under `docs_path` and every skill resolves it from there
// — nothing in ACE may hardcode `.docs`.

/**
 * Normalize a configured docs path to a forward-slash, trailing-slash-free
 * string. Returns null for empty/invalid values so callers can fall back to the
 * default.
 */
function normalizeDocsPath(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim()
    .replace(/\\/g, '/')   // accept Windows-style input
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '');
  if (!trimmed || trimmed === '.') return null;
  return trimmed;
}

/**
 * The project's docs root, relative to cwd (e.g. '.docs' or 'ProcerERP/.docs').
 */
function resolveDocsPath(cwd) {
  return loadSettings(cwd).docs_path;
}

/**
 * Build a path underneath the configured docs root.
 * docsPath(cwd, 'wiki/system-wide', 'coding-standards.md')
 *   -> 'ProcerERP/.docs/wiki/system-wide/coding-standards.md'
 *
 * Always returns forward slashes — these strings are handed to workflows,
 * agent prompts and markdown links, not only to the filesystem.
 */
function docsPath(cwd, ...segments) {
  const parts = [resolveDocsPath(cwd), ...segments]
    .filter(s => s !== undefined && s !== null && s !== '')
    .map(s => String(s).replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''));
  return parts.join('/');
}

/**
 * Find candidate docs roots by walking the tree for directories named `.docs`.
 * Used by /ace:help to propose a location instead of forcing the user to type
 * one. Returns cwd-relative POSIX paths, shallowest first.
 */
function detectDocsCandidates(cwd, maxDepth = 3) {
  const ignoreDirs = new Set([
    'node_modules', '.git', '.ace', '.gsd', '.claude', '.codex', '.opencode',
    'dist', 'build', 'bin', 'obj', 'out', 'target', 'vendor', '__pycache__',
  ]);
  const found = [];

  function walk(dir, depth) {
    if (depth > maxDepth || found.length >= 10) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === '.docs') {
        found.push(path.relative(cwd, full).replace(/\\/g, '/'));
        continue;
      }
      if (!ignoreDirs.has(entry.name)) walk(full, depth + 1);
    }
  }

  walk(cwd, 0);
  return found.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
}

// ─── Slug & Timestamp ────────────────────────────────────────────────────────

function generateSlug(text) {
  if (!text) return null;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function currentTimestamp(format) {
  const now = new Date();
  switch (format) {
    case 'date':
      return now.toISOString().split('T')[0];
    case 'filename':
      return now.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
    case 'full':
    default:
      return now.toISOString();
  }
}

// ─── Model Resolution ────────────────────────────────────────────────────────

function resolveModel(cwd, agentType) {
  const config = loadConfig(cwd);
  const profile = config.model_profile || 'balanced';
  const agentModels = MODEL_PROFILES[agentType];
  if (!agentModels) return 'sonnet';
  return agentModels[profile] || agentModels['balanced'] || 'sonnet';
}

// ─── Code & Environment Detection ────────────────────────────────────────────

/**
 * Detect existing code files by walking up to maxDepth levels.
 */
function detectCodeFiles(cwd, maxDepth) {
  const codeExtensions = new Set(['.cs', '.ts', '.js', '.py', '.go', '.rs', '.swift', '.java', '.tsx', '.jsx']);
  const ignoreDirs = new Set(['node_modules', '.git', '.ace', '.gsd', 'dist', 'build', '__pycache__']);
  const found = [];

  function walk(dir, depth) {
    if (depth > maxDepth || found.length >= 5) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (found.length >= 5) return;
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          walk(path.join(dir, entry.name), depth + 1);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (codeExtensions.has(ext)) {
          found.push(path.join(dir, entry.name));
        }
      }
    }
  }

  walk(cwd, 0);
  return found;
}

/**
 * Detect whether the project is brownfield (existing code/manifests) or greenfield.
 */
function detectBrownfieldStatus(cwd) {
  const codeFiles = detectCodeFiles(cwd, 3);
  const hasExistingCode = codeFiles.length > 0;

  const packageFiles = [
    'package.json', 'requirements.txt', 'pyproject.toml', 'Cargo.toml',
    'go.mod', 'Package.swift', 'pom.xml', 'build.gradle',
  ];

  const hasDotnetProject = (() => {
    try {
      const rootFiles = fs.readdirSync(cwd);
      return rootFiles.some(f => f.endsWith('.sln') || f.endsWith('.csproj'));
    } catch {
      return false;
    }
  })();

  const hasPackageFile = packageFiles.some(f => pathExists(cwd, f)) || hasDotnetProject;
  const isBrownfield = hasExistingCode || hasPackageFile;

  return {
    has_existing_code: hasExistingCode,
    has_package_file: hasPackageFile,
    is_brownfield: isBrownfield,
    is_greenfield: !isBrownfield,
  };
}

// ─── Settings ────────────────────────────────────────────────────────────────

function loadSettings(cwd) {
  const settingsPath = path.join(cwd, '.ace', 'settings.json');
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      model_profile: parsed.model_profile ?? SETTINGS_DEFAULTS.model_profile,
      commit_docs: parsed.commit_docs ?? SETTINGS_DEFAULTS.commit_docs,
      agent_teams: parsed.agent_teams ?? SETTINGS_DEFAULTS.agent_teams,
      docs_path: normalizeDocsPath(parsed.docs_path) ?? SETTINGS_DEFAULTS.docs_path,
      github_project: {
        enabled: parsed.github_project?.enabled ?? SETTINGS_DEFAULTS.github_project.enabled,
        gh_installed: parsed.github_project?.gh_installed ?? SETTINGS_DEFAULTS.github_project.gh_installed,
        repo: parsed.github_project?.repo ?? SETTINGS_DEFAULTS.github_project.repo,
        project_number: parsed.github_project?.project_number ?? SETTINGS_DEFAULTS.github_project.project_number,
        owner: parsed.github_project?.owner ?? SETTINGS_DEFAULTS.github_project.owner,
      },
    };
  } catch {
    return JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
  }
}

function writeSettings(cwd, settings) {
  const aceDir = path.join(cwd, '.ace');
  if (!fs.existsSync(aceDir)) {
    fs.mkdirSync(aceDir, { recursive: true });
  }
  const settingsPath = path.join(aceDir, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

// ─── Shell Execution ─────────────────────────────────────────────────────────

/**
 * Parse key=value arguments into an object.
 */
function parseKeyValueArgs(args) {
  const result = {};
  for (const arg of args) {
    const eqIndex = arg.indexOf('=');
    if (eqIndex === -1) continue;
    result[arg.substring(0, eqIndex)] = arg.substring(eqIndex + 1);
  }
  return result;
}

/**
 * Parse raw skill init args into a structured object.
 * Handles key=value params, flags (--name), and positional args.
 * ALL skill script.js files MUST use this for argument parsing.
 *
 * Returns: { story: '...', text: '...', _flags: ['--agent-teams-off'], _positional: '...' }
 */
function parseSkillArgs(rawArgs) {
  const args = rawArgs.filter(a => a !== '--raw');
  const flags = args.filter(a => a.startsWith('--'));
  const params = args.filter(a => !a.startsWith('--'));
  const hasKeyValue = params.some(a => a.includes('='));

  const result = { _flags: flags };

  if (hasKeyValue) {
    Object.assign(result, parseKeyValueArgs(params));
  } else if (params.length > 0) {
    result._positional = params.join(' ');
  }

  return result;
}

/**
 * Shared CLI dispatch for all skill scripts.
 * Parses process.argv, extracts --raw, parses key=value args, and routes to handlers.
 * ALL skill script.js files MUST use this — no manual arg parsing.
 *
 * Handlers receive (cwd, raw, args, parsed):
 *   cwd    — process.cwd()
 *   raw    — boolean, --raw flag present
 *   args   — raw arg array (after command name, --raw stripped)
 *   parsed — parseSkillArgs result: { story: '...', _flags: [...], _positional: '...' }
 */
function runSkillScript(handlers) {
  const cwd = process.cwd();
  const allArgs = process.argv.slice(2);
  const raw = allArgs.includes('--raw');
  const cmd = allArgs[0];
  const restArgs = allArgs.slice(1).filter(a => a !== '--raw');
  const parsed = parseSkillArgs(allArgs.slice(1));

  const handler = handlers[cmd];
  if (!handler) {
    error(`Unknown command: ${cmd}\nAvailable: ${Object.keys(handlers).join(', ')}`);
    return;
  }
  handler(cwd, raw, restArgs, parsed);
}

/**
 * Run a shell command and return trimmed stdout. Returns null on failure.
 */
function execCommand(cmd, cwd) {
  const { execSync } = require('child_process');
  try {
    return execSync(cmd, {
      cwd,
      shell: 'bash',
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf-8',
      timeout: 30000,
    }).trim();
  } catch {
    return null;
  }
}

module.exports = {
  MODEL_PROFILES,
  SETTINGS_DEFAULTS,
  output,
  error,
  loadConfig,
  pathExists,
  safeReadFile,
  normalizeDocsPath,
  resolveDocsPath,
  docsPath,
  detectDocsCandidates,
  generateSlug,
  currentTimestamp,
  resolveModel,
  detectCodeFiles,
  detectBrownfieldStatus,
  loadSettings,
  writeSettings,
  parseKeyValueArgs,
  parseSkillArgs,
  runSkillScript,
  execCommand,
};
