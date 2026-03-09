# Architecture

## Overview

badge-sync is a small CLI package with five main concerns:

- repository metadata detection
- badge resolution and generation
- badge ordering and markdown rendering
- badge URL validation
- README badge block management

badge-sync is a **badge manager**, not a badge provider. It delegates badge rendering to external providers and focuses on managing the lifecycle of badge URLs in README files.

```
Provider Layer (external)          Manager Layer (badge-sync)
├── Shields.io                     ├── detector
├── GitHub Actions                 ├── resolver
├── npm registry                   ├── validator
├── PyPI                           ├── formatter
└── crates.io                      └── applier
```

## Module Pipeline

```
detector → resolver → formatter → validator → applier
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
5. If badges match → exit `0`. If mismatch → print diff and exit `1`.

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
3. For each repairable issue, applies automatic fixes:
   - regenerates badge URLs from current metadata
   - removes duplicates
   - fixes workflow file references
4. Runs `apply` with the repaired badge set.
5. Reports what was fixed and exits.

## Module Structure

### `detector.ts`

Responsibilities:

- scan the repository root for metadata files
- parse `package.json`, `pyproject.toml`, `Cargo.toml`
- extract package name, version, repository URL
- detect GitHub Actions workflow files
- detect license files
- extract git remote origin URL

Returns: `RepositoryMetadata` — a structured object containing all detected metadata.

### `resolver.ts`

Responsibilities:

- map repository metadata to badge definitions
- determine which badges apply based on detected ecosystem
- construct badge image URLs and link URLs using Shields.io and GitHub templates
- avoid duplicate badges when multiple metadata sources overlap

Returns: `Badge[]` — an ordered list of badge definitions with type, group, image URL, and link URL.

### `formatter.ts`

Responsibilities:

- sort badges by group ordering (Distribution → Runtime → Build/CI → Quality → Metadata → Social)
- apply user configuration overrides for ordering
- render each badge as a markdown image link: `[![alt](image-url)](link-url)`
- join badges into a single markdown string

Returns: `string` — the formatted markdown badge block content.

### `validator.ts`

Responsibilities:

- validate badge image URLs via HTTP HEAD requests
- validate badge link URLs via HTTP HEAD requests
- cross-reference workflow badge filenames against `.github/workflows/`
- detect mismatched repository references
- detect duplicate badges
- report validation results with severity levels

Returns: `ValidationResult[]` — a list of issues with badge reference, issue type, and severity.

### `readme.ts`

Responsibilities:

- read README file content
- locate `<!-- BADGES:START -->` and `<!-- BADGES:END -->` markers
- extract existing badge block content
- insert or replace badge block content
- write updated README file
- preserve all content outside the badge block exactly as-is

### `applier.ts`

Responsibilities:

- orchestrate the module pipeline for each CLI command
- coordinate `detector → resolver → formatter` for `apply` and `check`
- coordinate `detector → resolver → validator` for `doctor`
- coordinate `doctor` flow + `apply` flow for `repair`
- handle command-specific options and flags
- format CLI output (success messages, diffs, diagnostic reports)

### `config.ts`

Responsibilities:

- locate configuration files (`badgesync.config.json`, `badgesync.config.yaml`, `badgesync.config.yml`)
- parse and validate configuration using zod schemas
- merge user configuration with default configuration
- expose resolved configuration to other modules

### `types.ts`

Responsibilities:

- define shared TypeScript types and interfaces
- serve as the single source of truth for type definitions across modules

Core type definitions:

```typescript
/** Detected ecosystem type */
type Ecosystem = 'javascript' | 'python' | 'rust';

/** Badge group for ordering */
type BadgeGroup = 'distribution' | 'runtime' | 'build' | 'quality' | 'metadata' | 'social';

/** Repository metadata collected by detector */
interface RepositoryMetadata {
  ecosystem: Ecosystem[];              // detected ecosystems (can be multi-language)
  packageName: string | null;          // package name from manifest
  repositoryUrl: string | null;        // git remote origin URL
  owner: string | null;                // GitHub owner (parsed from repositoryUrl)
  repo: string | null;                 // GitHub repo name (parsed from repositoryUrl)
  license: string | null;              // license SPDX identifier (e.g., 'MIT')
  workflows: string[];                 // .github/workflows/*.yml filenames
  nodeVersion: string | null;          // from package.json engines.node
  pythonVersion: string | null;        // from pyproject.toml requires-python
}

/** Single badge definition */
interface Badge {
  type: string;                        // unique identifier (e.g., 'npm-version', 'github-actions')
  group: BadgeGroup;                   // ordering group
  label: string;                       // alt text for the badge image
  imageUrl: string;                    // badge image URL (Shields.io or GitHub)
  linkUrl: string;                     // click-through URL
}

/** Result from validator */
interface ValidationResult {
  badge: Badge;                        // the badge that was validated
  issue: 'broken-image' | 'broken-link' | 'missing-workflow' | 'duplicate' | 'mismatched-repo';
  severity: 'error' | 'warning';
  message: string;                     // human-readable description
  fixable: boolean;                    // whether repair can auto-fix this
}

/** User configuration (validated by zod) */
interface Config {
  readme: string;                      // README file path, default: 'README.md'
  badges: {
    order: BadgeGroup[];               // custom group ordering
    exclude: string[];                 // badge types to skip (e.g., ['stars'])
    include: string[];                 // additional badge types to force-include
  };
}
```

### `cli.ts`

Responsibilities:

- define CLI commands using commander
- wire commands to `applier` handlers
- parse global options (e.g., `--readme`, `--config`, `--dry-run`)
- handle top-level error reporting

### `index.ts`

Responsibilities:

- CLI entry point
- import and execute `cli.ts`

## Error Handling

- `detector` returns partial metadata when some files are missing or unparseable. It does not throw for missing optional files.
- `resolver` skips badges when required metadata is insufficient. It does not throw.
- `formatter` always succeeds given valid badge input.
- `validator` catches HTTP errors per badge and includes them in results. It does not throw for individual badge failures.
- `readme.ts` throws if the README file is missing or if badge block markers are malformed.
- `applier` catches module errors and reports them as CLI-friendly messages. Exits with code `1` on failure.

All errors must include actionable context: which file, which badge, what went wrong.

## Design Constraints

- keep the runtime small and dependency-light
- keep badge generation deterministic (same input → same output)
- avoid hidden network calls except in `doctor` and `repair` (which explicitly probe URLs)
- `apply` and `check` must work fully offline
- never modify README content outside the badge block markers

## Testing Strategy

The repository tests focus on:

- `detector`: fixture-based tests with sample `package.json`, `pyproject.toml`, `Cargo.toml` files
- `resolver`: unit tests mapping metadata → badge definitions
- `formatter`: unit tests for ordering, rendering, and custom configuration
- `readme`: unit tests for badge block parsing, insertion, and replacement
- `validator`: tests with mocked HTTP responses
- `applier`: integration tests covering full command flows
- `config`: tests for config file discovery, parsing, and validation

Test fixtures live in `test/fixtures/` with representative repository structures.

## Future Architectural Extensions

Likely next additions:

- ecosystem plugin system for adding new language support
- badge template registry for custom badge types
- monorepo detection and per-package badge generation
- GitHub Action wrapper around the CLI
- caching layer for `doctor` HTTP validation results
