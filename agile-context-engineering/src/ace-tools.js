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
 *   init plan-story <story>          Environment detection for plan-story workflow (deep questioning)
 *   init research-story <story>     Validate story, extract metadata/requirements/wiki refs, compute paths
 *   init execute-story <story>      Environment detection for execute-story workflow (execution context)
 *   init setup-github               Detect gh CLI, repo, and list GitHub Projects
 *
 *   ensure-settings                  Create .ace/settings.json with defaults if missing
 *   write-github-settings            Write GitHub Project settings (key=value args)
 *   write-agent-teams <true|false>   Enable/disable agent teams in ACE + Claude Code settings
 *   sync-agent-teams                 Sync agent_teams from runtime settings.json (source of truth) to .ace/settings.json
 *
 * Story Commands:
 *   story update-state               Update story status across story file, feature file, and product backlog
 *
 * GitHub Commands:
 *   github resolve-fields             Resolve native issue type IDs and project field IDs
 *   github create-issue               Create issue, set type, add to project, set fields
 *   github update-issue               Update an existing issue's title, body, and optionally project fields
 *   github sync-story                 Sync story/feature body and project status to GitHub
 *   github fetch-issues               Fetch all Epics/Features from GitHub Project with full fields
 */

const fs = require('fs');
const path = require('path');

// ─── Runtime Detection ───────────────────────────────────────────────────────

/**
 * Detect the runtime config directory name from where this script is installed.
 * Script location: <base>/<config-dir>/agile-context-engineering/src/ace-tools.js
 * Returns '.claude' or '.opencode' depending on which runtime installed ACE.
 */
function getRuntimeConfigDirName() {
  const aceDir = path.dirname(__dirname); // <base>/<config-dir>/agile-context-engineering
  const configDir = path.dirname(aceDir); // <base>/<config-dir>
  const dirName = path.basename(configDir); // '.claude' or '.opencode'
  if (dirName === '.opencode' || dirName === '.claude') {
    return dirName;
  }
  // Fallback for development/testing (running from repo source)
  return '.claude';
}

const RUNTIME_CONFIG_DIR = getRuntimeConfigDirName();

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

// ─── Story Parsing Helpers ────────────────────────────────────────────────────

/**
 * Read a file safely, returning null on failure instead of throwing.
 */
function safeReadFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); }
  catch { return null; }
}

/**
 * Classify a story parameter as file path, GitHub URL, or issue number.
 * Returns { type, filePath?, repo?, issueNumber?, reason? }
 */
