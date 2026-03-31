# ACE Skills/Plugin Migration Proposal

## Executive Summary

**Yes, ACE can be migrated to use skills (and optionally a plugin) instead of commands.** The migration is architecturally sound and would bring several benefits: better auto-discovery, supporting files, model/effort control per skill, and proper distribution via plugin marketplaces. However, there are significant nuances that require careful planning.

This document is a comprehensive deep-dive into what the migration entails.

---

## 1. Current ACE Architecture

### 1.1 Component Inventory

| Component | Count | Location (repo) | Installed to |
|-----------|-------|-----------------|-------------|
| Commands | 17 | `commands/ace/*.md` | `~/.claude/commands/ace/` |
| Agents | 8 | `agents/*.md` | `~/.claude/agents/` |
| Workflows | 17 | `agile-context-engineering/workflows/*.xml` | `~/.claude/agile-context-engineering/workflows/` |
| Templates | 25 | `agile-context-engineering/templates/**/*.xml` | `~/.claude/agile-context-engineering/templates/` |
| Utils | 2 | `agile-context-engineering/utils/` | `~/.claude/agile-context-engineering/utils/` |
| CLI Tool | 1 (2881 lines) | `agile-context-engineering/src/ace-tools.js` | Split into `shared/lib/` + per-skill `script.js` (see 4.8) |
| Hooks | 2 | `hooks/` | `~/.claude/hooks/` |
| Installer | 1 | `bin/install.js` | N/A (npm entrypoint) |

### 1.2 How Commands Work Today

Each command is a `.md` file with frontmatter + XML body:

```
commands/ace/execute-story.md
  |-- Frontmatter: name, description, argument-hint, allowed-tools
  |-- XML body:
       |-- <execution-time>     -- when to trigger
       |-- <input>              -- flags, required/optional params
       |-- <execution-context>  -- @-references to workflows, templates, utils
       |-- <output>             -- objective, artifacts
       |-- <process>            -- step-by-step instructions
       |-- <next-steps>         -- what to run after
```

**Critical mechanism**: The `<execution-context>` section uses `@~/.claude/...` references to load workflows, templates, and utils into context. This is how Claude Code currently resolves supporting files -- via `@`-file references embedded in the command content.

### 1.3 How the Installer Works

`bin/install.js` copies files from the npm package to `~/.claude/`:
- `commands/` -> `~/.claude/commands/`
- `agents/` -> `~/.claude/agents/`
- `agile-context-engineering/` -> `~/.claude/agile-context-engineering/`
- `hooks/` -> `~/.claude/hooks/`
- Configures `settings.json` (hooks, statusline)

### 1.4 Inter-Command Relationships

Commands form a DAG (directed acyclic graph):

```
help
  |-- plan-product-vision
  |-- map-system -> map-subsystem -> map-story
  |-- init-coding-standards
  |-- plan-backlog -> plan-feature -> plan-story -> execute-story
                                          |              |
                                          |-- research-story-wiki
                                          |-- research-external-solution
                                          |-- research-integration-solution
                                          |-- research-technical-solution
                                          |              |
                                          |--------------+-- review-story
                                                         |-- map-story -> map-walkthrough
```

Commands call other commands via the `Agent` tool with `/ace:command-name` patterns.

---

## 2. Skills vs Commands -- Feature Comparison

### 2.1 What Skills Add

| Feature | Commands (current) | Skills (new) |
|---------|-------------------|-------------|
| Frontmatter fields | `name`, `description`, `argument-hint`, `allowed-tools` | Same + `disable-model-invocation`, `user-invocable`, `model`, `effort`, `context`, `agent`, `hooks` |
| Supporting files | Via `@~/.claude/...` references in body | Native directory structure: `SKILL.md` + any files in dir |
| Auto-discovery | Yes (description in context) | Yes (description in context, with budget control) |
| Invocation control | All user-invocable | `disable-model-invocation` and `user-invocable` flags |
| Subagent execution | Manual via `Agent` tool | Native `context: fork` + `agent` field |
| Dynamic context | Not built-in | `` !`command` `` shell injection |
| String substitutions | `$ARGUMENTS` only | `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}` |
| Scoping | Global (`~/.claude/commands/`) or project (`.claude/commands/`) | Same + plugin namespace + enterprise |
| Model override | Via `ace-tools.js resolve-model` | Native `model` field in frontmatter |
| Effort level | Not available | Native `effort` field |
| Lifecycle hooks | Global hooks only | Per-skill `hooks` field in frontmatter |

### 2.2 What Commands Have That Skills Don't Need

- `@`-file references for loading context -> replaced by `${CLAUDE_SKILL_DIR}` + relative paths in supporting files
- XML-structured body -> skills use plain markdown (simpler)

### 2.3 Key Insight: Commands Already Work as Skills

From the docs: *"Custom commands have been merged into skills. A file at `.claude/commands/deploy.md` and a skill at `.claude/skills/deploy/SKILL.md` both create `/deploy` and work the same way. Your existing `.claude/commands/` files keep working."*

**This means ACE already works as-is.** The migration is about unlocking the new features, not about fixing something broken.

---

## 3. Plugin Architecture

### 3.1 Plugin Structure (What ACE Would Look Like)

