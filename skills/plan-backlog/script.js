#!/usr/bin/env node

/**
 * plan-backlog skill script — Entry point for ace-tools operations
 * needed by the plan-backlog skill.
 *
 * Subcommands:
 *   init [args]           Environment detection for plan-backlog workflow
 *   resolve-fields [args] Resolve GitHub Project field IDs
 *   create-issue [args]   Create a GitHub issue in a project
 *   fetch-issues [args]   Fetch all epics/features from a GitHub project
 *
 * Usage: node script.js <subcommand> [args] [--raw]
 */

const fs = require('fs');
const path = require('path');

const {
  loadConfig, pathExists, resolveModel,
  detectBrownfieldStatus, loadSettings, output, error, runSkillScript,
  docsPath, resolveDocsPath,
} = require('../../shared/lib/ace-core');

const {
  resolveFields, createIssue, fetchIssues,
} = require('../../shared/lib/ace-github');

// ─── CLI Dispatch ────────────────────────────────────────────────────────────

runSkillScript({
  init: cmdInit,
  'resolve-fields': (cwd, raw, args) => resolveFields(cwd, raw, args),
  'create-issue': (cwd, raw, args) => createIssue(cwd, raw, args),
  'fetch-issues': (cwd, raw, args) => fetchIssues(cwd, raw, args),
});

// ─── Init: Plan Backlog ─────────────────────────────────────────────────────

function cmdInit(cwd, raw, args, parsed) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  // Wiki detection — system-wide
  const wikiSystemDir = docsPath(cwd, 'wiki/system-wide');
  const has_wiki_system_wide = pathExists(cwd, wikiSystemDir);
  const has_system_architecture = pathExists(cwd, path.join(wikiSystemDir, 'system-architecture.md'));
  const has_system_structure = pathExists(cwd, path.join(wikiSystemDir, 'system-structure.md'));
  const has_testing_framework = pathExists(cwd, path.join(wikiSystemDir, 'testing-framework.md'));

  // Wiki detection — subsystems
  const wikiSubsystemsDir = docsPath(cwd, 'wiki/subsystems');
  const has_wiki_subsystems = pathExists(cwd, wikiSubsystemsDir);

  let wiki_subsystem_names = [];
  if (has_wiki_subsystems) {
    try {
      const entries = fs.readdirSync(path.join(cwd, wikiSubsystemsDir), { withFileTypes: true });
      wiki_subsystem_names = entries
        .filter(e => e.isDirectory())
        .map(e => e.name);
    } catch {}
  }

  const has_wiki = has_wiki_system_wide || has_wiki_subsystems;

  const result = {
    // Models
    product_owner_model: resolveModel(cwd, 'ace-product-owner'),
    researcher_model: resolveModel(cwd, 'ace-project-researcher'),

    // Config
    commit_docs: config.commit_docs,
    docs_path: resolveDocsPath(cwd),

    // Product artifacts
    has_product_vision: pathExists(cwd, docsPath(cwd, 'product/product-vision.md')),
    has_product_backlog: pathExists(cwd, '.ace/artifacts/product/product-backlog.md'),

    // Research artifacts (from previous runs)
    has_features_research: pathExists(cwd, '.ace/research/FEATURES.md'),
    has_architecture_research: pathExists(cwd, '.ace/research/ARCHITECTURE.md'),

    // Wiki analysis cache (from previous runs)
    has_wiki_analysis: pathExists(cwd, '.ace/artifacts/wiki/wiki-analysis.md'),

    // Brownfield detection
    ...brownfield,

    // Wiki state — system-wide
    has_wiki,
    has_wiki_system_wide,
    has_system_architecture,
    has_system_structure,
    has_testing_framework,

    // Wiki state — subsystems
    has_wiki_subsystems,
    wiki_subsystem_names,

    // Git state
    has_git: pathExists(cwd, '.git'),

    // GitHub CLI
    has_gh_cli: (() => {
      try {
        const { execSync } = require('child_process');
        execSync('gh --version', { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    })(),

    // GitHub Project settings (from settings.json)
    github_project: (() => {
      const settings = loadSettings(cwd);
      return settings.github_project;
    })(),
  };

  output(result, raw);
}
