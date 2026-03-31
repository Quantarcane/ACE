#!/usr/bin/env node
// Check for ACE updates in background, write result to cache
// Called by SessionStart hook - runs once per session

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Use CLAUDE_PLUGIN_DATA for persistent cache (survives plugin updates)
// Use CLAUDE_PLUGIN_ROOT to find the bundled VERSION file
const pluginData = process.env.CLAUDE_PLUGIN_DATA;
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;

// Fallback for legacy standalone installs
const homeDir = os.homedir();
const cwd = process.cwd();

const cacheDir = pluginData || path.join(homeDir, '.claude', 'cache');
const cacheFile = path.join(cacheDir, 'ace-update-check.json');

// VERSION file: prefer plugin root, then legacy locations
const versionFiles = [
  pluginRoot ? path.join(pluginRoot, 'shared', 'VERSION') : null,
  path.join(cwd, '.claude', 'shared', 'VERSION'),
  path.join(homeDir, '.claude', 'shared', 'VERSION'),
].filter(Boolean);

// Ensure cache directory exists
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Run check in background (spawn detached process, windowsHide prevents console flash)
const child = spawn(process.execPath, ['-e', `
  const fs = require('fs');
  const { execSync } = require('child_process');

  const cacheFile = ${JSON.stringify(cacheFile)};
  const versionFiles = ${JSON.stringify(versionFiles)};

  let installed = '0.0.0';
  try {
    for (const vf of versionFiles) {
      if (fs.existsSync(vf)) {
        installed = fs.readFileSync(vf, 'utf8').trim();
        break;
      }
    }
  } catch (e) {}

  let latest = null;
  try {
    latest = execSync('npm view agile-context-engineering version', { encoding: 'utf8', timeout: 10000, windowsHide: true }).trim();
  } catch (e) {}

  const result = {
    update_available: latest && installed !== latest,
    installed,
    latest: latest || 'unknown',
    checked: Math.floor(Date.now() / 1000)
  };

  fs.writeFileSync(cacheFile, JSON.stringify(result));
`], {
  stdio: 'ignore',
  windowsHide: true,
  detached: true
});

child.unref();