```
ace-plugin/
|-- .claude-plugin/
|   |-- plugin.json                          # Manifest
|-- skills/
|   |-- help/
|   |   |-- SKILL.md                         # Was: commands/ace/help.md
|   |   |-- workflow.xml                     # Was: workflows/help.xml
|   |   |-- script.js                        # Skill-specific ace-tools logic
|   |   |-- script.test.js                   # Tests for this skill's script
|   |-- execute-story/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- story-template.xml
|   |   |-- walkthrough-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- plan-story/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- story-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- plan-feature/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- feature-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- plan-backlog/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- product-backlog-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- plan-product-vision/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- product-vision-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- init-coding-standards/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- coding-standards-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- map-system/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- templates/
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- map-subsystem/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- templates/
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- map-story/                           # No script.js -- doesn't use ace-tools
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- templates/
|   |-- map-walkthrough/                     # No script.js -- doesn't use ace-tools
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- walkthrough-template.xml
|   |-- review-story/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- story-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- research-external-solution/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- external-solution-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- research-integration-solution/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- integration-solution-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- research-technical-solution/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- technical-solution-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- research-story-wiki/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- story-wiki-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- update/                              # No script.js -- uses npm directly
|       |-- SKILL.md
|       |-- workflow.xml
|-- agents/                                   # Agent definitions
|   |-- ace-product-owner.md
|   |-- ace-code-discovery-analyst.md
|   |-- ace-code-integration-analyst.md
|   |-- ace-code-reviewer.md
|   |-- ace-wiki-mapper.md
|   |-- ace-technical-application-architect.md
|   |-- ace-research-synthesizer.md
|   |-- ace-project-researcher.md
|-- hooks/
|   |-- hooks.json                            # Statusline + update hooks
|-- shared/                                   # Shared resources
|   |-- utils/
|   |   |-- ui-formatting.md
|   |   |-- questioning.xml
|   |-- lib/
|       |-- ace-core.js                      # Config, paths, slugs, models, detection
|       |-- ace-core.test.js
|       |-- ace-github.js                    # All GitHub operations
|       |-- ace-github.test.js
|       |-- ace-story.js                     # Story state, metadata extraction
|       |-- ace-story.test.js
|-- settings.json                             # Default plugin settings
|-- .mcp.json                                 # (future) MCP servers
```

### 3.2 Plugin Manifest

```json
{
  "name": "ace",
  "description": "Agile Context Engineering -- spec-driven development for AI coding assistants",
  "version": "0.3.0",
  "author": {
    "name": "Piticas Razvan"
  },
  "repository": "https://github.com/Quantarcane/ACE",
  "license": "MIT"
}
```

### 3.3 Naming: Skills-Only vs Plugin

**Skills-only (no plugin):**
- Skills at `~/.claude/skills/ace-help/SKILL.md` -> invoked as `/ace-help`
- No namespace prefix, names can conflict with other tools
- Requires the current installer approach

**Plugin:**
- Skills at `ace-plugin/skills/help/SKILL.md` -> invoked as `/ace:help`
- Namespaced automatically (plugin name `ace` + `:` + skill name)
- Distributed via marketplace, installed with `/plugin install`
- **This matches ACE's current naming convention perfectly** (`/ace:help`, `/ace:plan-story`)

---

## 4. Migration Challenges & Solutions

### 4.1 CRITICAL: `@`-File References -> `${CLAUDE_SKILL_DIR}`

**Problem:** Current commands load workflows and templates via `@~/.claude/agile-context-engineering/workflows/plan-story.xml`. Skills don't support `@`-references the same way.

**Solution:** Use `${CLAUDE_SKILL_DIR}` to reference supporting files relative to the skill directory:

```yaml
# Before (command)
<execution-context>
  <plan-story-workflow>@~/.claude/agile-context-engineering/workflows/plan-story.xml</plan-story-workflow>
  <story-template>@~/.claude/agile-context-engineering/templates/product/story.xml</story-template>
</execution-context>

# After (skill)
## Supporting Resources
- Workflow: see [workflow.xml](workflow.xml) in this skill directory
- Story template: see [story-template.xml](story-template.xml) in this skill directory
- For complete details, see [templates/](templates/)
```

Or with `${CLAUDE_SKILL_DIR}`:
```
Read the workflow at: ${CLAUDE_SKILL_DIR}/workflow.xml
Read the template at: ${CLAUDE_SKILL_DIR}/story-template.xml
```

**Risk Level:** ~~HIGH~~ **RESOLVED** — validated in plan-story migration. `${CLAUDE_SKILL_DIR}` + relative paths and markdown links both work. Claude reads supporting files when instructed in the "Supporting Resources" section.

### 4.2 Shared Resources (Utils)

**Problem:** `ui-formatting.md` and `questioning.xml` are shared across ALL commands. In the current system, they live in a shared directory. In a skill-per-directory structure, where do shared text files go?

(For `ace-tools.js`, see section 4.8 -- it gets split into `shared/lib/` modules + per-skill `script.js` files.)

**Solutions (ranked):**

1. **Plugin `shared/` directory** -- Put shared resources at the plugin root in a `shared/` directory. Skills reference them via relative paths from `${CLAUDE_SKILL_DIR}`:
   ```
   Read: ${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md
   ```
   *Pro:* Single source of truth. *Con:* Ugly relative paths, depends on `${CLAUDE_SKILL_DIR}` resolving correctly for relative traversal.

2. **Symlinks or copy-on-build** -- A build step that copies shared resources into each skill directory before packaging.
   *Pro:* Each skill is self-contained. *Con:* File duplication, build complexity.

