#!/usr/bin/env node

/**
 * plan-product-vision skill script — Entry point for ace-tools operations
 * needed by the plan-product-vision skill.
 *
 * Subcommands:
 *   init [args]        Environment detection for plan-product-vision workflow
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

// ─── Init: Plan Product Vision ──────────────────────────────────────────────

function cmdInit(cwd, raw, args, parsed) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  const result = {
    // Models
    product_owner_model: resolveModel(cwd, 'ace-product-owner'),

    // Config
    commit_docs: config.commit_docs,
    docs_path: resolveDocsPath(cwd),

    // Existing state
    has_product_vision: pathExists(cwd, docsPath(cwd, 'product/product-vision.md')),

    // Brownfield detection
    ...brownfield,

    // Architecture context
    has_system_architecture: pathExists(cwd, docsPath(cwd, 'wiki/system-wide/system-architecture.md')),

    // Git state
    has_git: pathExists(cwd, '.git'),
  };

  output(result, raw);
}
