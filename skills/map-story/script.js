#!/usr/bin/env node

/**
 * map-story skill script — Entry point for all ace-tools operations
 * needed by the map-story skill.
 *
 * Subcommands:
 *   init               Environment detection for the map-story workflow
 *
 * Usage: node script.js <subcommand> [args] [--raw]
 */

const fs = require("fs");
const path = require("path");

const {
  loadConfig, pathExists, resolveModel,
  docsPath, resolveDocsPath,
  output, runSkillScript,
} = require("../../shared/lib/ace-core");

// ─── CLI Dispatch ────────────────────────────────────────────────────────────

runSkillScript({
  init: cmdInit,
});

// ─── Init: map-story ───────────────────────────────────────────────────────────

/**
 * Environment detection for the post-story wiki update workflow.
 *
 * Resolves the docs root from .ace/settings.json so the workflow never has to
 * guess where the wiki lives — it is `.docs` by default but commonly nested in
 * monorepos (e.g. `ProcerERP/.docs`).
 */
function cmdInit(cwd, raw, args, parsed) {
  const config = loadConfig(cwd);

  const wikiRoot = docsPath(cwd, "wiki");
  const subsystemsRoot = docsPath(cwd, "wiki/subsystems");

  // Existing subsystems — these workflows ask the user which one to document
  let subsystems = [];
  try {
    subsystems = fs.readdirSync(path.join(cwd, subsystemsRoot), { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch {}

  const result = {
    // Models
    mapper_model: resolveModel(cwd, "ace-wiki-mapper"),

    // Config
    commit_docs: config.commit_docs,
    docs_path: resolveDocsPath(cwd),

    // Wiki state — all paths below are already resolved against docs_path
    wiki_root: wikiRoot,
    system_wide_dir: docsPath(cwd, "wiki/system-wide"),
    subsystems_dir: subsystemsRoot,
    wiki_exists: pathExists(cwd, wikiRoot),
    subsystems,

    // Git state
    has_git: pathExists(cwd, ".git"),
  };

  output(result, raw);
}
