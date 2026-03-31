#!/usr/bin/env node

/**
 * init-coding-standards skill script — Entry point for ace-tools operations
 * needed by the init-coding-standards skill.
 *
 * Subcommands:
 *   init [args]        Environment detection for init-coding-standards workflow
 *
 * Usage: node script.js <subcommand> [args] [--raw]
 */

const {
  loadConfig, pathExists,
  detectBrownfieldStatus, output, error, runSkillScript,
} = require('../../shared/lib/ace-core');

// ─── CLI Dispatch ────────────────────────────────────────────────────────────

runSkillScript({
  init: cmdInit,
});

// ─── Init: Coding Standards ─────────────────────────────────────────────────

function cmdInit(cwd, raw, args, parsed) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  const result = {
    // Config
    commit_docs: config.commit_docs,

    // Brownfield detection
    ...brownfield,

    // Existing coding standards
    has_coding_standards: pathExists(cwd, '.docs/wiki/system-wide/coding-standards.md'),
    wiki_dir_exists: pathExists(cwd, '.docs/wiki/system-wide'),

    // Existing wiki context (useful for cross-referencing)
    has_system_architecture: pathExists(cwd, '.docs/wiki/system-wide/system-architecture.md'),
    has_system_structure: pathExists(cwd, '.docs/wiki/system-wide/system-structure.md'),

    // Git state
    has_git: pathExists(cwd, '.git'),
  };

  output(result, raw);
}
