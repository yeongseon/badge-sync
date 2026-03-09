# Product Requirements Document

## 1. Overview

**badge-sync** is a CLI tool that automatically detects, generates, validates, orders, and maintains README badges based on repository metadata.

badge-sync is a **badge manager**, not a badge provider. It does not host or render badges itself. Instead, it integrates with existing badge providers — Shields.io, GitHub Actions, and package registry badges (npm, PyPI, crates.io) — to generate, validate, and maintain badge URLs.

The tool analyzes repository configuration such as:

- programming language
- package manager
- CI workflows
- license
- repository metadata

Based on this information, badge-sync ensures that README badges are:

- automatically generated
- consistently ordered
- valid and not broken
- aligned with repository metadata
- maintained automatically over time

badge-sync can run locally or inside CI/CD pipelines to enforce consistent README badge standards across repositories.

## 2. Problem Statement

README badges are widely used in open-source repositories to communicate important project metadata such as:

- build status
- package version
- language compatibility
- license
- documentation status
- repository activity

However, badge management is currently manual and error-prone.

### 2.1 Common Issues

- broken badge URLs
- incorrect repository references
- outdated CI workflow names
- inconsistent badge ordering
- duplicated badges
- missing recommended badges
- copied badges referencing other repositories

Maintainers typically copy badges from other projects and manually edit them, which frequently introduces mistakes.

There is currently no widely adopted tool that automatically manages README badges across repositories.

## 3. Goals

badge-sync aims to:

- Automatically detect repository metadata
- Generate recommended badges
- Enforce consistent badge ordering
- Detect broken badge links
- Repair common badge issues automatically
- Integrate with CI/CD workflows
- Support multiple programming ecosystems
- Allow users to customize badge ordering

## 4. Non-Goals

The following are not part of the initial scope:

- full README formatting
- markdown linting
- documentation generation
- repository analytics
- replacing existing markdown lint tools

badge-sync focuses specifically on badge detection, validation, and maintenance.

## 5. Target Users

Primary users include:

- open-source maintainers
- library authors
- repository maintainers
- teams managing multiple repositories
- DevOps engineers managing CI/CD pipelines

badge-sync is especially useful for developers maintaining multiple repositories and seeking consistency across README files.

## 6. Supported Ecosystems (MVP)

The first version will support the following ecosystems:

| Ecosystem              | Metadata Source                        |
| ---------------------- | -------------------------------------- |
| JavaScript / TypeScript | `package.json`                        |
| Python                 | `pyproject.toml` / `requirements.txt`  |
| Rust                   | `Cargo.toml`                           |

These ecosystems were selected because they provide:

- standardized package metadata
- widely used package registries
- consistent badge providers

## 7. Core Features

### 7.1 Repository Metadata Detection

badge-sync automatically detects repository metadata by analyzing repository files.

Detected metadata may include:

- programming language
- package name
- package registry
- CI system
- repository name
- license type

Detection sources include:

- package configuration files
- GitHub workflows
- license files
- git repository metadata

### 7.2 Automatic Badge Generation

Based on detected metadata, badge-sync generates recommended badges.

Example badges include:

- **Distribution**: npm version, PyPI version, crates.io version
- **Runtime**: Node version, Python version
- **Build**: GitHub Actions status
- **Metadata**: license badge
- **Social**: GitHub stars

Badge URL formats:

| Badge Type       | URL Template                                                                    |
| ---------------- | ------------------------------------------------------------------------------- |
| npm version      | `https://img.shields.io/npm/v/<package>`                                        |
| PyPI version     | `https://img.shields.io/pypi/v/<package>`                                       |
| crates.io        | `https://img.shields.io/crates/v/<package>`                                     |
| GitHub Actions   | `https://github.com/<owner>/<repo>/actions/workflows/<file>/badge.svg`          |
| License          | `https://img.shields.io/github/license/<owner>/<repo>`                          |
| Stars            | `https://img.shields.io/github/stars/<owner>/<repo>`                            |

Badge-to-group mapping:

