#!/usr/bin/env node

/**
 * ACE Tools — CLI utility for ACE workflow operations
 *
 * Inspired by GSD's gsd-tools.js (https://github.com/gsd-build/get-shit-done).
 * Centralizes: config loading, model resolution, path checks, environment detection, slug/timestamp generation.
 *
 * Usage: node ace-tools.js <command> [args] [--raw]
 *
 * Atomic Commands:
 *   load-config                     Load ACE config with defaults
 *   resolve-model <agent-type>      Get model for agent based on profile
 *   verify-path-exists <path>       Check file/directory existence
 *   generate-slug <text>            Convert text to URL-safe slug
 *   current-timestamp [format]      Get timestamp (full|date|filename)
 *
 * Compound Commands:
 *   init new-project                Environment detection for project init (status dashboard)
 *   init product-vision             Environment detection for product vision upsert
 *   init coding-standards           Environment detection for coding standards init
 *   init map-system                 Environment detection for map-system workflow
 *   init plan-backlog               Environment detection for plan-backlog workflow
 *   init setup-github               Detect gh CLI, repo, and list GitHub Projects
 *
 *   ensure-settings                  Create .ace/settings.json with defaults if missing
 *   write-github-settings            Write GitHub Project settings (key=value args)
 *
 * GitHub Commands:
 *   github resolve-fields             Resolve native issue type IDs and project field IDs
 *   github create-issue               Create issue, set type, add to project, set fields
 *   github update-issue               Update an existing issue's title, body, and optionally project fields
 *   github fetch-issues               Fetch all Epics/Features from GitHub Project with full fields
 */

const fs = require('fs');
const path = require('path');

// ─── Model Profile Table ─────────────────────────────────────────────────────

