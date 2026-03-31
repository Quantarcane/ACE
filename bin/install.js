#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');
const { execSync } = require('child_process');

const VERSION = require('../package.json').version;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

// Runtime configurations
const RUNTIMES = {
  claude: {
    name: 'Claude Code',
    description: "Anthropic's Claude Code CLI",
    globalDir: '.claude',
    supportsPlugin: true,
  },
  opencode: {
    name: 'Crush',
    description: 'Crush AI coding assistant (formerly OpenCode)',
    globalDir: '.opencode',
    agentsDir: 'agents',
    supportsPlugin: false,
  },
};

const MARKETPLACE_NAME = 'ace-marketplace';

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function banner() {
  log(`
  ●●●   ●●●  ●●●●●
 ●   ●  ●    ●
 ●●●●●  ●    ●●●●
 ●   ●  ●    ●
 ●   ●  ●●●  ●●●●●
  `, colors.cyan);
  log(`  Agile Context Engineering v${VERSION}`, colors.bright);
  log(`  Spec-driven development for AI coding assistants\n`, colors.dim);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    claude: args.includes('--claude'),
    opencode: args.includes('--opencode'),
    all: args.includes('--all'),
    global: args.includes('--global'),
    local: args.includes('--local'),
    forceStatusline: args.includes('--force-statusline'),
    help: args.includes('--help') || args.includes('-h'),
    version: args.includes('--version') || args.includes('-v'),
  };
  return flags;
}