3. **Dynamic context injection** -- Use `` !`cat shared/utils/ui-formatting.md` `` in SKILL.md to inject shared content at runtime.
   *Pro:* Clean, no duplication. *Con:* Only works for text content.

**Decision (validated in plan-story migration):** Option 1 — `shared/utils/` directory. Skills reference them via `${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md`. Relative traversal from `${CLAUDE_SKILL_DIR}` works. No build step needed, single source of truth.

### 4.3 Cross-Skill Invocation

**Problem:** Commands call other commands via `Agent` tool prompts like `/ace:plan-story`. In the plugin model, these become `/ace:plan-story` (same name if plugin name is `ace`).

**Solution:** This works out of the box. The plugin namespace `ace` + skill name `plan-story` = `/ace:plan-story`, which is the exact current naming. **No changes needed.**

### 4.4 Agent Definitions

**Problem:** Agent `.md` files live in `agents/` and are referenced by name in command `<process>` sections (e.g., "For this command use the `ace-code-reviewer` agent"). Plugins support an `agents/` directory.

**Solution:** Direct migration -- the plugin `agents/` directory works identically.

### 4.5 Hooks

**Problem:** ACE uses two hooks (`ace-statusline.js`, `ace-check-update.js`) configured in `settings.json`. Plugins support `hooks/hooks.json`.

**Solution:**

```json
// hooks/hooks.json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node path/to/ace-check-update.js" }
        ]
      }
    ]
  }
}
```

**Note:** Need to verify whether plugin-relative paths work in hook commands. If not, hooks may need the global install path or a known `node_modules` path.

### 4.6 Dynamic Context (Shell Preprocessing)

**Problem:** Some workflows need runtime data (e.g., the init output parsed by the workflow). In the command system, Claude must manually run a bash command as its first step. Skills support `` !`command` `` syntax that runs **before** Claude sees the content — the output replaces the placeholder in the prompt.

**Solution:** Use shell preprocessing in SKILL.md for the init call that ALWAYS runs first:
```yaml
## Environment Context (preprocessed)

!`node "${CLAUDE_SKILL_DIR}/script.js" init "$ARGUMENTS" 2>/dev/null`
```

This is a significant improvement over the current approach:
- **No tool call overhead** -- the init data is embedded in the prompt before Claude starts thinking
- **No "decide to run" step** -- Claude doesn't need to execute a Bash tool call for setup
- **Clean paths** -- each skill has its own `script.js`, always `${CLAUDE_SKILL_DIR}/script.js`

**CRITICAL — Always quote `$ARGUMENTS` and paths in shell preprocessing:**
On Windows, user-provided paths contain backslashes (e.g., `C:\Coding\repos\...`). Bash interprets unquoted backslashes as escape characters, stripping them. Always use `"$ARGUMENTS"` and `"${CLAUDE_SKILL_DIR}/script.js"` in the `` !`command` `` syntax. This applies to ALL skills, not just plan-story.

**Note on model resolution:** The `model` and `effort` frontmatter fields set the orchestrator skill's model. Subagent models are handled by the agent system -- agents are referenced by name and Claude Code resolves their configuration from `agents/`. No manual `resolve-model` calls needed.

**CRITICAL — Workflow must NOT duplicate preprocessed calls:**
When a skill preprocesses the init call, the workflow's setup step MUST reference the preprocessed data instead of re-running the script. The workflow should say "use the INIT JSON from the Environment Context above" — NOT run `node script.js init` again. Only runtime calls that depend on conversation decisions (re-init after new story creation, update-state, sync-github, generate-slug) should use Bash tool calls in the workflow.

This applies to ALL migrated skills: if the SKILL.md preprocesses something, remove the duplicate call from the workflow.xml.

### 4.7 Model & Effort Configuration

**Current:** `ace-tools.js resolve-model` reads `.ace/config.json` model_profile and returns the model per agent.

**Skills approach:** The `model` and `effort` frontmatter fields set the model for the skill itself:
```yaml
---
name: plan-story
model: opus
effort: max
---
```

Subagent models are handled by the agent system -- agents are referenced by name only (e.g., `subagent_type="ace-wiki-mapper"`) and Claude Code resolves their configuration from the `agents/` directory. Manual `resolve-model` calls are **not needed** in per-skill scripts. The `resolve-model` function remains in `shared/lib/ace-core.js` for any edge cases, but skills should not use it for normal subagent spawning.

### 4.8 Splitting ace-tools.js

**Problem:** `ace-tools.js` is a 2881-line monolith containing 26 command functions. Every workflow calls it via `node ace-tools.js <command>`. In the plugin model, we want skills to be self-contained.

**Solution:** Every skill that uses ace-tools.js gets its own `script.js` as the single entry point. That script handles skill-specific logic and `require()`s shared libraries for cross-cutting concerns.

#### Principle: One Script Per Skill, Shared Libs Underneath

```
skill/
|-- SKILL.md
|-- workflow.xml
|-- script.js            # THIS skill's entry point (always)
|-- script.test.js       # Tests for THIS skill's script (always)
```

The skill's `script.js` is the **only** thing the workflow calls. If it needs config loading, slug generation, GitHub ops, etc., it imports from `shared/lib/`. The workflow never reaches into `shared/` directly.

#### Current Function Inventory (26 commands)

