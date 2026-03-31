/**
 * ACE GitHub — GitHub integration operations shared across ACE skills.
 *
 * Extracted from ace-tools.js monolith. Contains: project context resolution
 * and story/feature GitHub sync.
 *
 * Usage: const { syncStory, resolveProjectContext } = require('./ace-github');
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const {
  safeReadFile, parseKeyValueArgs, execCommand, output, error,
} = require('./ace-core');
const {
  extractStoryMetadata, extractIssueNumberFromFile,
} = require('./ace-story');

// ─── Project Context ─────────────────────────────────────────────────────────

/**
 * Resolve project ID and field definitions for a GitHub Project.
 * Returns { project_id, fields } where fields maps field names to { id, type, options? }.
 */
function resolveProjectContext(owner, project, cwd) {
  const projectListRaw = execCommand(
    `gh project list --owner ${owner} --format json --limit 20`,
    cwd
  );

  let project_id = null;
  if (projectListRaw) {
    try {
      const parsed = JSON.parse(projectListRaw);
      const projects = parsed.projects || parsed || [];
      const match = projects.find(p => String(p.number) === String(project));
      if (match) project_id = match.id;
    } catch {}
  }

  const fieldsRaw = execCommand(
    `gh project field-list ${project} --owner ${owner} --format json`,
    cwd
  );

  const fields = {};
  if (fieldsRaw) {
    try {
      const parsed = JSON.parse(fieldsRaw);
      const fieldList = parsed.fields || parsed || [];
      for (const field of fieldList) {
        const entry = { id: field.id, type: field.type };
        if (field.options) {
          entry.options = {};
          for (const opt of field.options) {
            entry.options[opt.name] = opt.id;
          }
        }
        fields[field.name] = entry;
      }
    } catch {}
  }

  return { project_id, fields };
}

// ─── Story Sync ──────────────────────────────────────────────────────────────

/**
 * Sync story and feature body + project status to GitHub.
 * Updates issue body via --body-file and project status via GraphQL.
 *
 * Required args: repo=owner/name  story_file=path
 * Optional args: feature_file=path  owner=org  project=number
 */
