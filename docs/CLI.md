# CLI Specification

## Command Surface

```bash
badge-sync apply [options]
badge-sync check [options]
badge-sync list [options]
badge-sync doctor [options]
badge-sync repair [options]
badge-sync init [options]
badge-sync --version
badge-sync --help
```

## Global Options

### `--readme <path>`

- optional
- default: `README.md` in the current directory
- specifies the README file to operate on

### `--config <path>`

- optional
- default: auto-detected from `badgesync.config.{json,yaml,yml}`
- specifies a configuration file

### `--dry-run`

- optional
- default: `false`
- prints what would change without writing any files
- applies to `apply` and `repair` commands

### `--markers-only`

- optional
- default: `false`
- inserts badge block markers without running badge detection/apply
- applies to `init` command

## `apply`

Generate and apply badges to the README.

### Behavior

1. Detects repository metadata from files in the current directory.
2. Resolves applicable badges from detected metadata.
3. Sorts badges by group ordering (default or user-configured).
4. Renders badges as markdown image links.
5. Locates the badge block in the README (`<!-- BADGES:START -->` / `<!-- BADGES:END -->`).
6. Replaces the badge block content with the generated badges.
7. Writes the updated README.

### Options

`--dry-run`

- prints the generated badge block to stdout without modifying the README

`--package <name>`

- targets a specific monorepo package
- detects metadata from the selected package directory
- reads and writes `README.md` in the selected package directory

### Output

On success:

- prints a summary: number of badges applied, grouped by category
- exit code `0`

On no changes needed:

- prints "Badges are up to date"
- exit code `0`

### Failure Conditions

Exit code `1` when:

- README file not found
- badge block markers (`<!-- BADGES:START -->` / `<!-- BADGES:END -->`) not found in README
- badge block markers are malformed (e.g., START without END, or nested markers)
- no metadata detected (no recognizable ecosystem files found)

### Network

- **no network calls** — `apply` works fully offline

## `check`

Validate badge configuration and ordering against the current README.

### Behavior

1. Detects repository metadata.
2. Resolves and formats the expected badge block.
3. Reads the current badge block from the README.
4. Compares expected vs. current content.

### Options

`--package <name>`

- targets a specific monorepo package
- detects metadata from the selected package directory
- reads `README.md` in the selected package directory

### Output

On match:

- prints "Badges are in sync"
- exit code `0`

On mismatch:

- prints a diff showing expected vs. current badge block
- exit code `1`

### Failure Conditions

Exit code `1` when:

- README file not found
- badge block markers not found
- expected badges differ from current badges (content or ordering)

### Network

- **no network calls** — `check` works fully offline

### CI Usage

```yaml
- name: Check badges
  run: npx badge-sync check
```

The `check` command is designed for CI enforcement. A non-zero exit code fails the pipeline.

## `list`

List detected badges and monorepo packages without applying changes.

### Behavior

1. Detects repository metadata from the current directory.
2. Detects monorepo packages when workspace configuration exists.
3. Resolves badges from detected metadata.
4. Prints monorepo package information (if any).
5. Prints all detected badges.

### Output

On monorepo projects:

- prints detected package names, ecosystems, and relative paths
- prints detected badges for the root project metadata

On non-monorepo projects:

- prints `Monorepo packages: none`
- prints detected badges

### Network

- **no network calls** — `list` works fully offline

## `doctor`

Detect broken or inconsistent badges.

### Behavior

1. Detects repository metadata.
2. Resolves expected badges.
3. Reads current badges from the README badge block.
4. For each badge, validates:
   - badge image URL accessibility (HTTP HEAD)
   - badge link URL accessibility (HTTP HEAD)
   - workflow file existence for GitHub Actions badges
   - repository name consistency
5. Detects duplicate badges.
6. Reports all issues found.

### Options

`--timeout <ms>`

- optional
- default: `5000`
- HTTP request timeout per badge URL

### Output

On no issues:

- prints "No issues found"
- exit code `0`

On issues found:

- prints a diagnostic report listing each issue with:
  - badge reference (which badge)
  - issue type (broken URL, missing workflow, duplicate, etc.)
  - severity (error, warning)
  - suggested fix (if available)
- exit code `1`

### Failure Conditions

Exit code `1` when:

- any badge validation issue is detected
- README or badge block markers are missing

### Network

- **makes network calls** — HTTP HEAD requests to validate badge URLs
- respects `--timeout` for each request
- network failures for individual badges are reported as issues, not as command failures

## `repair`

Automatically repair detected badge issues.

### Behavior

1. Runs the `doctor` diagnostic flow.
2. For each repairable issue:
   - regenerates badge URLs from current metadata
   - removes duplicate badges
   - fixes workflow file references
3. Applies the repaired badge set using the `apply` flow.
4. Reports what was fixed.

### Options

`--dry-run`

- prints what would be fixed without modifying the README

### Output

On no issues:

- prints "No issues to repair"
- exit code `0`

On repairs applied:

- prints a summary of each repair action taken
- exit code `0`

On unrepairable issues:

- prints repairs applied and lists remaining issues that require manual intervention
- exit code `1` (if any issues remain unresolved)

### Failure Conditions

Exit code `1` when:

- README or badge block markers are missing
- some issues could not be automatically repaired

### Network

- **makes network calls** — same as `doctor` for diagnostic phase

## `init`

Initialize badge-sync in your project with a guided non-interactive flow.

### Behavior

1. Loads config and resolves README path.
2. Creates the README file if it does not exist (`# <directory-name>`).
3. Checks for existing badge markers.
4. If markers exist, reports that setup is already complete and exits.
5. If markers do not exist, inserts:
   - `<!-- BADGES:START -->`
   - `<!-- BADGES:END -->`
6. Marker placement:
   - after the first `# ` heading line when present
   - otherwise at the top of the README
7. By default, runs the normal badge pipeline (`detectMetadata` -> `resolveBadges` -> `formatBadges`) and writes badges into the new marker block.
8. Prints a setup summary (README creation, marker insertion, badge count, detected badge labels).

### Options

`--markers-only`

- inserts markers only
- skips badge detection and application

### Output

On first setup:

- prints marker insertion summary
- prints created README path if README was created
- prints applied badge count when badges are applied
- exit code `0`

When markers already exist:

- prints "Badge markers already exist in README"
- prints "Run `badge-sync apply` to update badges"
- exit code `0`

### Failure Conditions

Exit code `1` when:

- config path is invalid or config validation fails
- README cannot be read or written
- badge detection/apply fails in default mode

### Network

- **no network calls** in normal `init` mode (same as `apply`)
- `--markers-only` also performs no network calls

## `--version`

Prints the installed package version and exits.

## `--help`

Prints usage information for the CLI or a specific command.

```bash
badge-sync --help
badge-sync apply --help
```

## Exit Code Summary

| Code | Meaning                                          |
| ---- | ------------------------------------------------ |
| `0`  | Success, no issues                               |
| `1`  | Failure, issues found, or validation mismatch    |

## Non-Goals for Current CLI

Not currently supported:

- interactive prompts
- selecting specific badge types to apply
- overwriting badges outside the badge block
- custom badge providers (beyond Shields.io and GitHub)
- verbose/quiet output flags (may be added later)

## Future CLI Surface

Likely future additions:

- ~~`badge-sync init` — create badge block markers in README~~ (implemented)
- ~~`badge-sync list` — list detected badges without applying~~ (implemented)
- `--verbose` / `--quiet` output control
- `--format json` for machine-readable output