| Category | Functions | Lines (approx) |
|----------|-----------|----------------|
| Helpers | `loadConfig`, `pathExistsInternal`, `generateSlugInternal`, `resolveModelInternal`, `detectCodeFiles`, `safeReadFile`, `classifyStoryParam`, `extractMarkdownSection`, `extractStoryMetadata`, `extractIssueNumber`, `extractIssueNumberFromFile`, `extractStoryRequirements`, `extractWikiReferences`, `computeStoryPaths`, `detectBrownfieldStatus`, `loadSettings`, `writeSettings`, `parseKeyValueArgs`, `execCommand`, `resolveProjectContext` | ~500 |
| Init commands | `cmdInitNewProject`, `cmdInitCodingStandards`, `cmdInitMapSystem`, `cmdInitMapSubsystem`, `cmdInitProductVision`, `cmdInitPlanBacklog`, `cmdInitPlanFeature`, `cmdInitPlanStory`, `cmdInitExecuteStory`, `cmdInitResearchStory`, `cmdSetupGithubProject` | ~1100 |
| Settings | `cmdEnsureSettings`, `cmdWriteGithubSettings`, `cmdSyncAgentTeams`, `cmdWriteAgentTeamsSetting` | ~200 |
| Story state | `cmdStoryUpdateState` | ~170 |
| GitHub ops | `cmdGithubResolveFields`, `cmdGithubCreateIssue`, `cmdGithubUpdateIssue`, `cmdGithubSyncStory`, `cmdGithubFetchIssues` | ~750 |
| Atomic utils | `cmdLoadConfig`, `cmdResolveModel`, `cmdVerifyPathExists`, `cmdGenerateSlug`, `cmdCurrentTimestamp` | ~60 |

#### Shared Libraries (3 modules)

**`shared/lib/ace-core.js`** (~500 lines) -- Universal helpers:

```
Exports:
  loadConfig(cwd)             loadSettings(cwd)
  writeSettings(cwd, s)       pathExists(cwd, targetPath)
  generateSlug(text)          resolveModel(cwd, agentType)
  detectBrownfieldStatus(cwd) detectCodeFiles(cwd, maxDepth)
  currentTimestamp(format)    safeReadFile(filePath)
  output(result, raw, val)    error(message)
  parseKeyValueArgs(args)     execCommand(cmd, cwd)
  MODEL_PROFILES
```

**`shared/lib/ace-github.js`** (~800 lines) -- GitHub integration:

```
Requires: ace-core.js
Exports:
  resolveProjectContext(owner, project, cwd)
  resolveFields(cwd, args)   createIssue(cwd, args)
  updateIssue(cwd, args)     syncStory(cwd, args)
  fetchIssues(cwd, args)     setupGithubProject(cwd)
  writeGithubSettings(cwd, args)
```

**`shared/lib/ace-story.js`** (~600 lines) -- Story metadata & state:

```
Requires: ace-core.js
Exports:
  classifyStoryParam(param)  extractMarkdownSection(content, name, level)
  extractStoryMetadata(c)    extractIssueNumber(linkStr)
  extractIssueNumberFromFile(cwd, filePath)
  extractStoryRequirements(c) extractWikiReferences(c)
  computeStoryPaths(epicId, epicTitle, featureId, featureTitle, storyId, storyTitle)
  updateState(cwd, args)
```

Each shared library gets its own test file:

```
shared/lib/
|-- ace-core.js
|-- ace-core.test.js
|-- ace-github.js
|-- ace-github.test.js
|-- ace-story.js
|-- ace-story.test.js
```

#### Per-Skill Scripts (every skill that uses ace-tools.js)

Every skill gets its own `script.js` + `script.test.js`. Even when multiple skills share the same init logic (e.g., the 4 research skills all use `cmdInitResearchStory`), each skill gets its own copy. This means:

- **Uniform pattern** -- every skill works the same way, always `node ${CLAUDE_SKILL_DIR}/script.js <subcommand>`
- **Self-contained** -- look at any skill folder and see everything it does
- **Independent evolution** -- change one skill's script without risking others

| Skill | script.js contains | Imports from shared |
|-------|-------------------|-------------------|
| help | `cmdInitNewProject`, `cmdEnsureSettings`, `cmdSyncAgentTeams`, `cmdWriteAgentTeamsSetting`, `cmdSetupGithubProject`, `cmdWriteGithubSettings` | ace-core |
| plan-product-vision | `cmdInitProductVision` | ace-core |
| plan-backlog | `cmdInitPlanBacklog` | ace-core, ace-github |
| plan-feature | `cmdInitPlanFeature` | ace-core, ace-github, ace-story |
| plan-story | `cmdInitPlanStory`, `cmdStoryUpdateState` | ace-core, ace-story, ace-github |
| execute-story | `cmdInitExecuteStory`, `cmdStoryUpdateState` | ace-core, ace-story, ace-github |
| review-story | `cmdInitExecuteStory` (same init as execute) | ace-core, ace-story |
| init-coding-standards | `cmdInitCodingStandards` | ace-core |
| map-system | `cmdInitMapSystem` | ace-core |
| map-subsystem | `cmdInitMapSubsystem` | ace-core |
| research-story-wiki | `cmdInitResearchStory` | ace-core, ace-story |
| research-external-solution | `cmdInitResearchStory` | ace-core, ace-story |
| research-integration-solution | `cmdInitResearchStory` | ace-core, ace-story |
| research-technical-solution | `cmdInitResearchStory` | ace-core, ace-story |

Skills that don't use ace-tools.js (map-story, map-walkthrough, update) don't get a script.

