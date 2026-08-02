#!/usr/bin/env node

/**
 * plan-story skill script — Entry point for all ace-tools operations
 * needed by the plan-story skill.
 *
 * Subcommands:
 *   init [story-param]        Environment detection for plan-story workflow
 *   update-state story=X status=Y   Update story status across files
 *   sync-github repo=X story_file=Y  Sync story/feature to GitHub
 *   resolve-model <agent-type>       Get model for agent based on profile
 *
 * Usage: node script.js <subcommand> [args] [--raw]
 */

const fs = require('fs');
const path = require('path');

const {
  loadConfig, pathExists, safeReadFile, generateSlug, resolveModel,
  detectBrownfieldStatus, loadSettings, execCommand,
  output, error, runSkillScript,
  docsPath, resolveDocsPath,
} = require('../../shared/lib/ace-core');

const {
  classifyStoryParam, extractStoryMetadata, extractStoryRequirements,
  extractTechnicalDirection, extractIssueNumber, extractIssueNumberFromFile, computeStoryPaths,
  updateState,
} = require('../../shared/lib/ace-story');

const { syncStory, resolveFields, createIssue } = require('../../shared/lib/ace-github');

// ─── CLI Dispatch ────────────────────────────────────────────────────────────

runSkillScript({
  init: cmdInit,
  'update-state': (cwd, raw, args) => updateState(cwd, raw, args),
  'sync-github': (cwd, raw, args) => syncStory(cwd, raw, args),
  'resolve-model': (cwd, raw, args, parsed) => {
    const agentType = parsed._positional || args[0];
    if (!agentType) error('resolve-model requires agent-type argument');
    const model = resolveModel(cwd, agentType);
    output({ model, agent: agentType }, raw, model);
  },
  'generate-slug': (cwd, raw, args, parsed) => {
    const text = parsed._positional || args.join(' ');
    if (!text) error('generate-slug requires text argument');
    const slug = generateSlug(text);
    output({ slug }, raw, slug);
  },
  'resolve-fields': (cwd, raw, args) => resolveFields(cwd, raw, args),
  'create-issue': (cwd, raw, args) => createIssue(cwd, raw, args),
});

// ─── Init: Plan Story ────────────────────────────────────────────────────────

/**
 * Environment detection for the plan-story workflow.
 *
 * Detects: git, gh CLI, GitHub project, brownfield status, wiki state,
 * product artifacts, and story source/content/metadata.
 *
 * Supports three input modes:
 *   - story param provided → loads existing file or fetches GitHub issue
 *   - text param provided (no story) → uses inline text as seed description
 *   - neither → new story mode, workflow handles placement
 *
 * initArgs: array of arguments — either a single positional path/URL,
 *           or key=value pairs (story=X text=Y)
 */
