import { describe, expect, it } from 'vitest';
import { detectMigrations, MIGRATION_RULES } from '../src/migrator.js';
import type { MigrationContext } from '../src/migrator.js';

function makeContext(overrides: Partial<MigrationContext> = {}): MigrationContext {
  return {
    owner: 'acme',
    repo: 'my-project',
    workflows: ['ci.yml'],
    ...overrides,
  };
}

function makeBadge(overrides: Partial<{ label: string; imageUrl: string; linkUrl: string; raw: string }> = {}) {
  const label = overrides.label ?? 'Build Status';
  const imageUrl = overrides.imageUrl ?? 'https://img.shields.io/npm/v/test';
  const linkUrl = overrides.linkUrl ?? 'https://www.npmjs.com/package/test';
  const raw = overrides.raw ?? `[![${label}](${imageUrl})](${linkUrl})`;
  return { label, imageUrl, linkUrl, raw };
}

describe('migrator', () => {
  describe('MIGRATION_RULES', () => {
    it('has 4 rules', () => {
      expect(MIGRATION_RULES).toHaveLength(4);
    });

    it('rules have required fields', () => {
      for (const rule of MIGRATION_RULES) {
        expect(rule.name).toBeTruthy();
        expect(rule.description).toBeTruthy();
        expect(typeof rule.matches).toBe('function');
        expect(typeof rule.migrate).toBe('function');
      }
    });
  });

  describe('Travis CI migration', () => {
    it('detects travis-ci.org in imageUrl and migrates to GitHub Actions', () => {
      const badge = makeBadge({
        label: 'Build',
        imageUrl: 'https://travis-ci.org/acme/repo.svg?branch=master',
        linkUrl: 'https://travis-ci.org/acme/repo',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('travis-to-github-actions');
      expect(results[0].migrated).not.toBeNull();
      expect(results[0].migrated!.imageUrl).toBe(
        'https://github.com/acme/my-project/actions/workflows/ci.yml/badge.svg',
      );
      expect(results[0].migrated!.linkUrl).toBe(
        'https://github.com/acme/my-project/actions/workflows/ci.yml',
      );
    });

    it('detects travis-ci.com in linkUrl and migrates to GitHub Actions', () => {
      const badge = makeBadge({
        label: 'CI',
        imageUrl: 'https://img.shields.io/travis/com/acme/repo',
        linkUrl: 'https://travis-ci.com/acme/repo',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('travis-to-github-actions');
      expect(results[0].migrated).not.toBeNull();
    });

    it('returns null (removal) when no workflows available', () => {
      const badge = makeBadge({
        label: 'Build',
        imageUrl: 'https://travis-ci.org/acme/repo.svg',
        linkUrl: 'https://travis-ci.org/acme/repo',
      });
      const context = makeContext({ workflows: [] });
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(1);
      expect(results[0].migrated).toBeNull();
    });

    it('returns null when owner is missing', () => {
      const badge = makeBadge({
        label: 'Build',
        imageUrl: 'https://travis-ci.org/acme/repo.svg',
        linkUrl: 'https://travis-ci.org/acme/repo',
      });
      const context = makeContext({ owner: null });
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(1);
      expect(results[0].migrated).toBeNull();
    });

    it('returns null when repo is missing', () => {
      const badge = makeBadge({
        label: 'Build',
        imageUrl: 'https://travis-ci.org/acme/repo.svg',
        linkUrl: 'https://travis-ci.org/acme/repo',
      });
      const context = makeContext({ repo: null });
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(1);
      expect(results[0].migrated).toBeNull();
    });
  });

  describe('CircleCI migration', () => {
    it('detects circleci.com in imageUrl and migrates to GitHub Actions', () => {
      const badge = makeBadge({
        label: 'Build',
        imageUrl: 'https://circleci.com/gh/acme/repo.svg?style=svg',
        linkUrl: 'https://circleci.com/gh/acme/repo',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('circleci-to-github-actions');
      expect(results[0].migrated).not.toBeNull();
      expect(results[0].migrated!.imageUrl).toContain('github.com/acme/my-project/actions');
    });

    it('returns null when no workflows available', () => {
      const badge = makeBadge({
        label: 'Build',
        imageUrl: 'https://circleci.com/gh/acme/repo.svg',
        linkUrl: 'https://circleci.com/gh/acme/repo',
      });
      const context = makeContext({ workflows: [] });
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(1);
      expect(results[0].migrated).toBeNull();
    });
  });

  describe('david-dm.org migration', () => {
    it('detects david-dm.org in imageUrl and returns null (removal)', () => {
      const badge = makeBadge({
        label: 'Dependencies',
        imageUrl: 'https://david-dm.org/acme/repo.svg',
        linkUrl: 'https://david-dm.org/acme/repo',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('remove-david-dm');
      expect(results[0].migrated).toBeNull();
    });

    it('detects david-dm.org in linkUrl and returns null (removal)', () => {
      const badge = makeBadge({
        label: 'Dependencies',
        imageUrl: 'https://img.shields.io/david/acme/repo',
        linkUrl: 'https://david-dm.org/acme/repo',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(1);
      expect(results[0].migrated).toBeNull();
    });
  });

  describe('Shields license modernize', () => {
    it('modernizes legacy shields license badge format', () => {
      const badge = makeBadge({
        label: 'License',
        imageUrl: 'https://img.shields.io/badge/license-MIT-blue',
        linkUrl: 'https://opensource.org/licenses/MIT',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('shields-license-modernize');
      expect(results[0].migrated).not.toBeNull();
      expect(results[0].migrated!.imageUrl).toBe(
        'https://img.shields.io/github/license/acme/my-project',
      );
      expect(results[0].migrated!.linkUrl).toBe(
        'https://github.com/acme/my-project/blob/main/LICENSE',
      );
    });

    it('returns original badge unchanged when owner/repo not available', () => {
      const badge = makeBadge({
        label: 'License',
        imageUrl: 'https://img.shields.io/badge/license-MIT-blue',
        linkUrl: 'https://opensource.org/licenses/MIT',
      });
      const context = makeContext({ owner: null, repo: null });
      const results = detectMigrations([badge], context);

      // No change because migrate returns the badge as-is
      expect(results).toHaveLength(0);
    });

    it('is case-insensitive', () => {
      const badge = makeBadge({
        label: 'License',
        imageUrl: 'https://img.shields.io/badge/License-Apache-green',
        linkUrl: 'https://opensource.org/licenses/Apache-2.0',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('shields-license-modernize');
    });
  });

  describe('non-deprecated badges', () => {
    it('does not flag regular shields.io npm badges', () => {
      const badge = makeBadge({
        label: 'npm version',
        imageUrl: 'https://img.shields.io/npm/v/my-package',
        linkUrl: 'https://www.npmjs.com/package/my-package',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(0);
    });

    it('does not flag GitHub Actions badges', () => {
      const badge = makeBadge({
        label: 'CI',
        imageUrl: 'https://github.com/acme/repo/actions/workflows/ci.yml/badge.svg',
        linkUrl: 'https://github.com/acme/repo/actions/workflows/ci.yml',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(0);
    });

    it('does not flag custom badges', () => {
      const badge = makeBadge({
        label: 'custom',
        imageUrl: 'https://img.shields.io/badge/made%20with-love-red',
        linkUrl: 'https://example.com',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context);

      expect(results).toHaveLength(0);
    });
  });

  describe('normalize option', () => {
    it('converts http:// to https://', () => {
      const badge = makeBadge({
        label: 'npm version',
        imageUrl: 'http://img.shields.io/npm/v/test',
        linkUrl: 'http://www.npmjs.com/package/test',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context, { normalize: true });

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('normalize-urls');
      expect(results[0].migrated!.imageUrl).toBe('https://img.shields.io/npm/v/test');
      expect(results[0].migrated!.linkUrl).toBe('https://www.npmjs.com/package/test');
    });

    it('removes trailing slashes from shields.io URLs', () => {
      const badge = makeBadge({
        label: 'npm version',
        imageUrl: 'https://img.shields.io/npm/v/test/',
        linkUrl: 'https://www.npmjs.com/package/test',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context, { normalize: true });

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('normalize-urls');
      expect(results[0].migrated!.imageUrl).toBe('https://img.shields.io/npm/v/test');
    });

    it('produces normalize-urls rule for non-rule-matched badges', () => {
      const badge = makeBadge({
        label: 'coverage',
        imageUrl: 'http://codecov.io/gh/acme/repo/branch/main/graph/badge.svg',
        linkUrl: 'http://codecov.io/gh/acme/repo',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context, { normalize: true });

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('normalize-urls');
      expect(results[0].description).toBe('Normalized badge URLs to canonical https format.');
      expect(results[0].migrated!.imageUrl).toMatch(/^https:/);
      expect(results[0].migrated!.linkUrl).toMatch(/^https:/);
    });

    it('does not produce migration when URLs are already normalized', () => {
      const badge = makeBadge({
        label: 'npm version',
        imageUrl: 'https://img.shields.io/npm/v/test',
        linkUrl: 'https://www.npmjs.com/package/test',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context, { normalize: true });

      expect(results).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty badges input', () => {
      const context = makeContext();
      const results = detectMigrations([], context);

      expect(results).toHaveLength(0);
    });

    it('handles multiple migrations in one pass', () => {
      const travisBadge = makeBadge({
        label: 'Build',
        imageUrl: 'https://travis-ci.org/acme/repo.svg',
        linkUrl: 'https://travis-ci.org/acme/repo',
      });
      const davidBadge = makeBadge({
        label: 'Dependencies',
        imageUrl: 'https://david-dm.org/acme/repo.svg',
        linkUrl: 'https://david-dm.org/acme/repo',
      });
      const normalBadge = makeBadge({
        label: 'npm version',
        imageUrl: 'https://img.shields.io/npm/v/test',
        linkUrl: 'https://www.npmjs.com/package/test',
      });
      const context = makeContext();
      const results = detectMigrations([travisBadge, davidBadge, normalBadge], context);

      expect(results).toHaveLength(2);
      expect(results[0].rule).toBe('travis-to-github-actions');
      expect(results[1].rule).toBe('remove-david-dm');
    });

    it('preserves original badge data in migration result', () => {
      const badge = makeBadge({
        label: 'Build',
        imageUrl: 'https://travis-ci.org/acme/repo.svg',
        linkUrl: 'https://travis-ci.org/acme/repo',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context);

      expect(results[0].original.label).toBe('Build');
      expect(results[0].original.imageUrl).toBe('https://travis-ci.org/acme/repo.svg');
      expect(results[0].original.linkUrl).toBe('https://travis-ci.org/acme/repo');
      expect(results[0].original.raw).toBe(badge.raw);
    });

    it('normalize applies to rule-matched migrations too', () => {
      const badge = makeBadge({
        label: 'Build',
        imageUrl: 'https://travis-ci.org/acme/repo.svg',
        linkUrl: 'https://travis-ci.org/acme/repo',
      });
      const context = makeContext();
      const results = detectMigrations([badge], context, { normalize: true });

      expect(results).toHaveLength(1);
      expect(results[0].rule).toBe('travis-to-github-actions');
      // The migrated URLs should still be https (they already are from the rule)
      expect(results[0].migrated!.imageUrl).toMatch(/^https:/);
    });
  });
});
