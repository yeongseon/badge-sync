# badge-sync

<!-- BADGES:START -->
[![npm version](https://img.shields.io/npm/v/badge-sync)](https://www.npmjs.com/package/badge-sync)
[![node version](https://img.shields.io/node/v/badge-sync)](https://nodejs.org)
[![ci workflow](https://github.com/yeongseon/badge-sync/actions/workflows/ci.yml/badge.svg)](https://github.com/yeongseon/badge-sync/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/yeongseon/badge-sync)](https://github.com/yeongseon/badge-sync/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/yeongseon/badge-sync)](https://github.com/yeongseon/badge-sync)
[![coverage](https://codecov.io/gh/yeongseon/badge-sync/branch/main/graph/badge.svg)](https://codecov.io/gh/yeongseon/badge-sync)
<!-- BADGES:END -->

Keep your README badges clean, valid, and consistent.

> **Status**: Early-stage. Core happy path works. Real-world edge cases may need fixes.

## Problem

README badges are widely used in open-source projects.

But in practice, many repositories have:

- broken badge links after renaming repos or workflows
- outdated CI badges pointing to old services
- incorrect repository references copied from other projects
- inconsistent badge ordering across repositories

Maintaining badges is surprisingly manual and error-prone.

## Solution

badge-sync is a small CLI tool that helps maintain README badges.

It automatically:

- detects badges relevant to your repository
- validates badge links
- fixes broken badge references
- keeps badge ordering consistent

```bash
npx badge-sync apply
```

## Demo

**Before** — a typical README with stale and broken badges:

```md
<!-- BADGES:START -->
[![Build Status](https://travis-ci.org/old-org/old-name.svg?branch=master)](https://travis-ci.org/old-org/old-name)
[![npm](https://img.shields.io/npm/v/old-name.svg)](https://npmjs.com/package/old-name)
[![Coverage](https://coveralls.io/repos/github/old-org/old-name/badge.svg)](https://coveralls.io/github/old-org/old-name)
<!-- BADGES:END -->
```

```bash
$ badge-sync doctor

  ✗ Badge "Build Status" — URL returns 404
  ✗ Badge "npm" — package name mismatch (old-name ≠ my-tool)
  ✗ Badge "Coverage" — repository moved (old-org/old-name → my-org/my-tool)

3 issues found. Run badge-sync repair to fix.
```

**After** — `badge-sync apply`:

```md
<!-- BADGES:START -->
[![npm version](https://img.shields.io/npm/v/my-tool)](https://www.npmjs.com/package/my-tool)
[![node version](https://img.shields.io/node/v/my-tool)](https://nodejs.org)
[![ci workflow](https://github.com/my-org/my-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/my-org/my-tool/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/my-org/my-tool)](https://github.com/my-org/my-tool/blob/main/LICENSE)
<!-- BADGES:END -->
```

Correct names. Correct URLs. Correct order. Zero manual work.

## Philosophy

> Badges should be simple signals, not maintenance burdens.

badge-sync follows a conservative design:

- **Zero-config** — run `badge-sync apply` and it works
- **Deterministic** — same repository state always produces the same badges
- **Conservative** — never removes badges you added, only updates stale ones
- **Offline-first** — `apply` and `check` require no network access
- **Safe** — only modifies content inside `<!-- BADGES:START -->` / `<!-- BADGES:END -->` markers

## Installation

```bash
npm install -g badge-sync
```

Or run directly:

```bash
npx badge-sync apply
```

## Usage

```bash
badge-sync init          # Set up markers and detect badges
badge-sync apply         # Generate and apply badges
badge-sync check         # Validate badges match repo state (CI)
badge-sync doctor        # Detect broken or inconsistent badges
badge-sync repair        # Automatically repair badge issues
```

## Supported Ecosystems

| Ecosystem              | Metadata Source                        | Badges Generated                  |
| ---------------------- | -------------------------------------- | --------------------------------- |
| JavaScript / TypeScript | `package.json`                        | npm version, Node version         |
| Python                 | `pyproject.toml` / `requirements.txt`  | PyPI version, Python version      |
| Rust                   | `Cargo.toml`                           | crates.io version                 |

Additional badges detected automatically:

- **CI** — GitHub Actions workflow status
- **License** — from `LICENSE` file
- **Stars** — from GitHub remote

## Configuration

badge-sync works with zero configuration. All badges are detected from repository files.

To customize badge ordering or exclude specific badges, create a config file:

```yaml
# badgesync.config.yaml
badges:
  order:
    - distribution
    - runtime
    - build
    - quality
    - metadata
    - social
  exclude:
    - stars
```

Configuration priority: user config > project preset > default ordering.

Supported config files: `badgesync.config.json`, `badgesync.config.yaml`, `badgesync.config.yml`

## CI Integration

### Using npx

```yaml
- name: Check badges
  run: npx badge-sync check
```

### Using GitHub Action

```yaml
- uses: yeongseon/badge-sync@main
  with:
    command: check
```

With options:

```yaml
- uses: yeongseon/badge-sync@main
  with:
    command: apply
    readme: docs/README.md
    dry-run: true
```

`badge-sync check` exits with code `1` if badges are out of sync, failing the pipeline.

## Roadmap

- [x] Core badge detection and generation
- [x] `apply`, `check`, `doctor`, `repair` commands
- [ ] Additional ecosystems (Go, Java)
- [x] Coverage badge detection
- [x] GitHub Action distribution
- [x] Interactive CLI setup
- [x] Monorepo support

## Documentation

- [Product Requirements](PRD.md)
- [Architecture](ARCH.md)
- [Design Principles](DESIGN.md)
- [CLI Specification](docs/CLI.md)
- [Agent Instructions](AGENTS.md)

## License

MIT
