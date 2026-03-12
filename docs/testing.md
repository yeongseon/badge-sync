# Testing

This guide covers badge-sync's testing strategy, how to run tests, write new tests, and maintain the test fixtures.

## Running Tests

### All Tests

```bash
npm test
```

This runs all test files in the `test/` directory using [vitest](https://vitest.dev/).

### With Coverage

```bash
npm run test:coverage
```

Coverage is enforced at 90% branch coverage. The pre-commit hook runs this automatically.

### Single Test File

```bash
npx vitest run test/detector.test.ts
```

### Watch Mode

```bash
npx vitest test/detector.test.ts
```

Vitest re-runs the test file on every source change.

### E2E Tests

```bash
npm run test:e2e         # Full E2E suite
npm run test:e2e:quick   # Quick mode (fewer repos)
```

E2E tests clone real open-source repositories and run badge-sync against them. These tests require network access and take longer to run.

## Test Structure

```
test/
+-- fixtures/           # Sample project files for testing
|   +-- javascript/     # package.json variants
|   +-- python/         # pyproject.toml variants
|   +-- rust/           # Cargo.toml variants
|   +-- monorepo/       # Workspace configurations
|   +-- workflows/      # GitHub Actions workflow files
+-- detector.test.ts    # Metadata detection tests
+-- resolver.test.ts    # Badge resolution tests
+-- formatter.test.ts   # Badge ordering and rendering tests
+-- readme.test.ts      # README parsing and badge block tests
+-- validator.test.ts   # URL validation tests (mocked HTTP)
+-- applier.test.ts     # Integration tests (full command flows)
+-- config.test.ts      # Configuration loading and validation tests
```

## Testing by Module

### detector

Tests use fixture files that simulate real project structures. Each test creates a temporary directory with specific metadata files and verifies that the detector extracts the correct information.

Key test scenarios:

- JavaScript project with `package.json` (name, version, repository URL, engines)
- Python project with `pyproject.toml` (name, requires-python)
- Rust project with `Cargo.toml` (name, version)
- Multi-ecosystem project (JavaScript + Python)
- Missing optional files (no LICENSE, no workflows)
- Malformed metadata files (invalid JSON, incomplete TOML)
- Monorepo workspace detection (npm, pnpm, lerna, Cargo)
- Private packages (`"private": true` in package.json)

### resolver

Unit tests that map `RepositoryMetadata` objects to `Badge[]` arrays. No file system access needed.

Key test scenarios:

- JavaScript project generates npm version, node version, CI, and license badges
- Python project generates PyPI version, python version, CI, and license badges
- Rust project generates crates.io version, CI, and license badges
- Multiple CI workflows generate multiple build badges
- Private packages skip distribution badges (no npm/PyPI/crates badge)
- Missing metadata fields result in skipped badges (not errors)
- Duplicate badge prevention when multiple sources provide the same information

### formatter

Unit tests for badge ordering and markdown rendering. Pure function tests with no side effects.

Key test scenarios:

- Default group ordering (distribution, runtime, build, quality, metadata, social)
- Custom group ordering via configuration
- Markdown rendering format: `[![alt](image-url)](link-url)`
- Empty badge list produces empty string
- Single badge produces single line (no trailing newline issues)
- Badges within the same group maintain stable ordering

### readme

Unit tests for README file parsing and badge block management.

Key test scenarios:

- Locate badge markers in a README string
- Extract existing badge block content
- Replace badge block content while preserving surrounding content
- Insert badge markers after the first heading
- Insert badge markers at the top when no heading exists
- Handle malformed markers (START without END, nested markers)
- Preserve content outside the badge block exactly (whitespace, formatting)

### validator

Tests with mocked HTTP responses. No real network calls during testing.

Key test scenarios:

- Badge image URL returns 200 (valid)
- Badge image URL returns 404 (broken-image issue)
- Badge link URL returns 404 (broken-link issue)
- Workflow badge references a workflow file that does not exist (missing-workflow issue)
- Badge references a different repository than the detected one (mismatched-repo issue)
- Duplicate badges in the badge block (duplicate issue)
- HTTP timeout handling
- Network error handling (connection refused, DNS failure)

### applier

Integration tests that exercise the full command flow. These tests create temporary directories with complete project structures and run commands end-to-end.

Key test scenarios:

- `apply` generates and writes badges to README
- `apply --dry-run` prints output without writing
- `check` passes when badges are in sync
- `check` fails when badges are out of sync
- `doctor` reports broken URLs
- `repair` fixes repairable issues
- `init` creates markers and applies badges
- `init` on an already-initialized project is a no-op
- Error handling for missing README, missing markers

### config

Tests for configuration file discovery, parsing, and validation.

Key test scenarios:

- Auto-detect `badgesync.config.yaml` in project root
- Auto-detect `badgesync.config.json` in project root
- Priority order when multiple config files exist
- Valid configuration passes zod validation
- Invalid configuration produces clear error messages
- Missing configuration file falls back to defaults
- CLI flag overrides configuration file values

## Writing Tests

### Test File Naming

Test files follow the pattern `test/<module>.test.ts`. Each test file corresponds to a source module in `src/`.

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { resolveBadges } from '../src/resolver.js';

describe('resolveBadges', () => {
  it('generates npm version badge for JavaScript projects', () => {
    const metadata = {
      ecosystem: ['javascript'],
      packageName: 'my-lib',
      // ... other fields
    };

    const badges = resolveBadges(metadata);
    const npmBadge = badges.find(b => b.type === 'npm-version');

    expect(npmBadge).toBeDefined();
    expect(npmBadge!.imageUrl).toContain('img.shields.io/npm/v/my-lib');
    expect(npmBadge!.group).toBe('distribution');
  });
});
```

### Test Fixtures

Place test fixtures in `test/fixtures/`. Organize by ecosystem:

```
test/fixtures/
+-- javascript/
|   +-- basic/package.json
|   +-- private/package.json
|   +-- workspaces/package.json
+-- python/
|   +-- basic/pyproject.toml
+-- rust/
|   +-- basic/Cargo.toml
```

### Mocking HTTP Requests

For `validator` tests, mock HTTP responses instead of making real network calls:

```typescript
import { vi } from 'vitest';

// Mock the HTTP module before importing validator
vi.mock('../src/http.js', () => ({
  headRequest: vi.fn(),
}));
```

## Coverage Requirements

- **Branch coverage**: 90% minimum (enforced by pre-commit hook)
- **Line coverage**: tracked but not enforced separately
- **Function coverage**: tracked but not enforced separately

Run `npm run test:coverage` to see the coverage report. Uncovered lines are highlighted in the terminal output.

## E2E Test Infrastructure

The E2E test script (`scripts/e2e-repos.sh`) clones real open-source repositories and runs badge-sync against them. This validates that badge-sync works correctly with real-world project structures.

The E2E suite has been validated against 24 open-source repositories covering JavaScript, Python, and Rust ecosystems.

To add a new E2E test repository, edit `scripts/e2e-repos.sh` and add the repository URL to the list.
