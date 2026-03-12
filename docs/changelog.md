# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-03-11

### Added

- Translated README files: Korean (`README.ko.md`), Japanese (`README.ja.md`), Chinese (`README.zh-CN.md`)
- Badge synchronization across translated READMEs
- MkDocs documentation site infrastructure

## [0.3.0] - 2026-03-10

### Added

- `list` command for displaying detected badges and monorepo packages without applying changes
- Monorepo workspace detection for npm, pnpm, Lerna, and Cargo workspaces
- `--package` flag for targeting specific monorepo packages

## [0.2.0] - 2026-03-10

### Added

- `init` command with `--markers-only` and `--dry-run` options
- Existing badge preservation during `init` (custom badges are never removed)
- Badge migration from unmarked READMEs into badge block markers

## [0.1.1] - 2026-03-10

### Fixed

- `init` no longer creates duplicate badges when run on READMEs with existing custom shields.io license badges (e.g., `img.shields.io/badge/License-MIT-yellow.svg`)
- `inferBadgeType` now recognizes custom shields.io license URL patterns and `LICENSE` file link URLs

### Added

- `--dry-run` option for `init` command -- preview what `init` would do without writing files
- `applyBadgeFilters` helper to share badge include/exclude filtering logic between `apply` and `init`

## [0.1.0] - 2026-03-09

### Added

- CLI commands: `apply`, `check`, `doctor`, `repair`, `init`, `list`
- Ecosystem detection: JavaScript/TypeScript, Python, Rust
- GitHub Actions workflow badge generation with CI workflow allowlist
- Monorepo support for npm workspaces, pnpm workspaces, Lerna, and Cargo workspaces
- Badge block isolation using `<!-- BADGES:START -->` / `<!-- BADGES:END -->` markers
- Existing badge preservation (custom badges are never removed)
- `--dry-run` mode with categorized diff output (`+` new / `~` updated / `=` unchanged)
- Zero-config operation with optional `badgesync.config.yaml` support
- GitHub Action (`action.yml`) for CI integration
- URL validation for broken badge detection (`doctor` / `repair`)
- README auto-detection (README.md, Readme.md, readme.md, README.rst)
- Private `package.json` handling (detects JS ecosystem, skips npm badge)
- E2E test infrastructure validated against 24 open-source repos

[0.4.0]: https://github.com/yeongseon/badge-sync/releases/tag/v0.4.0
[0.3.0]: https://github.com/yeongseon/badge-sync/releases/tag/v0.3.0
[0.2.0]: https://github.com/yeongseon/badge-sync/releases/tag/v0.2.0
[0.1.1]: https://github.com/yeongseon/badge-sync/releases/tag/v0.1.1
[0.1.0]: https://github.com/yeongseon/badge-sync/releases/tag/v0.1.0
