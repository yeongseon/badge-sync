# badge-sync

> Badges should be simple signals, not maintenance burdens.

Keep your README badges clean, valid, and consistent.

badge-sync automatically detects, validates, and synchronizes README badges based on repository metadata.

## Why badge-sync

Badge management in README files is often manual and error-prone.

Common problems include:

- broken badge URLs after renaming repos or workflows
- badges copied from other projects with wrong references
- inconsistent badge ordering across repositories
- missing badges for detected ecosystems
- duplicated or outdated badges

badge-sync automatically:

- detects recommended badges from repository metadata
- validates badge links
- fixes broken badges
- enforces consistent ordering

## Features

- **Zero-config** — run `badge-sync apply` and it works
- **Deterministic** — same repository state always produces the same badges
- **Conservative** — never removes badges you added, only updates stale ones
- **CI-friendly** — `badge-sync check` exits with code `1` on mismatch
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

Add badge markers to your README:

```md
<!-- BADGES:START -->
<!-- BADGES:END -->
```

Then run:

```bash
# Generate and apply badges
badge-sync apply

# Validate badges match repository state (CI)
badge-sync check

# Detect broken or inconsistent badges
badge-sync doctor

# Automatically repair badge issues
badge-sync repair
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

Add to your GitHub Actions workflow:

```yaml
- name: Check badges
  run: npx badge-sync check
```

`badge-sync check` exits with code `1` if badges are out of sync, failing the pipeline.

## Roadmap

- [x] Core badge detection and generation
- [x] `apply`, `check`, `doctor`, `repair` commands
- [ ] Additional ecosystems (Go, Java)
- [ ] Coverage badge detection
- [ ] GitHub Action distribution
- [ ] Interactive CLI setup
- [ ] Monorepo support

## Documentation

- [Product Requirements](PRD.md)
- [Architecture](ARCH.md)
- [Design Principles](DESIGN.md)
- [CLI Specification](docs/CLI.md)
- [Agent Instructions](AGENTS.md)

## License

MIT
