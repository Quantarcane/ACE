#!/usr/bin/env node

/**
 * map-subsystem skill script — Entry point for ace-tools operations
 * needed by the map-subsystem skill.
 *
 * Subcommands:
 *   init [args]        Environment detection for map-subsystem workflow
 *
 * Usage: node script.js <subcommand> [args] [--raw]
 */

const {
  loadConfig, pathExists, resolveModel,
  detectBrownfieldStatus, output, error, runSkillScript,
  docsPath, resolveDocsPath,
} = require('../../shared/lib/ace-core');

// ─── CLI Dispatch ────────────────────────────────────────────────────────────

runSkillScript({
  init: cmdInit,
});

// ─── Init: Map Subsystem ────────────────────────────────────────────────────

function cmdInit(cwd, raw, args, parsed) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  const wikiDir = docsPath(cwd, 'wiki/subsystems');
  const wikiDirExists = pathExists(cwd, wikiDir);

  const result = {
    // Models
    mapper_model: resolveModel(cwd, 'ace-wiki-mapper'),

    // Config
    commit_docs: config.commit_docs,
    docs_path: resolveDocsPath(cwd),

    // Brownfield detection
    ...brownfield,

    // Wiki directory state
    wiki_dir_exists: wikiDirExists,

    // Git state
    has_git: pathExists(cwd, '.git'),
  };

  output(result, raw);
}