| Badge Type         | Group          | Trigger Condition                          |
| ------------------ | -------------- | ------------------------------------------ |
| `npm-version`      | Distribution   | `package.json` detected                    |
| `pypi-version`     | Distribution   | `pyproject.toml` detected                  |
| `crates-version`   | Distribution   | `Cargo.toml` detected                      |
| `node-version`     | Runtime        | `package.json` with `engines.node`         |
| `python-version`   | Runtime        | `pyproject.toml` with `requires-python`    |
| `github-actions`   | Build / CI     | `.github/workflows/*.yml` detected (one badge per workflow) |
| `coverage`         | Quality        | (future — not in MVP)                      |
| `license`          | Metadata       | `LICENSE*` file detected                   |
| `stars`            | Social         | GitHub remote detected                     |

### 7.3 Badge Ordering

badge-sync enforces a consistent badge ordering pattern.

Default ordering:

1. Distribution
2. Runtime
3. Build / CI
4. Quality
5. Metadata
6. Social

This ordering ensures badges are presented in a predictable and readable format.

### 7.4 Custom Badge Ordering

Users can override the default ordering through configuration.

Example configuration:

```yaml
badges:
  order:
    - pypi
    - python
    - ci
    - license
    - stars
```

Configuration priority: user configuration > project preset > default ordering.

### 7.5 Broken Badge Detection

badge-sync detects broken or inconsistent badges.

Detected issues include:

- badge image URLs returning errors
- invalid badge target links
- workflow badges referencing missing workflow files
- mismatched repository names
- missing packages in registries
- duplicated badges

### 7.6 Automatic Repair

badge-sync can automatically repair common badge issues when possible.

**Safe to auto-fix:**

- fixing incorrect workflow badge URLs (workflow file renamed)
- updating repository references (owner/repo changed)
- removing exact duplicate badges (same type and URL)
- regenerating badge URLs from current metadata

**Never auto-fixed (reported as suggestions only):**

- deleting badges — even if broken, the user may want to keep or fix them manually
- changing badge providers — if a user chose a non-default provider, that choice is respected
- changing badge semantics — e.g., switching a version badge to a downloads badge

The `repair` command follows the Conservative by Default principle: it merges updated badges with existing content rather than replacing the entire badge block. User-added custom badges that are not auto-detected are preserved.

### 7.7 README Badge Block Management

badge-sync manages badges within a dedicated section in the README file.

```md
<!-- BADGES:START -->
... generated badges ...
<!-- BADGES:END -->
```

Only this section is modified to avoid affecting manual documentation.

### 7.8 CI/CD Integration

badge-sync can run inside CI pipelines to enforce badge consistency.

Typical CI usage includes:

- validating badge order
- detecting broken badges
- enforcing repository badge policies

Example CI command:

```bash
badge-sync check
```

## 8. CLI Commands

### `apply`

Generate and apply badges to the README.

```bash
badge-sync apply
```

### `check`

Verify badge configuration and ordering.

```bash
badge-sync check
```

### `doctor`

Detect broken or inconsistent badges.

```bash
badge-sync doctor
```

### `repair`

Automatically repair detected issues.

```bash
badge-sync repair
```

## 9. Architecture

Core modules:

- **detector** — detects repository metadata
- **resolver** — determines required badges from metadata
- **formatter** — applies badge ordering rules and renders markdown
- **validator** — validates badge URLs and links
- **applier** — updates README badge block

Module pipeline: `detector → resolver → formatter → validator → applier`

## 10. Technical Stack

| Purpose        | Choice     |
| -------------- | ---------- |
| Language       | TypeScript |
| Runtime        | Node.js 20+ |
| CLI framework  | commander  |
| Validation     | zod        |
| HTTP           | fetch      |
| File scanning  | fast-glob  |
| Config parsing | yaml       |
| Testing        | vitest     |

Distribution:

- npm package
- optional GitHub Action (future)

## 11. MVP Scope

Initial version will support:

- JavaScript / TypeScript repositories
- Python repositories
- Rust repositories
- GitHub Actions detection
- license badge generation
- CI badge generation
- package version badges
- README badge block management
- `apply`, `check`, `doctor`, `repair` commands

## 12. Future Enhancements

Possible future extensions include:

- additional ecosystem support (Go, Java, etc.)
- coverage badge detection
- documentation badge detection
- GitHub Action distribution
- interactive CLI setup
- monorepo support
- repository-wide badge policies

## 13. Success Metrics

- number of repositories using badge-sync
- adoption in CI/CD pipelines
- reduction in broken badge links
- consistent badge formatting across repositories