function cmdInit(cwd, raw, args, parsed) {
  const config = loadConfig(cwd);
  const brownfield = detectBrownfieldStatus(cwd);

  // ── Environment detection ──
  const has_git = pathExists(cwd, '.git');
  const has_gh_cli = (() => {
    try {
      const { execSync } = require('child_process');
      execSync('gh --version', { stdio: 'pipe' });
      return true;
    } catch { return false; }
  })();
  const github_project = loadSettings(cwd).github_project;

  // Wiki detection
  const wikiSystemDir = docsPath(cwd, 'wiki/system-wide');
  const has_wiki_system_wide = pathExists(cwd, wikiSystemDir);
  const wikiSubsystemsDir = docsPath(cwd, 'wiki/subsystems');
  const has_wiki_subsystems = pathExists(cwd, wikiSubsystemsDir);
  let wiki_subsystem_names = [];
  if (has_wiki_subsystems) {
    try {
      const entries = fs.readdirSync(path.join(cwd, wikiSubsystemsDir), { withFileTypes: true });
      wiki_subsystem_names = entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {}
  }
  const has_wiki = has_wiki_system_wide || has_wiki_subsystems;

  // ── Parse input from shared parsed args ──
  const resolvedStoryParam = parsed.story || parsed._positional || null;
  const textParam = parsed.text || null;

  // ── Base result (shared across all modes) ──
  const baseResult = {
    product_owner_model: resolveModel(cwd, 'ace-product-owner'),
    commit_docs: config.commit_docs,
    docs_path: resolveDocsPath(cwd),
    has_git, has_gh_cli, github_project,
    ...brownfield,
    has_wiki, has_wiki_system_wide, has_wiki_subsystems, wiki_subsystem_names,
    has_product_vision: pathExists(cwd, docsPath(cwd, 'product/product-vision.md')),
    has_product_backlog: pathExists(cwd, '.ace/artifacts/product/product-backlog.md'),
  };

  // ── Mode 1: No story param and no text → new story mode ──
  if (!resolvedStoryParam && !textParam) {
    output({
      ...baseResult,
      story_source: 'new',
      story_valid: true,
      story_error: null,
      story_content: null,
      story: { id: null, title: null, status: null, size: null, issue_number: null },
      feature: { id: null, title: null, issue_number: null },
      epic: { id: null, title: null },
      user_story: null, description: null, technical_direction: null, acceptance_criteria_count: 0,
      paths: null,
      has_external_analysis: false, has_integration_analysis: false,
      has_feature_file: false, has_story_file: false,
    }, raw);
    return;
  }

  // ── Mode 2: Text param only → use text as seed description ──
  if (!resolvedStoryParam && textParam) {
    output({
      ...baseResult,
      story_source: 'text',
      story_valid: true,
      story_error: null,
      story_content: textParam,
      story: { id: null, title: null, status: null, size: null, issue_number: null },
      feature: { id: null, title: null, issue_number: null },
      epic: { id: null, title: null },
      user_story: null, description: textParam, technical_direction: null, acceptance_criteria_count: 0,
      paths: null,
      has_external_analysis: false, has_integration_analysis: false,
      has_feature_file: false, has_story_file: false,
    }, raw);
    return;
  }

  // ── Mode 3: Story param provided → classify and load ──
  const classified = classifyStoryParam(resolvedStoryParam);

  // Invalid param
  if (classified.type === null || classified.type === 'invalid') {
    output({
      ...baseResult,
      story_source: null,
      story_valid: false,
      story_error: classified.reason || 'No story parameter provided',
      story_content: null,
      story: { id: null, title: null, status: null, size: null, issue_number: null },
      feature: { id: null, title: null, issue_number: null },
      epic: { id: null, title: null },
      user_story: null, description: null, technical_direction: null, acceptance_criteria_count: 0,
      paths: null,
      has_external_analysis: false, has_integration_analysis: false,
      has_feature_file: false, has_story_file: false,
    }, raw);
    return;
  }

  // ── Load story content ──
  let storyContent = null;
  let storySource = classified.type === 'file' ? 'file' : 'github';
  let storyError = null;
  let storyFilePath = null;

  if (classified.type === 'file') {
    const resolvedPath = path.isAbsolute(classified.filePath)
      ? classified.filePath
      : path.join(cwd, classified.filePath);
    if (!pathExists(cwd, classified.filePath)) {
      storyError = `Story file not found: ${classified.filePath}`;
    } else {
      storyContent = safeReadFile(resolvedPath);
      storyFilePath = classified.filePath;
      if (!storyContent) storyError = `Could not read story file: ${classified.filePath}`;
    }
  } else {
    // github-url or issue-number
    if (!has_gh_cli) {
      storyError = 'GitHub CLI (gh) not installed. Cannot fetch GitHub issues.';
    } else {
      const repo = classified.repo || (github_project.repo || null);
      if (!repo) {
        storyError = 'No repository configured. Provide a full GitHub URL or configure github_project.repo in settings.';
      } else {
        const ghResult = execCommand(
          `gh issue view ${classified.issueNumber} --repo ${repo} --json title,body,labels,state`,
          cwd
        );
        if (!ghResult) {
          storyError = `Could not fetch GitHub issue #${classified.issueNumber} from ${repo}.`;
        } else {
          try {
            const issue = JSON.parse(ghResult);
            storyContent = issue.body || '';
            if (storyContent && !storyContent.match(/^#\s+/m)) {
              storyContent = `# ${issue.title}\n\n${storyContent}`;
            }
          } catch {
            storyError = `Failed to parse GitHub issue response for #${classified.issueNumber}.`;
          }
        }
      }
    }
  }

  // ── Extract metadata & requirements ──
  const metadata = extractStoryMetadata(storyContent);
  const requirements = extractStoryRequirements(storyContent);
  const technicalDirection = extractTechnicalDirection(storyContent);

  // ── Compute paths ──
  let paths = null;
  let has_story_file = false;

  if (storyFilePath) {
    const resolvedPath = path.isAbsolute(storyFilePath)
      ? storyFilePath
      : path.join(cwd, storyFilePath);
    const storyDir = path.dirname(resolvedPath);
    const relStoryDir = path.relative(cwd, storyDir).replace(/\\/g, '/');
    const storySlug = path.basename(storyDir);
    const featureDir = path.dirname(storyDir);
    const relFeatureDir = path.relative(cwd, featureDir).replace(/\\/g, '/');
    const featureSlug = path.basename(featureDir);

    paths = {
      epic_slug: null,
      feature_slug: featureSlug,
      story_slug: storySlug,
      story_dir: relStoryDir,
      story_file: storyFilePath.replace(/\\/g, '/'),
      external_analysis_file: `${relStoryDir}/external-analysis.md`,
      integration_analysis_file: `${relStoryDir}/integration-analysis.md`,
      feature_dir: relFeatureDir,
      feature_file: `${relFeatureDir}/${featureSlug}.md`,
    };
    has_story_file = true;
  } else if (metadata.epic.id && metadata.feature.id && metadata.id) {
    paths = computeStoryPaths(
      metadata.epic.id, metadata.epic.title || '',
      metadata.feature.id, metadata.feature.title || '',
      metadata.id, metadata.title || ''
    );
    has_story_file = paths ? pathExists(cwd, paths.story_file) : false;
  }

  // ── Check artifact existence ──
  const has_external_analysis = paths ? pathExists(cwd, paths.external_analysis_file) : false;
  const has_integration_analysis = paths ? pathExists(cwd, paths.integration_analysis_file) : false;
  const has_feature_file = paths ? pathExists(cwd, paths.feature_file) : false;

  // ── Build result ──
  output({
    ...baseResult,
    story_source: storySource,
    story_valid: storyContent !== null && storyError === null,
    story_error: storyError,
    story_content: storyContent,
    story: {
      id: metadata.id,
      title: metadata.title,
      status: metadata.status,
      size: metadata.size,
      issue_number: extractIssueNumber(metadata.link),
    },
    feature: {
      ...metadata.feature,
      issue_number: paths ? extractIssueNumberFromFile(cwd, paths.feature_file) : null,
    },
    epic: metadata.epic,
    user_story: requirements.user_story,
    description: requirements.description,
    technical_direction: technicalDirection,
    acceptance_criteria_count: requirements.acceptance_criteria_count,
    paths,
    has_external_analysis,
    has_integration_analysis,
    has_feature_file,
    has_story_file,
  }, raw);
}