#### Example: plan-story skill

```
skills/plan-story/
|-- SKILL.md
|-- workflow.xml
|-- story-template.xml
|-- script.js              # Entry point for all ace-tools operations this skill needs
|-- script.test.js         # Tests for this script
```

**`script.js`:**
```javascript
#!/usr/bin/env node
const { loadConfig, pathExists, detectBrownfieldStatus, resolveModel,
        output, error } = require('../../shared/lib/ace-core');
const { classifyStoryParam, extractStoryMetadata,
        computeStoryPaths, updateState } = require('../../shared/lib/ace-story');
const { syncStory } = require('../../shared/lib/ace-github');

const cwd = process.cwd();
const args = process.argv.slice(2);
const cmd = args[0];
const raw = args.includes('--raw');

switch (cmd) {
  case 'init':
    // cmdInitPlanStory logic here (~230 lines)
    break;
  case 'update-state':
    // cmdStoryUpdateState logic here (~170 lines)
    break;
  case 'sync-github':
    syncStory(cwd, raw, args.slice(1));
    break;
  default:
    error(`Unknown command: ${cmd}`);
}
```

**`script.test.js`:**
```javascript
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, 'script.js');

describe('plan-story script', () => {
  it('init returns valid JSON for a story file', () => {
    const result = execSync(`node "${SCRIPT}" init path/to/story.md`, {
      cwd: '/tmp/test-project',
      encoding: 'utf-8'
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.config);
    assert.ok(parsed.story);
  });

  it('errors on unknown command', () => {
    assert.throws(() => {
      execSync(`node "${SCRIPT}" bogus`, { encoding: 'utf-8' });
    });
  });
});
```

**SKILL.md preprocesses the init (no Bash tool call needed):**
```yaml
## Environment Context (preprocessed)

!`node "${CLAUDE_SKILL_DIR}/script.js" init "$ARGUMENTS" 2>/dev/null`
```

**Workflow still calls script.js for runtime operations:**
```xml
<!-- Re-init after new story creation (step 2j) -->
INIT=$(node ${CLAUDE_SKILL_DIR}/script.js init story={STORY_FILE})

<!-- State updates and GitHub sync (steps 8-9) -->
node ${CLAUDE_SKILL_DIR}/script.js update-state story={path} status=Refined
node ${CLAUDE_SKILL_DIR}/script.js sync-github repo={repo} story_file={path}
```

#### Complete Plugin Structure (with per-skill scripts)

```
ace-plugin/
|-- .claude-plugin/plugin.json
|-- skills/
|   |-- help/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- plan-product-vision/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- product-vision-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- plan-backlog/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- product-backlog-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- plan-feature/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- feature-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- plan-story/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- story-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- execute-story/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- story-template.xml
|   |   |-- walkthrough-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- review-story/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- story-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- init-coding-standards/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- coding-standards-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- map-system/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- templates/
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- map-subsystem/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- templates/
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- map-story/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- templates/
|   |-- map-walkthrough/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- walkthrough-template.xml
|   |-- research-story-wiki/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- story-wiki-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- research-external-solution/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- external-solution-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- research-integration-solution/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- integration-solution-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- research-technical-solution/
|   |   |-- SKILL.md
|   |   |-- workflow.xml
|   |   |-- technical-solution-template.xml
|   |   |-- script.js
|   |   |-- script.test.js
|   |-- update/
|       |-- SKILL.md
|       |-- workflow.xml
|-- agents/
|   |-- ace-product-owner.md
|   |-- ace-code-discovery-analyst.md
|   |-- ace-code-integration-analyst.md
|   |-- ace-code-reviewer.md
|   |-- ace-wiki-mapper.md
|   |-- ace-technical-application-architect.md
|   |-- ace-research-synthesizer.md
|   |-- ace-project-researcher.md
|-- hooks/
|   |-- hooks.json
|-- shared/
    |-- utils/
    |   |-- ui-formatting.md
    |   |-- questioning.xml
    |-- lib/
        |-- ace-core.js
        |-- ace-core.test.js
        |-- ace-github.js
        |-- ace-github.test.js
        |-- ace-story.js
        |-- ace-story.test.js
```

**Test runner:** A single `npm test` at the plugin root runs all tests:
```json
{
  "scripts": {
    "test": "node --test shared/lib/*.test.js skills/*/script.test.js"
  }
}
```

#### Duplication Trade-off

The 4 research skills each get a copy of `cmdInitResearchStory` (~220 lines). Same for execute-story and review-story sharing `cmdInitExecuteStory` (~250 lines). That's ~1100 lines of duplication across 6 files.

**Why this is worth it:**
- Uniform pattern -- no exceptions to remember
- Each skill folder tells the complete story
- If research-external-solution needs a tweak (e.g., extra validation for the `external-codebase` param), change one file, zero risk to the other 3
- Tests are per-skill, so each copy is independently verified

If the duplication ever becomes a maintenance pain, the per-skill scripts can always extract a shared helper into `shared/lib/` at that point. Start simple, refactor when it hurts.

#### Migration Path for the Split

1. **Extract shared libs** -- Pull helpers into `ace-core.js`, `ace-github.js`, `ace-story.js`. Pure refactor. Run existing `ace-tools.test.js` against them.
2. **Create per-skill scripts** -- For each skill, create `script.js` that imports shared libs and contains the skill-specific logic. Create `script.test.js` alongside it.
3. **Update workflows** -- Replace `node ~/.claude/agile-context-engineering/src/ace-tools.js <cmd>` with `node ${CLAUDE_SKILL_DIR}/script.js <cmd>`.
4. **Delete the monolith** -- Remove `ace-tools.js` once all skills are migrated and green.