const MODEL_PROFILES = {
  'ace-product-owner':        { quality: 'opus',   balanced: 'sonnet', budget: 'sonnet' },
  'ace-project-researcher':   { quality: 'opus',   balanced: 'sonnet', budget: 'haiku' },
  'ace-research-synthesizer': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'ace-wiki-mapper':     { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function pathExistsInternal(cwd, targetPath) {
  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
  try {
    fs.statSync(fullPath);
    return true;
  } catch {
    return false;
  }
}

function generateSlugInternal(text) {
  if (!text) return null;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function resolveModelInternal(cwd, agentType) {
  const config = loadConfig(cwd);
  const profile = config.model_profile || 'balanced';
  const agentModels = MODEL_PROFILES[agentType];
  if (!agentModels) return 'sonnet';
  return agentModels[profile] || agentModels['balanced'] || 'sonnet';
}

/**
 * Detect existing code files by walking up to maxDepth levels.
 * Cross-platform alternative to `find` shell command.
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

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmdLoadConfig(cwd, raw) {
  const config = loadConfig(cwd);
  output(config, raw);
}

function cmdResolveModel(cwd, agentType, raw) {
  if (!agentType) {
    error('agent-type required for resolve-model. Available: ' + Object.keys(MODEL_PROFILES).join(', '));
  }
  const model = resolveModelInternal(cwd, agentType);
  const config = loadConfig(cwd);
  output({ model, agent: agentType, profile: config.model_profile }, raw, model);
}

function cmdVerifyPathExists(cwd, targetPath, raw) {
  if (!targetPath) {
    error('path required for verify-path-exists');
  }
  const exists = pathExistsInternal(cwd, targetPath);
  output({ exists, path: targetPath }, raw, exists ? 'true' : 'false');
}

function cmdGenerateSlug(text, raw) {
  if (!text) {
    error('text required for slug generation');
  }
  const slug = generateSlugInternal(text);
  output({ slug }, raw, slug);
}

function cmdCurrentTimestamp(format, raw) {
  const now = new Date();
  let value;
  switch (format) {
    case 'date':
      value = now.toISOString().split('T')[0];
      break;
    case 'filename':
      value = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
      break;
    case 'full':
    default:
      value = now.toISOString();
      break;
  }
  output({ timestamp: value, format }, raw, value);
}

// ─── Brownfield Detection (shared) ───────────────────────────────────────────

/**
 * Detect whether the project is brownfield (has existing code/manifests) or greenfield.
 * Returns a reusable object with detection results.
 */
function detectBrownfieldStatus(cwd) {
  const codeFiles = detectCodeFiles(cwd, 3);
  const hasExistingCode = codeFiles.length > 0;

  const packageFiles = [
    'package.json',       // Node.js
    'requirements.txt',   // Python (pip)
    'pyproject.toml',     // Python (modern)
    'Cargo.toml',         // Rust
    'go.mod',             // Go
    'Package.swift',      // Swift
    'pom.xml',            // Java (Maven)
    'build.gradle',       // Java/Kotlin (Gradle)
  ];

  // C# / .NET — look for *.sln or *.csproj in project root
  const hasDotnetProject = (() => {
    try {
      const rootFiles = fs.readdirSync(cwd);
      return rootFiles.some(f => f.endsWith('.sln') || f.endsWith('.csproj'));
    } catch {
      return false;
    }
  })();

  const hasPackageFile = packageFiles.some(f => pathExistsInternal(cwd, f)) || hasDotnetProject;
  const isBrownfield = hasExistingCode || hasPackageFile;

  return {
    has_existing_code: hasExistingCode,
    has_package_file: hasPackageFile,
    is_brownfield: isBrownfield,
    is_greenfield: !isBrownfield,
  };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const SETTINGS_DEFAULTS = {
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

function loadSettings(cwd) {
  const settingsPath = path.join(cwd, '.ace', 'settings.json');
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      model_profile: parsed.model_profile ?? SETTINGS_DEFAULTS.model_profile,
      commit_docs: parsed.commit_docs ?? SETTINGS_DEFAULTS.commit_docs,
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

function cmdEnsureSettings(cwd, raw) {
  const settingsPath = path.join(cwd, '.ace', 'settings.json');
  const alreadyExists = pathExistsInternal(cwd, '.ace/settings.json');

  if (!alreadyExists) {
    const defaults = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
    writeSettings(cwd, defaults);
    output({ created: true, path: settingsPath, settings: defaults }, raw);
  } else {
    const settings = loadSettings(cwd);
    output({ created: false, path: settingsPath, settings }, raw);
  }
}

function cmdSetupGithubProject(cwd, raw) {
  const { execSync } = require('child_process');
  const settings = loadSettings(cwd);

  // Detect gh CLI
  let ghInstalled = false;
  try {
    execSync('gh --version', { stdio: 'pipe' });
    ghInstalled = true;
  } catch {}

  // Detect repo
  let repo = '';
  let owner = '';
  if (ghInstalled) {
    try {
      repo = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
      }).trim();
      owner = repo.split('/')[0] || '';
    } catch {}
  }

  // List projects
  let projects = [];
  if (ghInstalled && owner) {
    try {
      const projectsJson = execSync(`gh project list --owner ${owner} --limit 10 --format json`, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
      }).trim();
      const parsed = JSON.parse(projectsJson);
      projects = (parsed.projects || parsed || []).map(p => ({
        number: p.number,
        title: p.title,
      }));
    } catch {}
  }

  output({
    gh_installed: ghInstalled,
    repo,
    owner,
    projects,
    current_settings: settings.github_project,
  }, raw);
}

function cmdWriteGithubSettings(cwd, raw, extraArgs) {
  const settings = loadSettings(cwd);

  // Parse key=value pairs from extra args
  for (const arg of extraArgs) {
    const eqIndex = arg.indexOf('=');
    if (eqIndex === -1) continue;
    const key = arg.substring(0, eqIndex);
    const value = arg.substring(eqIndex + 1);

    switch (key) {
      case 'enabled':
        settings.github_project.enabled = value === 'true';
        break;
      case 'gh_installed':
        settings.github_project.gh_installed = value === 'true';
        break;
      case 'repo':
        settings.github_project.repo = value;
        break;
      case 'project_number':
        settings.github_project.project_number = value === 'null' ? null : parseInt(value, 10);
        break;
      case 'owner':
        settings.github_project.owner = value;
        break;
    }
  }

  writeSettings(cwd, settings);
  output({ written: true, settings }, raw);
}

// ─── Compound Commands ────────────────────────────────────────────────────────

function cmdInitNewProject(cwd, raw) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  const result = {
    // Models (pre-resolved so workflows know which model to spawn each agent with)
    product_owner_model: resolveModelInternal(cwd, 'ace-product-owner'),

    researcher_model: resolveModelInternal(cwd, 'ace-project-researcher'),
    synthesizer_model: resolveModelInternal(cwd, 'ace-research-synthesizer'),

    // Config
    commit_docs: config.commit_docs,

    // Existing state
    has_product_vision: pathExistsInternal(cwd, '.docs/product/product-vision.md'),
    has_system_architecture: pathExistsInternal(cwd, '.docs/wiki/system-wide/system-architecture.md'),
    has_system_structure: pathExistsInternal(cwd, '.docs/wiki/system-wide/system-structure.md'),
    has_coding_standards: pathExistsInternal(cwd, '.docs/wiki/system-wide/coding-standards.md'),
    has_testing_framework: pathExistsInternal(cwd, '.docs/wiki/system-wide/testing-framework.md'),
    project_exists: pathExistsInternal(cwd, '.docs/product/product-vision.md'),
    has_codebase_map: pathExistsInternal(cwd, '.ace/codebase'),
    planning_exists: pathExistsInternal(cwd, '.ace'),

    // Brownfield detection
    ...brownfield,
    needs_codebase_map: brownfield.is_brownfield && !pathExistsInternal(cwd, '.ace/codebase'),

    // Git state
    has_git: pathExistsInternal(cwd, '.git'),

    // GitHub CLI
    has_gh_cli: (() => {
      try {
        const { execSync } = require('child_process');
        execSync('gh --version', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    })(),
  };

  output(result, raw);
}

function cmdInitCodingStandards(cwd, raw) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  const result = {
    // Config
    commit_docs: config.commit_docs,

    // Brownfield detection
    ...brownfield,

    // Existing coding standards
    has_coding_standards: pathExistsInternal(cwd, '.docs/wiki/system-wide/coding-standards.md'),
    wiki_dir_exists: pathExistsInternal(cwd, '.docs/wiki/system-wide'),

    // Existing wiki context (useful for cross-referencing)
    has_system_architecture: pathExistsInternal(cwd, '.docs/wiki/system-wide/system-architecture.md'),
    has_system_structure: pathExistsInternal(cwd, '.docs/wiki/system-wide/system-structure.md'),

    // Git state
    has_git: pathExistsInternal(cwd, '.git'),
  };

  output(result, raw);
}

function cmdInitMapSystem(cwd, raw) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  // Check existing wiki documents
  const wikiDir = '.docs/wiki/system-wide';
  const wikiDirExists = pathExistsInternal(cwd, wikiDir);

  const has_system_structure = pathExistsInternal(cwd, path.join(wikiDir, 'system-structure.md'));
  const has_system_architecture = pathExistsInternal(cwd, path.join(wikiDir, 'system-architecture.md'));
  const has_testing_framework = pathExistsInternal(cwd, path.join(wikiDir, 'testing-framework.md'));
  const has_coding_standards = pathExistsInternal(cwd, path.join(wikiDir, 'coding-standards.md'));

  // List existing wiki files if directory exists
  let existing_wiki_files = [];
  if (wikiDirExists) {
    try {
      existing_wiki_files = fs.readdirSync(path.join(cwd, wikiDir)).filter(f => f.endsWith('.md'));
    } catch {}
  }

  const result = {
    // Models
    mapper_model: resolveModelInternal(cwd, 'ace-wiki-mapper'),

    // Config
    commit_docs: config.commit_docs,

    // Brownfield detection
    ...brownfield,

    // Wiki directory state
    wiki_dir_exists: wikiDirExists,
    existing_wiki_files,

    // Per-document existence
    has_system_structure,
    has_system_architecture,
    has_testing_framework,
    has_coding_standards,

    // Git state
    has_git: pathExistsInternal(cwd, '.git'),
  };

  output(result, raw);
}

function cmdInitMapSubsystem(cwd, raw) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  const wikiDir = '.docs/wiki/subsystems';
  const wikiDirExists = pathExistsInternal(cwd, wikiDir);

  const result = {
    // Models
    mapper_model: resolveModelInternal(cwd, 'ace-wiki-mapper'),

    // Config
    commit_docs: config.commit_docs,

    // Brownfield detection
    ...brownfield,

    // Wiki directory state
    wiki_dir_exists: wikiDirExists,

    // Git state
    has_git: pathExistsInternal(cwd, '.git'),
  };

  output(result, raw);
}

function cmdInitProductVision(cwd, raw) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  const result = {
    // Models
    product_owner_model: resolveModelInternal(cwd, 'ace-product-owner'),

    // Config
    commit_docs: config.commit_docs,

    // Existing state
    has_product_vision: pathExistsInternal(cwd, '.docs/product/product-vision.md'),

    // Brownfield detection
    ...brownfield,

    // Architecture context
    has_system_architecture: pathExistsInternal(cwd, '.docs/wiki/system-wide/system-architecture.md'),

    // Git state
    has_git: pathExistsInternal(cwd, '.git'),
  };

  output(result, raw);
}

