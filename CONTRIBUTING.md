# Contributing to badge-sync

Thanks for your interest in contributing! This guide covers the most common contribution: adding a new badge provider.

## Adding a New Badge Provider

badge-sync follows a pipeline architecture: **detect → resolve → format → apply**. Adding a new badge type typically touches two files.

### Step 1: Update the Resolver

Open `src/resolver.ts` and add your badge to the `resolveBadges` function. Each badge needs a `type`, `group`, `label`, `imageUrl`, and `linkUrl`:

```typescript
// Example: adding a "downloads" badge
if (metadata.ecosystem.includes('javascript') && jsPackage) {
  badges.push({
    type: 'npm-downloads',
    group: 'distribution',
    label: 'npm downloads',
    imageUrl: `https://img.shields.io/npm/dm/${jsPackage}`,
    linkUrl: `https://www.npmjs.com/package/${jsPackage}`,
  });
}
```

### Step 2: Update Badge Type Inference

In the same file, add a case to `inferBadgeType` so badge-sync can recognize your badge in existing READMEs:

```typescript
if (imageUrl.includes('img.shields.io/npm/dm/')) {
  return 'npm-downloads';
}
```

And update `inferBadgeGroup` if your badge type uses a new prefix pattern:

```typescript
if (type === 'npm-downloads') {
  return 'distribution';
}
```

### Step 3: Add Tests

Add test cases in `test/resolver.test.ts`:

```typescript
it('generates npm-downloads badge for JS projects', () => {
  const badges = resolveBadges(metadata);
  const badge = badges.find(b => b.type === 'npm-downloads');
  expect(badge).toBeDefined();
  expect(badge!.imageUrl).toContain('img.shields.io/npm/dm/');
});
```

### Badge Groups

Badges are ordered by group. Use the appropriate group for your badge:

| Group | Examples |
| ----- | -------- |
| `distribution` | npm version, PyPI version, crates.io |
| `runtime` | Node version, Python version |
| `build` | GitHub Actions workflow status |
| `quality` | Code coverage |
| `metadata` | License |
| `social` | GitHub stars |

## Adding a New Ecosystem

To support a new ecosystem (e.g., Go, Java):

1. **`src/types.ts`** — Add the ecosystem to the `Ecosystem` type union
2. **`src/detector.ts`** — Add detection logic for the ecosystem's metadata files
3. **`src/resolver.ts`** — Add badge resolution for the new ecosystem
4. **`test/`** — Add tests for detection and resolution

## Development Setup

```bash
git clone https://github.com/yeongseon/badge-sync.git
cd badge-sync
npm install
```

### Common Commands

```bash
npm test              # Run tests
npm run typecheck     # Type-check without emitting
npm run build         # Build TypeScript
npm run test:coverage # Run tests with coverage (90% threshold)
```

### Code Standards

- **TypeScript strict mode** — no `any`, no `@ts-ignore`
- **ESM only** — use `.js` extensions in imports
- **No empty catch blocks** — always handle errors
- **Conventional commits** — `feat(scope):`, `fix(scope):`, `test(scope):`

### Testing

All changes must pass `npm run test:coverage` with 90%+ branch coverage. The pre-commit hook enforces this automatically.

## Submitting Changes

1. Fork the repo and create a feature branch
2. Make your changes with tests
3. Run `npm test && npm run typecheck` to verify
4. Submit a pull request with a clear description

## Releasing a New Version

badge-sync uses tag-triggered publishing. Pushing a `v*` tag to GitHub automatically runs CI and publishes to npm.

### Steps

1. Update the version in `package.json`:
   ```bash
   npm version patch  # or minor, major
   ```
2. Update `CHANGELOG.md` with the new version's changes.
3. Commit the version bump:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore: release v$(node -p "require('./package.json').version")"
   ```
4. Create and push the tag:
   ```bash
   git tag v$(node -p "require('./package.json').version")
   git push origin main --tags
   ```
5. The `publish.yml` workflow will automatically:
   - Run CI (typecheck + tests) on Node 20 and 22
   - Verify the tag version matches `package.json`
   - Publish to npm with provenance
   - Create a GitHub Release with auto-generated notes

### Requirements

- `NPM_TOKEN` secret must be set in GitHub repository settings (Settings → Secrets → Actions)
- The token must have publish permission for the `badge-sync` package
- The tag version must exactly match `package.json` version (e.g., tag `v0.1.2` requires `"version": "0.1.2"`)

### Troubleshooting

- **Publish fails with 404**: Verify the `NPM_TOKEN` has publish (not read-only) scope
- **Version mismatch error**: The tag `v*` must match `package.json` version exactly
- **Re-publishing a failed tag**: Delete the tag locally and remotely, then recreate:
  ```bash
  git tag -d v0.1.1
  git push origin --delete v0.1.1
  git tag v0.1.1
  git push origin v0.1.1
  ```

## Questions?

Open an issue on [GitHub](https://github.com/yeongseon/badge-sync/issues).
