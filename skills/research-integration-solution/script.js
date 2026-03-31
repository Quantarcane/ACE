#!/usr/bin/env node

/**
 * research-integration-solution skill script — Entry point for ace-tools operations
 * needed by the research-integration-solution skill.
 *
 * Subcommands:
 *   init [story-param]        Environment detection for research-integration-solution workflow
 *
 * Usage: node script.js <subcommand> [args] [--raw]
 */

const path = require('path');

const {
  loadConfig, pathExists, safeReadFile, loadSettings, resolveModel,
  execCommand, output, error, runSkillScript,
} = require('../../shared/lib/ace-core');

const {
  classifyStoryParam, extractStoryMetadata, extractStoryRequirements,
  extractWikiReferences,
  computeStoryPaths,
} = require('../../shared/lib/ace-story');

// ─── CLI Dispatch ────────────────────────────────────────────────────────────

runSkillScript({
  init: cmdInit,
});

// ─── Init: Research Story ───────────────────────────────────────────────────

/**
 * Environment detection for the research-integration-solution workflow.
 *
 * Replicates cmdInitResearchStory from ace-tools.js:
 * 1. loadConfig, detect git/gh CLI/github_project
 * 2. classifyStoryParam — validate story source
 * 3. Load story content (from file or GitHub)
 * 4. extractStoryMetadata, extractStoryRequirements, extractWikiReferences
 * 5. computeStoryPaths or derive from file location
 * 6. Check artifact existence (external/integration analysis, feature file)
 * 7. Verify wiki doc existence
 * 8. Output JSON with all data
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
  const github_project = (() => {
    const settings = loadSettings(cwd);
    return settings.github_project;
  })();

  // ── Classify the story parameter ──
  const classified = classifyStoryParam(storyParam);

  // Early exit if invalid
  if (classified.type === null || classified.type === 'invalid') {
    output({
      analyst_model: resolveModel(cwd, 'ace-code-integration-analyst'),
      mapper_model: resolveModel(cwd, 'ace-wiki-mapper'),
      commit_docs: config.commit_docs,
      has_git, has_gh_cli, github_project,
      story_source: null,
      story_valid: false,
      story_error: classified.reason || 'No story parameter provided',
      story: { id: null, title: null, status: null, size: null },
      feature: { id: null, title: null },
      epic: { id: null, title: null },
      user_story: null, description: null, acceptance_criteria_count: 0,
      paths: null,
      has_external_analysis: false, has_integration_analysis: false, has_feature_file: false,
      wiki_references: { system_wide: [], subsystem_docs: [], total_count: 0 },
      wiki_docs_exist: { existing: [], missing: [] },
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
  const wikiRefs = extractWikiReferences(storyContent);

  // ── Compute paths ──
  let paths = null;
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
  } else if (metadata.epic.id && metadata.feature.id && metadata.id) {
    paths = computeStoryPaths(
      metadata.epic.id, metadata.epic.title || '',
      metadata.feature.id, metadata.feature.title || '',
      metadata.id, metadata.title || ''
    );
  }

  // ── Check artifact existence ──
  const has_external_analysis = paths ? pathExists(cwd, paths.external_analysis_file) : false;
  const has_integration_analysis = paths ? pathExists(cwd, paths.integration_analysis_file) : false;
  const has_feature_file = paths ? pathExists(cwd, paths.feature_file) : false;

  // ── Verify wiki doc existence ──
  const allWikiPaths = [...wikiRefs.system_wide, ...wikiRefs.subsystem_docs.map(d => d.path)];
  const wikiExisting = [];
  const wikiMissing = [];
  for (const wikiPath of allWikiPaths) {
    if (pathExists(cwd, wikiPath)) {
      wikiExisting.push(wikiPath);
    } else {
      wikiMissing.push(wikiPath);
    }
  }

  // ── Build result ──
  const result = {
    analyst_model: resolveModel(cwd, 'ace-code-integration-analyst'),
    mapper_model: resolveModel(cwd, 'ace-wiki-mapper'),
    commit_docs: config.commit_docs,
    has_git, has_gh_cli, github_project,
    story_source: storySource,
    story_valid: storyContent !== null && storyError === null,
    story_error: storyError,
    story: {
      id: metadata.id,
      title: metadata.title,
      status: metadata.status,
      size: metadata.size,
    },
    feature: metadata.feature,
    epic: metadata.epic,
    user_story: requirements.user_story,
    description: requirements.description,
    acceptance_criteria_count: requirements.acceptance_criteria_count,
    paths,
    has_external_analysis,
    has_integration_analysis,
    has_feature_file,
    wiki_references: wikiRefs,
    wiki_docs_exist: {
      existing: wikiExisting,
      missing: wikiMissing,
    },
  };

  output(result, raw);
}
