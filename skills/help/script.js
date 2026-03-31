#!/usr/bin/env node

/**
 * help skill script — Entry point for all ace-tools operations
 * needed by the help skill.
 *
 * Subcommands:
 *   init                             Environment detection for help workflow
 *   ensure-settings                  Create .ace/settings.json with defaults if missing
 *   setup-github                     Detect gh CLI, repo, and list GitHub Projects
 *   write-github-settings            Write GitHub Project settings (key=value args)
 *   sync-agent-teams                 Sync agent_teams from runtime settings to .ace/settings.json
 *   write-agent-teams <true|false>   Enable/disable agent teams in ACE + runtime settings
 *   verify-path-exists <path>        Check file/directory existence
 *
 * Usage: node script.js <subcommand> [args] [--raw]
 */

const fs = require('fs');
const path = require('path');

const {
  loadConfig, pathExists, resolveModel,
  detectBrownfieldStatus, loadSettings, writeSettings,
  output, error, runSkillScript,
} = require('../../shared/lib/ace-core');

// ─── Runtime Config Dir ─────────────────────────────────────────────────────

/**
 * Detect the runtime config directory name.
 * In the plugin context, the script lives at:
 *   <base>/<config-dir>/skills/help/script.js
 * Default to '.claude' since the plugin always runs in Claude Code.
 */
function getRuntimeConfigDirName() {
  try {
    const skillDir = __dirname;                // <base>/<config-dir>/skills/help
    const skillsDir = path.dirname(skillDir);  // <base>/<config-dir>/skills
    const configDir = path.dirname(skillsDir); // <base>/<config-dir>
    const dirName = path.basename(configDir);
    if (dirName === '.opencode' || dirName === '.claude') {
      return dirName;
    }
  } catch {}
  return '.claude';
}

const RUNTIME_CONFIG_DIR = getRuntimeConfigDirName();

// ─── CLI Dispatch ────────────────────────────────────────────────────────────

runSkillScript({
  init: cmdInit,
  'ensure-settings': (cwd, raw) => cmdEnsureSettings(cwd, raw),
  'setup-github': (cwd, raw) => cmdSetupGithubProject(cwd, raw),
  'write-github-settings': (cwd, raw, args) => cmdWriteGithubSettings(cwd, raw, args),
  'sync-agent-teams': (cwd, raw) => cmdSyncAgentTeams(cwd, raw),
  'write-agent-teams': (cwd, raw, args) => cmdWriteAgentTeamsSetting(cwd, raw, args),
  'verify-path-exists': (cwd, raw, args, parsed) => {
    const targetPath = parsed._positional || args[0];
    if (!targetPath) error('path required for verify-path-exists');
    const exists = pathExists(cwd, targetPath);
    output({ exists, path: targetPath }, raw, exists ? 'true' : 'false');
  },
});

// ─── Init: Help ─────────────────────────────────────────────────────────────

/**
 * Environment detection for the help workflow (project status dashboard).
 * Detects: git, gh CLI, brownfield status, wiki state, product artifacts.
 */
function cmdInit(cwd, raw) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  const result = {
    // Models (pre-resolved so workflows know which model to spawn each agent with)
    product_owner_model: resolveModel(cwd, 'ace-product-owner'),
    researcher_model: resolveModel(cwd, 'ace-project-researcher'),
    synthesizer_model: resolveModel(cwd, 'ace-research-synthesizer'),

    // Config
    commit_docs: config.commit_docs,

    // Existing state
    has_product_vision: pathExists(cwd, '.docs/product/product-vision.md'),
    has_system_architecture: pathExists(cwd, '.docs/wiki/system-wide/system-architecture.md'),
    has_system_structure: pathExists(cwd, '.docs/wiki/system-wide/system-structure.md'),
    has_coding_standards: pathExists(cwd, '.docs/wiki/system-wide/coding-standards.md'),
    has_testing_framework: pathExists(cwd, '.docs/wiki/system-wide/testing-framework.md'),
    project_exists: pathExists(cwd, '.docs/product/product-vision.md'),
    has_codebase_map: pathExists(cwd, '.ace/codebase'),
    planning_exists: pathExists(cwd, '.ace'),

    // Brownfield detection
    ...brownfield,
    needs_codebase_map: brownfield.is_brownfield && !pathExists(cwd, '.ace/codebase'),

    // Git state
    has_git: pathExists(cwd, '.git'),

    // GitHub CLI
    has_gh_cli: (() => {
      try {
        const { execSync } = require('child_process');
        execSync('gh --version', { stdio: 'pipe' });
        return true;
      } catch { return false; }
    })(),
  };

  output(result, raw);
}

// ─── Ensure Settings ────────────────────────────────────────────────────────

function cmdEnsureSettings(cwd, raw) {
  const settingsPath = path.join(cwd, '.ace', 'settings.json');
  const alreadyExists = pathExists(cwd, '.ace/settings.json');

  if (!alreadyExists) {
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
    const defaults = JSON.parse(JSON.stringify(SETTINGS_DEFAULTS));
    writeSettings(cwd, defaults);
    output({ created: true, path: settingsPath, settings: defaults }, raw);
  } else {
    const settings = loadSettings(cwd);
    output({ created: false, path: settingsPath, settings }, raw);
  }
}

// ─── Setup GitHub Project ───────────────────────────────────────────────────

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

// ─── Write GitHub Settings ──────────────────────────────────────────────────

function cmdWriteGithubSettings(cwd, raw, extraArgs) {
  const settings = loadSettings(cwd);

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

// ─── Sync Agent Teams ───────────────────────────────────────────────────────

function cmdSyncAgentTeams(cwd, raw) {
  // Source of truth: runtime settings.json env var (e.g. .claude/settings.json)
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

// ─── Write Agent Teams Setting ──────────────────────────────────────────────

function cmdWriteAgentTeamsSetting(cwd, raw, extraArgs) {
  const enabled = extraArgs[0] === 'true';
  const settings = loadSettings(cwd);
  settings.agent_teams = enabled;
  writeSettings(cwd, settings);

  // Also update the project's runtime settings.json (e.g. .claude/)
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
