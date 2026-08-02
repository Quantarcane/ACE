#!/usr/bin/env node

/**
 * map-system skill script — Entry point for ace-tools operations
 * needed by the map-system skill.
 *
 * Subcommands:
 *   init [args]        Environment detection for map-system workflow
 *
 * Usage: node script.js <subcommand> [args] [--raw]
 */

const fs = require('fs');
const path = require('path');

const {
  loadConfig, pathExists, resolveModel,
  detectBrownfieldStatus, output, error, runSkillScript,
  docsPath, resolveDocsPath,
} = require('../../shared/lib/ace-core');

// ─── CLI Dispatch ────────────────────────────────────────────────────────────

runSkillScript({
  init: cmdInit,
});

// ─── Init: Map System ───────────────────────────────────────────────────────

function cmdInit(cwd, raw, args, parsed) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  // Check existing wiki documents
  const wikiDir = docsPath(cwd, 'wiki/system-wide');
  const wikiDirExists = pathExists(cwd, wikiDir);

  const has_system_structure = pathExists(cwd, path.join(wikiDir, 'system-structure.md'));
  const has_system_architecture = pathExists(cwd, path.join(wikiDir, 'system-architecture.md'));
  const has_testing_framework = pathExists(cwd, path.join(wikiDir, 'testing-framework.md'));
  const has_coding_standards = pathExists(cwd, path.join(wikiDir, 'coding-standards.md'));

  // List existing wiki files if directory exists
  let existing_wiki_files = [];
  if (wikiDirExists) {
    try {
      existing_wiki_files = fs.readdirSync(path.join(cwd, wikiDir)).filter(f => f.endsWith('.md'));
    } catch {}
  }

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
    existing_wiki_files,

    // Per-document existence
    has_system_structure,
    has_system_architecture,
    has_testing_framework,
    has_coding_standards,

    // Git state
    has_git: pathExists(cwd, '.git'),
  };

  output(result, raw);
}
