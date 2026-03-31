#!/usr/bin/env node

/**
 * plan-feature skill script — Entry point for ace-tools operations
 * needed by the plan-feature skill.
 *
 * Subcommands:
 *   init [args]              Environment detection for plan-feature workflow
 *   resolve-fields [args]    Resolve GitHub Project field IDs
 *   create-issue [args]      Create a GitHub issue in a project
 *   update-issue [args]      Update a GitHub issue
 *   generate-slug <text>     Generate a URL-safe slug from text
 *   verify-path-exists <path> Check if a file/directory exists
 *
 * Usage: node script.js <subcommand> [args] [--raw]
 */

const fs = require('fs');
const path = require('path');

const {
  loadConfig, pathExists, generateSlug, resolveModel,
  detectBrownfieldStatus, loadSettings, output, error, runSkillScript,
} = require('../../shared/lib/ace-core');

const {
  resolveFields, createIssue, updateIssue,
} = require('../../shared/lib/ace-github');

// ─── CLI Dispatch ────────────────────────────────────────────────────────────

runSkillScript({
  init: cmdInit,
  'resolve-fields': (cwd, raw, args) => resolveFields(cwd, raw, args),
  'create-issue': (cwd, raw, args) => createIssue(cwd, raw, args),
  'update-issue': (cwd, raw, args) => updateIssue(cwd, raw, args),
  'generate-slug': (cwd, raw, args, parsed) => {
    const text = parsed._positional || args.join(' ');
    if (!text) error('generate-slug requires text argument');
    const slug = generateSlug(text);
    output({ slug }, raw, slug);
  },
  'verify-path-exists': (cwd, raw, args, parsed) => {
    const targetPath = parsed._positional || args.join(' ');
    if (!targetPath) error('verify-path-exists requires path argument');
    const exists = pathExists(cwd, targetPath);
    output({ exists, path: targetPath }, raw, String(exists));
  },
});

// ─── Init: Plan Feature ─────────────────────────────────────────────────────

function cmdInit(cwd, raw, args, parsed) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  // Wiki detection — system-wide
  const wikiSystemDir = '.docs/wiki/system-wide';
  const has_wiki_system_wide = pathExists(cwd, wikiSystemDir);
  const has_system_architecture = pathExists(cwd, path.join(wikiSystemDir, 'system-architecture.md'));
  const has_system_structure = pathExists(cwd, path.join(wikiSystemDir, 'system-structure.md'));
  const has_testing_framework = pathExists(cwd, path.join(wikiSystemDir, 'testing-framework.md'));

  // Wiki detection — subsystems
  const wikiSubsystemsDir = '.docs/wiki/subsystems';
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

    // Product artifacts
    has_product_vision: pathExists(cwd, '.docs/product/product-vision.md'),
    has_product_backlog: pathExists(cwd, '.ace/artifacts/product/product-backlog.md'),

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
