# badge-sync

Automatically detect, generate, validate, and repair README badges from your repository metadata.

badge-sync scans your project files (`package.json`, `pyproject.toml`, `Cargo.toml`, workflow files, `LICENSE`) and generates a consistent, up-to-date badge block for your README. It works offline, requires zero configuration, and integrates with CI pipelines and GitHub Actions.

## The Problem

README badges go stale. You rename a repository, change a package name, switch CI providers, or add a new workflow -- and the badges in your README quietly break. Nobody notices until a contributor points out the dead links months later.

Manually maintaining badges is tedious and error-prone:

- Shields.io URLs embed your package name, repo owner, and workflow filenames
- Renaming anything invalidates multiple badge URLs at once
- There is no built-in tool to detect broken or outdated badges
- Monorepo setups multiply the maintenance burden

## The Solution

badge-sync treats badges like generated code. Instead of hand-crafting badge URLs, you let badge-sync detect your project metadata and generate the correct badges automatically.

```bash
npx badge-sync apply
```

That single command:

1. Scans your project files for metadata (package name, repo URL, workflows, license)
2. Generates the correct badge URLs for your ecosystem (npm, PyPI, crates.io)
3. Replaces the badge block in your README with the updated badges
4. Leaves everything outside the badge block untouched

## Before and After

**Before** -- stale badges after renaming your repo:

```md
<!-- BADGES:START -->
[![Build Status](https://travis-ci.org/old-org/old-name.svg?branch=master)](https://travis-ci.org/old-org/old-name)
[![npm](https://img.shields.io/npm/v/old-name.svg)](https://npmjs.com/package/old-name)
<!-- BADGES:END -->
```

**After** -- one command fixes everything:

```bash
$ npx badge-sync apply
Applied 4 badges
  [distribution] npm version
  [runtime] node version
  [build] ci workflow
  [metadata] license
```

## Key Features

- **Zero-config** -- run `badge-sync apply` and it works out of the box
- **Multi-ecosystem** -- supports JavaScript/TypeScript, Python, and Rust projects
- **Monorepo-aware** -- handles npm workspaces, pnpm, lerna, and Cargo workspaces
- **Safe** -- only modifies content inside `<!-- BADGES:START -->` / `<!-- BADGES:END -->` markers
- **Offline** -- `apply` and `check` require no network access
- **CI-ready** -- `check` exits code 1 when badges drift, failing the pipeline
- **Repairable** -- `doctor` finds broken badges, `repair` fixes them automatically

## Quick Start

### New project (no badges yet)

```bash
npx badge-sync init
```

This detects your project metadata, creates badge markers in your README, and generates all the right badges automatically.

### Existing project (update badges)

```bash
npx badge-sync apply
```

### CI enforcement

```yaml
# .github/workflows/ci.yml
- uses: yeongseon/badge-sync@v1
  with:
    command: check
```

## How It Works

badge-sync follows a four-stage pipeline:

1. **Detect** -- Scans project files (`package.json`, `pyproject.toml`, `Cargo.toml`, `.github/workflows/`, `LICENSE`) to collect repository metadata
2. **Resolve** -- Maps detected metadata to badge definitions with correct URLs for your package name, repo owner, and CI workflows
3. **Format** -- Orders badges by group (distribution, runtime, build, quality, metadata, social) and renders them as markdown
4. **Apply** -- Replaces only the content between `<!-- BADGES:START -->` and `<!-- BADGES:END -->` markers. Everything else is untouched

## Supported Badge Services

| Badge | Source | Service |
| ----- | ------ | ------- |
| npm version | `package.json` | shields.io |
| Node version | `package.json` `engines.node` | shields.io |
| PyPI version | `pyproject.toml` | shields.io |
| Python version | `pyproject.toml` | shields.io |
| crates.io version | `Cargo.toml` | shields.io |
| CI workflow status | `.github/workflows/*.yml` | GitHub Actions |
| Coverage | `codecov.yml` / `coveralls` config | Codecov, Coveralls |
| License | `LICENSE` file | shields.io |
| GitHub stars | Git remote URL | shields.io |

## Commands Overview

| Command | Purpose | Network |
| ------- | ------- | ------- |
| `apply` | Generate and write badges to README | Offline |
| `check` | Validate badges match repo state (CI gate) | Offline |
| `init` | First-time setup (create markers + badges) | Offline |
| `list` | List detected badges without applying | Offline |
| `doctor` | Detect broken or inconsistent badges | Online |
| `repair` | Automatically fix what `doctor` finds | Online |

See the [CLI Reference](CLI.md) for detailed command documentation and the [GitHub Action](github-action.md) guide for CI integration.

## Configuration

badge-sync works with zero configuration. To customize badge ordering or exclude specific badges, create a config file:

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

Supported config files: `badgesync.config.json`, `badgesync.config.yaml`, `badgesync.config.yml`.

Priority: user config > project preset > default ordering.

See the [Configuration](configuration.md) guide for full details.

## Project Links

- [Source Code](https://github.com/yeongseon/badge-sync)
- [npm Package](https://www.npmjs.com/package/badge-sync)
- [Issue Tracker](https://github.com/yeongseon/badge-sync/issues)
- [Changelog](changelog.md)
- [Contributing](contributing.md)