---

## 5. Migration Execution Guide

### What's Done (plan-story PoC — validated)

- `.claude-plugin/plugin.json` created — `ace:` namespace works
- `shared/lib/ace-core.js`, `ace-story.js`, `ace-github.js` extracted with tests (71 tests passing)
- `shared/utils/ui-formatting.md`, `questioning.xml` moved to shared location
- `skills/plan-story/` fully migrated with `script.js`, `script.test.js`, workflow.xml, story-template.xml
- Shell preprocessing (`!` backtick) validated — `"$ARGUMENTS"` quoting required on Windows
- `${CLAUDE_SKILL_DIR}` relative traversal to `../../shared/` validated
- Plugin namespace `/ace:plan-story` validated
- Old `commands/ace/plan-story.md` removed

### Validated Findings

- `${CLAUDE_SKILL_DIR}` resolves correctly from `--plugin-dir`
- Relative paths from `${CLAUDE_SKILL_DIR}` to `../../shared/` work
- Shell preprocessing runs before Claude sees content — init data is embedded
- Windows backslashes in `$ARGUMENTS` require double-quoting in `!` backtick commands
- `model` and `effort` frontmatter work — no need for `resolve-model` in scripts
- Agents referenced by name — agent system handles model resolution
- Workflows must NOT duplicate preprocessed init calls
- Cross-skill invocation (`/ace:research-story-wiki` etc.) works from skill context

### Remaining: Migrate All Other Commands

For each remaining command in `commands/ace/`, follow these steps:

#### Per-Skill Migration Checklist

For each command `commands/ace/<name>.md`:

1. **Create skill directory**: `mkdir -p skills/<name>/`
2. **Write SKILL.md** with frontmatter from the table below + markdown body converted from XML
3. **Copy supporting files** into skill directory: workflow.xml, templates
4. **Add shell preprocessing** if skill has an init call: `!`node "${CLAUDE_SKILL_DIR}/script.js" init "$ARGUMENTS" 2>/dev/null``
5. **Create script.js** if skill uses ace-tools.js — import from `../../shared/lib/`, add subcommands
6. **Create script.test.js** — test each subcommand with temp directory fixtures
7. **Update workflow.xml** paths: `node ~/.claude/.../ace-tools.js <cmd>` → `node ${CLAUDE_SKILL_DIR}/script.js <cmd>`
8. **Remove duplicate init** from workflow step 1 — reference preprocessed Environment Context instead
9. **Reference shared utils** via `${CLAUDE_SKILL_DIR}/../../shared/utils/` (not per-skill copies)
10. **Delete old command**: `rm commands/ace/<name>.md`
11. **Test**: `claude --plugin-dir .` then `/ace:<name>`

#### Frontmatter decisions per skill

**Key decisions per skill:**

| Skill | `disable-model-invocation` | `model` | `effort` | `context` | `agent` |
|-------|---------------------------|---------|----------|-----------|---------|
| help | false | sonnet | medium | -- | -- |
| execute-story | true | opus | max | -- | -- |
| plan-story | true | opus | high | -- | -- |
| plan-feature | true | opus | high | -- | -- |
| plan-backlog | true | opus | high | -- | -- |
| plan-product-vision | true | opus | high | -- | -- |
| init-coding-standards | true | sonnet | high | -- | -- |
| map-system | true | opus | max | -- | -- |
| map-subsystem | true | opus | max | -- | -- |
| map-story | true | opus | max | -- | -- |
| map-walkthrough | true | opus | max | -- | -- |
| review-story | true | sonnet | high | fork | ace-code-reviewer |
| research-external-solution | true | opus | max | fork | ace-code-discovery-analyst |
| research-integration-solution | true | opus | max | fork | ace-code-integration-analyst |
| research-technical-solution | true | opus | max | fork | ace-technical-application-architect |
| research-story-wiki | true | opus | max | fork | ace-wiki-mapper |
| update | true | sonnet | medium | -- | -- |

**Note on `context: fork` + `agent`:** The research and review skills use `context: fork` with their corresponding agent type. This means they run in an isolated context — no conversation history, no user interaction. The SKILL.md content becomes the task prompt, and the `agent` field determines the execution environment (system prompt, tools, model). This works because these skills are autonomous: read inputs, produce output file, done. Orchestrator skills (plan-story, execute-story) do NOT use `context: fork` because they need interactive questioning and conversation history. They reference agents in the body text instead (e.g., "Use the `ace-product-owner` agent").

#### Step 3.3: Copy supporting files per skill
Move each command's referenced workflows and templates into its skill directory.

#### Step 3.4: Convert `@`-references to relative paths
Replace all `@~/.claude/agile-context-engineering/...` with `${CLAUDE_SKILL_DIR}/...` or `[file.xml](file.xml)` relative references.

#### Step 3.5: Update workflow ace-tools calls
Replace `node ~/.claude/agile-context-engineering/src/ace-tools.js <cmd>` with `node ${CLAUDE_SKILL_DIR}/script.js <cmd>` in every workflow XML.

#### Step 3.6: Shared text resources
Already in `shared/utils/`. Skills reference via `${CLAUDE_SKILL_DIR}/../../shared/utils/`. No build step needed.

