# Development

This guide covers how to set up a development environment, run tests, and contribute code to badge-sync.

## Prerequisites

- **Node.js** >= 20 (check with `node --version`)
- **npm** >= 9 (comes with Node.js 20+)
- **Git**

## Getting Started

Clone the repository and install dependencies:

```bash
git clone https://github.com/yeongseon/badge-sync.git
cd badge-sync
npm install
```

## Project Structure

```
badge-sync/
+-- src/
|   +-- index.ts          # CLI entry point
|   +-- cli.ts            # Command definitions (commander)
|   +-- applier.ts        # Pipeline orchestrator
|   +-- detector.ts       # Repository metadata scanner
|   +-- resolver.ts       # Metadata-to-badge mapper
|   +-- formatter.ts      # Badge ordering and markdown renderer
|   +-- validator.ts      # Badge URL validator (HTTP)
|   +-- readme.ts         # README badge block manager
|   +-- config.ts         # Configuration file loader
|   +-- types.ts          # Shared TypeScript types
+-- test/
|   +-- fixtures/          # Test repository structures
|   +-- *.test.ts          # Test files (vitest)
+-- dist/                  # Compiled output (gitignored)
+-- docs/                  # Documentation (MkDocs)
+-- scripts/               # Build and E2E scripts
+-- action.yml             # GitHub Action definition
+-- package.json
+-- tsconfig.json
+-- mkdocs.yml
```

## Common Commands

| Command | Purpose |
| ------- | ------- |
| `npm test` | Run all tests |
| `npm run typecheck` | Type-check without emitting output |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run test:coverage` | Run tests with coverage (90% threshold) |
| `npm run test:e2e` | Run E2E tests against real repositories |
| `npm run test:e2e:quick` | Run E2E tests (quick mode) |
| `npm run clean` | Remove `dist/` directory |

## Code Standards

### TypeScript Strict Mode

The project uses TypeScript strict mode. All code must pass `npm run typecheck` without errors.

- No `any` types -- use `unknown` and narrow with type guards
- No `@ts-ignore` or `@ts-expect-error` -- fix the type issue properly
- No implicit `any` in function parameters or return types

### ESM Only

badge-sync is an ESM-only package (`"type": "module"` in package.json).

- Use `.js` extensions in all import paths (TypeScript resolves `.ts` files from `.js` imports)
- Use `import`/`export` syntax, never `require()`
- The compiled output in `dist/` is also ESM

### Error Handling

- No empty catch blocks (`catch(e) {}` is forbidden)
- All errors must include actionable context: which file, which badge, what went wrong
- Use specific error messages, not generic "something went wrong"

### Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat(detector): add Go ecosystem detection
fix(resolver): handle private packages without npm badge
test(formatter): add ordering edge case
docs(readme): update CLI usage examples
chore(deps): bump commander to v13
```

The scope should match the module name when the change is module-specific.

## Development Workflow

### Making Changes

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes in `src/`.

3. Add or update tests in `test/`.

4. Verify everything passes:

   ```bash
   npm run typecheck && npm test
   ```

5. Run coverage to verify the 90% threshold:

   ```bash
   npm run test:coverage
   ```

6. Commit using conventional commit format and push.

### Adding a New Badge Provider

This is the most common contribution. See the [Contributing](contributing.md) guide for step-by-step instructions.

### Adding a New Ecosystem

To support a new language ecosystem (e.g., Go, Java):

1. **`src/types.ts`** -- Add the ecosystem to the `Ecosystem` type union
2. **`src/detector.ts`** -- Add detection logic for the ecosystem's metadata files
3. **`src/resolver.ts`** -- Add badge resolution for the new ecosystem
4. **`test/`** -- Add tests for detection and resolution
5. **`test/fixtures/`** -- Add sample project files for the new ecosystem

### Pre-commit Hooks

The project uses [husky](https://typicode.github.io/husky/) for pre-commit hooks. The hook runs `npm run test:coverage` to enforce the 90% coverage threshold before every commit.

If you need to bypass the hook temporarily (not recommended):

```bash
git commit --no-verify -m "wip: temporary commit"
```

## Building

Compile TypeScript to JavaScript:

```bash
npm run build
```

The compiled output goes to `dist/`. This is the directory published to npm.

To test the CLI locally after building:

```bash
node dist/index.js apply
```

Or link it globally for development:

```bash
npm link
badge-sync apply
```

## Debugging

### Debugging Tests

Run a specific test file:

```bash
npx vitest run test/detector.test.ts
```

Run tests in watch mode:

```bash
npx vitest test/detector.test.ts
```

### Debugging the CLI

Run the CLI directly from TypeScript source using `tsx`:

```bash
npx tsx src/index.ts apply --dry-run
```

This avoids the need to rebuild after every change.

## Dependencies

badge-sync keeps its dependency footprint small:

| Package | Purpose |
| ------- | ------- |
| `commander` | CLI argument parsing |
| `fast-glob` | File pattern matching |
| `yaml` | YAML config file parsing |
| `zod` | Configuration schema validation |

Dev dependencies:

| Package | Purpose |
| ------- | ------- |
| `typescript` | TypeScript compiler |
| `vitest` | Test runner |
| `@vitest/coverage-v8` | Code coverage |
| `@types/node` | Node.js type definitions |
| `husky` | Git hooks |

## Continuous Integration

CI runs on every push and pull request via GitHub Actions (`.github/workflows/ci.yml`):

1. Typecheck (`npm run typecheck`)
2. Tests with coverage (`npm run test:coverage`)
3. Build verification (`npm run build`)

The CI matrix tests against Node.js 20 and 22.
