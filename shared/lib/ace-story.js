/**
 * ACE Story — Story metadata extraction, path computation, and state management.
 *
 * Extracted from ace-tools.js monolith. Contains: story param classification,
 * markdown section extraction, metadata/requirements parsing, wiki reference parsing,
 * path computation, and story state updates across story/feature/backlog files.
 *
 * Usage: const { classifyStoryParam, extractStoryMetadata, updateState } = require('./ace-story');
 */

const fs = require('fs');
const path = require('path');
const {
  safeReadFile, generateSlug, parseKeyValueArgs, output, error,
} = require('./ace-core');

// ─── Story Param Classification ──────────────────────────────────────────────

/**
 * Classify a story parameter as file path, GitHub URL, or issue number.
 * Returns { type, filePath?, repo?, issueNumber?, reason? }
 */
function classifyStoryParam(param) {
  if (!param) return { type: null, reason: 'No story parameter provided' };
  const trimmed = param.trim();
  if (/^https?:\/\/github\.com\//.test(trimmed)) {
    const match = trimmed.match(/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
    if (match) return { type: 'github-url', repo: match[1], issueNumber: parseInt(match[2]) };
    return { type: 'invalid', reason: 'Unrecognized GitHub URL format. Expected: https://github.com/owner/repo/issues/123' };
  }
  if (/^\d+$/.test(trimmed)) {
    return { type: 'issue-number', issueNumber: parseInt(trimmed) };
  }
  return { type: 'file', filePath: trimmed };
}

// ─── Markdown Parsing ────────────────────────────────────────────────────────

/**
 * Extract a markdown section between a heading and the next heading of equal or higher level.
 * Returns the section content (without the heading itself), or null if not found.
 */
function extractMarkdownSection(content, sectionName, headingLevel) {
  const prefix = '#'.repeat(headingLevel);
  const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingPattern = new RegExp(`^${prefix}\\s+${escapedName}\\s*$`, 'm');
  const headingMatch = headingPattern.exec(content);
  if (!headingMatch) return null;

  const startIdx = headingMatch.index + headingMatch[0].length;
  const rest = content.substring(startIdx);

  const nextHeadingPattern = new RegExp(`^#{1,${headingLevel}}\\s`, 'm');
  const nextMatch = nextHeadingPattern.exec(rest);

  const sectionContent = nextMatch ? rest.substring(0, nextMatch.index) : rest;
  return sectionContent.trim() || null;
}

// ─── Story Metadata ──────────────────────────────────────────────────────────

/**
 * Parse the story markdown header to extract metadata and parent context.
 *
 * Expected format:
 *   # S3: Display OAuth Provider Buttons
 *   **Feature**: F3 OAuth2 Login Flow | **Epic**: #45 User Authentication
 *   **Status**: Refined | **Size**: 3 | **Sprint**: Sprint 2 | **Link**: [#95](url)
 */
function extractStoryMetadata(content) {
  const result = {
    id: null, title: null, status: null, size: null, sprint: null, link: null,
    feature: { id: null, title: null },
    epic: { id: null, title: null },
  };
  if (!content) return result;

  // Header: # ID: Title
  const headerMatch = content.match(/^#\s+([^:\n]+?):\s+(.+)$/m);
  if (headerMatch) {
    result.id = headerMatch[1].trim();
    result.title = headerMatch[2].trim();
  }

  // Feature/Epic line
  const featureEpicMatch = content.match(/\*\*Feature\*\*:\s*(.+?)\s*\|\s*\*\*Epic\*\*:\s*(.+)$/m);
  if (featureEpicMatch) {
    const featureStr = featureEpicMatch[1].trim();
    const epicStr = featureEpicMatch[2].trim();
    const featureParts = featureStr.match(/^(\S+)\s+(.+)$/);
    if (featureParts) {
      result.feature.id = featureParts[1];
      result.feature.title = featureParts[2];
    } else {
      result.feature.title = featureStr;
    }
    const epicParts = epicStr.match(/^(\S+)\s+(.+)$/);
    if (epicParts) {
      result.epic.id = epicParts[1];
      result.epic.title = epicParts[2];
    } else {
      result.epic.title = epicStr;
    }
  }

  const statusMatch = content.match(/\*\*Status\*\*:\s*([^|*]+)/);
  if (statusMatch) result.status = statusMatch[1].trim();

  const sizeMatch = content.match(/\*\*Size\*\*:\s*([^|*]+)/);
  if (sizeMatch) result.size = sizeMatch[1].trim();

  const sprintMatch = content.match(/\*\*Sprint\*\*:\s*([^|*]+)/);
  if (sprintMatch) result.sprint = sprintMatch[1].trim();

  const linkMatch = content.match(/\*\*Link\*\*:\s*([^|*\n]+)/);
  if (linkMatch) result.link = linkMatch[1].trim();

  return result;
}

/**
 * Extract GitHub issue number from a Link field value.
 * Handles formats: "[#187](url)", "#187", "187"
 */
function extractIssueNumber(linkStr) {
  if (!linkStr) return null;
  const match = linkStr.match(/#(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract GitHub issue number from a file's **Link** header field.
 */
function extractIssueNumberFromFile(cwd, filePath) {
  if (!filePath) return null;
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(resolved);
  if (!content) return null;
  const linkMatch = content.match(/\*\*Link\*\*:\s*([^|*\n]+)/);
  if (!linkMatch) return null;
  return extractIssueNumber(linkMatch[1].trim());
}

// ─── Story Requirements ──────────────────────────────────────────────────────

/**
 * Extract story requirements: user story statement, description, and AC scenario count.
 */
function extractStoryRequirements(content) {
  const result = { user_story: null, description: null, acceptance_criteria_count: 0 };
  if (!content) return result;

  const userStorySection = extractMarkdownSection(content, 'User Story', 2);
  if (userStorySection) {
    result.user_story = userStorySection.replace(/^>\s?/gm, '').trim();
  }

  const descSection = extractMarkdownSection(content, 'Description', 2);
  if (descSection) {
    result.description = descSection.trim();
  }

  const scenarioMatches = content.match(/^###\s+Scenario:/gm);
  result.acceptance_criteria_count = scenarioMatches ? scenarioMatches.length : 0;

  return result;
}

/**
 * Parse the "## Relevant Wiki" section to extract structured wiki file references.
 */
function extractWikiReferences(content) {
  const result = { system_wide: [], subsystem_docs: [], total_count: 0 };
  if (!content) return result;

  const wikiSection = extractMarkdownSection(content, 'Relevant Wiki', 2);
  if (!wikiSection) return result;

  const linePattern = /^-\s+`([^`]+)`\s*[—–-]\s*(.+)$/gm;
  let match;
  while ((match = linePattern.exec(wikiSection)) !== null) {
    const filePath = match[1].trim();
    const reason = match[2].trim();

    if (filePath.includes('/system-wide/')) {
      result.system_wide.push(filePath);
    } else {
      let category = 'other';
      if (filePath.includes('/systems/')) category = 'systems';
      else if (filePath.includes('/patterns/')) category = 'patterns';
      else if (filePath.includes('/cross-cutting/')) category = 'cross-cutting';
      else if (filePath.includes('/guides/')) category = 'guides';
      else if (filePath.includes('/decisions/')) category = 'decisions';
      else if (filePath.includes('/architecture')) category = 'architecture';

      result.subsystem_docs.push({ path: filePath, category, reason });
    }
  }

  result.total_count = result.system_wide.length + result.subsystem_docs.length;
  return result;
}

// ─── Path Computation ────────────────────────────────────────────────────────

/**
 * Compute all story-related paths and slugs from parent context.
 */
function computeStoryPaths(epicId, epicTitle, featureId, featureTitle, storyId, storyTitle) {
  const epicSlug = generateSlug(`${epicId}-${epicTitle}`) || 'unknown-epic';
  const featureSlug = generateSlug(`${featureId}-${featureTitle}`) || 'unknown-feature';
  const storySlug = generateSlug(`${storyId}-${storyTitle}`) || 'unknown-story';

  const storyDir = `.ace/artifacts/product/${epicSlug}/${featureSlug}/${storySlug}`;
  const featureDir = `.ace/artifacts/product/${epicSlug}/${featureSlug}`;

  return {
    epic_slug: epicSlug,
    feature_slug: featureSlug,
    story_slug: storySlug,
    story_dir: storyDir,
    story_file: `${storyDir}/${storySlug}.md`,
    external_analysis_file: `${storyDir}/external-analysis.md`,
    integration_analysis_file: `${storyDir}/integration-analysis.md`,
    feature_dir: featureDir,
    feature_file: `${featureDir}/${featureSlug}.md`,
  };
}

// ─── Story State Management ──────────────────────────────────────────────────

/**
 * Update story status across story file, feature file, and product backlog.
 * Handles: story header update, feature index table update, backlog table update,
 * and auto-promotes feature to Done when all stories are Done.
 *
 * Called via: node script.js update-state story=<path> status=<Refined|InProgress|Done|DevReady>
 */
function updateState(cwd, raw, extraArgs) {
  const params = parseKeyValueArgs(extraArgs);
  const storyParam = params.story;
  const newStatus = params.status;

  if (!storyParam) {
    error('update-state requires: story=<path>');
  }
  if (!newStatus || !['Done', 'DevReady', 'Refined', 'InProgress', 'In Progress'].includes(newStatus)) {
    error('update-state requires: status=Done|DevReady|Refined|InProgress');
  }

  const displayStatus = newStatus === 'InProgress' ? 'In Progress' : newStatus;

  const result = {
    story_updated: false,
    feature_updated: false,
    backlog_updated: false,
    feature_status_changed: false,
    new_status: displayStatus,
    errors: [],
  };

  // Resolve story file path
  const classified = classifyStoryParam(storyParam);
  if (classified.type !== 'file' || !classified.filePath) {
    result.errors.push('update-state currently only supports file paths');
    output(result, raw);
    return;
  }

  const storyFilePath = path.isAbsolute(classified.filePath)
    ? classified.filePath
    : path.join(cwd, classified.filePath);

  // 1. Update story file header
  const storyContent = safeReadFile(storyFilePath);
  if (!storyContent) {
    result.errors.push(`Could not read story file: ${classified.filePath}`);
    output(result, raw);
    return;
  }

  const updatedStory = storyContent.replace(
    /(\*\*Status\*\*:\s*)([^|*\n]+)/,
    `$1${displayStatus}`
  );
  if (updatedStory !== storyContent) {
    try {
      fs.writeFileSync(storyFilePath, updatedStory, 'utf-8');
      result.story_updated = true;
    } catch (e) {
      result.errors.push(`Failed to write story file: ${e.message}`);
    }
  }

  const metadata = extractStoryMetadata(storyContent);
  const storyId = metadata.id;

  // 2. Update feature file story index
  const storyDir = path.dirname(storyFilePath);
  const featureDir = path.dirname(storyDir);
  const featureSlug = path.basename(featureDir);
  const featureFilePath = path.join(featureDir, `${featureSlug}.md`);

  const featureContent = safeReadFile(featureFilePath);
  if (featureContent && storyId) {
    const storyIdEscaped = storyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tableRowPattern = new RegExp(
      `(\\|\\s*${storyIdEscaped}\\s*\\|[^|]*\\|[^|]*\\|\\s*)([^|]*)(\\s*\\|)`,
      'm'
    );
    const updatedFeature = featureContent.replace(tableRowPattern, `$1${displayStatus}$3`);

    if (updatedFeature !== featureContent) {
      try {
        fs.writeFileSync(featureFilePath, updatedFeature, 'utf-8');
        result.feature_updated = true;
      } catch (e) {
        result.errors.push(`Failed to write feature file: ${e.message}`);
      }
    }

    // Check if all stories in the feature are Done
    if (displayStatus === 'Done') {
      const updatedFeatureContent = safeReadFile(featureFilePath) || updatedFeature;
      const statusPattern = /\|\s*(?:S\d+|#\d+)\s*\|[^|]*\|[^|]*\|\s*([^|]*)\s*\|/gm;
      let allDone = true;
      let match;
      let storyCount = 0;
      while ((match = statusPattern.exec(updatedFeatureContent)) !== null) {
        storyCount++;
        const status = match[1].trim();
        if (status !== 'Done') {
          allDone = false;
        }
      }

      if (allDone && storyCount > 0) {
        const featureWithDoneStatus = updatedFeatureContent.replace(
          /(\*\*Status\*\*:\s*)([^|*\n]+)/,
          '$1Done'
        );
        if (featureWithDoneStatus !== updatedFeatureContent) {
          try {
            fs.writeFileSync(featureFilePath, featureWithDoneStatus, 'utf-8');
            result.feature_status_changed = true;
          } catch (e) {
            result.errors.push(`Failed to update feature status: ${e.message}`);
          }
        }
      }
    }
  }

  // 3. Update product backlog
  const backlogPath = path.join(cwd, '.ace', 'artifacts', 'product', 'product-backlog.md');
  const backlogContent = safeReadFile(backlogPath);
  if (backlogContent && storyId) {
    let updatedBacklog = backlogContent;

    const storyIdEscaped = storyId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const backlogStoryPattern = new RegExp(
      `(\\|\\s*${storyIdEscaped}\\s*\\|[^|]*\\|[^|]*\\|\\s*)([^|]*)(\\s*\\|)`,
      'm'
    );
    updatedBacklog = updatedBacklog.replace(backlogStoryPattern, `$1${displayStatus}$3`);

    if (result.feature_status_changed && metadata.feature.id) {
      const featureIdEscaped = metadata.feature.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const backlogFeaturePattern = new RegExp(
        `(\\|\\s*${featureIdEscaped}\\s*\\|[^|]*\\|[^|]*\\|\\s*)([^|]*)(\\s*\\|)`,
        'm'
      );
      updatedBacklog = updatedBacklog.replace(backlogFeaturePattern, `$1Done$3`);
    }

    if (updatedBacklog !== backlogContent) {
      try {
        fs.writeFileSync(backlogPath, updatedBacklog, 'utf-8');
        result.backlog_updated = true;
      } catch (e) {
        result.errors.push(`Failed to write product backlog: ${e.message}`);
      }
    }
  }

  if (result.errors.length === 0) delete result.errors;
  output(result, raw);
}

module.exports = {
  classifyStoryParam,
  extractMarkdownSection,
  extractStoryMetadata,
  extractIssueNumber,
  extractIssueNumberFromFile,
  extractStoryRequirements,
  extractWikiReferences,
  computeStoryPaths,
  updateState,
};
