# Troubleshooting

This page covers common issues when using badge-sync and how to resolve them.

## Installation Issues

### `npx badge-sync` fails with "command not found"

Ensure Node.js >= 20 is installed:

```bash
node --version
# Should print v20.x.x or higher
```

If you have an older version, upgrade Node.js using your package manager or [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 20
nvm use 20
```

### `npm install` fails with peer dependency errors

badge-sync requires Node.js 20+. If you see peer dependency warnings, verify your Node.js version. The `engines` field in `package.json` enforces `"node": ">=20"`.

## Badge Block Issues

### "Badge block markers not found"

badge-sync requires `<!-- BADGES:START -->` and `<!-- BADGES:END -->` markers in your README. If they are missing, run `init` to create them:

```bash
badge-sync init
```

This inserts the markers after the first `# ` heading in your README (or at the top if no heading exists).

### Markers exist but badges are not updated

Verify the markers are exactly as shown (no extra spaces or characters):

```md
<!-- BADGES:START -->
...your badges...
<!-- BADGES:END -->
```

Common mistakes:

- Extra whitespace inside the comment: `<!-- BADGES: START -->` (space before START)
- Lowercase: `<!-- badges:start -->`
- Missing closing `-->`: `<!-- BADGES:START`
- Nested markers (START inside another START/END block)

### `init` says "Badge markers already exist"

This means your README already has badge markers. Use `apply` to update badges:

```bash
badge-sync apply
```

Running `init` on an already-initialized project is intentionally a no-op to prevent duplicate markers.

## Detection Issues

### "No metadata detected"

badge-sync could not find any recognizable project files. It looks for:

- `package.json` (JavaScript/TypeScript)
- `pyproject.toml` (Python)
- `Cargo.toml` (Rust)
- `.github/workflows/*.yml` (CI workflows)
- `LICENSE` or `LICENSE.*` (license file)

Verify you are running badge-sync from the project root directory (where these files live).

### Wrong package name detected

badge-sync reads the package name from:

- `package.json` `name` field (JavaScript)
- `pyproject.toml` `[project] name` field (Python)
- `Cargo.toml` `[package] name` field (Rust)

If the detected name is wrong, check the corresponding metadata file. badge-sync uses the metadata as-is and does not infer package names from directory names.

### Missing badges for a detected ecosystem

Some badges require specific metadata fields:

| Badge | Required Field |
| ----- | -------------- |
| npm version | `package.json` `name` (and package must not be `"private": true`) |
| Node version | `package.json` `engines.node` |
| PyPI version | `pyproject.toml` `[project] name` |
| Python version | `pyproject.toml` `requires-python` |
| CI workflow | `.github/workflows/*.yml` files must exist |
| License | `LICENSE` file must exist in the project root |

If a required field is missing, the corresponding badge is silently skipped.

### Private packages skip distribution badges

If `package.json` has `"private": true`, badge-sync skips the npm version badge because private packages are not published to npm. This is intentional behavior.

## CI Issues

### `badge-sync check` fails in CI

This means your README badges are out of sync with your repository metadata. Fix it by running locally:

```bash
badge-sync apply
```

Then commit and push the updated README.

To prevent this from happening, use the badge-sync bot workflow to automatically open PRs when badges drift. See the [GitHub Action](github-action.md) guide.

### GitHub Action fails with permission errors

The badge-sync bot workflow requires these permissions:

```yaml
permissions:
  contents: write
  pull-requests: write
```

Ensure these are set in your workflow file. The default `GITHUB_TOKEN` provides these permissions in the original repository (not in forks).

### GitHub Action does not create a PR

Check the "Check for changes" step output. If `changed=false`, badge-sync did not detect any differences. This means badges are already up to date.

If you expect changes but none were detected, run `badge-sync apply --dry-run` locally to see what badge-sync would generate.

## Doctor and Repair Issues

### `doctor` reports false positives for badge URLs

Some badge URLs return non-200 status codes even when the badge renders correctly:

- Shields.io may return 302 redirects
- GitHub Actions badge URLs may return 404 for private repositories
- Rate limiting may cause temporary 429 responses

If `doctor` reports issues that you know are false positives, you can ignore them. The `--timeout` flag can help with slow responses:

```bash
badge-sync doctor --timeout 10000
```

### `repair` says "requires manual intervention"

Some issues cannot be automatically fixed:

- **broken-image**: badge-sync cannot determine the correct image URL if the badge provider is down or the URL pattern is unrecognized
- **Custom badges**: badges that were manually added (not auto-detected) are never modified by `repair`

For these issues, edit the badge block in your README manually.

### `doctor` hangs or is very slow

`doctor` makes HTTP HEAD requests to validate each badge URL. If you have many badges or slow network connectivity, this can take a while.

Use `--timeout` to reduce the per-URL timeout:

```bash
badge-sync doctor --timeout 3000
```

## Monorepo Issues

### Badges generated for wrong package

In monorepo setups, use the `--package` flag to target a specific package:

```bash
badge-sync apply --package my-lib
```

Without `--package`, badge-sync uses metadata from the repository root.

### Workspace packages not detected

badge-sync detects workspaces from:

- `package.json` `workspaces` field (npm)
- `pnpm-workspace.yaml` (pnpm)
- `lerna.json` (Lerna)
- `Cargo.toml` `[workspace]` section (Rust)

Verify your workspace configuration file exists and contains the correct package paths.

## Configuration Issues

### Configuration file is ignored

Ensure the file is in the project root and has one of these names:

- `badgesync.config.json`
- `badgesync.config.yaml`
- `badgesync.config.yml`

Files in subdirectories are not auto-detected. Use `--config` to specify a non-standard path:

```bash
badge-sync apply --config ./config/badges.yaml
```

### "Invalid configuration" error

badge-sync validates configuration files using zod schemas. The error message includes the specific validation failure:

```
Error: Invalid configuration in badgesync.config.yaml
  badges.order: Expected array of BadgeGroup values, received "invalid"
```

Valid badge group values are: `distribution`, `runtime`, `build`, `quality`, `metadata`, `social`.

## Getting Help

If your issue is not covered here:

1. Run with `--dry-run` to see what badge-sync would do without making changes
2. Check the [CLI Reference](CLI.md) for command-specific behavior
3. Open an issue on [GitHub](https://github.com/yeongseon/badge-sync/issues) with:
   - The command you ran
   - The error message or unexpected behavior
   - Your project structure (which metadata files exist)
   - Your Node.js version (`node --version`)
