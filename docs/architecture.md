# Architecture

This document describes the internal architecture of badge-sync: its module pipeline, data flow, type system, and design constraints.

## Overview

badge-sync is a small CLI package with five main concerns:

- Repository metadata detection
- Badge resolution and generation
- Badge ordering and markdown rendering
- Badge URL validation
- README badge block management

badge-sync is a **badge manager**, not a badge provider. It delegates badge rendering to external providers (Shields.io, GitHub Actions) and focuses on managing the lifecycle of badge URLs in README files.

```
Provider Layer (external)          Manager Layer (badge-sync)
+-- Shields.io                     +-- detector
+-- GitHub Actions                 +-- resolver
+-- npm registry                   +-- validator
+-- PyPI                           +-- formatter
+-- crates.io                      +-- applier
```

## Module Pipeline

```
detector --> resolver --> formatter --> validator --> applier
```

Each module has a single responsibility. Only the `applier` orchestrates the pipeline.

## Runtime Flow by Command

### `apply`

1. User runs `badge-sync apply`.
2. Commander dispatches to the `apply` handler in `applier.ts`.
3. `detector` scans the repository for metadata files (`package.json`, `pyproject.toml`, `Cargo.toml`, `.github/workflows/*`, `LICENSE*`, git remote).
4. `resolver` maps detected metadata to badge definitions (type, image URL, link URL).
5. `formatter` sorts badges by group ordering and renders them as markdown image links.
6. `applier` reads the README, locates the `<!-- BADGES:START -->` / `<!-- BADGES:END -->` block, replaces its contents with the formatted badges, and writes the file.
7. CLI prints a summary of applied badges and exits with code `0`.

### `check`

1. User runs `badge-sync check`.
2. `detector` and `resolver` produce the expected badge set.
3. `applier` reads the current README badge block.
4. Compares expected badges against current badges (content and ordering).
5. If badges match, exit `0`. If mismatch, print diff and exit `1`.

### `doctor`

1. User runs `badge-sync doctor`.
2. `detector` and `resolver` produce the expected badge set.
3. `validator` performs HTTP HEAD requests against each badge image URL and link URL.
4. `validator` cross-references workflow badges against `.github/workflows/` files.
5. Reports broken URLs, missing workflows, mismatched repositories, and duplicate badges.
6. Exit `0` if no issues found. Exit `1` if issues detected.

### `repair`

1. User runs `badge-sync repair`.
2. Runs the `doctor` diagnostic flow first.
3. For each repairable issue, applies automatic fixes: regenerates badge URLs from current metadata, removes duplicates, fixes workflow file references.
4. Runs `apply` with the repaired badge set.
5. Reports what was fixed and exits.

### `init`

1. User runs `badge-sync init`.
2. Loads config and resolves README path.
3. Creates the README file if it does not exist.
4. Checks for existing badge markers.
5. If markers exist, reports setup is complete and exits.
6. If markers do not exist, inserts `<!-- BADGES:START -->` / `<!-- BADGES:END -->` markers after the first heading (or at the top of the file).
7. Runs the badge pipeline and writes badges into the new marker block.
8. Prints a setup summary.

## Module Structure

### `detector.ts`

Scans the repository root for metadata files. Parses `package.json`, `pyproject.toml`, and `Cargo.toml`. Extracts package name, version, repository URL, GitHub Actions workflow files, license files, and git remote origin URL.

Returns: `RepositoryMetadata` -- a structured object containing all detected metadata.

### `resolver.ts`

Maps repository metadata to badge definitions. Determines which badges apply based on the detected ecosystem. Constructs badge image URLs and link URLs using Shields.io and GitHub templates. Avoids duplicate badges when multiple metadata sources overlap.

Returns: `Badge[]` -- an ordered list of badge definitions with type, group, image URL, and link URL.

### `formatter.ts`

Sorts badges by group ordering (Distribution, Runtime, Build/CI, Quality, Metadata, Social). Applies user configuration overrides for ordering. Renders each badge as a markdown image link (`[![alt](image-url)](link-url)`) and joins them into a single markdown string.

