# badge-sync

<!-- BADGES:START -->
[![npm version](https://img.shields.io/npm/v/badge-sync)](https://www.npmjs.com/package/badge-sync)
[![ci workflow](https://github.com/yeongseon/badge-sync/actions/workflows/ci.yml/badge.svg)](https://github.com/yeongseon/badge-sync/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/yeongseon/badge-sync)](https://github.com/yeongseon/badge-sync/blob/main/LICENSE)
<!-- BADGES:END -->

Automatically detect, generate, validate, and repair README badges from your repository metadata.

## Before / After

**Before** — stale badges after renaming your repo:

```md
<!-- BADGES:START -->
[![Build Status](https://travis-ci.org/old-org/old-name.svg?branch=master)](https://travis-ci.org/old-org/old-name)
[![npm](https://img.shields.io/npm/v/old-name.svg)](https://npmjs.com/package/old-name)
[![Coverage](https://coveralls.io/repos/github/old-org/old-name/badge.svg)](https://coveralls.io/github/old-org/old-name)
<!-- BADGES:END -->
```

**After** — one command fixes everything:

```bash
$ npx badge-sync apply
Applied 4 badges
  [distribution] npm version
  [runtime] node version
  [build] ci workflow
  [metadata] license
```

```md
<!-- BADGES:START -->
[![npm version](https://img.shields.io/npm/v/my-tool)](https://www.npmjs.com/package/my-tool)
[![node version](https://img.shields.io/node/v/my-tool)](https://nodejs.org)
[![ci workflow](https://github.com/my-org/my-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/my-org/my-tool/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/my-org/my-tool)](https://github.com/my-org/my-tool/blob/main/LICENSE)
<!-- BADGES:END -->
```

## Quick Start

**New project? No badges yet?** One command sets everything up:

```bash
npx badge-sync init
```

This detects your project metadata, creates badge markers in your README, and generates all the right badges automatically. No config needed.

**Already have badges?** Keep them in sync:

```bash
npx badge-sync apply
```

## Features

- **Zero-config** — run `badge-sync apply` and it works
- **Multi-ecosystem** — JavaScript, Python, Rust
- **Monorepo-aware** — npm workspaces, pnpm, lerna, Cargo workspaces
- **Safe** — only modifies content inside `<!-- BADGES:START -->` / `<!-- BADGES:END -->` markers
- **Offline** — `apply` and `check` require no network access
- **CI-ready** — `check` exits code 1 when badges drift, failing the pipeline
- **Repairable** — `doctor` finds broken badges, `repair` fixes them

## How It Works

1. **Detect** — Scans your project files (`package.json`, `pyproject.toml`, `Cargo.toml`, `.github/workflows/`, `LICENSE`) to collect repository metadata.
2. **Resolve** — Maps detected metadata to badge definitions with correct URLs for your package name, repo owner, and CI workflows.
3. **Format** — Orders badges by group (distribution → runtime → build → quality → metadata → social) and renders them as markdown.
4. **Apply** — Replaces only the content between `<!-- BADGES:START -->` and `<!-- BADGES:END -->` markers in your README. Everything else is untouched.

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

## CLI Usage

### `badge-sync init`

First-time setup — works in two scenarios:

#### New project (no badges yet)

Detects your project, creates a README if needed, inserts badge markers, and generates badges — all in one step:

```bash
$ badge-sync init
Created README.md
Inserted badge markers
Applied 4 badges
  [distribution] npm version
  [runtime] node version
  [build] ci workflow
  [metadata] license
```

#### Existing project (badges already in README)

Already have badges scattered in your README? `init` wraps them in badge markers, adds any missing ones, and removes duplicates:

```bash
$ badge-sync init
Inserted badge markers
Migrated 3 existing badges
Applied 5 badges (2 new)
  [distribution] npm version        # kept
  [runtime] node version            # new
  [build] ci workflow               # kept
  [quality] coverage                # kept
  [metadata] license                # new
```

Either way, running `init` on a project that's already set up is safe — it won't create duplicates.

### `badge-sync apply`

Generate and apply badges:

```bash
$ badge-sync apply
Applied 4 badges
  [distribution] npm version
  [runtime] node version
  [build] ci workflow
  [metadata] license
```

### `badge-sync apply --dry-run`

Preview changes without writing anything — useful for CI or when you want to see what would change before committing:

```bash
$ badge-sync apply --dry-run
Dry run - no changes written

Would apply 4 badge(s) (0 new, 2 updated, 2 unchanged):
  ~ [distribution] npm version
  ~ [build] ci workflow
  = [runtime] node version
  = [metadata] license
```

### `badge-sync check`

Validate badges match your repo state. Designed for CI — exits code 1 if badges are out of sync:

```bash
$ badge-sync check
Badges are in sync

$ badge-sync check  # when out of sync
Badges are out of sync

Detected 2 difference(s)

Expected:
[![npm version](https://img.shields.io/npm/v/my-tool)](...) ...

Current:
[![npm version](https://img.shields.io/npm/v/old-name)](...) ...
```

### `badge-sync doctor`

Detect broken or inconsistent badges (makes HTTP requests):

```bash
$ badge-sync doctor
Found 3 issue(s)

  ✗ [broken-image] Badge "Build Status" image URL returns 404
  ✗ [mismatched-repo] Badge "npm" references wrong package name
  ⚠ [missing-workflow] Badge "deploy" workflow file not found
```

### `badge-sync repair`

Automatically fix what `doctor` finds:

```bash
$ badge-sync repair
Fixed 2 issue(s)
  ✓ [mismatched-repo] Updated npm badge to correct package name
  ✓ [missing-workflow] Removed badge for missing workflow

1 issue(s) require manual intervention
  ✗ [broken-image] Cannot resolve "Build Status" badge URL
```

### Common Options

| Option | Commands | Description |
| ------ | -------- | ----------- |
| `--readme <path>` | all | README file path (default: `README.md`) |
| `--config <path>` | all | Config file path |
| `--dry-run` | `apply`, `init`, `repair` | Preview changes without writing |
| `--timeout <ms>` | `doctor`, `repair` | HTTP timeout per URL (default: 5000) |
| `--package <name>` | `apply`, `check` | Target a specific monorepo package |
| `--markers-only` | `init` | Insert markers without applying badges |

## Configuration

badge-sync works with zero configuration. To customize badge ordering or exclude specific badges:

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

Supported config files: `badgesync.config.json`, `badgesync.config.yaml`, `badgesync.config.yml`

Priority: user config > project preset > default ordering.

## CI Integration

### Using npx

```yaml
- name: Check badges
  run: npx badge-sync check
```

### Using GitHub Action

```yaml
- uses: yeongseon/badge-sync@v1
  with:
    command: check
```

With options:

```yaml
- uses: yeongseon/badge-sync@v1
  with:
    command: apply
    readme: docs/README.md
    dry-run: true
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on adding new badge providers and contributing to badge-sync.

## License

MIT
