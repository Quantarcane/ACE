# Changelog

All notable changes to ACE will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.3.0] - 2026-03-20

### Added
- CHANGELOG.md with full release history
- GitHub Actions workflow for automated releases and npm publishing on version tags
- Changelog display during `/ace:update` — fetches and shows what changed before updating
- CICD.md documenting the complete release pipeline

## [0.2.2] - 2026-03-14

### Added
- `/ace:update` command with automatic update detection and installation
- Statusline hooks (`ace-check-update.js`, `ace-statusline.js`) for background update checking and context window display
- Wiki README template for subsystem documentation
- Plan mode exit warning for solo execution

### Fixed
- VERSION file now written correctly during installation

### Changed
- Renamed OpenCode to Crush across all commands, agents, and installer

## [0.2.1] - 2026-03-10

### Added
- Agent team tear down guards to prevent orphaned subagents
- `lib-docs` parameter to `/ace:plan-story` for external library documentation
- New subsystem detection in `/ace:map-story`
- Defensive programming instructions in coding standards

### Fixed
- Execute-story now enforces all steps in sequence
- GitHub issue status updates during story execution

### Changed
- Feature planning adjusted to break down into vertical stories

## [0.2.0] - 2026-03-07

### Added
- `/ace:plan-story` — deep questioning to create crystal-clear acceptance criteria with zero assumptions, then dispatches wiki research, external analysis, integration analysis, and technical solution design
- `/ace:execute-story` — loads AC + technical solution, creates execution plan, implements with solo or agent teams, runs code review, updates state, and triggers wiki mapping
- Agent teams support for parallel execution of independent tasks

## [0.1.0] - 2026-03-05

### Added
- `/ace:plan-backlog` — create or refine product backlog through vision-aware questioning, wiki analysis, and guided epic/feature planning
- `/ace:plan-feature` — plan features through backlog-aware questioning, story decomposition, and guided feature specification

## [0.0.2] - 2026-03-02

### Added
- `/ace:map-story` — update living knowledge docs after story implementation (git-based) or for existing undocumented code (file-based)
- `/ace:map-subsystem` — map a subsystem's structure, architecture, and knowledge docs
- `/ace:map-system` — map system-wide codebase structure, architecture, and testing framework

## [0.0.1] - 2026-02-23

### Added
- Initial ACE framework setup
- `/ace:init-coding-standards` — generate tailored coding standards through codebase detection and user interview
- `/ace:plan-product-vision` — create or update product vision through architecture-aware questioning
- Installer (`bin/install.js`) with support for Claude Code and Crush runtimes
- Local and global installation modes

[Unreleased]: https://github.com/Quantarcane/ACE/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/Quantarcane/ACE/releases/tag/v0.3.0
[0.2.2]: https://github.com/Quantarcane/ACE/releases/tag/v0.2.2
[0.2.1]: https://github.com/Quantarcane/ACE/releases/tag/v0.2.1
[0.2.0]: https://github.com/Quantarcane/ACE/releases/tag/v0.2.0
[0.1.0]: https://github.com/Quantarcane/ACE/releases/tag/v0.1.0
[0.0.2]: https://github.com/Quantarcane/ACE/releases/tag/v0.0.2
[0.0.1]: https://github.com/Quantarcane/ACE/releases/tag/v0.0.1