function syncStory(cwd, raw, extraArgs) {
  const params = parseKeyValueArgs(extraArgs);
  const repo = params.repo;
  const storyFile = params.story_file;

  if (!repo || !storyFile) {
    error('sync-github requires: repo=owner/name story_file=path');
  }

  const result = {
    story: { number: null, updated: false, status_synced: false, error: null },
    feature: { number: null, updated: false, status_synced: false, error: null },
  };

  // Resolve project context for status updates (optional)
  const owner = params.owner;
  const project = params.project;
  let projectCtx = null;

  if (owner && project) {
    projectCtx = resolveProjectContext(owner, project, cwd);
    if (!projectCtx.project_id) {
      process.stderr.write(`  !  Could not resolve GitHub Project #${project}. Status updates skipped.\n`);
      projectCtx = null;
    } else if (!projectCtx.fields.Status) {
      process.stderr.write('  !  GitHub Project has no Status field. Status updates skipped.\n');
      projectCtx = null;
    }
  }

  // Helper: update project status for a single issue
  function syncProjectStatus(issueNumber, filePath, label) {
    if (!projectCtx) return false;

    const content = safeReadFile(filePath);
    if (!content) return false;

    const metadata = extractStoryMetadata(content);
    const localStatus = metadata.status;
    if (!localStatus) {
      process.stderr.write(`  —  ${label} has no Status field. Skipping project status update.\n`);
      return false;
    }

    const statusField = projectCtx.fields.Status;
    const statusOptionId = statusField.options?.[localStatus];
    if (!statusOptionId) {
      process.stderr.write(`  !  GitHub Project has no status option "${localStatus}". Skipping status update for ${label}.\n`);
      return false;
    }

    // Look up project item ID via GraphQL
    const repoParts = repo.split('/');
    const repoOwner = repoParts[0];
    const repoName = repoParts[1] || repoParts[0];
    const itemQuery = `query { repository(owner: \\"${repoOwner}\\", name: \\"${repoName}\\") { issue(number: ${issueNumber}) { projectItems(first: 10) { nodes { id project { id } } } } } }`;
    const itemResult = execCommand(
      `gh api graphql -f query="${itemQuery}"`,
      cwd
    );
    let itemId = null;
    if (itemResult) {
      try {
        const parsed = JSON.parse(itemResult);
        const nodes = parsed.data?.repository?.issue?.projectItems?.nodes || [];
        const match = nodes.find(n => n.project?.id === projectCtx.project_id);
        itemId = match?.id || null;
      } catch {}
    }
    if (!itemId) {
      process.stderr.write(`  !  ${label} #${issueNumber} not found in GitHub Project. Skipping status update.\n`);
      return false;
    }

    const statusOk = execCommand(
      `gh project item-edit --project-id ${projectCtx.project_id} --id ${itemId} --field-id ${statusField.id} --single-select-option-id ${statusOptionId}`,
      cwd
    );
    if (statusOk !== null) {
      process.stderr.write(`  +  Updated ${label} #${issueNumber} project status → "${localStatus}".\n`);
      return true;
    } else {
      process.stderr.write(`  x  FAILED to update ${label} #${issueNumber} project status.\n`);
      return false;
    }
  }

  // Sync story issue
  const storyPath = path.isAbsolute(storyFile) ? storyFile : path.join(cwd, storyFile);
  const storyIssue = extractIssueNumberFromFile(cwd, storyFile);

  if (!storyIssue) {
    result.story.error = 'No GitHub issue linked';
    process.stderr.write('  —  Story has no GitHub issue linked. Skipping.\n');
  } else {
    result.story.number = storyIssue;
    const safePath = storyPath.replace(/\\/g, '/');
    try {
      execSync(`gh issue edit ${storyIssue} --repo ${repo} --body-file "${safePath}"`, {
        cwd, shell: 'bash', stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8', timeout: 30000,
      });
      result.story.updated = true;
      process.stderr.write(`  +  Updated GitHub story issue #${storyIssue}.\n`);
    } catch (e) {
      result.story.error = (e.stderr || e.message || 'unknown error').trim();
      process.stderr.write(`  x  FAILED to update GitHub story issue #${storyIssue}.\n`);
      process.stderr.write(`     Error: ${result.story.error}\n`);
    }

    if (result.story.updated) {
      result.story.status_synced = syncProjectStatus(storyIssue, storyPath, 'Story');
    }
  }

  // Sync feature issue
  const featureFile = params.feature_file;
  if (featureFile) {
    const featurePath = path.isAbsolute(featureFile) ? featureFile : path.join(cwd, featureFile);
    const featureIssue = extractIssueNumberFromFile(cwd, featureFile);

    if (!featureIssue) {
      result.feature.error = 'No GitHub issue linked';
      process.stderr.write('  —  Feature has no GitHub issue linked. Skipping.\n');
    } else {
      result.feature.number = featureIssue;
      const safePath = featurePath.replace(/\\/g, '/');
      try {
        execSync(`gh issue edit ${featureIssue} --repo ${repo} --body-file "${safePath}"`, {
          cwd, shell: 'bash', stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8', timeout: 30000,
        });
        result.feature.updated = true;
        process.stderr.write(`  +  Updated GitHub feature issue #${featureIssue}.\n`);
      } catch (e) {
        result.feature.error = (e.stderr || e.message || 'unknown error').trim();
        process.stderr.write(`  x  FAILED to update GitHub feature issue #${featureIssue}.\n`);
        process.stderr.write(`     Error: ${result.feature.error}\n`);
      }

      if (result.feature.updated) {
        result.feature.status_synced = syncProjectStatus(featureIssue, featurePath, 'Feature');
      }
    }
  }

  output(result, raw);
}

// ─── Resolve Fields ─────────────────────────────────────────────────────────

/**
 * Resolve native issue types and project field definitions.
 * Required args: repo=owner/name  owner=org  project=number
 * Outputs: { issue_types, project_id, fields }
 */