function classifyStoryParam(param) {
  if (!param) return { type: null, reason: 'No story parameter provided' };
  const trimmed = param.trim();
  if (/^https?:\/\/github\.com\//.test(trimmed)) {
    const match = trimmed.match(/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
    if (match) return { type: 'github-url', repo: match[1], issueNumber: parseInt(match[2]) };
    return { type: 'invalid', reason: 'Unrecognized GitHub URL format. Expected: https://github.com/owner/repo/issues/123' };
  }
  if (/^\d+$/.test(trimmed)) {
    return { type: 'issue-number', issueNumber: parseInt(trimmed) };
  }
  return { type: 'file', filePath: trimmed };
}

/**
 * Extract a markdown section between a heading and the next heading of equal or higher level.
 * Returns the section content (without the heading itself), or null if not found.
 * headingLevel: number of '#' chars (2 for ##, 3 for ###)
 */
function extractMarkdownSection(content, sectionName, headingLevel) {
  const prefix = '#'.repeat(headingLevel);
  const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Find the heading line
  const headingPattern = new RegExp(`^${prefix}\\s+${escapedName}\\s*$`, 'm');
  const headingMatch = headingPattern.exec(content);
  if (!headingMatch) return null;

  // Get everything after the heading line
  const startIdx = headingMatch.index + headingMatch[0].length;
  const rest = content.substring(startIdx);

  // Find the next heading of equal or higher level
  const nextHeadingPattern = new RegExp(`^#{1,${headingLevel}}\\s`, 'm');
  const nextMatch = nextHeadingPattern.exec(rest);

  const sectionContent = nextMatch ? rest.substring(0, nextMatch.index) : rest;
  return sectionContent.trim() || null;
}

/**
 * Parse the story markdown header to extract metadata and parent context.
 *
 * Expected format:
 *   # S3: Display OAuth Provider Buttons
 *   **Feature**: F3 OAuth2 Login Flow | **Epic**: #45 User Authentication
 *   **Status**: Refined | **Size**: 3 | **Sprint**: Sprint 2 | **Link**: [#95](url)
 */
function extractStoryMetadata(content) {
  const result = {
    id: null, title: null, status: null, size: null, sprint: null, link: null,
    feature: { id: null, title: null },
    epic: { id: null, title: null },
  };
  if (!content) return result;

  // Header: # ID: Title
  const headerMatch = content.match(/^#\s+([^:\n]+?):\s+(.+)$/m);
  if (headerMatch) {
    result.id = headerMatch[1].trim();
    result.title = headerMatch[2].trim();
  }

  // Feature/Epic line: **Feature**: F3 OAuth2 Login Flow | **Epic**: #45 User Authentication
  const featureEpicMatch = content.match(/\*\*Feature\*\*:\s*(.+?)\s*\|\s*\*\*Epic\*\*:\s*(.+)$/m);
  if (featureEpicMatch) {
    const featureStr = featureEpicMatch[1].trim();
    const epicStr = featureEpicMatch[2].trim();
    // Parse "F3 OAuth2 Login Flow" → id="F3", title="OAuth2 Login Flow"
    const featureParts = featureStr.match(/^(\S+)\s+(.+)$/);
    if (featureParts) {
      result.feature.id = featureParts[1];
      result.feature.title = featureParts[2];
    } else {
      result.feature.title = featureStr;
    }
    const epicParts = epicStr.match(/^(\S+)\s+(.+)$/);
    if (epicParts) {
      result.epic.id = epicParts[1];
      result.epic.title = epicParts[2];
    } else {
      result.epic.title = epicStr;
    }
  }

  // Status line: **Status**: Refined | **Size**: 3 | **Sprint**: Sprint 2 | **Link**: [#95](url)
  const statusMatch = content.match(/\*\*Status\*\*:\s*([^|*]+)/);
  if (statusMatch) result.status = statusMatch[1].trim();

  const sizeMatch = content.match(/\*\*Size\*\*:\s*([^|*]+)/);
  if (sizeMatch) result.size = sizeMatch[1].trim();

  const sprintMatch = content.match(/\*\*Sprint\*\*:\s*([^|*]+)/);
  if (sprintMatch) result.sprint = sprintMatch[1].trim();

  const linkMatch = content.match(/\*\*Link\*\*:\s*([^|*\n]+)/);
  if (linkMatch) result.link = linkMatch[1].trim();

  return result;
}

/**
 * Extract GitHub issue number from a Link field value.
 * Handles formats: "[#187](url)", "#187", "187"
 * Returns the issue number as an integer, or null if not parseable.
 */
function extractIssueNumber(linkStr) {
  if (!linkStr) return null;
  const match = linkStr.match(/#(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract GitHub issue number from a file's **Link** header field.
 * Reads the file, finds **Link**: [#N](url), returns the issue number or null.
 */
function extractIssueNumberFromFile(cwd, filePath) {
  if (!filePath) return null;
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(resolved);
  if (!content) return null;
  const linkMatch = content.match(/\*\*Link\*\*:\s*([^|*\n]+)/);
  if (!linkMatch) return null;
  return extractIssueNumber(linkMatch[1].trim());
}

/**
 * Extract story requirements: user story statement, description, and AC scenario count.
 */
function extractStoryRequirements(content) {
  const result = { user_story: null, description: null, acceptance_criteria_count: 0 };
  if (!content) return result;

  // User Story: content between "## User Story" and next "## "
  const userStorySection = extractMarkdownSection(content, 'User Story', 2);
  if (userStorySection) {
    // Strip blockquote prefixes (> )
    result.user_story = userStorySection.replace(/^>\s?/gm, '').trim();
  }

  // Description: content between "## Description" and next "## "
  const descSection = extractMarkdownSection(content, 'Description', 2);
  if (descSection) {
    result.description = descSection.trim();
  }

  // Count AC scenarios: occurrences of "### Scenario:"
  const scenarioMatches = content.match(/^###\s+Scenario:/gm);
  result.acceptance_criteria_count = scenarioMatches ? scenarioMatches.length : 0;

  return result;
}

/**
 * Parse the "## Relevant Wiki" section to extract structured wiki file references.
 * Returns { system_wide: string[], subsystem_docs: [{path, category, reason}], total_count }
 */
function extractWikiReferences(content) {
  const result = { system_wide: [], subsystem_docs: [], total_count: 0 };
  if (!content) return result;

  const wikiSection = extractMarkdownSection(content, 'Relevant Wiki', 2);
  if (!wikiSection) return result;

  // Parse each line that starts with "- `path`" — extract path and reason
  const linePattern = /^-\s+`([^`]+)`\s*[—–-]\s*(.+)$/gm;
  let match;
  while ((match = linePattern.exec(wikiSection)) !== null) {
    const filePath = match[1].trim();
    const reason = match[2].trim();

    if (filePath.includes('/system-wide/')) {
      result.system_wide.push(filePath);
    } else {
      // Classify subsystem doc category from path
      let category = 'other';
      if (filePath.includes('/systems/')) category = 'systems';
      else if (filePath.includes('/patterns/')) category = 'patterns';
      else if (filePath.includes('/cross-cutting/')) category = 'cross-cutting';
      else if (filePath.includes('/guides/')) category = 'guides';
      else if (filePath.includes('/decisions/')) category = 'decisions';
      else if (filePath.includes('/architecture')) category = 'architecture';

      result.subsystem_docs.push({ path: filePath, category, reason });
    }
  }

  result.total_count = result.system_wide.length + result.subsystem_docs.length;
  return result;
}

/**
 * Compute all story-related paths and slugs from parent context.
 */
function computeStoryPaths(epicId, epicTitle, featureId, featureTitle, storyId, storyTitle) {
  const epicSlug = generateSlugInternal(`${epicId}-${epicTitle}`) || 'unknown-epic';
  const featureSlug = generateSlugInternal(`${featureId}-${featureTitle}`) || 'unknown-feature';
  const storySlug = generateSlugInternal(`${storyId}-${storyTitle}`) || 'unknown-story';

  const storyDir = `.ace/artifacts/product/${epicSlug}/${featureSlug}/${storySlug}`;
  const featureDir = `.ace/artifacts/product/${epicSlug}/${featureSlug}`;

  return {
    epic_slug: epicSlug,
    feature_slug: featureSlug,
    story_slug: storySlug,
    story_dir: storyDir,
    story_file: `${storyDir}/${storySlug}.md`,
    external_analysis_file: `${storyDir}/external-analysis.md`,
    integration_analysis_file: `${storyDir}/integration-analysis.md`,
    feature_dir: featureDir,
    feature_file: `${featureDir}/${featureSlug}.md`,
  };
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
  agent_teams: false,
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
      agent_teams: parsed.agent_teams ?? SETTINGS_DEFAULTS.agent_teams,
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

function cmdSyncAgentTeams(cwd, raw) {
  // Source of truth: runtime settings.json env var (e.g. .claude/settings.json or .opencode/settings.json)
  const claudeSettingsPath = path.join(cwd, RUNTIME_CONFIG_DIR, 'settings.json');
  let claudeEnabled = false;
  try {
    const claudeRaw = fs.readFileSync(claudeSettingsPath, 'utf-8');
    const claudeSettings = JSON.parse(claudeRaw);
    const val = claudeSettings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    claudeEnabled = val === '1' || val === 'true';
  } catch {
    // File doesn't exist or is invalid — treat as disabled
  }

  // Sync ACE settings to match Claude's source of truth
  const settings = loadSettings(cwd);
  const wasDifferent = settings.agent_teams !== claudeEnabled;
  if (wasDifferent) {
    settings.agent_teams = claudeEnabled;
    writeSettings(cwd, settings);
  }

  output({ agent_teams: claudeEnabled, synced: wasDifferent }, raw);
}

function cmdWriteAgentTeamsSetting(cwd, raw, extraArgs) {
  const enabled = extraArgs[0] === 'true';
  const settings = loadSettings(cwd);
  settings.agent_teams = enabled;
  writeSettings(cwd, settings);

  // Also update the project's runtime settings.json (e.g. .claude/ or .opencode/)
  const claudeDir = path.join(cwd, RUNTIME_CONFIG_DIR);
  const claudeSettingsPath = path.join(claudeDir, 'settings.json');

  let claudeSettings = {};
  try {
    const existing = fs.readFileSync(claudeSettingsPath, 'utf-8');
    claudeSettings = JSON.parse(existing);
  } catch {
    // File doesn't exist or is invalid — start fresh
  }

  if (!claudeSettings.env) {
    claudeSettings.env = {};
  }

  if (enabled) {
    claudeSettings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1';
  } else {
    delete claudeSettings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    // Clean up empty env object
    if (Object.keys(claudeSettings.env).length === 0) {
      delete claudeSettings.env;
    }
  }

  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }
  fs.writeFileSync(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2) + '\n', 'utf-8');

  output({ written: true, agent_teams: enabled, settings, claude_settings: claudeSettings }, raw);
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

// ─── Init: Plan Story ─────────────────────────────────────────────────────────

/**
 * init plan-story <story-param>
 *
 * Environment detection for the plan-story workflow.
 * Validates the story source (file path, GitHub URL, or issue number),
 * loads feature context, detects existing story state, and returns
 * everything the workflow needs to run deep questioning.
 *
 * story-param can be:
 *   - File path: .ace/artifacts/product/.../story.md or any markdown file
 *   - GitHub URL: https://github.com/owner/repo/issues/123
 *   - Issue number: 123
 */
function cmdInitPlanStory(cwd, raw, storyParam) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  // ── Environment detection ──
  const has_git = pathExistsInternal(cwd, '.git');
  const has_gh_cli = (() => {
    try {
      const { execSync } = require('child_process');
      execSync('gh --version', { stdio: 'pipe' });
      return true;
    } catch { return false; }
  })();
  const github_project = (() => {
    const settings = loadSettings(cwd);
    return settings.github_project;
  })();

  // Wiki detection
  const wikiSystemDir = '.docs/wiki/system-wide';
  const has_wiki_system_wide = pathExistsInternal(cwd, wikiSystemDir);
  const wikiSubsystemsDir = '.docs/wiki/subsystems';
  const has_wiki_subsystems = pathExistsInternal(cwd, wikiSubsystemsDir);
  let wiki_subsystem_names = [];
  if (has_wiki_subsystems) {
    try {
      const entries = fs.readdirSync(path.join(cwd, wikiSubsystemsDir), { withFileTypes: true });
      wiki_subsystem_names = entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {}
  }
  const has_wiki = has_wiki_system_wide || has_wiki_subsystems;

  // ── Classify the story parameter ──
  const classified = classifyStoryParam(storyParam);

  // Early exit if invalid
  if (classified.type === null || classified.type === 'invalid') {
    output({
      product_owner_model: resolveModelInternal(cwd, 'ace-product-owner'),
      commit_docs: config.commit_docs,
      has_git, has_gh_cli, github_project,
      ...brownfield,
      has_wiki, has_wiki_system_wide, has_wiki_subsystems, wiki_subsystem_names,
      has_product_vision: pathExistsInternal(cwd, '.docs/product/product-vision.md'),
      has_product_backlog: pathExistsInternal(cwd, '.ace/artifacts/product/product-backlog.md'),
      story_source: null,
      story_valid: false,
      story_error: classified.reason || 'No story parameter provided',
      story_content: null,
      story: { id: null, title: null, status: null, size: null },
      feature: { id: null, title: null },
      epic: { id: null, title: null },
      user_story: null, description: null, acceptance_criteria_count: 0,
      paths: null,
      has_external_analysis: false, has_integration_analysis: false,
      has_feature_file: false, has_story_file: false,
    }, raw);
    return;
  }

  // ── Load story content ──
  let storyContent = null;
  let storySource = classified.type === 'file' ? 'file' : 'github';
  let storyError = null;
  let storyFilePath = null;

  if (classified.type === 'file') {
    const resolvedPath = path.isAbsolute(classified.filePath)
      ? classified.filePath
      : path.join(cwd, classified.filePath);
    if (!pathExistsInternal(cwd, classified.filePath)) {
      storyError = `Story file not found: ${classified.filePath}`;
    } else {
      storyContent = safeReadFile(resolvedPath);
      storyFilePath = classified.filePath;
      if (!storyContent) storyError = `Could not read story file: ${classified.filePath}`;
    }
  } else {
    // github-url or issue-number
    if (!has_gh_cli) {
      storyError = 'GitHub CLI (gh) not installed. Cannot fetch GitHub issues.';
    } else {
      const repo = classified.repo || (github_project.repo || null);
      if (!repo) {
        storyError = 'No repository configured. Provide a full GitHub URL or configure github_project.repo in settings.';
      } else {
        const ghResult = execCommand(
          `gh issue view ${classified.issueNumber} --repo ${repo} --json title,body,labels,state`,
          cwd
        );
        if (!ghResult) {
          storyError = `Could not fetch GitHub issue #${classified.issueNumber} from ${repo}.`;
        } else {
          try {
            const issue = JSON.parse(ghResult);
            storyContent = issue.body || '';
            if (storyContent && !storyContent.match(/^#\s+/m)) {
              storyContent = `# ${issue.title}\n\n${storyContent}`;
            }
          } catch {
            storyError = `Failed to parse GitHub issue response for #${classified.issueNumber}.`;
          }
        }
      }
    }
  }

  // ── Extract metadata & requirements (may be empty for seed stories) ──
  const metadata = extractStoryMetadata(storyContent);
  const requirements = extractStoryRequirements(storyContent);

  // ── Compute paths ──
  let paths = null;
  let has_story_file = false;

  if (storyFilePath) {
    const resolvedPath = path.isAbsolute(storyFilePath)
      ? storyFilePath
      : path.join(cwd, storyFilePath);
    const storyDir = path.dirname(resolvedPath);
    const relStoryDir = path.relative(cwd, storyDir).replace(/\\/g, '/');
    const storySlug = path.basename(storyDir);
    const featureDir = path.dirname(storyDir);
    const relFeatureDir = path.relative(cwd, featureDir).replace(/\\/g, '/');
    const featureSlug = path.basename(featureDir);

    paths = {
      epic_slug: null,
      feature_slug: featureSlug,
      story_slug: storySlug,
      story_dir: relStoryDir,
      story_file: storyFilePath.replace(/\\/g, '/'),
      external_analysis_file: `${relStoryDir}/external-analysis.md`,
      integration_analysis_file: `${relStoryDir}/integration-analysis.md`,
      feature_dir: relFeatureDir,
      feature_file: `${relFeatureDir}/${featureSlug}.md`,
    };
    has_story_file = true;
  } else if (metadata.epic.id && metadata.feature.id && metadata.id) {
    paths = computeStoryPaths(
      metadata.epic.id, metadata.epic.title || '',
      metadata.feature.id, metadata.feature.title || '',
      metadata.id, metadata.title || ''
    );
    has_story_file = paths ? pathExistsInternal(cwd, paths.story_file) : false;
  }

  // ── Check artifact existence ──
  const has_external_analysis = paths ? pathExistsInternal(cwd, paths.external_analysis_file) : false;
  const has_integration_analysis = paths ? pathExistsInternal(cwd, paths.integration_analysis_file) : false;
  const has_feature_file = paths ? pathExistsInternal(cwd, paths.feature_file) : false;

  // ── Build result ──
  const result = {
    // Models
    product_owner_model: resolveModelInternal(cwd, 'ace-product-owner'),

    // Config
    commit_docs: config.commit_docs,

    // Environment
    has_git, has_gh_cli, github_project,

    // Brownfield detection
    ...brownfield,

    // Wiki state
    has_wiki, has_wiki_system_wide, has_wiki_subsystems, wiki_subsystem_names,

    // Product artifacts
    has_product_vision: pathExistsInternal(cwd, '.docs/product/product-vision.md'),
    has_product_backlog: pathExistsInternal(cwd, '.ace/artifacts/product/product-backlog.md'),

    // Story source
    story_source: storySource,
    story_valid: storyContent !== null && storyError === null,
    story_error: storyError,

    // Raw story content (for the workflow to analyze)
    story_content: storyContent,

    // Story metadata (may be partial for seed stories)
    story: {
      id: metadata.id,
      title: metadata.title,
      status: metadata.status,
      size: metadata.size,
      issue_number: extractIssueNumber(metadata.link),
    },
    feature: {
      ...metadata.feature,
      issue_number: paths ? extractIssueNumberFromFile(cwd, paths.feature_file) : null,
    },
    epic: metadata.epic,

    // Requirements (may be empty for seed stories)
    user_story: requirements.user_story,
    description: requirements.description,
    acceptance_criteria_count: requirements.acceptance_criteria_count,

    // Computed paths
    paths,

    // Artifact existence
    has_external_analysis,
    has_integration_analysis,
    has_feature_file,
    has_story_file,
  };

  output(result, raw);
}

// ─── Init: Execute Story ─────────────────────────────────────────────────────

/**
 * init execute-story <story-param>
 *
 * Environment detection for the execute-story workflow.
 * Similar to init plan-story but with additional fields for execution:
 * - agent_teams status (synced from Claude Code settings)
 * - has_technical_solution, has_acceptance_criteria checks
 * - has_coding_standards, has_wiki_refs checks
 * - executor_model, reviewer_model (resolved from profiles)
 * - product_backlog path
 *
 * story-param can be:
 *   - File path: .ace/artifacts/product/.../story.md
 *   - GitHub URL: https://github.com/owner/repo/issues/123
 *   - Issue number: 123
 */
function cmdInitExecuteStory(cwd, raw, storyParam) {
  const config = loadConfig(cwd);

  // ── Environment detection ──
  const has_git = pathExistsInternal(cwd, '.git');
  const has_gh_cli = (() => {
    try {
      const { execSync } = require('child_process');
      execSync('gh --version', { stdio: 'pipe' });
      return true;
    } catch { return false; }
  })();
  const settings = loadSettings(cwd);
  const github_project = settings.github_project;

  // ── Agent teams detection (sync from runtime settings) ──
  const claudeSettingsPath = path.join(cwd, RUNTIME_CONFIG_DIR, 'settings.json');
  let agent_teams = settings.agent_teams || false;
  try {
    const claudeRaw = fs.readFileSync(claudeSettingsPath, 'utf-8');
    const claudeSettings = JSON.parse(claudeRaw);
    const val = claudeSettings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    agent_teams = val === '1' || val === 'true';
  } catch {}

  // ── Classify the story parameter ──
  const classified = classifyStoryParam(storyParam);

  // Early exit if invalid
  if (classified.type === null || classified.type === 'invalid') {
    output({
      executor_model: resolveModelInternal(cwd, 'ace-executor'),
      reviewer_model: resolveModelInternal(cwd, 'ace-code-reviewer'),
      commit_docs: config.commit_docs,
      has_git, has_gh_cli, github_project, agent_teams,
      story_source: null,
      story_valid: false,
      story_error: classified.reason || 'No story parameter provided',
      story_content: null,
      story: { id: null, title: null, status: null, size: null },
      feature: { id: null, title: null },
      epic: { id: null, title: null },
      has_acceptance_criteria: false,
      acceptance_criteria_count: 0,
      has_technical_solution: false,
      has_wiki_refs: false,
      has_coding_standards: false,
      paths: null,
    }, raw);
    return;
  }

  // ── Load story content ──
  let storyContent = null;
  let storySource = classified.type === 'file' ? 'file' : 'github';
  let storyError = null;
  let storyFilePath = null;

  if (classified.type === 'file') {
    const resolvedPath = path.isAbsolute(classified.filePath)
      ? classified.filePath
      : path.join(cwd, classified.filePath);
    if (!pathExistsInternal(cwd, classified.filePath)) {
      storyError = `Story file not found: ${classified.filePath}`;
    } else {
      storyContent = safeReadFile(resolvedPath);
      storyFilePath = classified.filePath;
      if (!storyContent) storyError = `Could not read story file: ${classified.filePath}`;
    }
  } else {
    // github-url or issue-number
    if (!has_gh_cli) {
      storyError = 'GitHub CLI (gh) not installed. Cannot fetch GitHub issues.';
    } else {
      const repo = classified.repo || (github_project.repo || null);
      if (!repo) {
        storyError = 'No repository configured. Provide a full GitHub URL or configure github_project.repo in settings.';
      } else {
        const ghResult = execCommand(
          `gh issue view ${classified.issueNumber} --repo ${repo} --json title,body,labels,state`,
          cwd
        );
        if (!ghResult) {
          storyError = `Could not fetch GitHub issue #${classified.issueNumber} from ${repo}.`;
        } else {
          try {
            const issue = JSON.parse(ghResult);
            storyContent = issue.body || '';
            if (storyContent && !storyContent.match(/^#\s+/m)) {
              storyContent = `# ${issue.title}\n\n${storyContent}`;
            }
          } catch {
            storyError = `Failed to parse GitHub issue response for #${classified.issueNumber}.`;
          }
        }
      }
    }
  }

  // ── Extract metadata & requirements ──
  const metadata = extractStoryMetadata(storyContent);
  const requirements = extractStoryRequirements(storyContent);

  // ── Detect key sections ──
  const has_acceptance_criteria = requirements.acceptance_criteria_count > 0;
  const has_technical_solution = storyContent
    ? !!extractMarkdownSection(storyContent, 'Technical Solution', 2)
    : false;
  const has_wiki_refs = storyContent
    ? !!extractMarkdownSection(storyContent, 'Relevant Wiki', 2)
    : false;
  const has_coding_standards = pathExistsInternal(cwd, '.docs/wiki/system-wide/coding-standards.md');

  // ── Compute paths ──
  let paths = null;
  let has_story_file = false;

  if (storyFilePath) {
    const resolvedPath = path.isAbsolute(storyFilePath)
      ? storyFilePath
      : path.join(cwd, storyFilePath);
    const storyDir = path.dirname(resolvedPath);
    const relStoryDir = path.relative(cwd, storyDir).replace(/\\/g, '/');
    const storySlug = path.basename(storyDir);
    const featureDir = path.dirname(storyDir);
    const relFeatureDir = path.relative(cwd, featureDir).replace(/\\/g, '/');
    const featureSlug = path.basename(featureDir);

    paths = {
      epic_slug: null,
      feature_slug: featureSlug,
      story_slug: storySlug,
      story_dir: relStoryDir,
      story_file: storyFilePath.replace(/\\/g, '/'),
      external_analysis_file: `${relStoryDir}/external-analysis.md`,
      integration_analysis_file: `${relStoryDir}/integration-analysis.md`,
      feature_dir: relFeatureDir,
      feature_file: `${relFeatureDir}/${featureSlug}.md`,
      product_backlog: '.ace/artifacts/product/product-backlog.md',
      coding_standards: '.docs/wiki/system-wide/coding-standards.md',
    };
    has_story_file = true;
  } else if (metadata.epic.id && metadata.feature.id && metadata.id) {
    const computed = computeStoryPaths(
      metadata.epic.id, metadata.epic.title || '',
      metadata.feature.id, metadata.feature.title || '',
      metadata.id, metadata.title || ''
    );
    if (computed) {
      paths = {
        ...computed,
        product_backlog: '.ace/artifacts/product/product-backlog.md',
        coding_standards: '.docs/wiki/system-wide/coding-standards.md',
      };
      has_story_file = pathExistsInternal(cwd, paths.story_file);
    }
  }

  // ── Extract GitHub issue numbers ──
  const storyIssueNumber = extractIssueNumber(metadata.link);
  const featureIssueNumber = paths ? extractIssueNumberFromFile(cwd, paths.feature_file) : null;

  // ── Build result ──
  const result = {
    // Models
    executor_model: resolveModelInternal(cwd, 'ace-executor'),
    reviewer_model: resolveModelInternal(cwd, 'ace-code-reviewer'),

    // Config
    commit_docs: config.commit_docs,

    // Environment
    has_git, has_gh_cli, github_project, agent_teams,

    // Story source
    story_source: storySource,
    story_valid: storyContent !== null && storyError === null,
    story_error: storyError,

    // Raw story content
    story_content: storyContent,

    // Story metadata
    story: {
      id: metadata.id,
      title: metadata.title,
      status: metadata.status,
      size: metadata.size,
      issue_number: storyIssueNumber,
    },
    feature: {
      ...metadata.feature,
      issue_number: featureIssueNumber,
    },
    epic: metadata.epic,

    // Section detection
    has_acceptance_criteria,
    acceptance_criteria_count: requirements.acceptance_criteria_count,
    has_technical_solution,
    has_wiki_refs,
    has_coding_standards,

    // Computed paths
    paths,

    // Artifact existence
    has_story_file,
  };

  output(result, raw);
}

// ─── Init: Research Story ────────────────────────────────────────────────────

/**
 * init research-story <story-param>
 *
 * Single compound command that validates a story source, extracts all metadata,
 * requirements, wiki references, computes paths, and checks artifact existence.
 * Replaces 5-7 separate ace-tools calls in story-level workflows.
 *
 * story-param can be:
 *   - File path: .ace/artifacts/product/.../story.md
 *   - GitHub URL: https://github.com/owner/repo/issues/123
 *   - Issue number: 123
 */
function cmdInitResearchStory(cwd, raw, storyParam) {
  const config = loadConfig(cwd);

  // ── Environment detection (reused from other init commands) ──
  const has_git = pathExistsInternal(cwd, '.git');
  const has_gh_cli = (() => {
    try {
      const { execSync } = require('child_process');
      execSync('gh --version', { stdio: 'pipe' });
      return true;
    } catch { return false; }
  })();
  const github_project = (() => {
    const settings = loadSettings(cwd);
    return settings.github_project;
  })();

  // ── Classify the story parameter ──
  const classified = classifyStoryParam(storyParam);

  // Early exit if invalid
  if (classified.type === null || classified.type === 'invalid') {
    output({
      analyst_model: resolveModelInternal(cwd, 'ace-code-integration-analyst'),
      mapper_model: resolveModelInternal(cwd, 'ace-wiki-mapper'),
      commit_docs: config.commit_docs,
      has_git, has_gh_cli, github_project,
      story_source: null,
      story_valid: false,
      story_error: classified.reason || 'No story parameter provided',
      story: { id: null, title: null, status: null, size: null },
      feature: { id: null, title: null },
      epic: { id: null, title: null },
      user_story: null, description: null, acceptance_criteria_count: 0,
      paths: null,
      has_external_analysis: false, has_integration_analysis: false, has_feature_file: false,
      wiki_references: { system_wide: [], subsystem_docs: [], total_count: 0 },
      wiki_docs_exist: { existing: [], missing: [] },
    }, raw);
    return;
  }

  // ── Load story content ──
  let storyContent = null;
  let storySource = classified.type === 'file' ? 'file' : 'github';
  let storyError = null;
  let storyFilePath = null;

  if (classified.type === 'file') {
    const resolvedPath = path.isAbsolute(classified.filePath)
      ? classified.filePath
      : path.join(cwd, classified.filePath);
    if (!pathExistsInternal(cwd, classified.filePath)) {
      storyError = `Story file not found: ${classified.filePath}`;
    } else {
      storyContent = safeReadFile(resolvedPath);
      storyFilePath = classified.filePath;
      if (!storyContent) storyError = `Could not read story file: ${classified.filePath}`;
    }
  } else {
    // github-url or issue-number
    if (!has_gh_cli) {
      storyError = 'GitHub CLI (gh) not installed. Cannot fetch GitHub issues.';
    } else {
      const repo = classified.repo || (github_project.repo || null);
      if (!repo) {
        storyError = 'No repository configured. Provide a full GitHub URL or configure github_project.repo in settings.';
      } else {
        const ghResult = execCommand(
          `gh issue view ${classified.issueNumber} --repo ${repo} --json title,body,labels,state`,
          cwd
        );
        if (!ghResult) {
          storyError = `Could not fetch GitHub issue #${classified.issueNumber} from ${repo}.`;
        } else {
          try {
            const issue = JSON.parse(ghResult);
            // Reconstruct story content from issue body (the body IS the story markdown)
            storyContent = issue.body || '';
            // If the title isn't in the body, prepend it as a header
            if (storyContent && !storyContent.match(/^#\s+/m)) {
              storyContent = `# ${issue.title}\n\n${storyContent}`;
            }
          } catch {
            storyError = `Failed to parse GitHub issue response for #${classified.issueNumber}.`;
          }
        }
      }
    }
  }

  // ── Extract metadata & requirements ──
  const metadata = extractStoryMetadata(storyContent);
  const requirements = extractStoryRequirements(storyContent);
  const wikiRefs = extractWikiReferences(storyContent);

  // ── Compute paths ──
  let paths = null;
  if (storyFilePath) {
    // Story loaded from file — derive paths from actual file location
    const resolvedPath = path.isAbsolute(storyFilePath)
      ? storyFilePath
      : path.join(cwd, storyFilePath);
    const storyDir = path.dirname(resolvedPath);
    const relStoryDir = path.relative(cwd, storyDir).replace(/\\/g, '/');
    const storySlug = path.basename(storyDir);
    const featureDir = path.dirname(storyDir);
    const relFeatureDir = path.relative(cwd, featureDir).replace(/\\/g, '/');
    const featureSlug = path.basename(featureDir);

    paths = {
      epic_slug: null,
      feature_slug: featureSlug,
      story_slug: storySlug,
      story_dir: relStoryDir,
      story_file: storyFilePath.replace(/\\/g, '/'),
      external_analysis_file: `${relStoryDir}/external-analysis.md`,
      integration_analysis_file: `${relStoryDir}/integration-analysis.md`,
      feature_dir: relFeatureDir,
      feature_file: `${relFeatureDir}/${featureSlug}.md`,
    };
  } else if (metadata.epic.id && metadata.feature.id && metadata.id) {
    // Story loaded from GitHub — compute paths from metadata
    paths = computeStoryPaths(
      metadata.epic.id, metadata.epic.title || '',
      metadata.feature.id, metadata.feature.title || '',
      metadata.id, metadata.title || ''
    );
  }

  // ── Check artifact existence ──
  const has_external_analysis = paths ? pathExistsInternal(cwd, paths.external_analysis_file) : false;
  const has_integration_analysis = paths ? pathExistsInternal(cwd, paths.integration_analysis_file) : false;
  const has_feature_file = paths ? pathExistsInternal(cwd, paths.feature_file) : false;

  // ── Verify wiki doc existence ──
  const allWikiPaths = [...wikiRefs.system_wide, ...wikiRefs.subsystem_docs.map(d => d.path)];
  const wikiExisting = [];
  const wikiMissing = [];
  for (const wikiPath of allWikiPaths) {
    if (pathExistsInternal(cwd, wikiPath)) {
      wikiExisting.push(wikiPath);
    } else {
      wikiMissing.push(wikiPath);
    }
  }

  // ── Build result ──
  const result = {
    // Models
    analyst_model: resolveModelInternal(cwd, 'ace-code-integration-analyst'),
    mapper_model: resolveModelInternal(cwd, 'ace-wiki-mapper'),

    // Config
    commit_docs: config.commit_docs,

    // Environment
    has_git,
    has_gh_cli,
    github_project,

    // Story source
    story_source: storySource,
    story_valid: storyContent !== null && storyError === null,
    story_error: storyError,

    // Story metadata
    story: {
      id: metadata.id,
      title: metadata.title,
      status: metadata.status,
      size: metadata.size,
    },
    feature: metadata.feature,
    epic: metadata.epic,

    // Requirements
    user_story: requirements.user_story,
    description: requirements.description,
    acceptance_criteria_count: requirements.acceptance_criteria_count,

    // Computed paths
    paths,

    // Artifact existence
    has_external_analysis,
    has_integration_analysis,
    has_feature_file,

    // Wiki references (structured)
    wiki_references: wikiRefs,

    // Wiki doc verification
    wiki_docs_exist: {
      existing: wikiExisting,
      missing: wikiMissing,
    },
  };

  output(result, raw);
}

// ─── Story State Commands ────────────────────────────────────────────────────

/**
 * story update-state <story-param> --status <Done|DevReady|InProgress>
 *
 * Updates the story status across all ACE artifacts:
 * 1. Story file header (Status field)
 * 2. Feature file story index table
 * 3. Product backlog story entry
 *
 * Also checks if all stories in the feature are Done — if so, updates
 * the feature status to Done in both the feature file and product backlog.
 *
 * Returns: { story_updated, feature_updated, backlog_updated, feature_status_changed }
 */
function cmdStoryUpdateState(cwd, raw, extraArgs) {
  const params = parseKeyValueArgs(extraArgs);
  const storyParam = params.story;
  const newStatus = params.status;

  if (!storyParam) {
    error('story update-state requires: story=<path|github-url>');
  }
  if (!newStatus || !['Done', 'DevReady', 'Refined', 'InProgress', 'In Progress'].includes(newStatus)) {
    error('story update-state requires: status=Done|DevReady|Refined|InProgress');
  }

  // Normalize "InProgress" to "In Progress" for display
  const displayStatus = newStatus === 'InProgress' ? 'In Progress' : newStatus;

  const result = {
    story_updated: false,
    feature_updated: false,
    backlog_updated: false,
    feature_status_changed: false,
    new_status: displayStatus,
    errors: [],
  };

  // ── Resolve story file path ──
  const classified = classifyStoryParam(storyParam);
  if (classified.type !== 'file' || !classified.filePath) {
    result.errors.push('story update-state currently only supports file paths');
    output(result, raw);
    return;
  }

  const storyFilePath = path.isAbsolute(classified.filePath)
    ? classified.filePath
    : path.join(cwd, classified.filePath);

  // ── 1. Update story file header ──
  const storyContent = safeReadFile(storyFilePath);
  if (!storyContent) {
    result.errors.push(`Could not read story file: ${classified.filePath}`);
    output(result, raw);
    return;
  }

  const updatedStory = storyContent.replace(
    /(\*\*Status\*\*:\s*)([^|*\n]+)/,
    `$1${displayStatus}`
  );
  if (updatedStory !== storyContent) {
    try {
      fs.writeFileSync(storyFilePath, updatedStory, 'utf-8');
      result.story_updated = true;
    } catch (e) {
      result.errors.push(`Failed to write story file: ${e.message}`);
    }
  }

  // Extract story metadata for lookups
  const metadata = extractStoryMetadata(storyContent);
  const storyId = metadata.id;
  const storyTitle = metadata.title;

  // ── 2. Update feature file story index ──
  const storyDir = path.dirname(storyFilePath);
  const featureDir = path.dirname(storyDir);
  const featureSlug = path.basename(featureDir);
  const featureFilePath = path.join(featureDir, `${featureSlug}.md`);

  const featureContent = safeReadFile(featureFilePath);
  if (featureContent && storyId) {
    // Find the story in the feature's story index table and update its status
    // Table format: | ID | Title | Size | Status | Sprint | Link |
    const storyIdEscaped = storyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tableRowPattern = new RegExp(
      `(\\|\\s*${storyIdEscaped}\\s*\\|[^|]*\\|[^|]*\\|\\s*)([^|]*)(\\s*\\|)`,
      'm'
    );
    const updatedFeature = featureContent.replace(tableRowPattern, `$1${displayStatus}$3`);

    if (updatedFeature !== featureContent) {
      try {
        fs.writeFileSync(featureFilePath, updatedFeature, 'utf-8');
        result.feature_updated = true;
      } catch (e) {
        result.errors.push(`Failed to write feature file: ${e.message}`);
      }
    }

    // ── Check if all stories in the feature are Done ──
    if (displayStatus === 'Done') {
      const updatedFeatureContent = safeReadFile(featureFilePath) || updatedFeature;
      // Find all status cells in the story index table
      // Match rows like: | S1 | ... | ... | Status | ... | ... |
      const statusPattern = /\|\s*(?:S\d+|#\d+)\s*\|[^|]*\|[^|]*\|\s*([^|]*)\s*\|/gm;
      let allDone = true;
      let match;
      let storyCount = 0;
      while ((match = statusPattern.exec(updatedFeatureContent)) !== null) {
        storyCount++;
        const status = match[1].trim();
        if (status !== 'Done') {
          allDone = false;
        }
      }

      if (allDone && storyCount > 0) {
        // Update feature status to Done in the feature file header
        const featureWithDoneStatus = updatedFeatureContent.replace(
          /(\*\*Status\*\*:\s*)([^|*\n]+)/,
          '$1Done'
        );
        if (featureWithDoneStatus !== updatedFeatureContent) {
          try {
            fs.writeFileSync(featureFilePath, featureWithDoneStatus, 'utf-8');
            result.feature_status_changed = true;
          } catch (e) {
            result.errors.push(`Failed to update feature status: ${e.message}`);
          }
        }
      }
    }
  }

  // ── 3. Update product backlog ──
  const backlogPath = path.join(cwd, '.ace', 'artifacts', 'product', 'product-backlog.md');
  const backlogContent = safeReadFile(backlogPath);
  if (backlogContent && storyId) {
    let updatedBacklog = backlogContent;

    // Update story status in backlog
    // Table format varies but story ID should be in a table row
    const storyIdEscaped = storyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const backlogStoryPattern = new RegExp(
      `(\\|\\s*${storyIdEscaped}\\s*\\|[^|]*\\|[^|]*\\|\\s*)([^|]*)(\\s*\\|)`,
      'm'
    );
    updatedBacklog = updatedBacklog.replace(backlogStoryPattern, `$1${displayStatus}$3`);

    // If feature status changed to Done, also update feature in backlog
    if (result.feature_status_changed && metadata.feature.id) {
      const featureIdEscaped = metadata.feature.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const backlogFeaturePattern = new RegExp(
        `(\\|\\s*${featureIdEscaped}\\s*\\|[^|]*\\|[^|]*\\|\\s*)([^|]*)(\\s*\\|)`,
        'm'
      );
      updatedBacklog = updatedBacklog.replace(backlogFeaturePattern, `$1Done$3`);
    }

    if (updatedBacklog !== backlogContent) {
      try {
        fs.writeFileSync(backlogPath, updatedBacklog, 'utf-8');
        result.backlog_updated = true;
      } catch (e) {
        result.errors.push(`Failed to write product backlog: ${e.message}`);
      }
    }
  }

  if (result.errors.length === 0) delete result.errors;
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
 * Resolve project ID and field definitions for a GitHub Project.
 * Returns { project_id, fields } where fields maps field names to { id, type, options? }.
 * Returns { project_id: null, fields: {} } on failure.
 */
function resolveProjectContext(owner, project, cwd) {
  const projectListRaw = execCommand(
    `gh project list --owner ${owner} --format json --limit 20`,
    cwd
  );

  let project_id = null;
  if (projectListRaw) {
    try {
      const parsed = JSON.parse(projectListRaw);
      const projects = parsed.projects || parsed || [];
      const match = projects.find(p => String(p.number) === String(project));
      if (match) project_id = match.id;
    } catch {}
  }

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

  return { project_id, fields };
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

  // 2 & 3. Resolve project ID and fields
  const { project_id, fields } = resolveProjectContext(owner, project, cwd);

  output({
    issue_types: issueTypes,
    project_id,
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
  // Use --body-file to avoid shell escaping issues with backticks, $, code blocks, etc.
  const fullTitle = `[${type}] ${title}`;
  const safeTitle = fullTitle.replace(/"/g, '\\"');

  let createBodyFile = null;
  if (params.body_file) {
    createBodyFile = path.isAbsolute(params.body_file)
      ? params.body_file
      : path.join(cwd, params.body_file);
  } else {
    const os = require('os');
    createBodyFile = path.join(os.tmpdir(), `ace-gh-body-${Date.now()}.md`);
    fs.writeFileSync(createBodyFile, body, 'utf8');
  }

  const safeBodyPath = createBodyFile.replace(/\\/g, '/');
  const issueUrl = execCommand(
    `gh issue create --repo ${repo} --title "${safeTitle}" --body-file "${safeBodyPath}"`,
    cwd
  );

  // Clean up temp file if we created one
  if (!params.body_file && createBodyFile && fs.existsSync(createBodyFile)) {
    try { fs.unlinkSync(createBodyFile); } catch {}
  }

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

  // Body can come from body_file= param (preferred — avoids shell escaping)
  // or body= param (for short text).
  // Uses gh's --body-file flag to avoid shell escaping issues with
  // backticks, $, newlines, code blocks, mermaid diagrams, etc.
  let bodyFilePath = null;
  let tempBodyFile = null;

  if (params.body_file) {
    bodyFilePath = path.isAbsolute(params.body_file)
      ? params.body_file
      : path.join(cwd, params.body_file);
    if (!fs.existsSync(bodyFilePath)) {
      result.errors.push(`body_file not found: ${params.body_file}`);
      bodyFilePath = null;
    }
  } else if (params.body) {
    // Write body text to a temp file to use --body-file
    const os = require('os');
    tempBodyFile = path.join(os.tmpdir(), `ace-gh-body-${Date.now()}.md`);
    fs.writeFileSync(tempBodyFile, params.body, 'utf8');
    bodyFilePath = tempBodyFile;
  }

  if (bodyFilePath) {
    const safeBodyPath = bodyFilePath.replace(/\\/g, '/');
    editParts.push(`--body-file "${safeBodyPath}"`);
    result.updated_body = true;
  }

  if (result.updated_title || result.updated_body) {
    const fullCmd = editParts.join(' ');
    const { execSync } = require('child_process');
    try {
      const editResult = execSync(fullCmd, {
        cwd,
        shell: 'bash',
        stdio: ['pipe', 'pipe', 'pipe'],
        encoding: 'utf-8',
        timeout: 30000,
      }).trim();
      // success — editResult is the URL
    } catch (e) {
      result.errors.push('Failed to update issue: ' + (e.stderr || e.message || 'unknown error'));
      result.updated_title = false;
      result.updated_body = false;
    }
  }

  // Clean up temp file if created
  if (tempBodyFile && fs.existsSync(tempBodyFile)) {
    try { fs.unlinkSync(tempBodyFile); } catch {}
  }

  // 2. Update project fields (optional — requires project context)
  if (params.owner && params.project && params.project_id) {
    const owner = params.owner;

    // Find the project item ID via GraphQL (direct query — no pagination issues)
    const repoParts = repo.split('/');
    const repoOwner = repoParts[0];
    const repoName = repoParts[1] || repoParts[0];
    const itemQuery = `query { repository(owner: \\"${repoOwner}\\", name: \\"${repoName}\\") { issue(number: ${number}) { projectItems(first: 10) { nodes { id project { id } } } } } }`;
    const itemResult = execCommand(
      `gh api graphql -f query="${itemQuery}"`,
      cwd
    );
    let itemId = null;
    if (itemResult) {
      try {
        const parsed = JSON.parse(itemResult);
        const nodes = parsed.data?.repository?.issue?.projectItems?.nodes || [];
        const match = nodes.find(n => n.project?.id === params.project_id);
        itemId = match?.id || null;
      } catch {}
    }

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

/**
 * github sync-story — Update a story's GitHub issue AND its parent feature's GitHub issue
 * in a single call. Pushes file content as body AND updates the GitHub Project Status field
 * to match each file's local **Status** value.
 *
 * Prints human-readable status lines to stderr so the console always
 * shows what happened, regardless of whether the calling workflow displays it.
 *
 * Required args: repo=owner/name  story_file=path
 * Optional args: feature_file=path  owner=org  project=number
 *
 * When owner and project are provided, resolves the GitHub Project's Status field
 * and updates each issue's project status to match the local file status.
 *
 * Reads each file's **Link** header to extract the issue number.
 * Uses --body-file to push the full file content to GitHub.
 *
 * Returns JSON with: { story: { number, updated, status_synced, error }, feature: { number, updated, status_synced, error } }
 */
function cmdGithubSyncStory(cwd, raw, extraArgs) {
  const params = parseKeyValueArgs(extraArgs);
  const repo = params.repo;
  const storyFile = params.story_file;

  if (!repo || !storyFile) {
    error('github sync-story requires: repo=owner/name story_file=path');
  }

  const result = {
    story: { number: null, updated: false, status_synced: false, error: null },
    feature: { number: null, updated: false, status_synced: false, error: null },
  };

  const { execSync } = require('child_process');

  // --- Resolve project context for status updates (optional) ---
  const owner = params.owner;
  const project = params.project;
  let projectCtx = null;

  if (owner && project) {
    projectCtx = resolveProjectContext(owner, project, cwd);
    if (!projectCtx.project_id) {
      process.stderr.write(`  !  Could not resolve GitHub Project #${project}. Status updates skipped.\n`);
      projectCtx = null;
    } else if (!projectCtx.fields.Status) {
      process.stderr.write('  !  GitHub Project has no Status field. Status updates skipped.\n');
      projectCtx = null;
    }
  }

  // --- Helper: update project status for a single issue ---
  function syncProjectStatus(issueNumber, filePath, label) {
    if (!projectCtx) return false;

    const content = safeReadFile(filePath);
    if (!content) return false;

    const metadata = extractStoryMetadata(content);
    const localStatus = metadata.status;
    if (!localStatus) {
      process.stderr.write(`  —  ${label} has no Status field. Skipping project status update.\n`);
      return false;
    }

    const statusField = projectCtx.fields.Status;
    const statusOptionId = statusField.options?.[localStatus];
    if (!statusOptionId) {
      process.stderr.write(`  !  GitHub Project has no status option "${localStatus}". Skipping status update for ${label}.\n`);
      return false;
    }

    // Look up project item ID via GraphQL (direct query — no pagination issues)
    const repoParts = repo.split('/');
    const repoOwner = repoParts[0];
    const repoName = repoParts[1] || repoParts[0];
    const itemQuery = `query { repository(owner: \\"${repoOwner}\\", name: \\"${repoName}\\") { issue(number: ${issueNumber}) { projectItems(first: 10) { nodes { id project { id } } } } } }`;
    const itemResult = execCommand(
      `gh api graphql -f query="${itemQuery}"`,
      cwd
    );
    let itemId = null;
    if (itemResult) {
      try {
        const parsed = JSON.parse(itemResult);
        const nodes = parsed.data?.repository?.issue?.projectItems?.nodes || [];
        const match = nodes.find(n => n.project?.id === projectCtx.project_id);
        itemId = match?.id || null;
      } catch {}
    }
    if (!itemId) {
      process.stderr.write(`  !  ${label} #${issueNumber} not found in GitHub Project. Skipping status update.\n`);
      return false;
    }

    const statusOk = execCommand(
      `gh project item-edit --project-id ${projectCtx.project_id} --id ${itemId} --field-id ${statusField.id} --single-select-option-id ${statusOptionId}`,
      cwd
    );
    if (statusOk !== null) {
      process.stderr.write(`  +  Updated ${label} #${issueNumber} project status → "${localStatus}".\n`);
      return true;
    } else {
      process.stderr.write(`  x  FAILED to update ${label} #${issueNumber} project status.\n`);
      return false;
    }
  }

  // --- Sync story issue ---
  const storyPath = path.isAbsolute(storyFile) ? storyFile : path.join(cwd, storyFile);
  const storyIssue = extractIssueNumberFromFile(cwd, storyFile);

  if (!storyIssue) {
    result.story.error = 'No GitHub issue linked';
    process.stderr.write('  —  Story has no GitHub issue linked. Skipping.\n');
  } else {
    result.story.number = storyIssue;
    const safePath = storyPath.replace(/\\/g, '/');
    try {
      execSync(`gh issue edit ${storyIssue} --repo ${repo} --body-file "${safePath}"`, {
        cwd, shell: 'bash', stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8', timeout: 30000,
      });
      result.story.updated = true;
      process.stderr.write(`  +  Updated GitHub story issue #${storyIssue}.\n`);
    } catch (e) {
      result.story.error = (e.stderr || e.message || 'unknown error').trim();
      process.stderr.write(`  x  FAILED to update GitHub story issue #${storyIssue}.\n`);
      process.stderr.write(`     Error: ${result.story.error}\n`);
    }

    if (result.story.updated) {
      result.story.status_synced = syncProjectStatus(storyIssue, storyPath, 'Story');
    }
  }

  // --- Sync feature issue ---
  const featureFile = params.feature_file;
  if (featureFile) {
    const featurePath = path.isAbsolute(featureFile) ? featureFile : path.join(cwd, featureFile);
    const featureIssue = extractIssueNumberFromFile(cwd, featureFile);

    if (!featureIssue) {
      result.feature.error = 'No GitHub issue linked';
      process.stderr.write('  —  Feature has no GitHub issue linked. Skipping.\n');
    } else {
      result.feature.number = featureIssue;
      const safePath = featurePath.replace(/\\/g, '/');
      try {
        execSync(`gh issue edit ${featureIssue} --repo ${repo} --body-file "${safePath}"`, {
          cwd, shell: 'bash', stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8', timeout: 30000,
        });
        result.feature.updated = true;
        process.stderr.write(`  +  Updated GitHub feature issue #${featureIssue}.\n`);
      } catch (e) {
        result.feature.error = (e.stderr || e.message || 'unknown error').trim();
        process.stderr.write(`  x  FAILED to update GitHub feature issue #${featureIssue}.\n`);
        process.stderr.write(`     Error: ${result.feature.error}\n`);
      }

      if (result.feature.updated) {
        result.feature.status_synced = syncProjectStatus(featureIssue, featurePath, 'Feature');
      }
    }
  }

  output(result, raw);
}

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
    error('Usage: ace-tools <command> [args] [--raw]\nCommands: load-config, resolve-model, verify-path-exists, generate-slug, current-timestamp, ensure-settings, write-github-settings, write-agent-teams, sync-agent-teams, init');
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

    case 'write-agent-teams': {
      cmdWriteAgentTeamsSetting(cwd, raw, args.slice(1));
      break;
    }

    case 'sync-agent-teams': {
      cmdSyncAgentTeams(cwd, raw);
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
        case 'plan-story':
          cmdInitPlanStory(cwd, raw, args.slice(2).join(' '));
          break;
        case 'research-story':
          cmdInitResearchStory(cwd, raw, args.slice(2).join(' '));
          break;
        case 'execute-story':
          cmdInitExecuteStory(cwd, raw, args.slice(2).join(' '));
          break;
        case 'setup-github':
          cmdSetupGithubProject(cwd, raw);
          break;
        default:
          error('Unknown init subcommand. Available: new-project, product-vision, coding-standards, map-system, map-subsystem, plan-backlog, plan-feature, plan-story, research-story, execute-story, setup-github');
      }
      break;
    }

    case 'story': {
      const storySubcommand = args[1];
      const storyArgs = args.slice(2);
      switch (storySubcommand) {
        case 'update-state':
          cmdStoryUpdateState(cwd, raw, storyArgs);
          break;
        default:
          error('Unknown story subcommand. Available: update-state');
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
        case 'sync-story':
          cmdGithubSyncStory(cwd, raw, githubArgs);
          break;
        case 'fetch-issues':
          cmdGithubFetchIssues(cwd, raw, githubArgs);
          break;
        default:
          error('Unknown github subcommand. Available: resolve-fields, create-issue, update-issue, sync-story, fetch-issues');
      }
      break;
    }

    default:
      error(`Unknown command: ${command}\nAvailable: load-config, resolve-model, verify-path-exists, generate-slug, current-timestamp, ensure-settings, write-github-settings, write-agent-teams, sync-agent-teams, init, story, github`);
  }
}

main();