### Post-Migration: Distribution

1. **Update npm installer** — `bin/install.js` copies `skills/`, `shared/`, `.claude-plugin/` alongside existing paths
2. **Marketplace submission** — submit to Anthropic official marketplace
3. **Keep npm fallback** — for Crush/OpenCode users who can't use plugins yet

---

## 6. SKILL.md Conversion Example

### Before: `commands/ace/review-story.md`

```yaml
---
name: ace:review-story
description: Standalone code review...
argument-hint: "story=<file-path|github-url>"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---
```
```xml
<command>
    <execution-context>
        <review-story-workflow>@~/.claude/agile-context-engineering/workflows/review-story.xml</review-story-workflow>
        <story-template>@~/.claude/agile-context-engineering/templates/product/story.xml</story-template>
        <ui-formatting>@~/.claude/agile-context-engineering/utils/ui-formatting.md</ui-formatting>
    </execution-context>
    <process>
        For this command use the `ace-code-reviewer` agent
        Execute the review-story workflow from
        `@~/.claude/agile-context-engineering/workflows/review-story.xml` end-to-end.
    </process>
</command>
```

### After: `skills/review-story/SKILL.md`

```yaml
---
name: review-story
description: Standalone code review -- performs 3-level artifact verification, anti-pattern detection, coding standards enforcement, and tech debt discovery against a story's implementation
argument-hint: "story=<file-path|github-url>"
disable-model-invocation: true
allowed-tools: Read, Bash, Glob, Grep
context: fork
agent: ace-code-reviewer
effort: high
---

# Review Story

Standalone code review for a story implementation.

## When to Use
- After `/ace:execute-story` -- to re-run code review after manual changes
- Anytime -- to review a story implementation standalone
- Pre-merge quality gate

## Input

**Required:** `story` -- file path, GitHub URL, or issue number (e.g., `story=#95`)

The story MUST have Acceptance Criteria and Technical Solution sections.

## Supporting Resources

- For the review workflow, see [workflow.xml](workflow.xml)
- For the story template structure, see [story-template.xml](story-template.xml)
- For UI formatting rules, read `${CLAUDE_SKILL_DIR}/../../shared/utils/ui-formatting.md`

## Process

Execute the review-story workflow from [workflow.xml](workflow.xml) end-to-end.

**CRITICAL REQUIREMENTS:**
- Story MUST have Acceptance Criteria -- STOP if missing
- Story MUST have Technical Solution -- STOP if missing
- This is a READ-ONLY command -- do NOT modify any code
- Coding standards violations are BLOCKERS, not warnings
- Dead code and backwards-compatible shims must be flagged for DELETION

## Next Steps