function resolveFields(cwd, raw, extraArgs) {
  const params = parseKeyValueArgs(extraArgs);
  const repo = params.repo;
  const owner = params.owner;
  const project = params.project;

  if (!repo || !owner || !project) {
    error('resolve-fields requires: repo=owner/name owner=org project=number');
  }

  const repoName = repo.split('/')[1];

  // Resolve native issue types via GraphQL
  const issueTypes = {};
  const typeQuery = `query { repository(owner: \\"${owner}\\", name: \\"${repoName}\\") { issueTypes(first: 10) { nodes { id name } } } }`;
  const typeResult = execCommand(
    `gh api graphql -f query="${typeQuery}"`,
    cwd
  );
  if (typeResult) {
    try {
      const parsed = JSON.parse(typeResult);
      const nodes = parsed.data?.repository?.issueTypes?.nodes || [];
      for (const node of nodes) {
        issueTypes[node.name] = node.id;
      }
    } catch {}
  }

  // Resolve project context (project_id + fields)
  const ctx = resolveProjectContext(owner, project, cwd);

  output({ issue_types: issueTypes, project_id: ctx.project_id, fields: ctx.fields }, raw);
}

// ─── Create Issue ───────────────────────────────────────────────────────────

/**
 * Create a GitHub issue, set native type, add to project, and set project fields.
 *
 * Required args: type, title, repo, owner, project, project_id, type_id
 * Body args (one of): body=... OR body_file=path
 * Optional: status_field_id, status_option_id, priority_field_id, priority_option_id,
 *           estimate_field_id, estimate, parent, milestone
 * Outputs: { number, url, item_id, type_set, status_set, priority_set, estimate_set,
 *            parent_set, milestone_set }
 */
