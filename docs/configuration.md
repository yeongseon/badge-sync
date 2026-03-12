# Configuration

badge-sync works with zero configuration out of the box. This page covers optional configuration for customizing badge ordering, excluding specific badges, and targeting specific files.

## Zero-Config Behavior

By default, badge-sync:

1. Scans the current directory for metadata files (`package.json`, `pyproject.toml`, `Cargo.toml`, `.github/workflows/`, `LICENSE`)
2. Detects the project ecosystem automatically
3. Generates badges using Shields.io and GitHub Actions badge URLs
4. Orders badges by group: distribution, runtime, build, quality, metadata, social
5. Reads and writes `README.md` in the current directory

No configuration file is required for this default behavior.

## Configuration File

To customize behavior, create a configuration file in your project root:

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
  include: []
```

### Supported File Formats

badge-sync looks for configuration files in this order:

1. `badgesync.config.json`
2. `badgesync.config.yaml`
3. `badgesync.config.yml`

The first file found is used. If no configuration file exists, defaults apply.

### Configuration Priority

Configuration values are resolved in this priority order (highest first):

1. **CLI flags** -- `--readme`, `--config`, `--dry-run`
2. **User configuration file** -- `badgesync.config.yaml`
3. **Project preset** -- ecosystem-specific defaults
4. **Built-in defaults** -- hardcoded fallback values

## Configuration Options

### `badges.order`

Controls the display order of badge groups in the generated badge block.

**Type:** `BadgeGroup[]`

**Default:** `['distribution', 'runtime', 'build', 'quality', 'metadata', 'social']`

**Available groups:**

| Group | Badges |
| ----- | ------ |
| `distribution` | npm version, PyPI version, crates.io version |
| `runtime` | Node version, Python version |
| `build` | GitHub Actions CI workflow status |
| `quality` | Code coverage (Codecov, Coveralls) |
| `metadata` | License |
| `social` | GitHub stars |

Example: put build status first:

```yaml
badges:
  order:
    - build
    - distribution
    - runtime
    - quality
    - metadata
    - social
```

### `badges.exclude`

Exclude specific badge types from generation.

**Type:** `string[]`

**Default:** `[]`

Badge types correspond to the `type` field in badge definitions. Common types:

- `npm-version`
- `node-version`
- `pypi-version`
- `python-version`
- `crates-version`
- `github-actions` (all CI workflow badges)
- `codecov`
- `coveralls`
- `license`
- `stars`

Example: exclude the stars badge:

```yaml
badges:
  exclude:
    - stars
```

### `badges.include`

Force-include badge types that would not be auto-detected.

**Type:** `string[]`

**Default:** `[]`

This is primarily useful when badge-sync does not detect a specific badge type but you want it included anyway.

## JSON Format

The same configuration can be written in JSON:

```json
{
  "badges": {
    "order": [
      "distribution",
      "runtime",
      "build",
      "quality",
      "metadata",
      "social"
    ],
    "exclude": ["stars"],
    "include": []
  }
}
```

## CLI Overrides

CLI flags override configuration file values:

### `--readme <path>`

Specify the README file path. Overrides the default `README.md`.

```bash
badge-sync apply --readme docs/README.md
```

### `--config <path>`

Specify a configuration file path explicitly. Skips auto-detection.

```bash
badge-sync apply --config ./config/badges.yaml
```

### `--package <name>`

Target a specific monorepo package. Detects metadata and reads/writes README from the package directory.

```bash
badge-sync apply --package my-lib
```

## Monorepo Configuration

In monorepo setups, badge-sync detects workspace packages automatically from:

- `package.json` `workspaces` field (npm workspaces)
- `pnpm-workspace.yaml`
- `lerna.json`
- `Cargo.toml` `[workspace]` section

Each package can have its own badge block in its own README. Use the `--package` flag to target a specific package:

```bash
badge-sync apply --package packages/my-lib
```

## Schema Validation

Configuration files are validated using [zod](https://zod.dev/) schemas at load time. Invalid configuration produces clear error messages with the specific validation failure:

```
Error: Invalid configuration in badgesync.config.yaml
  badges.order: Expected array of BadgeGroup values, received "invalid"
```

## Common Configurations

### Minimal (exclude stars only)

```yaml
badges:
  exclude:
    - stars
```

### CI-focused (build badges first)

```yaml
badges:
  order:
    - build
    - quality
    - distribution
    - runtime
    - metadata
```

### Library (no social badges)

```yaml
badges:
  exclude:
    - stars
```

### Monorepo root (distribution badges only)

```yaml
badges:
  order:
    - distribution
  exclude:
    - runtime
    - build
    - quality
    - metadata
    - social
```
