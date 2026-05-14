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
  codex: {
    name: 'Codex',
    description: "OpenAI's Codex CLI",
    globalDir: '.codex',
    agentsDir: 'agents',
    supportsPlugin: false,
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
const CODEX_CONFIG_BEGIN = '# ACE Agent Configuration - managed by agile-context-engineering installer';
const CODEX_CONFIG_END = '# End ACE Agent Configuration';

const CODEX_AGENT_SANDBOX = {
  'ace-code-reviewer': 'read-only',
  'ace-code-discovery-analyst': 'read-only',
  'ace-code-integration-analyst': 'read-only',
  'code-discovery-analyst': 'read-only',
  'code-integration-analyst': 'read-only',
  'ace-project-researcher': 'read-only',
  'ace-research-synthesizer': 'workspace-write',
  'ace-product-owner': 'workspace-write',
  'ace-technical-application-architect': 'workspace-write',
  'technical-application-architect': 'workspace-write',
  'ace-wiki-mapper': 'workspace-write',
};

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
  const args = process.argv.slice(2).map(arg => arg.toLowerCase());
  const flags = {
    claude: args.includes('--claude'),
    codex: args.includes('--codex'),
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
  --codex       Install for Codex only
  --opencode    Install for Crush (formerly OpenCode)
  --all         Install for all supported runtimes
  --global      Install globally (~/.claude, ~/.codex, ~/.opencode)
  --local             Install locally (.claude, .codex, .opencode)
  --force-statusline  Replace existing statusline configuration
  -h, --help          Show this help message
  -v, --version       Show version number

Examples:
  npx agile-context-engineering                    # Interactive installation
  npx agile-context-engineering --claude --local   # Claude Code, local install
  npx agile-context-engineering --codex --global   # Codex, global install
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

  if (runtime === 'codex' && scope === 'global' && process.env.CODEX_HOME) {
    return path.resolve(process.env.CODEX_HOME);
  }

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
  return content
    .replace(/\.claude\//g, `${targetDir}/`)
    .replace(/\.claudeignore\b/g, `${targetDir}ignore`);
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

function toPosixPath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function replaceAceInvocations(content, codexStyle) {
  if (!codexStyle) return content;
  return content.replace(/\/ace:([a-z0-9-]+)/g, '$ace-$1');
}

function transformCodexSkillContent(content, skillName, skillDir) {
  const codexSkillRoot = toPosixPath(path.dirname(skillDir));
  let transformed = content
    .replace(/\.claude\//g, '.codex/')
    .replace(/\.claudeignore\b/g, '.codexignore')
    .replace(/\$\{CODEX_SKILL_ROOT\}/g, codexSkillRoot)
    .replace(/\$\{CLAUDE_SKILL_DIR\}/g, toPosixPath(skillDir))
    .replace(/"\$CLAUDE_SKILL_DIR\//g, `"${toPosixPath(skillDir)}/`)
    .replace(/\$CLAUDE_SKILL_DIR\//g, `${toPosixPath(skillDir)}/`)
    .replace(/CLAUDE_SKILL_DIR/g, 'CODEX_SKILL_DIR');

  transformed = replaceAceInvocations(transformed, true);

  if (path.basename(skillDir) === skillName && content.includes('---')) {
    transformed = transformed.replace(/^name:\s*.+$/m, `name: ace-${skillName}`);
  }

  return transformed;
}

function codexSkillAdapter(skillName, skillDir, sourceContent = '') {
  const posixSkillDir = toPosixPath(skillDir);
  const declaredAgent = (sourceContent.match(/^agent:\s*([^\r\n]+)/m)?.[1] || '').trim();
  const agentExecutionContract = declaredAgent ? `
## Codex Agent Execution Context
- This skill declares \`agent: ${declaredAgent}\`. When invoked from a parent/orchestrator session and \`spawn_agent\` is available, run this skill by spawning \`spawn_agent(agent_type="${declaredAgent}", message="Execute $ace-${skillName} with the provided arguments by reading ${posixSkillDir}/SKILL.md and its supporting resources. Do not spawn another agent just to satisfy the frontmatter agent field.")\`.
- If this skill is already running inside \`${declaredAgent}\`, execute the workflow inline and write the required artifacts directly.
- If this skill is running inside a delegated Codex pass agent where \`spawn_agent\` is not exposed, execute inline instead of failing solely because nested delegation is unavailable.
` : '';
  const planStorySubagentContract = skillName === 'plan-story' ? `
## ACE Plan Story Subagent Contract
- Invocation of \`$ace-plan-story\` is an explicit user request to run the full ACE story-planning orchestration, including the Phase 2 research subagents.
- Pass 2 wiki research, Pass 3 external analysis, Pass 4 integration analysis, and Pass 5 technical solution design are delegated passes. Codex MUST call \`spawn_agent(...)\` for each pass that runs.
- The plan-story orchestrator MUST spawn the final pass agent directly: \`ace-wiki-mapper\`, \`code-discovery-analyst\`, \`code-integration-analyst\`, or \`technical-application-architect\`. Do not spawn a default agent that invokes another ACE research skill.
- Do NOT complete Pass 2 wiki research, Pass 3 external analysis, Pass 4 integration analysis, or Pass 5 technical solution design inline in the plan-story orchestrator.
- If \`spawn_agent\` is unavailable, blocked, or cannot be used, STOP after Phase 1 and tell the user that ACE Phase 2 requires subagents. Do not write Relevant Wiki, \`integration-analysis.md\`, or \`## Technical Solution\` inline.
- Once a delegated pass agent is running, it owns that pass artifact and MUST execute its workflow inline. It must not try to spawn another agent just to satisfy the research skill's frontmatter \`agent:\` field.
- The orchestrator may edit requirements and acceptance criteria, but research and technical-solution sections must be produced only by the delegated pass agents.
` : '';
  return `<codex_skill_adapter>
## Codex Invocation
- Invoke this skill by mentioning \`$ace-${skillName}\`.
- Treat any user text after \`$ace-${skillName}\` as the command arguments.
- In examples copied from Claude Code, \`/ace:${skillName}\` means \`$ace-${skillName}\`.

## Runtime Compatibility
- This repository is authored as a Claude Code plugin. In Codex, the installer copies it to \`${posixSkillDir}\`.
- Claude's \`!\` resource expansion does not run in Codex. Before following the workflow, manually read the supporting files referenced near the top of this SKILL.md.
- When a workflow says \`AskUserQuestion\`, use Codex \`request_user_input\` if available; otherwise ask the user directly and continue with a reasonable default only when the choice is low risk.
- Invocation of \`$ace-${skillName}\` is an explicit user request to run this ACE skill's full workflow.
- When a workflow says \`Agent(...)\`, \`Task(...)\`, or a task block with \`subagent_type\`, and Codex exposes \`spawn_agent\` in the current session, call \`spawn_agent(...)\` for that pass.
- Map Claude subagent names to Codex agent types as follows: \`general-purpose\` -> \`default\`, \`Explore\` or \`explore\` -> \`explorer\`, \`ace-code-discovery-analyst\` -> \`code-discovery-analyst\`, \`ace-code-integration-analyst\` -> \`code-integration-analyst\`, \`ace-technical-application-architect\` -> \`technical-application-architect\`. Other \`ace-*\` agent names that exist in Codex remain unchanged.
- If the workflow marks an agent as \`run_in_background=true\`, save the returned \`spawn_agent\` id and use \`wait_agent\` when the workflow needs completion. Codex has no \`TaskGet\` or \`TaskOutput\`.
- Codex delegated pass agents may not expose \`spawn_agent\`. If this skill is already running inside the agent that owns the artifact, execute the workflow inline instead of failing solely because nested delegation is unavailable.
- A skill frontmatter \`agent:\` field or a process line like "For this command use the X agent" identifies the preferred execution context. It is not a nested delegation requirement when the skill is already executing inside that pass agent.
- Prefer commands that use the absolute skill path above. It keeps Windows and Linux shells from depending on a runtime-specific skill directory environment variable.
${agentExecutionContract}
${planStorySubagentContract}
</codex_skill_adapter>

`;
}

const CODEX_STRIPPED_SKILL_FIELDS = new Set([
  'allowed-tools',
  'argument-hint',
  'disable-model-invocation',
  'model',
  'effort',
]);

function filterCodexSkillFrontmatter(body) {
  const filtered = [];
  let skippingStrippedBlock = false;

  for (const line of body.split(/\r?\n/)) {
    const keyMatch = line.match(/^([A-Za-z0-9_-]+):/);
    if (keyMatch) {
      skippingStrippedBlock = CODEX_STRIPPED_SKILL_FIELDS.has(keyMatch[1]);
      if (!skippingStrippedBlock) filtered.push(line);
      continue;
    }

    if (skippingStrippedBlock && (/^\s/.test(line) || line.trim() === '')) {
      continue;
    }

    skippingStrippedBlock = false;
    filtered.push(line);
  }

  return filtered;
}

function copySkillsForCodex(srcSkills, destSkills) {
  if (!fs.existsSync(srcSkills)) return 0;
  fs.mkdirSync(destSkills, { recursive: true });

  for (const entry of fs.readdirSync(destSkills, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith('ace-')) {
      fs.rmSync(path.join(destSkills, entry.name), { recursive: true });
    }
  }

  let count = 0;
  for (const entry of fs.readdirSync(srcSkills, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillName = entry.name;
    const srcDir = path.join(srcSkills, skillName);
    const destDir = path.join(destSkills, `ace-${skillName}`);
    copyCodexSkillDir(srcDir, destDir, skillName);
    count += 1;
  }
  return count;
}

function copyCodexSkillDir(src, dest, skillName) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyCodexSkillDir(srcPath, destPath, skillName);
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (TRANSFORMABLE_EXTENSIONS.has(ext)) {
      let content = fs.readFileSync(srcPath, 'utf-8');
      content = transformCodexSkillContent(content, skillName, dest);
      if (entry.name === 'SKILL.md') {
        content = content.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/, (match, body) => {
          const filtered = filterCodexSkillFrontmatter(body);
          const nameIndex = filtered.findIndex(line => /^name:/.test(line));
          if (nameIndex >= 0) {
            filtered[nameIndex] = `name: ace-${skillName}`;
          } else {
            filtered.unshift(`name: ace-${skillName}`);
          }
          return `---\n${filtered.join('\n')}\n---\n\n`;
        });
        content = content.replace(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)/, `$1\n${codexSkillAdapter(skillName, dest, fs.readFileSync(srcPath, 'utf-8'))}`);
      }
      fs.writeFileSync(destPath, content, 'utf-8');
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function extractFrontmatter(content) {
  const match = content.match(/^\s*(?:<!--[\s\S]*?-->\s*)*---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { frontmatter: '', body: content };
  return { frontmatter: match[1], body: content.slice(match[0].length) };
}

function extractFrontmatterField(frontmatter, field) {
  const re = new RegExp(`^${field}:\\s*(.*)$`, 'm');
  const match = frontmatter.match(re);
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
}

function generateCodexAgentToml(agentName, sourceContent) {
  const content = replaceAceInvocations(
    sourceContent
      .replace(/\.claude\//g, '.codex/')
      .replace(/\.claudeignore\b/g, '.codexignore')
      .replace(/CLAUDE_SKILL_DIR/g, 'CODEX_SKILL_DIR'),
    true
  );
  const { frontmatter, body } = extractFrontmatter(content);
  const name = extractFrontmatterField(frontmatter, 'name') || agentName;
  const description = extractFrontmatterField(frontmatter, 'description') || `ACE agent ${name}`;
  const sandbox = CODEX_AGENT_SANDBOX[name] || 'workspace-write';
  return [
    `name = ${JSON.stringify(name)}`,
    `description = ${JSON.stringify(description)}`,
    `sandbox_mode = ${JSON.stringify(sandbox)}`,
    `developer_instructions = '''`,
    body.trim(),
    `'''`,
    '',
  ].join('\n');
}

function installCodexAgents(configDir, srcAgents) {
  if (!fs.existsSync(srcAgents)) return 0;
  const agentsDir = path.join(configDir, 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });

  for (const file of fs.readdirSync(agentsDir)) {
    if (file.startsWith('ace-') && file.endsWith('.toml')) {
      fs.rmSync(path.join(agentsDir, file), { force: true });
    }
  }

  const agents = [];
  for (const file of fs.readdirSync(srcAgents)) {
    if (!file.startsWith('ace-') || !file.endsWith('.md')) continue;
    const agentName = file.slice(0, -3);
    const content = fs.readFileSync(path.join(srcAgents, file), 'utf-8');
    const { frontmatter } = extractFrontmatter(content);
    const description = extractFrontmatterField(frontmatter, 'description') || `ACE agent ${agentName}`;
    fs.writeFileSync(path.join(agentsDir, `${agentName}.toml`), generateCodexAgentToml(agentName, content), 'utf-8');
    agents.push({ name: agentName, description });
  }

  mergeCodexAgentConfig(path.join(configDir, 'config.toml'), agents, agentsDir);
  return agents.length;
}

function mergeCodexAgentConfig(configPath, agents, agentsDir) {
  const eol = os.EOL;
  let existing = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '';
  const blockPattern = new RegExp(`${escapeRegex(CODEX_CONFIG_BEGIN)}[\\s\\S]*?${escapeRegex(CODEX_CONFIG_END)}\\r?\\n?`, 'm');
  existing = existing.replace(blockPattern, '').trimEnd();

  const lines = [CODEX_CONFIG_BEGIN, ''];
  for (const agent of agents) {
    lines.push(`[agents.${agent.name}]`);
    lines.push(`description = ${JSON.stringify(agent.description)}`);
    lines.push(`config_file = ${JSON.stringify(`${toPosixPath(agentsDir)}/${agent.name}.toml`)}`);
    lines.push('');
  }
  lines.push(CODEX_CONFIG_END);

  const prefix = existing ? `${existing}${eol}${eol}` : '';
  fs.writeFileSync(configPath, `${prefix}${lines.join(eol)}${eol}`, 'utf-8');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

// Install ACE for Codex as native Codex skills + agent TOML config
function installForCodex(scope, packageDir) {
  const config = RUNTIMES.codex;
  const basePath = getBasePath('codex', scope);
  const skillsPath = path.join(basePath, 'skills');
  const sharedPath = path.join(basePath, 'shared');

  const srcSkills = path.join(packageDir, 'skills');
  const srcShared = path.join(packageDir, 'shared');
  const srcAgents = path.join(packageDir, 'agents');

  log(`\nInstalling ACE for ${config.name} (native skills)...`, colors.cyan);
  log(`  Target: ${basePath}`, colors.dim);

  fs.mkdirSync(basePath, { recursive: true });

  const skillCount = copySkillsForCodex(srcSkills, skillsPath);
  log(`  ✓ ${skillCount} skills installed`, colors.green);

  if (fs.existsSync(sharedPath)) {
    fs.rmSync(sharedPath, { recursive: true });
  }
  if (fs.existsSync(srcShared)) {
    copyDir(srcShared, sharedPath, 'codex');
    log(`  ✓ Shared libs installed`, colors.green);
  }

  const agentCount = installCodexAgents(basePath, srcAgents);
  log(`  ✓ ${agentCount} agents configured`, colors.green);

  const versionFile = path.join(sharedPath, 'VERSION');
  if (!fs.existsSync(sharedPath)) fs.mkdirSync(sharedPath, { recursive: true });
  fs.writeFileSync(versionFile, VERSION, 'utf-8');

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

  const hasRuntimeFlag = flags.claude || flags.codex || flags.opencode || flags.all;
  const hasScopeFlag = flags.global || flags.local;
  const isInteractive = !hasRuntimeFlag && !hasScopeFlag;

  if (isInteractive) {
    const rl = createPrompt();

    runtimes = await askMultiple(rl, '\nWhich runtime(s) do you want to install ACE for?', [
      { label: 'Claude Code', value: 'claude', description: "Anthropic's Claude Code CLI" },
      { label: 'Codex', value: 'codex', description: "OpenAI's Codex CLI" },
      { label: 'Crush', value: 'opencode', description: 'Crush AI coding assistant (formerly OpenCode)' },
    ]);

    scope = await ask(rl, '\nWhere should ACE be installed?', [
      { label: 'Global', value: 'global', description: 'Install in home directory (~/.claude, ~/.codex, ~/.opencode)' },
      { label: 'Local', value: 'local', description: 'Install in current project (.claude, .codex, .opencode)' },
    ]);

    rl.close();
  } else {
    if (flags.all) {
      runtimes = ['claude', 'codex', 'opencode'];
    } else {
      if (flags.claude) runtimes.push('claude');
      if (flags.codex) runtimes.push('codex');
      if (flags.opencode) runtimes.push('opencode');
    }

    if (runtimes.length === 0) {
      log('Error: No runtime specified. Use --claude, --codex, --opencode (Crush), or --all', colors.red);
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
    } else if (runtime === 'codex') {
      const p = installForCodex(scope, packageDir);
      installedPaths.push({ runtime, name: RUNTIMES[runtime].name, path: p, success: true });
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
  if (runtimes.includes('codex')) {
    log(`\nCodex skill names use $ace-* instead of /ace:*:`, colors.cyan);
    log(`  $ace-help                    Check project status and next steps`, colors.dim);
    log(`  $ace-plan-story              Plan a story specification`, colors.dim);
    log(`  $ace-execute-story           Execute a planned story`, colors.dim);
  }

  log(`\nGet started:`, colors.cyan);
  log(`  1. Restart your AI coding assistant`, colors.dim);
  log(`  2. Run /ace:help in Claude/Crush or $ace-help in Codex`, colors.dim);
  log(`  3. Run /ace:plan-product-vision or $ace-plan-product-vision to define your product\n`, colors.dim);
}

main().catch((err) => {
  log(`Error: ${err.message}`, colors.red);
  process.exit(1);
});