function cmdInitPlanBacklog(cwd, raw) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  // Wiki detection — system-wide
  const wikiSystemDir = '.docs/wiki/system-wide';
  const has_wiki_system_wide = pathExistsInternal(cwd, wikiSystemDir);
  const has_system_architecture = pathExistsInternal(cwd, path.join(wikiSystemDir, 'system-architecture.md'));
  const has_system_structure = pathExistsInternal(cwd, path.join(wikiSystemDir, 'system-structure.md'));
  const has_testing_framework = pathExistsInternal(cwd, path.join(wikiSystemDir, 'testing-framework.md'));

  // Wiki detection — subsystems
  const wikiSubsystemsDir = '.docs/wiki/subsystems';
  const has_wiki_subsystems = pathExistsInternal(cwd, wikiSubsystemsDir);

  let wiki_subsystem_names = [];
  if (has_wiki_subsystems) {
    try {
      const entries = fs.readdirSync(path.join(cwd, wikiSubsystemsDir), { withFileTypes: true });
      wiki_subsystem_names = entries
        .filter(e => e.isDirectory())
        .map(e => e.name);
    } catch {}
  }

  const has_wiki = has_wiki_system_wide || has_wiki_subsystems;

  const result = {
    // Models
    product_owner_model: resolveModelInternal(cwd, 'ace-product-owner'),
    researcher_model: resolveModelInternal(cwd, 'ace-project-researcher'),

    // Config
    commit_docs: config.commit_docs,

    // Product artifacts
    has_product_vision: pathExistsInternal(cwd, '.docs/product/product-vision.md'),
    has_product_backlog: pathExistsInternal(cwd, '.ace/artifacts/product/product-backlog.md'),

    // Research artifacts (from previous runs)
    has_features_research: pathExistsInternal(cwd, '.ace/research/FEATURES.md'),
    has_architecture_research: pathExistsInternal(cwd, '.ace/research/ARCHITECTURE.md'),

    // Wiki analysis cache (from previous runs)
    has_wiki_analysis: pathExistsInternal(cwd, '.ace/artifacts/wiki/wiki-analysis.md'),

    // Brownfield detection
    ...brownfield,

    // Wiki state — system-wide
    has_wiki,
    has_wiki_system_wide,
    has_system_architecture,
    has_system_structure,
    has_testing_framework,

    // Wiki state — subsystems
    has_wiki_subsystems,
    wiki_subsystem_names,

    // Git state
    has_git: pathExistsInternal(cwd, '.git'),

    // GitHub CLI
    has_gh_cli: (() => {
      try {
        const { execSync } = require('child_process');
        execSync('gh --version', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    })(),

    // GitHub Project settings (from settings.json)
    github_project: (() => {
      const settings = loadSettings(cwd);
      return settings.github_project;
    })(),
  };

  output(result, raw);
}

// ─── Init: Plan Feature ──────────────────────────────────────────────────────

function cmdInitPlanFeature(cwd, raw) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  // Wiki detection — system-wide
  const wikiSystemDir = '.docs/wiki/system-wide';
  const has_wiki_system_wide = pathExistsInternal(cwd, wikiSystemDir);
  const has_system_architecture = pathExistsInternal(cwd, path.join(wikiSystemDir, 'system-architecture.md'));
  const has_system_structure = pathExistsInternal(cwd, path.join(wikiSystemDir, 'system-structure.md'));
  const has_testing_framework = pathExistsInternal(cwd, path.join(wikiSystemDir, 'testing-framework.md'));

  // Wiki detection — subsystems
  const wikiSubsystemsDir = '.docs/wiki/subsystems';
  const has_wiki_subsystems = pathExistsInternal(cwd, wikiSubsystemsDir);

  let wiki_subsystem_names = [];
  if (has_wiki_subsystems) {
    try {
      const entries = fs.readdirSync(path.join(cwd, wikiSubsystemsDir), { withFileTypes: true });
      wiki_subsystem_names = entries
        .filter(e => e.isDirectory())
        .map(e => e.name);
    } catch {}
  }

  const has_wiki = has_wiki_system_wide || has_wiki_subsystems;

  const result = {
    // Models
    product_owner_model: resolveModelInternal(cwd, 'ace-product-owner'),
    researcher_model: resolveModelInternal(cwd, 'ace-project-researcher'),

    // Config
    commit_docs: config.commit_docs,

    // Product artifacts
    has_product_vision: pathExistsInternal(cwd, '.docs/product/product-vision.md'),
    has_product_backlog: pathExistsInternal(cwd, '.ace/artifacts/product/product-backlog.md'),

    // Wiki analysis cache (from previous runs)
    has_wiki_analysis: pathExistsInternal(cwd, '.ace/artifacts/wiki/wiki-analysis.md'),

    // Brownfield detection
    ...brownfield,

    // Wiki state — system-wide
    has_wiki,
    has_wiki_system_wide,
    has_system_architecture,
    has_system_structure,
    has_testing_framework,

    // Wiki state — subsystems
    has_wiki_subsystems,
    wiki_subsystem_names,

    // Git state
    has_git: pathExistsInternal(cwd, '.git'),

    // GitHub CLI
    has_gh_cli: (() => {
      try {
        const { execSync } = require('child_process');
        execSync('gh --version', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    })(),

    // GitHub Project settings (from settings.json)
    github_project: (() => {
      const settings = loadSettings(cwd);
      return settings.github_project;
    })(),
  };

  output(result, raw);
}

// ─── GitHub Integration Commands ──────────────────────────────────────────────

/**
 * Parse key=value arguments into an object.
 * Handles values with spaces when properly quoted in shell.
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
 * Run a shell command and return trimmed stdout. Returns null on failure.
 * Uses bash explicitly to ensure consistent quoting behavior across platforms.
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
  } catch (e) {
    return null;
  }
}

/**
 * github resolve-fields — Resolve all GitHub field/type IDs needed for issue creation.
 *
 * Required args: repo=owner/name  owner=org  project=number
 *
 * Returns JSON with:
 *   - issue_types: { Epic: "IT_...", Feature: "IT_...", Story: "IT_...", ... }
 *   - project_id: "PVT_..."
 *   - fields: { Priority: { id, options: { P0: id, ... } }, Estimate: { id }, Sprint: { id }, Status: { id, options } }
 */
function cmdGithubResolveFields(cwd, raw, extraArgs) {
  const params = parseKeyValueArgs(extraArgs);
  const repo = params.repo;     // e.g., "Quantarcane/qarc"
  const owner = params.owner;   // e.g., "Quantarcane"
  const project = params.project; // e.g., "1"

  if (!repo || !owner || !project) {
    error('github resolve-fields requires: repo=owner/name owner=org project=number');
  }

  const repoName = repo.split('/')[1] || repo;

  // 1. Resolve native issue types
  const issueTypesRaw = execCommand(
    `gh api graphql -f query='query { repository(owner: "${owner}", name: "${repoName}") { issueTypes(first: 10) { nodes { id name } } } }'`,
    cwd
  );

  const issueTypes = {};
  if (issueTypesRaw) {
    try {
      const parsed = JSON.parse(issueTypesRaw);
      const nodes = parsed.data?.repository?.issueTypes?.nodes || [];
      for (const node of nodes) {
        issueTypes[node.name] = node.id;
      }
    } catch {}
  }

  // 2. Resolve project ID
  const projectListRaw = execCommand(
    `gh project list --owner ${owner} --format json --limit 20`,
    cwd
  );

  let projectId = null;
  if (projectListRaw) {
    try {
      const parsed = JSON.parse(projectListRaw);
      const projects = parsed.projects || parsed || [];
      const match = projects.find(p => String(p.number) === String(project));
      if (match) projectId = match.id;
    } catch {}
  }

  // 3. Resolve project fields
  const fieldsRaw = execCommand(
    `gh project field-list ${project} --owner ${owner} --format json`,
    cwd
  );

  const fields = {};
  if (fieldsRaw) {
    try {
      const parsed = JSON.parse(fieldsRaw);
      const fieldList = parsed.fields || parsed || [];
      for (const field of fieldList) {
        const entry = { id: field.id, type: field.type };
        if (field.options) {
          entry.options = {};
          for (const opt of field.options) {
            entry.options[opt.name] = opt.id;
          }
        }
        fields[field.name] = entry;
      }
    } catch {}
  }

  output({
    issue_types: issueTypes,
    project_id: projectId,
    fields,
  }, raw);
}

/**
 * github create-issue — Create a GitHub issue, set its native type, add to project,
 * and optionally set project fields (Priority, Estimate) and issue metadata (parent, milestone).
 *
 * Required args: type=Epic|Feature|Story  title=...  repo=owner/name  owner=org
 *                project=number  project_id=PVT_...  type_id=IT_...
 *
 * Optional args: body=...  body_file=path (reads body from file, preferred for large bodies)
 *                status_field_id=...  status_option_id=...
 *                priority_field_id=...  priority_option_id=...
 *                estimate_field_id=...  estimate=number
 *                parent=issue_number  milestone=name
 *
 * The title is auto-prefixed: type=Epic + title="My Epic" → "[Epic] My Epic"
 *
 * Returns JSON with: { number, url, item_id, type_set, priority_set, estimate_set, parent_set, milestone_set }
 */
function cmdGithubCreateIssue(cwd, raw, extraArgs) {
  const params = parseKeyValueArgs(extraArgs);

  const type = params.type;           // Epic, Feature, or Story
  const title = params.title;
  let body = params.body || '';
  if (!body && params.body_file) {
    const bodyPath = path.isAbsolute(params.body_file)
      ? params.body_file
      : path.join(cwd, params.body_file);
    if (fs.existsSync(bodyPath)) {
      body = fs.readFileSync(bodyPath, 'utf8');
    }
  }
  const repo = params.repo;
  const owner = params.owner;
  const project = params.project;
  const projectId = params.project_id;
  const typeId = params.type_id;

  if (!type || !title || !repo || !owner || !project || !projectId || !typeId) {
    error('github create-issue requires: type, title, repo, owner, project, project_id, type_id');
  }

  const repoName = repo.split('/')[1] || repo;
  const result = {
    number: null,
    url: null,
    item_id: null,
    type_set: false,
    status_set: false,
    priority_set: false,
    estimate_set: false,
    parent_set: false,
    milestone_set: false,
    errors: [],
  };

  // 1. Create the issue (auto-prefix title with [Type])
  const fullTitle = `[${type}] ${title}`;
  const safeTitle = fullTitle.replace(/"/g, '\\"');
  const safeBody = body.replace(/"/g, '\\"');
  const issueUrl = execCommand(
    `gh issue create --repo ${repo} --title "${safeTitle}" --body "${safeBody}"`,
    cwd
  );

  if (!issueUrl) {
    result.errors.push('Failed to create issue');
    output(result, raw);
    return;
  }

  result.url = issueUrl;
  const urlParts = issueUrl.split('/');
  result.number = parseInt(urlParts[urlParts.length - 1], 10);

  // 2. Set native issue type via GraphQL
  const nodeIdRaw = execCommand(
    `gh api graphql -f query="query { repository(owner: \\"${owner}\\", name: \\"${repoName}\\") { issue(number: ${result.number}) { id } } }" --jq ".data.repository.issue.id"`,
    cwd
  );

  if (nodeIdRaw) {
    const setTypeRaw = execCommand(
      `gh api graphql -f query="mutation { updateIssue(input: { id: \\"${nodeIdRaw}\\", issueTypeId: \\"${typeId}\\" }) { issue { id } } }"`,
      cwd
    );
    result.type_set = !!setTypeRaw;
    if (!setTypeRaw) result.errors.push('Failed to set issue type');
  } else {
    result.errors.push('Failed to get issue node ID');
  }

  // 3. Add to project
  const addRaw = execCommand(
    `gh project item-add ${project} --owner ${owner} --url ${issueUrl} --format json`,
    cwd
  );

  if (addRaw) {
    try {
      const parsed = JSON.parse(addRaw);
      result.item_id = parsed.id;
    } catch {}
  } else {
    result.errors.push('Failed to add to project');
  }

  // 4. Set Status (optional)
  if (result.item_id && params.status_field_id && params.status_option_id) {
    const statusOk = execCommand(
      `gh project item-edit --project-id ${projectId} --id ${result.item_id} --field-id ${params.status_field_id} --single-select-option-id ${params.status_option_id}`,
      cwd
    );
    result.status_set = statusOk !== null;
    if (!result.status_set) result.errors.push('Failed to set status');
  }

  // 5. Set Priority (optional — single-select field)
  if (result.item_id && params.priority_field_id && params.priority_option_id) {
    const priorityOk = execCommand(
      `gh project item-edit --project-id ${projectId} --id ${result.item_id} --field-id ${params.priority_field_id} --single-select-option-id ${params.priority_option_id}`,
      cwd
    );
    result.priority_set = priorityOk !== null;
    if (!result.priority_set) result.errors.push('Failed to set priority');
  }

  // 6. Set Estimate (optional)
  if (result.item_id && params.estimate_field_id && params.estimate) {
    const estimateOk = execCommand(
      `gh project item-edit --project-id ${projectId} --id ${result.item_id} --field-id ${params.estimate_field_id} --number ${params.estimate}`,
      cwd
    );
    result.estimate_set = estimateOk !== null;
    if (!result.estimate_set) result.errors.push('Failed to set estimate');
  }

  // 7. Set parent issue via GraphQL addSubIssue (optional — Features under Epics, Stories under Features)
  if (params.parent) {
    // Get the parent issue's node ID
    const parentNodeId = execCommand(
      `gh api graphql -f query="query { repository(owner: \\"${owner}\\", name: \\"${repoName}\\") { issue(number: ${params.parent}) { id } } }" --jq ".data.repository.issue.id"`,
      cwd
    );
    // Get the child issue's node ID (we may already have it from step 2, but safer to re-fetch)
    const childNodeId = nodeIdRaw || execCommand(
      `gh api graphql -f query="query { repository(owner: \\"${owner}\\", name: \\"${repoName}\\") { issue(number: ${result.number}) { id } } }" --jq ".data.repository.issue.id"`,
      cwd
    );
    if (parentNodeId && childNodeId) {
      const parentOk = execCommand(
        `gh api graphql -f query="mutation { addSubIssue(input: { issueId: \\"${parentNodeId}\\", subIssueId: \\"${childNodeId}\\" }) { issue { id } } }"`,
        cwd
      );
      result.parent_set = parentOk !== null;
      if (!result.parent_set) result.errors.push('Failed to set parent');
    } else {
      result.errors.push('Failed to resolve parent/child node IDs');
    }
  }

  // 8. Set milestone (optional)
  if (params.milestone) {
    const safeMilestone = params.milestone.replace(/"/g, '\\"');
    const milestoneOk = execCommand(
      `gh issue edit ${result.number} --repo ${repo} --milestone "${safeMilestone}"`,
      cwd
    );
    result.milestone_set = milestoneOk !== null;
    if (!result.milestone_set) result.errors.push('Failed to set milestone');
  }

  if (result.errors.length === 0) delete result.errors;
  output(result, raw);
}

/**
 * github update-issue — Update an existing GitHub issue's title and body,
 * and optionally update project fields (Status, Priority, Estimate).
 *
 * Required args: number=issue_number  repo=owner/name
 *
 * Optional args: title=...  body=...  body_file=path (reads body from file)
 *                owner=org  project=number  project_id=PVT_...
 *                status_field_id=...  status_option_id=...
 *                priority_field_id=...  priority_option_id=...
 *                estimate_field_id=...  estimate=number
 *
 * Returns JSON with: { number, updated_title, updated_body, status_set, priority_set, estimate_set }
 */
function cmdGithubUpdateIssue(cwd, raw, extraArgs) {
  const params = parseKeyValueArgs(extraArgs);

  const number = params.number;
  const repo = params.repo;

  if (!number || !repo) {
    error('github update-issue requires: number, repo');
  }

  const result = {
    number: parseInt(number, 10),
    updated_title: false,
    updated_body: false,
    status_set: false,
    priority_set: false,
    estimate_set: false,
    errors: [],
  };

  // 1. Update title and/or body via gh issue edit
  const editParts = [`gh issue edit ${number} --repo ${repo}`];

  if (params.title) {
    const safeTitle = params.title.replace(/"/g, '\\"');
    editParts.push(`--title "${safeTitle}"`);
    result.updated_title = true;
  }

  // Body can come from body= param or body_file= param (for large bodies)
  let body = params.body || null;
  if (!body && params.body_file) {
    const bodyPath = path.isAbsolute(params.body_file)
      ? params.body_file
      : path.join(cwd, params.body_file);
    if (fs.existsSync(bodyPath)) {
      body = fs.readFileSync(bodyPath, 'utf8');
    } else {
      result.errors.push(`body_file not found: ${params.body_file}`);
    }
  }

  if (body) {
    const safeBody = body.replace(/"/g, '\\"');
    editParts.push(`--body "${safeBody}"`);
    result.updated_body = true;
  }

  if (result.updated_title || result.updated_body) {
    const editOk = execCommand(editParts.join(' '), cwd);
    if (!editOk && editOk !== '') {
      result.errors.push('Failed to update issue');
      result.updated_title = false;
      result.updated_body = false;
    }
  }

  // 2. Update project fields (optional — requires project context)
  if (params.owner && params.project && params.project_id) {
    const owner = params.owner;

    // Find the project item ID for this issue
    const itemId = execCommand(
      `gh project item-list ${params.project} --owner ${owner} --format json --jq ".items[] | select(.content.number == ${number}) | .id"`,
      cwd
    );

    if (itemId) {
      // Set Status
      if (params.status_field_id && params.status_option_id) {
        const statusOk = execCommand(
          `gh project item-edit --project-id ${params.project_id} --id ${itemId} --field-id ${params.status_field_id} --single-select-option-id ${params.status_option_id}`,
          cwd
        );
        result.status_set = statusOk !== null;
        if (!result.status_set) result.errors.push('Failed to set status');
      }

      // Set Priority
      if (params.priority_field_id && params.priority_option_id) {
        const priorityOk = execCommand(
          `gh project item-edit --project-id ${params.project_id} --id ${itemId} --field-id ${params.priority_field_id} --single-select-option-id ${params.priority_option_id}`,
          cwd
        );
        result.priority_set = priorityOk !== null;
        if (!result.priority_set) result.errors.push('Failed to set priority');
      }

      // Set Estimate
      if (params.estimate_field_id && params.estimate) {
        const estimateOk = execCommand(
          `gh project item-edit --project-id ${params.project_id} --id ${itemId} --field-id ${params.estimate_field_id} --number ${params.estimate}`,
          cwd
        );
        result.estimate_set = estimateOk !== null;
        if (!result.estimate_set) result.errors.push('Failed to set estimate');
      }
    } else {
      result.errors.push('Issue not found in project — cannot update fields');
    }
  }

  if (result.errors.length === 0) delete result.errors;
  output(result, raw);
}

/**
 * github fetch-issues — Fetch all Epics and Features from a GitHub Project with full field data.
 *
 * Uses a single paginated GraphQL query to retrieve project items with:
 * - Native issue type (Epic/Feature/Story)
 * - All project field values (Status, Priority, Estimate, Sprint, Size, etc.)
 * - Parent issue relationships (sub-issues)
 * - Milestone
 *
 * Required args: repo=owner/name  owner=org  project=number
 *
 * Returns JSON with:
 *   - epics: [{ number, title, status, priority, estimate, sprint, milestone, url, state }]
 *   - features: [{ number, title, status, priority, estimate, sprint, milestone, parent_number, parent_title, url, state }]
 *   - counts: { total, epics, features, skipped }
 */
function cmdGithubFetchIssues(cwd, raw, extraArgs) {
  const params = parseKeyValueArgs(extraArgs);
  const repo = params.repo;
  const owner = params.owner;
  const project = params.project;

  if (!repo || !owner || !project) {
    error('github fetch-issues requires: repo=owner/name owner=org project=number');
  }

  // 1. Get project node ID
  const projectListRaw = execCommand(
    `gh project list --owner ${owner} --format json --limit 20`,
    cwd
  );

  let projectId = null;
  if (projectListRaw) {
    try {
      const parsed = JSON.parse(projectListRaw);
      const projects = parsed.projects || parsed || [];
      const match = projects.find(p => String(p.number) === String(project));
      if (match) projectId = match.id;
    } catch {}
  }

  if (!projectId) {
    error('Could not find project #' + project + ' for owner ' + owner);
  }

  // 2. Fetch all project items via paginated GraphQL query
  //    Single query gets: issue details, native type, parent, milestone, and all project field values
  const allItems = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const query = `query { node(id: "${projectId}") { ... on ProjectV2 { items(first: 100${afterClause}) { nodes { id fieldValues(first: 20) { nodes { ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2SingleSelectField { name } } } ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2Field { name } } } ... on ProjectV2ItemFieldIterationValue { title field { ... on ProjectV2IterationField { name } } } } } content { ... on Issue { number title url state issueType { name } parent { number title } milestone { title } } } } pageInfo { hasNextPage endCursor } } } } }`;

    const result = execCommand(
      `gh api graphql -f query='${query}'`,
      cwd
    );

    if (!result) {
      if (allItems.length === 0) {
        error('Failed to fetch project items via GraphQL');
      }
      break; // partial success — return what we have
    }

    try {
      const parsed = JSON.parse(result);
      const itemsData = parsed.data?.node?.items;
      if (itemsData?.nodes) {
        allItems.push(...itemsData.nodes);
      }
      hasNextPage = itemsData?.pageInfo?.hasNextPage || false;
      cursor = itemsData?.pageInfo?.endCursor || null;
    } catch {
      break;
    }
  }

  // 3. Parse items into structured epics/features
  const epics = [];
  const features = [];
  let skipped = 0;

  for (const item of allItems) {
    const content = item.content;
    if (!content || !content.number) {
      skipped++;
      continue; // DraftIssue or PR — skip
    }

    // Extract project field values into a flat map
    const fieldMap = {};
    if (item.fieldValues?.nodes) {
      for (const fv of item.fieldValues.nodes) {
        if (fv.field?.name) {
          if (fv.name !== undefined) {
            fieldMap[fv.field.name] = fv.name;     // single-select (Status, Priority, Size)
          } else if (fv.number !== undefined) {
            fieldMap[fv.field.name] = fv.number;   // number (Estimate)
          } else if (fv.title !== undefined) {
            fieldMap[fv.field.name] = fv.title;    // iteration (Sprint)
          }
        }
      }
    }

    // Determine type: native issueType → title prefix → skip
    let type = null;
    if (content.issueType?.name) {
      type = content.issueType.name;
    } else if (content.title?.startsWith('[Epic]')) {
      type = 'Epic';
    } else if (content.title?.startsWith('[Feature]')) {
      type = 'Feature';
    }

    if (type !== 'Epic' && type !== 'Feature') {
      skipped++;
      continue;
    }

    const entry = {
      number: content.number,
      title: content.title,
      status: fieldMap.Status || null,
      priority: fieldMap.Priority || null,
      estimate: fieldMap.Estimate || null,
      sprint: fieldMap.Sprint || null,
      milestone: content.milestone?.title || null,
      url: content.url,
      state: content.state || null,
    };

    if (type === 'Epic') {
      epics.push(entry);
    } else {
      entry.parent_number = content.parent?.number || null;
      entry.parent_title = content.parent?.title || null;
      features.push(entry);
    }
  }

  output({
    epics,
    features,
    counts: {
      total: allItems.length,
      epics: epics.length,
      features: features.length,
      skipped,
    },
  }, raw);
}

// ─── CLI Router ───────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const rawIndex = args.indexOf('--raw');
  const raw = rawIndex !== -1;
  if (rawIndex !== -1) args.splice(rawIndex, 1);

  const command = args[0];
  const cwd = process.cwd();

  if (!command) {
    error('Usage: ace-tools <command> [args] [--raw]\nCommands: load-config, resolve-model, verify-path-exists, generate-slug, current-timestamp, ensure-settings, write-github-settings, init');
  }

  switch (command) {
    case 'load-config': {
      cmdLoadConfig(cwd, raw);
      break;
    }

    case 'resolve-model': {
      cmdResolveModel(cwd, args[1], raw);
      break;
    }

    case 'verify-path-exists': {
      cmdVerifyPathExists(cwd, args[1], raw);
      break;
    }

    case 'generate-slug': {
      cmdGenerateSlug(args.slice(1).join(' '), raw);
      break;
    }

    case 'current-timestamp': {
      cmdCurrentTimestamp(args[1] || 'full', raw);
      break;
    }

    case 'ensure-settings': {
      cmdEnsureSettings(cwd, raw);
      break;
    }

    case 'write-github-settings': {
      cmdWriteGithubSettings(cwd, raw, args.slice(1));
      break;
    }

    case 'init': {
      const workflow = args[1];
      switch (workflow) {
        case 'new-project':
          cmdInitNewProject(cwd, raw);
          break;
        case 'product-vision':
          cmdInitProductVision(cwd, raw);
          break;
        case 'coding-standards':
          cmdInitCodingStandards(cwd, raw);
          break;
        case 'map-system':
          cmdInitMapSystem(cwd, raw);
          break;
        case 'map-subsystem':
          cmdInitMapSubsystem(cwd, raw);
          break;
        case 'plan-backlog':
          cmdInitPlanBacklog(cwd, raw);
          break;
        case 'plan-feature':
          cmdInitPlanFeature(cwd, raw);
          break;
        case 'setup-github':
          cmdSetupGithubProject(cwd, raw);
          break;
        default:
          error('Unknown init subcommand. Available: new-project, product-vision, coding-standards, map-system, map-subsystem, plan-backlog, plan-feature, setup-github');
      }
      break;
    }

    case 'github': {
      const subcommand = args[1];
      const githubArgs = args.slice(2);
      switch (subcommand) {
        case 'resolve-fields':
          cmdGithubResolveFields(cwd, raw, githubArgs);
          break;
        case 'create-issue':
          cmdGithubCreateIssue(cwd, raw, githubArgs);
          break;
        case 'update-issue':
          cmdGithubUpdateIssue(cwd, raw, githubArgs);
          break;
        case 'fetch-issues':
          cmdGithubFetchIssues(cwd, raw, githubArgs);
          break;
        default:
          error('Unknown github subcommand. Available: resolve-fields, create-issue, update-issue, fetch-issues');
      }
      break;
    }

    default:
      error(`Unknown command: ${command}\nAvailable: load-config, resolve-model, verify-path-exists, generate-slug, current-timestamp, ensure-settings, write-github-settings, init, github`);
  }
}

main();
