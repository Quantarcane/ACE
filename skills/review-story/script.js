#!/usr/bin/env node

/**
 * review-story skill script — Entry point for ace-tools operations
 * needed by the review-story skill.
 *
 * Subcommands:
 *   init [story-param]        Environment detection for review-story workflow
 *
 * Usage: node script.js <subcommand> [args] [--raw]
 */

const fs = require('fs');
const path = require('path');

const {
  loadConfig, pathExists, safeReadFile, loadSettings, resolveModel,
  execCommand, output, error, runSkillScript,
} = require('../../shared/lib/ace-core');

const {
  classifyStoryParam, extractStoryMetadata, extractStoryRequirements,
  extractMarkdownSection, extractIssueNumber, extractIssueNumberFromFile,
  computeStoryPaths,
} = require('../../shared/lib/ace-story');

// ─── CLI Dispatch ────────────────────────────────────────────────────────────

runSkillScript({
  init: cmdInit,
});

// ─── Init: Execute/Review Story ─────────────────────────────────────────────

/**
 * Environment detection for the review-story workflow.
 *
 * Replicates cmdInitExecuteStory from ace-tools.js:
 * 1. loadConfig, detect git/gh CLI/settings/agent_teams
 * 2. classifyStoryParam
 * 3. Load story content
 * 4. extractStoryMetadata, extractStoryRequirements
 * 5. Detect key sections (AC, technical solution, wiki refs, coding standards)
 * 6. computeStoryPaths
 * 7. Output JSON with all data
 */
function cmdInit(cwd, raw, args, parsed) {
  const storyParam = parsed.story || parsed._positional || null;
  const config = loadConfig(cwd);

  // ── Environment detection ──
  const has_git = pathExists(cwd, '.git');
  const has_gh_cli = (() => {
    try {
      const { execSync } = require('child_process');
      execSync('gh --version', { stdio: 'pipe' });
      return true;
    } catch { return false; }
  })();
  const settings = loadSettings(cwd);
  const github_project = settings.github_project;

  // ── Agent teams detection (sync from runtime settings) ──
  // RUNTIME_CONFIG_DIR is not in shared libs — detect inline
  // Try .claude first, then .opencode
  let agent_teams = settings.agent_teams || false;
  for (const configDir of ['.claude', '.opencode']) {
    const claudeSettingsPath = path.join(cwd, configDir, 'settings.json');
    try {
      const claudeRaw = fs.readFileSync(claudeSettingsPath, 'utf-8');
      const claudeSettings = JSON.parse(claudeRaw);
      const val = claudeSettings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
      if (val === '1' || val === 'true') {
        agent_teams = true;
      }
      break; // found a settings file, stop looking
    } catch {}
  }

  // ── Classify the story parameter ──
  const classified = classifyStoryParam(storyParam);

  // Early exit if invalid
  if (classified.type === null || classified.type === 'invalid') {
    output({
      executor_model: resolveModel(cwd, 'ace-executor'),
      reviewer_model: resolveModel(cwd, 'ace-code-reviewer'),
      commit_docs: config.commit_docs,
      has_git, has_gh_cli, github_project, agent_teams,
      story_source: null,
      story_valid: false,
      story_error: classified.reason || 'No story parameter provided',
      story_content: null,
      story: { id: null, title: null, status: null, size: null },
      feature: { id: null, title: null },
      epic: { id: null, title: null },
      has_acceptance_criteria: false,
      acceptance_criteria_count: 0,
      has_technical_solution: false,
      has_wiki_refs: false,
      has_coding_standards: false,
      paths: null,
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

  // ── Detect key sections ──
  const has_acceptance_criteria = requirements.acceptance_criteria_count > 0;
  const has_technical_solution = storyContent
    ? !!extractMarkdownSection(storyContent, 'Technical Solution', 2)
    : false;
  const has_wiki_refs = storyContent
    ? !!extractMarkdownSection(storyContent, 'Relevant Wiki', 2)
    : false;
  const has_coding_standards = pathExists(cwd, '.docs/wiki/system-wide/coding-standards.md');

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
      product_backlog: '.ace/artifacts/product/product-backlog.md',
      coding_standards: '.docs/wiki/system-wide/coding-standards.md',
    };
    has_story_file = true;
  } else if (metadata.epic.id && metadata.feature.id && metadata.id) {
    const computed = computeStoryPaths(
      metadata.epic.id, metadata.epic.title || '',
      metadata.feature.id, metadata.feature.title || '',
      metadata.id, metadata.title || ''
    );
    if (computed) {
      paths = {
        ...computed,
        product_backlog: '.ace/artifacts/product/product-backlog.md',
        coding_standards: '.docs/wiki/system-wide/coding-standards.md',
      };
      has_story_file = pathExists(cwd, paths.story_file);
    }
  }

  // ── Extract GitHub issue numbers ──
  const storyIssueNumber = extractIssueNumber(metadata.link);
  const featureIssueNumber = paths ? extractIssueNumberFromFile(cwd, paths.feature_file) : null;

  // ── Build result ──
  const result = {
    executor_model: resolveModel(cwd, 'ace-executor'),
    reviewer_model: resolveModel(cwd, 'ace-code-reviewer'),
    commit_docs: config.commit_docs,
    has_git, has_gh_cli, github_project, agent_teams,
    story_source: storySource,
    story_valid: storyContent !== null && storyError === null,
    story_error: storyError,
    story_content: storyContent,
    story: {
      id: metadata.id,
      title: metadata.title,
      status: metadata.status,
      size: metadata.size,
      issue_number: storyIssueNumber,
    },
    feature: {
      ...metadata.feature,
      issue_number: featureIssueNumber,
    },
    epic: metadata.epic,
    has_acceptance_criteria,
    acceptance_criteria_count: requirements.acceptance_criteria_count,
    has_technical_solution,
    has_wiki_refs,
    has_coding_standards,
    paths,
    has_story_file,
  };

  output(result, raw);
}
