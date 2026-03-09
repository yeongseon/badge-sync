# badge-sync — Agent Instructions

## Project Overview

badge-sync is a TypeScript CLI tool that automatically detects repository metadata, generates README badges, enforces consistent badge ordering, validates badge links, and repairs common badge issues.

## Canonical Documents

Read these first, in this order:

1. `AGENTS.md` (this file)
2. `PRD.md`
3. `ARCH.md`
4. `DESIGN.md`
5. `docs/CLI.md`

## Technology Stack

- Language: TypeScript (strict mode)
- Runtime: Node.js 20+
- Package manager: npm
- CLI framework: commander
- Validation: zod
- File scanning: fast-glob
- Config parsing: yaml
- Testing: vitest

## Project Structure

```
badge-sync/
├── AGENTS.md
├── PRD.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts          # CLI entry point
│   ├── cli.ts            # Command definitions (apply, check, doctor, repair)
│   ├── types.ts          # Shared type definitions
│   ├── config.ts         # Config file loading and validation
│   ├── detector.ts       # Repository metadata detection
│   ├── resolver.ts       # Badge generation from metadata
│   ├── formatter.ts      # Badge ordering and markdown rendering
│   ├── validator.ts      # URL validation and broken badge detection
│   ├── readme.ts         # README badge block management
│   └── applier.ts        # Command orchestration (apply, check, doctor, repair)
└── test/
    ├── formatter.test.ts
    ├── readme.test.ts
    └── resolver.test.ts
```

## Architecture Rules

- Module pipeline: `detector → resolver → formatter → validator → applier`
- Each module has a single responsibility; do not merge concerns across modules
- The `applier` is the only module that orchestrates the pipeline
- README modifications are scoped to the badge block markers only:

```md
<!-- BADGES:START -->
<!-- BADGES:END -->
```

- Content outside the badge block must never be modified

## Supported Ecosystems (MVP)

| Ecosystem              | Metadata Source                       |
| ---------------------- | ------------------------------------- |
| JavaScript / TypeScript | `package.json`                       |
| Python                 | `pyproject.toml` / `requirements.txt` |
| Rust                   | `Cargo.toml`                          |

## CLI Commands

| Command   | Purpose                                    |
| --------- | ------------------------------------------ |
| `apply`   | Generate and apply badges to README        |
| `check`   | Validate badge configuration and ordering  |
| `doctor`  | Detect broken or inconsistent badges       |
| `repair`  | Automatically repair detected badge issues |

## Non-Negotiables

- **No `any` types** — use `unknown` and narrow
- **No `@ts-ignore` or `@ts-expect-error`** — fix the type issue properly
- **No silent error swallowing** — empty catch blocks are forbidden
- **ESM only** — `"type": "module"` in package.json, `.js` extensions in imports
- **Badge block isolation** — never modify README content outside `BADGES:START` / `BADGES:END`

## Working Rules

- Treat `PRD.md` as the product source of truth
- Treat `ARCH.md` as the implementation and structure source of truth
- Treat `DESIGN.md` as the design guardrail document
- Treat `docs/CLI.md` as the CLI behavior specification
- Keep changes small and focused on the requested task
- Avoid refactors unless explicitly requested
- Prefer existing patterns and conventions in this repo
- Write all documentation and code comments in English
- Do not create commits unless explicitly asked

## Testing

- Run `npm test` to execute the full test suite
- Always update or add tests when modifying logic
- Do not delete or disable failing tests

## Golden Commands

- `npm install`
- `npm run build`
- `npm run typecheck`
- `npm test`

## Commit Format

Use conventional commits:

```
type(scope): description

Examples:
feat(detector): add Go module detection
fix(validator): handle timeout on badge URL check
test(formatter): add custom ordering edge cases
docs(prd): update supported ecosystems
chore: update dependencies
```

## Badge Ordering

Default group order:

1. Distribution (npm, PyPI, crates.io)
2. Runtime (Node, Python, Rust version)
3. Build / CI (GitHub Actions)
4. Quality (coverage, code quality)
5. Metadata (license)
6. Social (stars)

Configuration priority: user config > project preset > default ordering.

## Configuration

Users can override badge ordering via config file:

- `badgesync.config.json`
- `badgesync.config.yaml`
- `badgesync.config.yml`