// Read or create settings.json
function readSettings(settingsPath) {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function showHelp() {
  log(`
Usage: npx agile-context-engineering [options]

Options:
  --claude      Install for Claude Code only
  --opencode    Install for Crush (formerly OpenCode)
  --all         Install for all supported runtimes
  --global      Install globally (~/.claude, ~/.opencode)
  --local             Install locally (.claude, .opencode)
  --force-statusline  Replace existing statusline configuration
  -h, --help          Show this help message
  -v, --version       Show version number

Examples:
  npx agile-context-engineering                    # Interactive installation
  npx agile-context-engineering --claude --local   # Claude Code, local install
  npx agile-context-engineering --opencode --global # Crush (formerly OpenCode), global install
  npx agile-context-engineering --all --global     # All runtimes, global install
`);
}

// Create readline interface for interactive prompts
function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function ask(rl, question, options) {
  return new Promise((resolve) => {
    log(question, colors.cyan);
    options.forEach((opt, i) => {
      log(`  ${i + 1}. ${opt.label}`, opt.description ? colors.bright : '');
      if (opt.description) {
        log(`     ${opt.description}`, colors.dim);
      }
    });
    rl.question(`\n${colors.yellow}Enter choice (1-${options.length}): ${colors.reset}`, (answer) => {
      const index = parseInt(answer) - 1;
      if (index >= 0 && index < options.length) {
        resolve(options[index].value);
      } else {
        log('Invalid choice, using default.', colors.red);
        resolve(options[0].value);
      }
    });
  });
}

async function askMultiple(rl, question, options) {
  return new Promise((resolve) => {
    log(question, colors.cyan);
    options.forEach((opt, i) => {
      log(`  ${i + 1}. ${opt.label}`, colors.bright);
      if (opt.description) {
        log(`     ${opt.description}`, colors.dim);
      }
    });
    log(`\n  Enter numbers separated by commas (e.g., 1,2) or 'all'`, colors.dim);
    rl.question(`\n${colors.yellow}Your choice: ${colors.reset}`, (answer) => {
      if (answer.toLowerCase() === 'all') {
        resolve(options.map(o => o.value));
      } else {
        const indices = answer.split(',').map(s => parseInt(s.trim()) - 1);
        const selected = indices
          .filter(i => i >= 0 && i < options.length)
          .map(i => options[i].value);
        if (selected.length === 0) {
          log('Invalid choice, using first option.', colors.red);
          resolve([options[0].value]);
        } else {
          resolve(selected);
        }
      }
    });
  });
}

// Get installation paths based on runtime and scope
function getBasePath(runtime, scope) {
  const home = os.homedir();
  const cwd = process.cwd();
  const config = RUNTIMES[runtime];

  return scope === 'global'
    ? path.join(home, config.globalDir)
    : path.join(cwd, config.globalDir);
}

// File extensions that contain path references needing runtime transformation
const TRANSFORMABLE_EXTENSIONS = new Set(['.md', '.xml', '.js']);

// Transform file content for a target runtime (replaces .claude/ paths with target runtime paths)
function transformForRuntime(content, runtime) {
  if (runtime === 'claude') return content; // Source files already use .claude paths
  const targetDir = RUNTIMES[runtime].globalDir; // e.g. '.opencode'
  return content.replace(/\.claude\//g, `${targetDir}/`);
}

// Copy directory recursively, optionally transforming text file content for the target runtime
function copyDir(src, dest, runtime) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, runtime);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (runtime !== 'claude' && TRANSFORMABLE_EXTENSIONS.has(ext)) {
        const content = fs.readFileSync(srcPath, 'utf-8');
        fs.writeFileSync(destPath, transformForRuntime(content, runtime), 'utf-8');
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

// Check if claude CLI is available
function hasClaudeCli() {
  try {
    execSync('claude --version', { encoding: 'utf8', stdio: 'pipe', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

// Run a claude CLI command, return { success, output }
function runClaude(args) {
  try {
    const output = execSync(`claude ${args}`, { encoding: 'utf8', stdio: 'pipe', windowsHide: true, timeout: 30000 });
    return { success: true, output: output.trim() };
  } catch (e) {
    return { success: false, output: (e.stderr || e.message || '').trim() };
  }
}

// Clean up old standalone ACE installation from ~/.claude/
function cleanLegacyInstall(basePath) {
  const dirsToClean = [
    path.join(basePath, 'skills'),
    path.join(basePath, 'shared'),
    path.join(basePath, '.claude-plugin'),
    path.join(basePath, 'agile-context-engineering'), // pre-plugin legacy
  ];
  const commandsAce = path.join(basePath, 'commands', 'ace');
  if (fs.existsSync(commandsAce)) {
    dirsToClean.push(commandsAce);
  }

  let cleaned = false;
  for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
      cleaned = true;
    }
  }

  // Clean ace-* agents
  const agentsPath = path.join(basePath, 'agents');
  if (fs.existsSync(agentsPath)) {
    for (const f of fs.readdirSync(agentsPath)) {
      if (f.startsWith('ace-')) {
        fs.rmSync(path.join(agentsPath, f), { recursive: true });
        cleaned = true;
      }
    }
  }

  // Clean legacy hooks from settings.json
  const settingsPath = path.join(basePath, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      let modified = false;

      // Remove ACE SessionStart hooks (now handled by plugin hooks.json)
      if (settings.hooks?.SessionStart) {
        const before = settings.hooks.SessionStart.length;
        settings.hooks.SessionStart = settings.hooks.SessionStart.filter(entry =>
          !(entry.hooks && entry.hooks.some(h => h.command && h.command.includes('ace-')))
        );
        if (settings.hooks.SessionStart.length === 0) {
          delete settings.hooks.SessionStart;
        }
        if (Object.keys(settings.hooks).length === 0) {
          delete settings.hooks;
        }
        if (settings.hooks?.SessionStart?.length !== before) {
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
      }
    } catch {}
  }

  return cleaned;
}

// Install ACE for Claude Code using the plugin marketplace system
function installForClaude(scope, packageDir, flags) {
  const basePath = getBasePath('claude', scope);

  log(`\nInstalling ACE for Claude Code (plugin marketplace)...`, colors.cyan);
  log(`  Scope: ${scope}`, colors.dim);

  // Step 1: Clean old standalone install
  const hadLegacy = cleanLegacyInstall(basePath);
  if (hadLegacy) {
    log(`  ✓ Cleaned legacy standalone installation`, colors.green);
  }

  // Step 2: Clean old cached plugin versions
  const aceCacheDir = path.join(basePath, 'plugins', 'cache', MARKETPLACE_NAME, 'ace');
  if (fs.existsSync(aceCacheDir)) {
    const cachedVersions = fs.readdirSync(aceCacheDir);
    if (cachedVersions.length > 0) {
      for (const ver of cachedVersions) {
        fs.rmSync(path.join(aceCacheDir, ver), { recursive: true });
      }
      log(`  ✓ Cleaned ${cachedVersions.length} old cached version(s)`, colors.green);
    }
  }

  // Step 3: Check for claude CLI
  if (!hasClaudeCli()) {
    log(`  ✗ Claude CLI not found in PATH`, colors.red);
    log(`    Install Claude Code first: https://code.claude.com/docs/en/quickstart`, colors.dim);
    return { success: false, path: basePath };
  }

  // Step 4: Add/update marketplace from this package directory
  // First check if marketplace already exists
  const listResult = runClaude('plugin marketplace list --json');
  let marketplaceExists = false;
  if (listResult.success) {
    try {
      // Check output for our marketplace name
      marketplaceExists = listResult.output.includes(MARKETPLACE_NAME);
    } catch {}
  }

  const packageDirUnix = packageDir.replace(/\\/g, '/');

  if (marketplaceExists) {
    // Update existing marketplace to pick up changes
    const updateResult = runClaude(`plugin marketplace update ${MARKETPLACE_NAME}`);
    if (updateResult.success) {
      log(`  ✓ Updated ACE marketplace`, colors.green);
    } else {
      // If update fails, remove and re-add
      runClaude(`plugin marketplace remove ${MARKETPLACE_NAME}`);
      const addResult = runClaude(`plugin marketplace add "${packageDirUnix}"`);
      if (addResult.success) {
        log(`  ✓ Re-added ACE marketplace`, colors.green);
      } else {
        log(`  ✗ Failed to add marketplace: ${addResult.output}`, colors.red);
        return { success: false, path: basePath };
      }
    }
  } else {
    const addResult = runClaude(`plugin marketplace add "${packageDirUnix}"`);
    if (addResult.success) {
      log(`  ✓ Added ACE marketplace`, colors.green);
    } else {
      log(`  ✗ Failed to add marketplace: ${addResult.output}`, colors.red);
      return { success: false, path: basePath };
    }
  }

  // Step 5: Install or update the ACE plugin
  const pluginId = `ace@${MARKETPLACE_NAME}`;
  const scopeFlag = scope === 'global' ? '--scope user' : `--scope ${scope}`;

  // Try install first; if already installed, try update
  const installResult = runClaude(`plugin install ${pluginId} ${scopeFlag}`);
  if (installResult.success) {
    log(`  ✓ ACE plugin installed`, colors.green);
  } else if (installResult.output.includes('already installed') || installResult.output.includes('already enabled')) {
    const updateResult = runClaude(`plugin update ${pluginId} ${scopeFlag}`);
    if (updateResult.success) {
      log(`  ✓ ACE plugin updated`, colors.green);
    } else {
      log(`  ⚠ Plugin update note: ${updateResult.output}`, colors.yellow);
    }
  } else {
    log(`  ✗ Failed to install plugin: ${installResult.output}`, colors.red);
    return { success: false, path: basePath };
  }

  // Step 6: Configure statusline (not part of plugin hooks — goes in settings.json)
  configureStatusline(basePath, flags);

  return { success: true, path: basePath };
}

// Configure the ACE statusline in settings.json
function configureStatusline(basePath, flags) {
  const settingsPath = path.join(basePath, 'settings.json');
  const settings = readSettings(settingsPath);

  // Statusline is a settings.json config, not a plugin hook, so CLAUDE_PLUGIN_ROOT
  // is not available. We write a thin wrapper to ~/.claude/hooks/ that finds the
  // installed plugin's statusline script at runtime.
  const wrapperPath = path.join(basePath, 'hooks', 'ace-statusline-wrapper.js');
  const wrapperDir = path.join(basePath, 'hooks');
  if (!fs.existsSync(wrapperDir)) {
    fs.mkdirSync(wrapperDir, { recursive: true });
  }

  // Write a thin wrapper that finds the ace plugin statusline script
  fs.writeFileSync(wrapperPath, `#!/usr/bin/env node
// ACE statusline wrapper — finds the installed plugin's statusline script
const fs = require('fs');
const path = require('path');
const home = require('os').homedir();

// Search plugin cache for ace plugin's statusline
const cacheDir = path.join(home, '.claude', 'plugins', 'cache');
let scriptPath = null;

function findScript(dir, depth) {
  if (depth > 5 || !fs.existsSync(dir)) return false;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (findScript(full, depth + 1)) return true;
    } else if (entry.name === 'ace-statusline.js' && dir.includes('ace')) {
      scriptPath = full;
      return true;
    }
  }
  return false;
}

if (fs.existsSync(cacheDir)) {
  findScript(cacheDir, 0);
}

if (scriptPath) {
  // Pipe stdin through to the actual script
  const { spawn } = require('child_process');
  const child = spawn(process.execPath, [scriptPath], {
    stdio: ['pipe', 'inherit', 'inherit'],
    windowsHide: true
  });
  process.stdin.pipe(child.stdin);
  child.on('exit', (code) => process.exit(code || 0));
} else {
  // Fallback: basic statusline
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const model = data.model?.display_name || 'Claude';
      const dir = path.basename(data.workspace?.current_dir || process.cwd());
      process.stdout.write(model + ' | ' + dir);
    } catch {}
  });
}
`, 'utf-8');

  const statuslineCmd = `node "${wrapperPath.replace(/\\/g, '/')}"`;

  const hasExisting = settings.statusLine != null;
  const isAceStatusline = hasExisting && settings.statusLine.command &&
    (settings.statusLine.command.includes('ace-statusline') || settings.statusLine.command.includes('ace-'));

  if (!hasExisting || flags.forceStatusline) {
    settings.statusLine = { type: 'command', command: statuslineCmd };
    log(`  ✓ Configured statusline`, colors.green);
  } else if (isAceStatusline) {
    settings.statusLine = { type: 'command', command: statuslineCmd };
    log(`  ✓ Updated statusline`, colors.green);
  } else {
    log(`  ⚠ Skipping statusline (already configured, use --force-statusline to replace)`, colors.yellow);
  }

  // Write settings
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

// Install ACE for Crush (legacy copy approach — no plugin system)
function installForCrush(scope, packageDir) {
  const config = RUNTIMES.opencode;
  const basePath = getBasePath('opencode', scope);
  const agentsPath = path.join(basePath, config.agentsDir);

  const srcSkills = path.join(packageDir, 'skills');
  const srcShared = path.join(packageDir, 'shared');
  const srcPlugin = path.join(packageDir, '.claude-plugin');
  const srcAgents = path.join(packageDir, 'agents');

  log(`\nInstalling ACE for ${config.name} (legacy copy)...`, colors.cyan);
  log(`  Target: ${basePath}`, colors.dim);

  // Clean previous installation
  const skillsPath = path.join(basePath, 'skills');
  const sharedPath = path.join(basePath, 'shared');
  const pluginPath = path.join(basePath, '.claude-plugin');
  const legacyPath = path.join(basePath, 'agile-context-engineering');

  for (const p of [skillsPath, sharedPath, pluginPath, legacyPath]) {
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true });
  }
  if (fs.existsSync(agentsPath)) {
    for (const f of fs.readdirSync(agentsPath)) {
      if (f.startsWith('ace-')) fs.rmSync(path.join(agentsPath, f), { recursive: true });
    }
  }

  fs.mkdirSync(agentsPath, { recursive: true });

  if (fs.existsSync(srcSkills)) {
    copyDir(srcSkills, skillsPath, 'opencode');
    log(`  ✓ Skills installed`, colors.green);
  }
  if (fs.existsSync(srcShared)) {
    copyDir(srcShared, sharedPath, 'opencode');
    log(`  ✓ Shared libs installed`, colors.green);
  }
  if (fs.existsSync(srcPlugin)) {
    copyDir(srcPlugin, pluginPath, 'opencode');
    log(`  ✓ Plugin manifest installed`, colors.green);
  }
  if (fs.existsSync(srcAgents)) {
    copyDir(srcAgents, agentsPath, 'opencode');
    log(`  ✓ Agents installed`, colors.green);
  }

  // Write VERSION file
  const versionFile = path.join(sharedPath, 'VERSION');
  if (!fs.existsSync(sharedPath)) fs.mkdirSync(sharedPath, { recursive: true });
  fs.writeFileSync(versionFile, VERSION, 'utf-8');

  // Copy CHANGELOG.md
  const changelogSrc = path.join(packageDir, 'CHANGELOG.md');
  const changelogDest = path.join(sharedPath, 'CHANGELOG.md');
  if (fs.existsSync(changelogSrc)) {
    fs.copyFileSync(changelogSrc, changelogDest);
  }

  return basePath;
}

// Main installation logic
async function main() {
  const flags = parseArgs();

  if (flags.version) {
    log(`ACE v${VERSION}`);
    process.exit(0);
  }

  if (flags.help) {
    banner();
    showHelp();
    process.exit(0);
  }

  banner();

  const packageDir = path.join(__dirname, '..');

  let runtimes = [];
  let scope = null;

  const hasRuntimeFlag = flags.claude || flags.opencode || flags.all;
  const hasScopeFlag = flags.global || flags.local;
  const isInteractive = !hasRuntimeFlag && !hasScopeFlag;

  if (isInteractive) {
    const rl = createPrompt();

    runtimes = await askMultiple(rl, '\nWhich runtime(s) do you want to install ACE for?', [
      { label: 'Claude Code', value: 'claude', description: "Anthropic's Claude Code CLI" },
      { label: 'Crush', value: 'opencode', description: 'Crush AI coding assistant (formerly OpenCode)' },
    ]);

    scope = await ask(rl, '\nWhere should ACE be installed?', [
      { label: 'Global', value: 'global', description: 'Install in home directory (~/.claude, ~/.opencode)' },
      { label: 'Local', value: 'local', description: 'Install in current project (.claude, .opencode)' },
    ]);

    rl.close();
  } else {
    if (flags.all) {
      runtimes = ['claude', 'opencode'];
    } else {
      if (flags.claude) runtimes.push('claude');
      if (flags.opencode) runtimes.push('opencode');
    }

    if (runtimes.length === 0) {
      log('Error: No runtime specified. Use --claude, --opencode (Crush), or --all', colors.red);
      process.exit(1);
    }

    if (flags.global && flags.local) {
      log('Error: Cannot specify both --global and --local', colors.red);
      process.exit(1);
    }

    scope = flags.local ? 'local' : 'global';
  }

  // Perform installation
  const installedPaths = [];

  for (const runtime of runtimes) {
    if (runtime === 'claude') {
      const result = installForClaude(scope, packageDir, flags);
      installedPaths.push({ runtime, name: 'Claude Code', ...result });
    } else {
      const p = installForCrush(scope, packageDir);
      installedPaths.push({ runtime, name: RUNTIMES[runtime].name, path: p, success: true });
    }
  }

  const anyFailed = installedPaths.some(p => !p.success);

  // Show success message
  log(`\n${'═'.repeat(50)}`, anyFailed ? colors.yellow : colors.green);
  log(`  ACE installation ${anyFailed ? 'completed with warnings' : 'complete'}!`, (anyFailed ? colors.yellow : colors.green) + colors.bright);
  log(`${'═'.repeat(50)}`, anyFailed ? colors.yellow : colors.green);

  for (const { name: runtimeName, success } of installedPaths) {
    if (success) {
      log(`  ✓ ${runtimeName}: installed`, colors.green);
    } else {
      log(`  ✗ ${runtimeName}: failed (see errors above)`, colors.red);
    }
  }

  log(`\nAvailable skills:`, colors.cyan);
  log(`  /ace:help                    Check project status and next steps`, colors.dim);
  log(`  /ace:plan-product-vision     Create or update the product vision`, colors.dim);
  log(`  /ace:plan-backlog            Plan the product backlog`, colors.dim);
  log(`  /ace:plan-feature            Plan a feature with stories`, colors.dim);
  log(`  /ace:plan-story              Plan a story specification`, colors.dim);
  log(`  /ace:execute-story           Execute a planned story`, colors.dim);
  log(`  /ace:map-system              Map system-wide architecture`, colors.dim);
  log(`  /ace:map-subsystem           Map a subsystem's internals`, colors.dim);
  log(`  /ace:init-coding-standards   Generate coding standards`, colors.dim);

  log(`\nGet started:`, colors.cyan);
  log(`  1. Restart Claude Code (or run /reload-plugins)`, colors.dim);
  log(`  2. Run /ace:help to initialize ACE`, colors.dim);
  log(`  3. Run /ace:plan-product-vision to define your product\n`, colors.dim);
}

main().catch((err) => {
  log(`Error: ${err.message}`, colors.red);
  process.exit(1);
});
