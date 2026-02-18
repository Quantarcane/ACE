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
 *   init new-project                Environment detection for project init
 */

const fs = require('fs');
const path = require('path');

// ─── Model Profile Table ─────────────────────────────────────────────────────

const MODEL_PROFILES = {
  'ace-product-owner':        { quality: 'opus',   balanced: 'sonnet', budget: 'sonnet' },
  'ace-project-researcher':   { quality: 'opus',   balanced: 'sonnet', budget: 'haiku' },
  'ace-research-synthesizer': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku' },
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

// ─── Compound Commands ────────────────────────────────────────────────────────

function cmdInitNewProject(cwd, raw) {
  const config = loadConfig(cwd);

  // Detect existing code (cross-platform)
  const codeFiles = detectCodeFiles(cwd, 3);
  const hasCode = codeFiles.length > 0;

  // Check for project/build manifest files (detects "project exists" even without source code yet)
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

  const result = {
    // Models (pre-resolved so workflows know which model to spawn each agent with)
    product_owner_model: resolveModelInternal(cwd, 'ace-product-owner'),

    researcher_model: resolveModelInternal(cwd, 'ace-project-researcher'),
    synthesizer_model: resolveModelInternal(cwd, 'ace-research-synthesizer'),

    // Config
    commit_docs: config.commit_docs,

    // Existing state
    has_product_vision: pathExistsInternal(cwd, '.docs/product/product-vision.md'),
    //has_system_architecture
    //has_tech_stack
    //has_tech_debt
    project_exists: pathExistsInternal(cwd, '.docs/product/product-vision.md'),
    has_codebase_map: pathExistsInternal(cwd, '.ace/codebase'),
    planning_exists: pathExistsInternal(cwd, '.ace'),

    // Brownfield detection
    has_existing_code: hasCode,
    has_package_file: hasPackageFile,
    is_brownfield: hasCode || hasPackageFile,
    needs_codebase_map: (hasCode || hasPackageFile) && !pathExistsInternal(cwd, '.ace/codebase'),

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
        default:
          error('Unknown init subcommand. Available: new-project');
      }
      break;
    }

    default:
      error(`Unknown command: ${command}\nAvailable: load-config, resolve-model, verify-path-exists, generate-slug, current-timestamp, init`);
  }
}

main();