Returns: `string` -- the formatted markdown badge block content.

### `validator.ts`

Validates badge image URLs and link URLs via HTTP HEAD requests. Cross-references workflow badge filenames against `.github/workflows/`. Detects mismatched repository references and duplicate badges. Reports validation results with severity levels.

Returns: `ValidationResult[]` -- a list of issues with badge reference, issue type, and severity.

### `readme.ts`

Reads README file content. Locates `<!-- BADGES:START -->` and `<!-- BADGES:END -->` markers. Extracts, inserts, or replaces badge block content. Writes the updated README file. Preserves all content outside the badge block exactly as-is.

### `applier.ts`

Orchestrates the module pipeline for each CLI command. Coordinates `detector -> resolver -> formatter` for `apply` and `check`. Coordinates `detector -> resolver -> validator` for `doctor`. Coordinates the `doctor` flow + `apply` flow for `repair`. Handles command-specific options, flags, and CLI output formatting.

### `config.ts`

Locates configuration files (`badgesync.config.json`, `badgesync.config.yaml`, `badgesync.config.yml`). Parses and validates configuration using zod schemas. Merges user configuration with default configuration. Exposes resolved configuration to other modules.

### `types.ts`

Defines shared TypeScript types and interfaces. Serves as the single source of truth for type definitions across modules.

Core types:

```typescript
type Ecosystem = 'javascript' | 'python' | 'rust';

type BadgeGroup = 'distribution' | 'runtime' | 'build' | 'quality' | 'metadata' | 'social';

interface RepositoryMetadata {
  ecosystem: Ecosystem[];
  packageName: string | null;
  repositoryUrl: string | null;
  owner: string | null;
  repo: string | null;
  license: string | null;
  workflows: string[];
  nodeVersion: string | null;
  pythonVersion: string | null;
}

interface Badge {
  type: string;
  group: BadgeGroup;
  label: string;
  imageUrl: string;
  linkUrl: string;
}

interface ValidationResult {
  badge: Badge;
  issue: 'broken-image' | 'broken-link' | 'missing-workflow' | 'duplicate' | 'mismatched-repo';
  severity: 'error' | 'warning';
  message: string;
  fixable: boolean;
}

interface Config {
  readme: string;
  badges: {
    order: BadgeGroup[];
    exclude: string[];
    include: string[];
  };
}
```

### `cli.ts`

Defines CLI commands using commander. Wires commands to `applier` handlers. Parses global options (`--readme`, `--config`, `--dry-run`). Handles top-level error reporting.

### `index.ts`

CLI entry point. Imports and executes `cli.ts`.

## Error Handling

- `detector` returns partial metadata when some files are missing or unparseable. It does not throw for missing optional files.
- `resolver` skips badges when required metadata is insufficient. It does not throw.
- `formatter` always succeeds given valid badge input.
- `validator` catches HTTP errors per badge and includes them in results. It does not throw for individual badge failures.
- `readme.ts` throws if the README file is missing or if badge block markers are malformed.
- `applier` catches module errors and reports them as CLI-friendly messages. Exits with code `1` on failure.

All errors include actionable context: which file, which badge, and what went wrong.

## Design Constraints

- Keep the runtime small and dependency-light
- Keep badge generation deterministic (same input produces same output)
- Avoid hidden network calls except in `doctor` and `repair` (which explicitly probe URLs)
- `apply` and `check` must work fully offline
- Never modify README content outside the badge block markers

## Testing Strategy

The repository tests focus on:

- `detector`: fixture-based tests with sample `package.json`, `pyproject.toml`, `Cargo.toml` files
- `resolver`: unit tests mapping metadata to badge definitions
- `formatter`: unit tests for ordering, rendering, and custom configuration
- `readme`: unit tests for badge block parsing, insertion, and replacement
- `validator`: tests with mocked HTTP responses
- `applier`: integration tests covering full command flows
- `config`: tests for config file discovery, parsing, and validation

Test fixtures live in `test/fixtures/` with representative repository structures.