function createIssue(cwd, raw, extraArgs) {
  const params = parseKeyValueArgs(extraArgs);
  const type = params.type;
  const title = params.title;
  let body = params.body || '';
  const bodyFile = params.body_file;
  const repo = params.repo;
  const owner = params.owner;
  const project = params.project;
  const projectId = params.project_id;
  const typeId = params.type_id;

  // Read body from file if provided
  if (bodyFile) {
    const filePath = path.isAbsolute(bodyFile) ? bodyFile : path.join(cwd, bodyFile);
    const content = safeReadFile(filePath);
    if (content !== null) body = content;
  }

  if (!type || !title || !repo || !owner || !project || !projectId || !typeId) {
    error('create-issue requires: type, title, repo, owner, project, project_id, type_id');
  }

  const prefixedTitle = `[${type}] ${title}`;

  // Write body to temp file to avoid shell escaping issues
  const tmpFile = path.join(os.tmpdir(), `ace-issue-${Date.now()}.md`);
  try {
    fs.writeFileSync(tmpFile, body, 'utf-8');
  } catch (e) {
    error(`Failed to write temp body file: ${e.message}`);
  }

  const safeTmpFile = tmpFile.replace(/\\/g, '/');

  // Create issue via gh CLI
  let issueUrl = null;
  try {
    issueUrl = execSync(
      `gh issue create --repo ${repo} --title "${prefixedTitle.replace(/"/g, '\\"')}" --body-file "${safeTmpFile}"`,
      { cwd, shell: 'bash', stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8', timeout: 30000 }
    ).trim();
  } catch (e) {
    try { fs.unlinkSync(tmpFile); } catch {}
    error(`Failed to create issue: ${(e.stderr || e.message || '').trim()}`);
  }

  try { fs.unlinkSync(tmpFile); } catch {}

  // Extract issue number from URL
  const number = issueUrl ? parseInt(issueUrl.split('/').pop(), 10) : null;

  const result = {
    number,
    url: issueUrl,
    item_id: null,
    type_set: false,
    status_set: false,
    priority_set: false,
    estimate_set: false,
    parent_set: false,
    milestone_set: false,
  };

  if (!number) {
    output(result, raw);
    return;
  }

  // Set native issue type via GraphQL mutation
  if (typeId) {
    const repoName = repo.split('/')[1];
    // First get the issue node ID
    const issueQuery = `query { repository(owner: \\"${owner}\\", name: \\"${repoName}\\") { issue(number: ${number}) { id } } }`;
    const issueResult = execCommand(`gh api graphql -f query="${issueQuery}"`, cwd);
    let issueNodeId = null;
    if (issueResult) {
      try {
        issueNodeId = JSON.parse(issueResult).data?.repository?.issue?.id;
      } catch {}
    }
    if (issueNodeId) {
      const typeMutation = `mutation { updateIssue(input: { id: \\"${issueNodeId}\\", issueTypeId: \\"${typeId}\\" }) { issue { id } } }`;
      const typeOk = execCommand(`gh api graphql -f query="${typeMutation}"`, cwd);
      result.type_set = typeOk !== null;
    }
  }

  // Add to project
  const addResult = execCommand(
    `gh project item-add ${project} --owner ${owner} --url ${issueUrl} --format json`,
    cwd
  );
  if (addResult) {
    try {
      const parsed = JSON.parse(addResult);
      result.item_id = parsed.id || null;
    } catch {}
  }

  // Set project fields if item was added
  if (result.item_id) {
    // Status (single-select)
    if (params.status_field_id && params.status_option_id) {
      const statusOk = execCommand(
        `gh project item-edit --project-id ${projectId} --id ${result.item_id} --field-id ${params.status_field_id} --single-select-option-id ${params.status_option_id}`,
        cwd
      );
      result.status_set = statusOk !== null;
    }

    // Priority (single-select)
    if (params.priority_field_id && params.priority_option_id) {
      const priorityOk = execCommand(
        `gh project item-edit --project-id ${projectId} --id ${result.item_id} --field-id ${params.priority_field_id} --single-select-option-id ${params.priority_option_id}`,
        cwd
      );
      result.priority_set = priorityOk !== null;
    }

    // Estimate (number)
    if (params.estimate_field_id && params.estimate) {
      const estimateOk = execCommand(
        `gh project item-edit --project-id ${projectId} --id ${result.item_id} --field-id ${params.estimate_field_id} --number ${params.estimate}`,
        cwd
      );
      result.estimate_set = estimateOk !== null;
    }
  }

  // Set parent via GraphQL addSubIssue mutation
  if (params.parent) {
    const repoName = repo.split('/')[1];
    // Get parent issue node ID
    const parentQuery = `query { repository(owner: \\"${owner}\\", name: \\"${repoName}\\") { issue(number: ${params.parent}) { id } } }`;
    const parentResult = execCommand(`gh api graphql -f query="${parentQuery}"`, cwd);
    let parentNodeId = null;
    if (parentResult) {
      try {
        parentNodeId = JSON.parse(parentResult).data?.repository?.issue?.id;
      } catch {}
    }
    // Get child issue node ID
    const childQuery = `query { repository(owner: \\"${owner}\\", name: \\"${repoName}\\") { issue(number: ${number}) { id } } }`;
    const childResult = execCommand(`gh api graphql -f query="${childQuery}"`, cwd);
    let childNodeId = null;
    if (childResult) {
      try {
        childNodeId = JSON.parse(childResult).data?.repository?.issue?.id;
      } catch {}
    }
    if (parentNodeId && childNodeId) {
      const subIssueMutation = `mutation { addSubIssue(input: { issueId: \\"${parentNodeId}\\", subIssueId: \\"${childNodeId}\\" }) { issue { id } } }`;
      const parentOk = execCommand(`gh api graphql -f query="${subIssueMutation}"`, cwd);
      result.parent_set = parentOk !== null;
    }
  }

  // Set milestone
  if (params.milestone) {
    const milestoneOk = execCommand(
      `gh issue edit ${number} --repo ${repo} --milestone "${params.milestone}"`,
      cwd
    );
    result.milestone_set = milestoneOk !== null;
  }

  output(result, raw);
}

// ─── Update Issue ───────────────────────────────────────────────────────────

/**
 * Update an existing GitHub issue's title, body, and/or project fields.
 *
 * Required args: number, repo
 * Optional: title, body, body_file, owner, project, project_id,
 *           status_field_id, status_option_id, priority_field_id, priority_option_id,
 *           estimate_field_id, estimate
 * Outputs: { number, updated_title, updated_body, status_set, priority_set, estimate_set }
 */
function updateIssue(cwd, raw, extraArgs) {
  const params = parseKeyValueArgs(extraArgs);
  const number = params.number;
  const repo = params.repo;
  const title = params.title;
  let body = params.body;
  const bodyFile = params.body_file;

  if (!number || !repo) {
    error('update-issue requires: number, repo');
  }

  const result = {
    number: parseInt(number, 10),
    updated_title: false,
    updated_body: false,
    status_set: false,
    priority_set: false,
    estimate_set: false,
  };

  // Build gh issue edit command parts
  const editParts = [`gh issue edit ${number} --repo ${repo}`];

  if (title) {
    editParts.push(`--title "${title.replace(/"/g, '\\"')}"`);
  }

  let tmpFile = null;
  if (bodyFile) {
    const filePath = path.isAbsolute(bodyFile) ? bodyFile : path.join(cwd, bodyFile);
    const safePath = filePath.replace(/\\/g, '/');
    editParts.push(`--body-file "${safePath}"`);
  } else if (body) {
    tmpFile = path.join(os.tmpdir(), `ace-issue-update-${Date.now()}.md`);
    try {
      fs.writeFileSync(tmpFile, body, 'utf-8');
      const safeTmpFile = tmpFile.replace(/\\/g, '/');
      editParts.push(`--body-file "${safeTmpFile}"`);
    } catch (e) {
      error(`Failed to write temp body file: ${e.message}`);
    }
  }

  // Execute issue edit if we have title or body to update
  if (title || bodyFile || body) {
    try {
      execSync(editParts.join(' '), {
        cwd, shell: 'bash', stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8', timeout: 30000,
      });
      if (title) result.updated_title = true;
      if (bodyFile || body) result.updated_body = true;
    } catch (e) {
      process.stderr.write(`  x  Failed to update issue #${number}: ${(e.stderr || e.message || '').trim()}\n`);
    }
  }

  if (tmpFile) {
    try { fs.unlinkSync(tmpFile); } catch {}
  }

  // Update project fields if provided
  const projectId = params.project_id;

  if (projectId && (params.status_field_id || params.priority_field_id || params.estimate_field_id)) {
    // Find the project item ID for this issue
    const repoParts = repo.split('/');
    const repoOwner = repoParts[0];
    const repoName = repoParts[1] || repoParts[0];
    const itemQuery = `query { repository(owner: \\"${repoOwner}\\", name: \\"${repoName}\\") { issue(number: ${number}) { projectItems(first: 10) { nodes { id project { id } } } } } }`;
    const itemResult = execCommand(`gh api graphql -f query="${itemQuery}"`, cwd);
    let itemId = null;
    if (itemResult) {
      try {
        const parsed = JSON.parse(itemResult);
        const nodes = parsed.data?.repository?.issue?.projectItems?.nodes || [];
        const match = nodes.find(n => n.project?.id === projectId);
        itemId = match?.id || null;
      } catch {}
    }

    if (itemId) {
      // Status (single-select)
      if (params.status_field_id && params.status_option_id) {
        const statusOk = execCommand(
          `gh project item-edit --project-id ${projectId} --id ${itemId} --field-id ${params.status_field_id} --single-select-option-id ${params.status_option_id}`,
          cwd
        );
        result.status_set = statusOk !== null;
      }

      // Priority (single-select)
      if (params.priority_field_id && params.priority_option_id) {
        const priorityOk = execCommand(
          `gh project item-edit --project-id ${projectId} --id ${itemId} --field-id ${params.priority_field_id} --single-select-option-id ${params.priority_option_id}`,
          cwd
        );
        result.priority_set = priorityOk !== null;
      }

      // Estimate (number)
      if (params.estimate_field_id && params.estimate) {
        const estimateOk = execCommand(
          `gh project item-edit --project-id ${projectId} --id ${itemId} --field-id ${params.estimate_field_id} --number ${params.estimate}`,
          cwd
        );
        result.estimate_set = estimateOk !== null;
      }
    } else {
      process.stderr.write(`  !  Issue #${number} not found in GitHub Project. Skipping field updates.\n`);
    }
  }

  output(result, raw);
}

// ─── Fetch Issues ───────────────────────────────────────────────────────────

/**
 * Fetch all epics and features from a GitHub Project via paginated GraphQL.
 *
 * Required args: repo=owner/name  owner=org  project=number
 * Outputs: { epics: [...], features: [...], counts: { total, epics, features, skipped } }
 */
function fetchIssues(cwd, raw, extraArgs) {
  const params = parseKeyValueArgs(extraArgs);
  const repo = params.repo;
  const owner = params.owner;
  const project = params.project;

  if (!repo || !owner || !project) {
    error('fetch-issues requires: repo=owner/name owner=org project=number');
  }

  // Get project ID
  const projectListRaw = execCommand(
    `gh project list --owner ${owner} --format json --limit 20`,
    cwd
  );
  let projectId = null;
  if (projectListRaw) {
    try {
      const parsed = JSON.parse(projectListRaw);
      const projects = parsed.projects || parsed || [];
      const match = projects.find(p => String(p.number) === String(project));
      if (match) projectId = match.id;
    } catch {}
  }

  if (!projectId) {
    error(`Could not find GitHub Project #${project} for owner "${owner}".`);
  }

  // Paginated GraphQL query to fetch all project items
  const allItems = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const afterClause = cursor ? `, after: \\"${cursor}\\"` : '';
    const query = `query {
      node(id: \\"${projectId}\\") {
        ... on ProjectV2 {
          items(first: 100${afterClause}) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2Field { name } } }
                  ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2Field { name } } }
                  ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2SingleSelectField { name } } }
                  ... on ProjectV2ItemFieldIterationValue { title field { ... on ProjectV2IterationField { name } } }
                }
              }
              content {
                ... on Issue {
                  number
                  title
                  url
                  state
                  issueType { name }
                  parent { number title }
                  milestone { title }
                }
              }
            }
          }
        }
      }
    }`.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    const result = execCommand(`gh api graphql -f query="${query}"`, cwd);
    if (!result) break;

    try {
      const parsed = JSON.parse(result);
      const items = parsed.data?.node?.items;
      if (!items) break;

      allItems.push(...(items.nodes || []));
      hasNextPage = items.pageInfo?.hasNextPage || false;
      cursor = items.pageInfo?.endCursor || null;
    } catch {
      break;
    }
  }

  // Process items into epics and features
  const epics = [];
  const features = [];
  let skipped = 0;

  for (const item of allItems) {
    const content = item.content;
    if (!content || !content.number) {
      skipped++;
      continue;
    }

    // Determine type: native issueType first, then title prefix fallback
    let itemType = null;
    if (content.issueType?.name) {
      const nativeType = content.issueType.name;
      if (nativeType === 'Epic' || nativeType === 'Feature') {
        itemType = nativeType;
      }
    }
    if (!itemType) {
      if (content.title.startsWith('[Epic]')) {
        itemType = 'Epic';
      } else if (content.title.startsWith('[Feature]')) {
        itemType = 'Feature';
      }
    }

    if (!itemType) {
      skipped++;
      continue;
    }

    // Extract field values
    const fieldValues = {};
    const fvNodes = item.fieldValues?.nodes || [];
    for (const fv of fvNodes) {
      const fieldName = fv.field?.name;
      if (!fieldName) continue;
      if (fv.name !== undefined) fieldValues[fieldName] = fv.name;           // single-select
      else if (fv.number !== undefined) fieldValues[fieldName] = fv.number;  // number
      else if (fv.text !== undefined) fieldValues[fieldName] = fv.text;      // text
      else if (fv.title !== undefined) fieldValues[fieldName] = fv.title;    // iteration
    }

    const entry = {
      number: content.number,
      title: content.title,
      status: fieldValues.Status || null,
      priority: fieldValues.Priority || null,
      estimate: fieldValues.Estimate || null,
      sprint: fieldValues.Sprint || fieldValues.Iteration || null,
      milestone: content.milestone?.title || null,
      url: content.url,
      state: content.state,
    };

    if (itemType === 'Epic') {
      epics.push(entry);
    } else {
      entry.parent_number = content.parent?.number || null;
      entry.parent_title = content.parent?.title || null;
      features.push(entry);
    }
  }

  output({
    epics,
    features,
    counts: {
      total: allItems.length,
      epics: epics.length,
      features: features.length,
      skipped,
    },
  }, raw);
}

module.exports = {
  resolveProjectContext,
  syncStory,
  resolveFields,
  createIssue,
  updateIssue,
  fetchIssues,
};
