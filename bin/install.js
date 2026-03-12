#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

const VERSION = '0.1.0';

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
    commandsDir: 'commands',
    agentsDir: 'agents',
    supportsLocal: true,
  },
  opencode: {
    name: 'Crush',
    description: 'Crush AI coding assistant (formerly OpenCode)',
    globalDir: '.opencode',
    commandsDir: 'commands',
    agentsDir: 'agents',
    supportsLocal: true,
  },
};

// The folder name installed inside the config directory (e.g. ~/.claude/agile-context-engineering/)
const ACE_DIR_NAME = 'agile-context-engineering';

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
    help: args.includes('--help') || args.includes('-h'),
    version: args.includes('--version') || args.includes('-v'),
  };
  return flags;
}

function showHelp() {
  log(`
Usage: npx agile-context-engineering [options]

Options:
  --claude      Install for Claude Code only
  --opencode    Install for Crush (formerly OpenCode)
  --all         Install for all supported runtimes
  --global      Install globally (~/.claude, ~/.opencode)
  --local       Install locally (.claude, .opencode)
  -h, --help    Show this help message
  -v, --version Show version number

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
const TRANSFORMABLE_EXTENSIONS = new Set(['.md', '.xml']);

// Transform file content for a target runtime (replaces .claude/ paths with target runtime paths)
function transformForRuntime(content, runtime) {
  if (runtime === 'claude') return content; // Source files already use .claude paths
  const targetDir = RUNTIMES[runtime].globalDir; // e.g. '.opencode'
  // Replace path references: ~/.claude/ → ~/.opencode/, .claude/settings → .opencode/settings, etc.
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
        // Transform path references for non-Claude runtimes
        const content = fs.readFileSync(srcPath, 'utf-8');
        fs.writeFileSync(destPath, transformForRuntime(content, runtime), 'utf-8');
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

// Install ACE for a runtime (Claude Code or Crush)
function installForRuntime(runtime, scope, packageDir) {
  const config = RUNTIMES[runtime];
  const basePath = getBasePath(runtime, scope);
  const commandsPath = path.join(basePath, config.commandsDir);
  const agentsPath = path.join(basePath, config.agentsDir);
  const acePath = path.join(basePath, ACE_DIR_NAME);

  // Source directories
  const srcCommands = path.join(packageDir, 'commands');
  const srcAgents = path.join(packageDir, 'agents');
  const srcTemplates = path.join(packageDir, 'agile-context-engineering', 'templates');
  const srcUtils = path.join(packageDir, 'agile-context-engineering', 'utils');
  const srcWorkflows = path.join(packageDir, 'agile-context-engineering', 'workflows');
  const srcTools = path.join(packageDir, 'agile-context-engineering', 'src');

  log(`\nInstalling ACE for ${config.name}...`, colors.cyan);
  log(`  Target: ${basePath}`, colors.dim);

  // Clean previous ACE installation to remove stale files from renamed/deleted commands
  const aceCommandsPath = path.join(commandsPath, 'ace');
  if (fs.existsSync(aceCommandsPath)) {
    fs.rmSync(aceCommandsPath, { recursive: true });
  }
  if (fs.existsSync(agentsPath)) {
    // Only remove ace-* agent files, preserve non-ACE agents
    for (const f of fs.readdirSync(agentsPath)) {
      if (f.startsWith('ace-')) {
        fs.rmSync(path.join(agentsPath, f), { recursive: true });
      }
    }
  }
  if (fs.existsSync(acePath)) {
    fs.rmSync(acePath, { recursive: true });
  }

  // Create directories
  fs.mkdirSync(commandsPath, { recursive: true });
  fs.mkdirSync(agentsPath, { recursive: true });
  fs.mkdirSync(acePath, { recursive: true });

  // Copy commands (transform paths for target runtime)
  if (fs.existsSync(srcCommands)) {
    copyDir(srcCommands, commandsPath, runtime);
    log(`  ✓ Commands installed`, colors.green);
  }

  // Copy agents (transform paths for target runtime)
  if (fs.existsSync(srcAgents)) {
    copyDir(srcAgents, agentsPath, runtime);
    log(`  ✓ Agents installed`, colors.green);
  }

  // Copy templates into agile-context-engineering/
  if (fs.existsSync(srcTemplates)) {
    copyDir(srcTemplates, path.join(acePath, 'templates'), runtime);
    log(`  ✓ Templates installed`, colors.green);
  }

  // Copy utils into agile-context-engineering/
  if (fs.existsSync(srcUtils)) {
    copyDir(srcUtils, path.join(acePath, 'utils'), runtime);
    log(`  ✓ Utils installed`, colors.green);
  }

  // Copy workflows into agile-context-engineering/
  if (fs.existsSync(srcWorkflows)) {
    copyDir(srcWorkflows, path.join(acePath, 'workflows'), runtime);
    log(`  ✓ Workflows installed`, colors.green);
  }

  // Copy src (ace-tools) into agile-context-engineering/
  if (fs.existsSync(srcTools)) {
    copyDir(srcTools, path.join(acePath, 'src'), runtime);
    log(`  ✓ Tools installed`, colors.green);
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

  // Determine package directory (where this script is located)
  const packageDir = path.join(__dirname, '..');

  let runtimes = [];
  let scope = null;

  // Check if non-interactive mode
  const hasRuntimeFlag = flags.claude || flags.opencode || flags.all;
  const hasScopeFlag = flags.global || flags.local;
  const isInteractive = !hasRuntimeFlag && !hasScopeFlag;

  if (isInteractive) {
    const rl = createPrompt();

    // Ask for runtime selection (multiple choice)
    runtimes = await askMultiple(rl, '\nWhich runtime(s) do you want to install ACE for?', [
      { label: 'Claude Code', value: 'claude', description: "Anthropic's Claude Code CLI" },
      { label: 'Crush', value: 'opencode', description: 'Crush AI coding assistant (formerly OpenCode)' },
    ]);

    // Ask for scope
    scope = await ask(rl, '\nWhere should ACE be installed?', [
      { label: 'Global', value: 'global', description: 'Install in home directory (~/.claude, ~/.opencode)' },
      { label: 'Local', value: 'local', description: 'Install in current project (.claude, .opencode)' },
    ]);

    rl.close();
  } else {
    // Non-interactive mode
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
    const installedPath = installForRuntime(runtime, scope, packageDir);
    installedPaths.push({ runtime, name: RUNTIMES[runtime].name, path: installedPath });
  }

  // Show success message
  log(`\n${'═'.repeat(50)}`, colors.green);
  log(`  ACE installed successfully!`, colors.green + colors.bright);
  log(`${'═'.repeat(50)}`, colors.green);

  log(`\nInstalled locations:`, colors.cyan);
  for (const { name, path: p } of installedPaths) {
    log(`  ${name}: ${p}`, colors.dim);
  }

  log(`\nInstalled structure:`, colors.cyan);
  for (const { name, path: p } of installedPaths) {
    log(`  ${p}/`, colors.dim);
    log(`    commands/ace/       Slash commands`, colors.dim);
    log(`    agents/             Agent definitions`, colors.dim);
    log(`    ${ACE_DIR_NAME}/`, colors.dim);
    log(`      templates/        Project & artifact templates`, colors.dim);
    log(`      utils/            Formatting & utility guides`, colors.dim);
    log(`      workflows/        Workflow definitions`, colors.dim);
  }

  log(`\nAvailable commands:`, colors.cyan);
  log(`  /ace:help          Check project status and next steps`, colors.dim);
  log(`  /ace:plan-project  Plan your project with epics and features`, colors.dim);
  log(`  /ace:plan-epic     Plan an epic with features and stories`, colors.dim);
  log(`  /ace:plan-feature  Plan a feature with stories`, colors.dim);
  log(`  /ace:plan-story    Plan a story with tasks`, colors.dim);
  log(`  /ace:refine-story  Refine a story for execution`, colors.dim);
  log(`  /ace:execute-story Execute a story`, colors.dim);
  log(`  /ace:verify-story  Verify a completed story`, colors.dim);

  log(`\nGet started:`, colors.cyan);
  log(`  1. Navigate to your project directory`, colors.dim);
  log(`  2. Run /ace:help to initialize ACE`, colors.dim);
  log(`  3. Run /ace:plan-project to start planning\n`, colors.dim);
}

main().catch((err) => {
  log(`Error: ${err.message}`, colors.red);
  process.exit(1);
});