After this command:
- `/ace:execute-story story=...` -- Re-execute to fix reported issues
- `/ace:review-story story=...` -- Re-run review after fixes
- `/ace:help` -- Check project status
```

With supporting files:
```
skills/review-story/
|-- SKILL.md
|-- workflow.xml          # Copied from workflows/review-story.xml
|-- story-template.xml    # Copied from templates/product/story.xml
|-- script.js             # cmdInitExecuteStory logic + imports from shared/lib/
|-- script.test.js        # Tests for this skill's script
# ui-formatting.md and questioning.xml live in shared/utils/ (not per-skill)
```

---

## 7. Risk Assessment (updated post-PoC)

### Resolved (validated in plan-story migration)

| Risk | Status |
|------|--------|
| `@`-file references don't work in skills | **RESOLVED** — `${CLAUDE_SKILL_DIR}` + relative paths work |
| `${CLAUDE_SKILL_DIR}` relative traversal breaks | **RESOLVED** — `../../shared/` traversal works |
| Plugin namespace wrong | **RESOLVED** — `ace:plan-story` works correctly |
| `require()` paths from `script.js` to `shared/lib/` | **RESOLVED** — relative imports work from `--plugin-dir` |

### Remaining Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `context: fork` loses conversation context | Interactive skills break | Only use `fork` for autonomous research/review skills |
| Windows backslash stripping in `$ARGUMENTS` | Init gets mangled paths | Always quote: `"$ARGUMENTS"` in shell preprocessing |
| Crush (OpenCode) compatibility | Crush may not support plugins | Keep npm installer as fallback |
| Plugin marketplace submission delays | Can't distribute as plugin immediately | `--plugin-dir` for dev; npm fallback for users |

---

## 8. Benefits of Migration

### Immediate (Skills + ace-tools Split)

1. **`disable-model-invocation`** -- Prevent Claude from auto-triggering heavy workflows like `execute-story`
2. **`model` and `effort` per skill** -- Set the orchestrator skill's model and effort level; subagent models are handled by the agent system automatically
3. **`context: fork`** -- Research commands naturally run in isolated contexts, reducing context window pollution
4. **`${CLAUDE_SKILL_DIR}`** -- Clean path resolution for supporting files and per-skill scripts
5. **Supporting files** -- Templates, workflows, and scripts co-located with their skill
6. **Dynamic context injection** -- `` !`node ${CLAUDE_SKILL_DIR}/script.js init ...` `` replaces manual "run this bash command first" patterns
7. **Argument substitutions** -- `$ARGUMENTS[0]` for named params, `${CLAUDE_SESSION_ID}` for logging
8. **Testable scripts** -- Each skill's `script.test.js` validates its own logic independently

### Plugin-Level

1. **Marketplace distribution** -- Install with one click, no `npx` required
2. **Versioned releases** -- Semantic versioning in `plugin.json`
3. **Automatic updates** -- Plugin manager handles updates
4. **Namespace isolation** -- `ace:*` namespace prevents conflicts with other tools
5. **Team distribution** -- Configure team marketplace for org-wide ACE access
6. **Self-contained** -- Plugin directory has everything; no scattered files across `~/.claude/`

---

## 9. What Changes vs What Stays the Same

### What Changes

1. **`ace-tools.js` is split** -- The 2881-line monolith becomes 3 shared libraries (`ace-core.js`, `ace-github.js`, `ace-story.js`) in `shared/lib/` + a per-skill `script.js` in each skill folder. Workflows call `node ${CLAUDE_SKILL_DIR}/script.js <cmd>` instead of `node ~/.claude/.../ace-tools.js <cmd>`.
2. **Commands become skills** -- `.md` files in `commands/ace/` become `SKILL.md` files in `skills/<name>/` directories with richer frontmatter.
3. **Supporting files co-locate** -- Workflows, templates, and utils move from shared directories into each skill's folder.
4. **`@`-references become relative paths** -- `@~/.claude/agile-context-engineering/...` becomes `${CLAUDE_SKILL_DIR}/...` or `[file.xml](file.xml)` links.
5. **Distribution** -- From `npx agile-context-engineering` installer to plugin marketplace (or `claude --plugin-dir`).

### What Stays the Same

1. **Agent definitions** -- Same `.md` format, same frontmatter, same content. Copied directly to plugin `agents/`.
2. **Workflow logic** -- XML workflows are consumed by Claude, not by the skill system. Their content is unchanged (only the `ace-tools.js` call paths change).
3. **Template content** -- Same XML templates, just relocated to skill directories.
4. **`.ace/` project directory** -- Config, artifacts, settings all stay the same.
5. **GitHub integration** -- Same operations, same `gh` CLI calls. The logic moves from monolith functions to `shared/lib/ace-github.js` but the behavior is identical.
6. **User experience** -- `/ace:help` stays `/ace:help`. No retraining needed.
7. **Tool functionality** -- Every `script.js` subcommand produces the same JSON/raw output as the original `ace-tools.js` command it replaces. Workflows consume the output the same way.

---

## 10. Remaining Commands to Migrate

Plan-story is done. These commands remain in `commands/ace/`:

| Command | Has script.js | context:fork | Notes |
|---------|--------------|-------------|-------|
| help | Yes (complex — init, settings, github setup) | -- | Most subcommands of any skill |
| execute-story | Yes (init, update-state, sync-github) | -- | Interactive orchestrator |
| plan-feature | Yes (init) | -- | Interactive orchestrator |
| plan-backlog | Yes (init) | -- | Interactive orchestrator |
| plan-product-vision | Yes (init) | -- | Interactive orchestrator |
| init-coding-standards | Yes (init) | -- | Interactive |
| map-system | Yes (init) | -- | Interactive |
| map-subsystem | Yes (init) | -- | Interactive |
| map-story | No | -- | No ace-tools usage |
| map-walkthrough | No | -- | No ace-tools usage |
| review-story | Yes (init) | fork | agent: ace-code-reviewer |
| research-story-wiki | Yes (init) | fork | agent: ace-wiki-mapper |
| research-external-solution | Yes (init) | fork | agent: ace-code-discovery-analyst |
| research-integration-solution | Yes (init) | fork | agent: ace-code-integration-analyst |
| research-technical-solution | Yes (init) | fork | agent: ace-technical-application-architect |
| update | No | -- | Uses npm directly |

### Shared libs already exist

`shared/lib/ace-core.js`, `ace-story.js`, `ace-github.js` are already extracted and tested. New skills import from these. If a skill needs a function not yet in the shared libs (e.g., `cmdGithubCreateIssue` for help skill), extract it from `ace-tools.js` into the appropriate shared lib.

### After all commands are migrated

1. Delete `commands/ace/` directory entirely
2. Delete `agile-context-engineering/src/ace-tools.js` (monolith no longer needed)
3. Keep `agile-context-engineering/src/ace-tools.test.js` until shared lib tests cover everything, then delete
4. Update `bin/install.js` to copy `skills/`, `shared/`, `.claude-plugin/` alongside existing paths
5. Test with `claude --plugin-dir .` before any release

---

## 11. Open Questions (updated)

| # | Question | Status |
|---|----------|--------|
| 1 | Does `${CLAUDE_SKILL_DIR}` support relative traversal? | **ANSWERED: YES** — `../../shared/` works |
| 2 | Can plugin hooks reference plugin-relative paths? | Open — needs testing |
| 3 | How does `/reload-plugins` interact with active skills? | Open — no issues seen during dev |
| 4 | Is there a size limit on plugin skill count? | **ANSWERED: NO** — 17 skills works fine, `disable-model-invocation` keeps descriptions out of context |
| 5 | Can a plugin ship `settings.json` with `statusLine`? | **ANSWERED: NO** — only `agent` key supported. Statusline stays in installer |
| 6 | Crush (OpenCode) support? | Open — keep npm installer as fallback |
| 7 | `@`-reference vs `${CLAUDE_SKILL_DIR}` + Read? | **ANSWERED** — skills use Read tool to load supporting files. Works correctly. Skills should list supporting files in a "Supporting Resources" section with clear instructions to "Read ALL of these before starting" |
