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
 */

const fs = require('fs');
const path = require('path');

// ─── Model Profile Table ─────────────────────────────────────────────────────

const MODEL_PROFILES = {
  'ace-product-owner':        { quality: 'opus',   balanced: 'sonnet', budget: 'sonnet' },
  'ace-project-researcher':   { quality: 'opus',   balanced: 'sonnet', budget: 'haiku' },
  'ace-research-synthesizer': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
  'ace-code-wiki-mapper':     { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
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
    mapper_model: resolveModelInternal(cwd, 'ace-code-wiki-mapper'),

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

// ─── CLI Router ───────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const rawIndex = args.indexOf('--raw');
  const raw = rawIndex !== -1;
  if (rawIndex !== -1) args.splice(rawIndex, 1);

  const command = args[0];
  const cwd = process.cwd();

  if (!command) {
    error('Usage: ace-tools <command> [args] [--raw]\nCommands: load-config, resolve-model, verify-path-exists, generate-slug, current-timestamp, init');
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
        default:
          error('Unknown init subcommand. Available: new-project, product-vision, coding-standards, map-system');
      }
      break;
    }

    default:
      error(`Unknown command: ${command}\nAvailable: load-config, resolve-model, verify-path-exists, generate-slug, current-timestamp, init`);
  }
}

main();
