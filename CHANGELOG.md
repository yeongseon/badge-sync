# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/yeongseon/badge-sync/releases/tag/v0.1.0
