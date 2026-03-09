import { describe, it, expect } from 'vitest';
import { resolveBadges } from '../src/resolver.js';
import type { RepositoryMetadata } from '../src/types.js';

function makeMetadata(overrides: Partial<RepositoryMetadata> = {}): RepositoryMetadata {
  return {
    ecosystem: [],
    packageName: null,
    packageNames: {},
    repositoryUrl: null,
    owner: null,
    repo: null,
    license: null,
    workflows: [],
    nodeVersion: null,
    pythonVersion: null,
    ...overrides,
  };
}

describe('resolver', () => {
  describe('JavaScript badges', () => {
    it('generates npm-version badge for JS project with package name', () => {
      const meta = makeMetadata({
        ecosystem: ['javascript'],
        packageName: 'my-lib',
        owner: 'user',
        repo: 'my-lib',
      });
      const badges = resolveBadges(meta);
      const npm = badges.find((b) => b.type === 'npm-version');
      expect(npm).toBeDefined();
      expect(npm!.group).toBe('distribution');
      expect(npm!.imageUrl).toBe('https://img.shields.io/npm/v/my-lib');
      expect(npm!.linkUrl).toBe('https://www.npmjs.com/package/my-lib');
    });

    it('generates node-version badge when engines.node is present', () => {
      const meta = makeMetadata({
        ecosystem: ['javascript'],
        packageName: 'my-lib',
        nodeVersion: '>=18',
        owner: 'user',
        repo: 'my-lib',
      });
      const badges = resolveBadges(meta);
      const node = badges.find((b) => b.type === 'node-version');
      expect(node).toBeDefined();
      expect(node!.group).toBe('runtime');
    });

    it('skips npm-version if no package name', () => {
      const meta = makeMetadata({
        ecosystem: ['javascript'],
        owner: 'user',
        repo: 'my-lib',
      });
      const badges = resolveBadges(meta);
      expect(badges.find((b) => b.type === 'npm-version')).toBeUndefined();
    });

    it('skips node-version if no nodeVersion', () => {
      const meta = makeMetadata({
        ecosystem: ['javascript'],
        packageName: 'my-lib',
      });
      const badges = resolveBadges(meta);
      expect(badges.find((b) => b.type === 'node-version')).toBeUndefined();
    });
  });

  describe('Python badges', () => {
    it('generates pypi-version badge', () => {
      const meta = makeMetadata({
        ecosystem: ['python'],
        packageName: 'my-tool',
        owner: 'user',
        repo: 'my-tool',
      });
      const badges = resolveBadges(meta);
      const pypi = badges.find((b) => b.type === 'pypi-version');
      expect(pypi).toBeDefined();
      expect(pypi!.imageUrl).toBe('https://img.shields.io/pypi/v/my-tool');
      expect(pypi!.linkUrl).toBe('https://pypi.org/project/my-tool');
    });

    it('generates python-version badge when requires-python is present', () => {
      const meta = makeMetadata({
        ecosystem: ['python'],
        packageName: 'my-tool',
        pythonVersion: '>=3.9',
        owner: 'user',
        repo: 'my-tool',
      });
      const badges = resolveBadges(meta);
      const py = badges.find((b) => b.type === 'python-version');
      expect(py).toBeDefined();
      expect(py!.group).toBe('runtime');
    });
  });

  describe('Rust badges', () => {
    it('generates crates-version badge', () => {
      const meta = makeMetadata({
        ecosystem: ['rust'],
        packageName: 'my-crate',
        owner: 'user',
        repo: 'my-crate',
      });
      const badges = resolveBadges(meta);
      const crate = badges.find((b) => b.type === 'crates-version');
      expect(crate).toBeDefined();
      expect(crate!.imageUrl).toBe('https://img.shields.io/crates/v/my-crate');
      expect(crate!.linkUrl).toBe('https://crates.io/crates/my-crate');
    });
  });

  describe('Build / CI badges', () => {
    it('generates one badge per workflow', () => {
      const meta = makeMetadata({
        ecosystem: ['javascript'],
        owner: 'user',
        repo: 'my-lib',
        workflows: ['ci.yml', 'release.yml'],
      });
      const badges = resolveBadges(meta);
      const builds = badges.filter((b) => b.group === 'build');
      expect(builds).toHaveLength(2);
      expect(builds[0].type).toBe('github-actions-ci');
      expect(builds[1].type).toBe('github-actions-release');
    });

    it('encodes workflow filename in URL', () => {
      const meta = makeMetadata({
        ecosystem: ['javascript'],
        owner: 'user',
        repo: 'my-lib',
        workflows: ['my workflow.yml'],
      });
      const badges = resolveBadges(meta);
      const build = badges.find((b) => b.group === 'build');
      expect(build).toBeDefined();
      expect(build!.imageUrl).toContain('my%20workflow.yml');
    });

    it('skips workflow badges without owner/repo', () => {
      const meta = makeMetadata({
        ecosystem: ['javascript'],
        workflows: ['ci.yml'],
      });
      const badges = resolveBadges(meta);
      expect(badges.filter((b) => b.group === 'build')).toHaveLength(0);
    });
  });

  describe('Metadata badges', () => {
    it('generates license badge when license and owner/repo exist', () => {
      const meta = makeMetadata({
        ecosystem: ['javascript'],
        license: 'MIT',
        owner: 'user',
        repo: 'my-lib',
      });
      const badges = resolveBadges(meta);
      const lic = badges.find((b) => b.type === 'license');
      expect(lic).toBeDefined();
      expect(lic!.group).toBe('metadata');
    });

    it('skips license badge without owner/repo', () => {
      const meta = makeMetadata({
        ecosystem: ['javascript'],
        license: 'MIT',
      });
      const badges = resolveBadges(meta);
      expect(badges.find((b) => b.type === 'license')).toBeUndefined();
    });
  });

  describe('Social badges', () => {
    it('generates stars badge when owner/repo exist', () => {
      const meta = makeMetadata({
        ecosystem: ['javascript'],
        owner: 'user',
        repo: 'my-lib',
      });
      const badges = resolveBadges(meta);
      const stars = badges.find((b) => b.type === 'stars');
      expect(stars).toBeDefined();
      expect(stars!.group).toBe('social');
    });

    it('skips stars badge without owner/repo', () => {
      const meta = makeMetadata({ ecosystem: ['javascript'] });
      const badges = resolveBadges(meta);
      expect(badges.find((b) => b.type === 'stars')).toBeUndefined();
    });
  });

  describe('Multi-ecosystem', () => {
    it('generates badges for all detected ecosystems', () => {
      const meta = makeMetadata({
        ecosystem: ['javascript', 'python'],
        packageName: 'my-app',
        owner: 'user',
        repo: 'my-app',
        nodeVersion: '>=20',
        pythonVersion: '>=3.11',
      });
      const badges = resolveBadges(meta);
      expect(badges.find((b) => b.type === 'npm-version')).toBeDefined();
      expect(badges.find((b) => b.type === 'pypi-version')).toBeDefined();
      expect(badges.find((b) => b.type === 'node-version')).toBeDefined();
      expect(badges.find((b) => b.type === 'python-version')).toBeDefined();
    });
  });

  describe('Empty metadata', () => {
    it('returns empty array for no ecosystems', () => {
      const meta = makeMetadata();
      const badges = resolveBadges(meta);
      expect(badges).toHaveLength(0);
    });
  });
});
