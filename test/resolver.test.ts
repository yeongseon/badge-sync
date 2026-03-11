import { describe, expect, it } from 'vitest';
import { resolveBadges, inferBadgeType, inferBadgeGroup } from '../src/resolver.js';
import type { RepositoryMetadata } from '../src/types.js';

function makeMetadata(overrides: Partial<RepositoryMetadata> = {}): RepositoryMetadata {
  return {
    ecosystem: [],
    packageName: null,
    packageNames: {},
    isMonorepo: false,
    packages: [],
    coverageService: null,
    hasCoverage: false,
    repositoryUrl: null,
    owner: null,
    repo: null,
    license: null,
    workflows: [],
    nodeVersion: null,
    pythonVersion: null,
    goVersion: null,
    ...overrides,
  };
}

function expectBadge(badges: ReturnType<typeof resolveBadges>, type: string) {
  const badge = badges.find((candidate) => candidate.type === type);
  expect(badge).toBeDefined();
  if (!badge) {
    throw new Error(`Expected badge not found: ${type}`);
  }
  return badge;
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
      const npm = expectBadge(badges, 'npm-version');
      expect(npm.group).toBe('distribution');
      expect(npm.imageUrl).toBe('https://img.shields.io/npm/v/my-lib');
      expect(npm.linkUrl).toBe('https://www.npmjs.com/package/my-lib');
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
      const node = expectBadge(badges, 'node-version');
      expect(node.group).toBe('runtime');
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
      const pypi = expectBadge(badges, 'pypi-version');
      expect(pypi.imageUrl).toBe('https://img.shields.io/pypi/v/my-tool');
      expect(pypi.linkUrl).toBe('https://pypi.org/project/my-tool');
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
      const py = expectBadge(badges, 'python-version');
      expect(py.group).toBe('runtime');
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
      const crate = expectBadge(badges, 'crates-version');
      expect(crate.imageUrl).toBe('https://img.shields.io/crates/v/my-crate');
      expect(crate.linkUrl).toBe('https://crates.io/crates/my-crate');
    });
  });

  describe('Go badges', () => {
    it('generates go-module badge for Go project with module name', () => {
      const meta = makeMetadata({
        ecosystem: ['go'],
        packageName: 'github.com/user/my-go-app',
        packageNames: { go: 'github.com/user/my-go-app' },
        owner: 'user',
        repo: 'my-go-app',
      });
      const badges = resolveBadges(meta);
      const goMod = expectBadge(badges, 'go-module');
      expect(goMod.group).toBe('distribution');
      expect(goMod.imageUrl).toBe('https://pkg.go.dev/badge/github.com/user/my-go-app.svg');
      expect(goMod.linkUrl).toBe('https://pkg.go.dev/github.com/user/my-go-app');
    });

    it('generates go-version badge when goVersion is present', () => {
      const meta = makeMetadata({
        ecosystem: ['go'],
        packageName: 'github.com/user/my-go-app',
        goVersion: '1.21',
        owner: 'user',
        repo: 'my-go-app',
      });
      const badges = resolveBadges(meta);
      const goVer = expectBadge(badges, 'go-version');
      expect(goVer.group).toBe('runtime');
      expect(goVer.imageUrl).toBe('https://img.shields.io/github/go-mod/go-version/user/my-go-app');
      expect(goVer.linkUrl).toBe('https://go.dev');
    });

    it('generates go-report badge for Go project', () => {
      const meta = makeMetadata({
        ecosystem: ['go'],
        packageName: 'github.com/user/my-go-app',
        packageNames: { go: 'github.com/user/my-go-app' },
        owner: 'user',
        repo: 'my-go-app',
      });
      const badges = resolveBadges(meta);
      const goReport = expectBadge(badges, 'go-report');
      expect(goReport.group).toBe('quality');
      expect(goReport.imageUrl).toBe('https://goreportcard.com/badge/github.com/user/my-go-app');
      expect(goReport.linkUrl).toBe('https://goreportcard.com/report/github.com/user/my-go-app');
    });

    it('skips go-module if no package name', () => {
      const meta = makeMetadata({
        ecosystem: ['go'],
        owner: 'user',
        repo: 'my-go-app',
      });
      const badges = resolveBadges(meta);
      expect(badges.find((b) => b.type === 'go-module')).toBeUndefined();
    });

    it('skips go-version if no goVersion', () => {
      const meta = makeMetadata({
        ecosystem: ['go'],
        packageName: 'github.com/user/my-go-app',
      });
      const badges = resolveBadges(meta);
      expect(badges.find((b) => b.type === 'go-version')).toBeUndefined();
    });

    it('skips go-version if no owner/repo', () => {
      const meta = makeMetadata({
        ecosystem: ['go'],
        packageName: 'github.com/user/my-go-app',
        goVersion: '1.21',
      });
      const badges = resolveBadges(meta);
      expect(badges.find((b) => b.type === 'go-version')).toBeUndefined();
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
      if (!build) {
        throw new Error('Expected build badge not found');
      }
      expect(build.imageUrl).toContain('my%20workflow.yml');
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

  describe('Quality badges', () => {
    it('generates coverage badge with codecov service', () => {
      const meta = makeMetadata({
        hasCoverage: true,
        coverageService: 'codecov',
        owner: 'user',
        repo: 'my-lib',
      });
      const badges = resolveBadges(meta);
      const coverage = expectBadge(badges, 'coverage');
      expect(coverage.group).toBe('quality');
      expect(coverage.imageUrl).toBe('https://codecov.io/gh/user/my-lib/branch/main/graph/badge.svg');
      expect(coverage.linkUrl).toBe('https://codecov.io/gh/user/my-lib');
    });

    it('generates coverage badge with coveralls service', () => {
      const meta = makeMetadata({
        hasCoverage: true,
        coverageService: 'coveralls',
        owner: 'user',
        repo: 'my-lib',
      });
      const badges = resolveBadges(meta);
      const coverage = expectBadge(badges, 'coverage');
      expect(coverage.group).toBe('quality');
      expect(coverage.imageUrl).toBe('https://coveralls.io/repos/github/user/my-lib/badge.svg?branch=main');
      expect(coverage.linkUrl).toBe('https://coveralls.io/github/user/my-lib?branch=main');
    });

    it('does not generate coverage badge when only tooling exists without service', () => {
      const meta = makeMetadata({
        hasCoverage: true,
        coverageService: null,
        owner: 'user',
        repo: 'my-lib',
      });
      const badges = resolveBadges(meta);
      expect(badges.find((b) => b.type === 'coverage')).toBeUndefined();
    });

    it('generates coverage badge when codecov service is configured', () => {
      const meta = makeMetadata({
        hasCoverage: true,
        coverageService: 'codecov',
        owner: 'testuser',
        repo: 'my-lib',
      });
      const badges = resolveBadges(meta);
      expect(badges.find((b) => b.type === 'coverage')).toBeDefined();
    });

    it('generates coverage badge when service is configured even if hasCoverage is false', () => {
      const meta = makeMetadata({
        hasCoverage: false,
        coverageService: 'codecov',
        owner: 'user',
        repo: 'my-lib',
      });
      const badges = resolveBadges(meta);
      expect(badges.find((b) => b.type === 'coverage')).toBeDefined();
    });

    it('skips coverage badge when owner/repo are missing', () => {
      const meta = makeMetadata({
        hasCoverage: true,
        coverageService: 'codecov',
      });
      const badges = resolveBadges(meta);
      expect(badges.find((b) => b.type === 'coverage')).toBeUndefined();
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
      const lic = expectBadge(badges, 'license');
      expect(lic.group).toBe('metadata');
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
      const stars = expectBadge(badges, 'stars');
      expect(stars.group).toBe('social');
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

describe('inferBadgeType', () => {
  it('returns npm-version for npm badge imageUrl', () => {
    const result = inferBadgeType('https://img.shields.io/npm/v/my-lib', '');
    expect(result).toBe('npm-version');
  });

  it('returns node-version for node badge imageUrl', () => {
    const result = inferBadgeType('https://img.shields.io/node/v/my-lib', '');
    expect(result).toBe('node-version');
  });

  it('returns pypi-version for pypi badge imageUrl', () => {
    const result = inferBadgeType('https://img.shields.io/pypi/v/my-tool', '');
    expect(result).toBe('pypi-version');
  });

  it('returns python-version for python badge imageUrl', () => {
    const result = inferBadgeType('https://img.shields.io/pypi/pyversions/my-tool', '');
    expect(result).toBe('python-version');
  });

  it('returns crates-version for crates badge imageUrl', () => {
    const result = inferBadgeType('https://img.shields.io/crates/v/my-crate', '');
    expect(result).toBe('crates-version');
  });

  it('returns github-actions-{workflow} for github actions badge imageUrl with matching regex', () => {
    const result = inferBadgeType('https://github.com/user/repo/actions/workflows/ci.yml/badge.svg', '');
    expect(result).toBe('github-actions-ci');
  });

  it('returns github-actions-workflow when imageUrl has actions badge but regex does not match', () => {
    const result = inferBadgeType('https://github.com/user/repo/actions/workflows//badge.svg', '');
    expect(result).toBe('github-actions-workflow');
  });

  it('returns coverage for codecov imageUrl', () => {
    const result = inferBadgeType('https://codecov.io/gh/user/repo/branch/main/graph/badge.svg', '');
    expect(result).toBe('coverage');
  });

  it('returns coverage for coveralls imageUrl', () => {
    const result = inferBadgeType('https://coveralls.io/repos/github/user/repo/badge.svg', '');
    expect(result).toBe('coverage');
  });

  it('returns license for github license badge imageUrl', () => {
    const result = inferBadgeType('https://img.shields.io/github/license/user/repo', '');
    expect(result).toBe('license');
  });

  it('returns stars for github stars badge imageUrl', () => {
    const result = inferBadgeType('https://img.shields.io/github/stars/user/repo', '');
    expect(result).toBe('stars');
  });

  it('returns github-actions-{workflow} for linkUrl with actions workflow when imageUrl does not match', () => {
    const result = inferBadgeType('https://example.com/badge.png', 'https://github.com/user/repo/actions/workflows/ci.yml');
    expect(result).toBe('github-actions-ci');
  });

  it('returns github-actions-workflow when linkUrl has actions badge but regex does not match', () => {
    const result = inferBadgeType('https://example.com/badge.png', 'https://github.com/user/repo/actions/workflows/');
    expect(result).toBe('github-actions-workflow');
  });

  it('returns null when neither imageUrl nor linkUrl match any known patterns', () => {
    const result = inferBadgeType('https://example.com/unknown-badge.png', 'https://example.com');
    expect(result).toBeNull();
  });

  it('handles URL encoded workflow names in imageUrl', () => {
    const result = inferBadgeType('https://github.com/user/repo/actions/workflows/my%20workflow.yml/badge.svg', '');
    expect(result).toBe('github-actions-my workflow');
  });

  it('handles .yaml extension in workflow names', () => {
    const result = inferBadgeType('https://github.com/user/repo/actions/workflows/ci.yaml/badge.svg', '');
    expect(result).toBe('github-actions-ci');
  });

  it('returns license for custom shields.io license badge (img.shields.io/badge/License-MIT-...)', () => {
    const result = inferBadgeType('https://img.shields.io/badge/License-MIT-yellow.svg', 'LICENSE');
    expect(result).toBe('license');
  });

  it('returns license for custom shields.io license badge with case variation', () => {
    const result = inferBadgeType('https://img.shields.io/badge/license-Apache_2.0-blue.svg', '');
    expect(result).toBe('license');
  });

  it('returns license for custom shields.io licence badge (British spelling)', () => {
    const result = inferBadgeType('https://img.shields.io/badge/Licence-GPL-green', '');
    expect(result).toBe('license');
  });

  it('returns license when linkUrl points to LICENSE file', () => {
    const result = inferBadgeType('https://img.shields.io/badge/some-badge-red', '/LICENSE');
    expect(result).toBe('license');
  });

  it('returns license when linkUrl points to LICENSE.md file', () => {
    const result = inferBadgeType(
      'https://img.shields.io/badge/some-badge-red',
      'https://github.com/user/repo/blob/main/LICENSE.md',
    );
    expect(result).toBe('license');
  });

  it('does NOT return license for non-license custom shields.io badge', () => {
    const result = inferBadgeType(
      'https://img.shields.io/badge/pre--commit-enabled-brightgreen',
      'https://pre-commit.com/',
    );
    expect(result).toBeNull();
  });

  it('does NOT return license for docs custom shields.io badge', () => {
    const result = inferBadgeType(
      'https://img.shields.io/badge/docs-gh--pages-blue',
      'https://example.github.io/project/',
    );
    expect(result).toBeNull();
  });

  it('returns go-module for pkg.go.dev badge imageUrl', () => {
    const result = inferBadgeType('https://pkg.go.dev/badge/github.com/user/repo.svg', '');
    expect(result).toBe('go-module');
  });

  it('returns go-version for go-mod go-version badge imageUrl', () => {
    const result = inferBadgeType('https://img.shields.io/github/go-mod/go-version/user/repo', '');
    expect(result).toBe('go-version');
  });

  it('returns go-report for goreportcard badge imageUrl', () => {
    const result = inferBadgeType('https://goreportcard.com/badge/github.com/user/repo', '');
    expect(result).toBe('go-report');
  });
});

describe('inferBadgeGroup', () => {
  it('returns distribution for npm-version', () => {
    const result = inferBadgeGroup('npm-version');
    expect(result).toBe('distribution');
  });

  it('returns distribution for pypi-version', () => {
    const result = inferBadgeGroup('pypi-version');
    expect(result).toBe('distribution');
  });

  it('returns distribution for crates-version', () => {
    const result = inferBadgeGroup('crates-version');
    expect(result).toBe('distribution');
  });

  it('returns runtime for node-version', () => {
    const result = inferBadgeGroup('node-version');
    expect(result).toBe('runtime');
  });

  it('returns runtime for python-version', () => {
    const result = inferBadgeGroup('python-version');
    expect(result).toBe('runtime');
  });

  it('returns build for github-actions-* badge types', () => {
    const result = inferBadgeGroup('github-actions-ci');
    expect(result).toBe('build');
  });

  it('returns build for various github-actions workflows', () => {
    expect(inferBadgeGroup('github-actions-release')).toBe('build');
    expect(inferBadgeGroup('github-actions-test')).toBe('build');
  });

  it('returns quality for coverage', () => {
    const result = inferBadgeGroup('coverage');
    expect(result).toBe('quality');
  });

  it('returns metadata for license', () => {
    const result = inferBadgeGroup('license');
    expect(result).toBe('metadata');
  });

  it('returns social for stars', () => {
    const result = inferBadgeGroup('stars');
    expect(result).toBe('social');
  });

  it('returns social for unknown badge type', () => {
    const result = inferBadgeGroup('unknown-badge');
    expect(result).toBe('social');
  });

  it('returns distribution for go-module', () => {
    const result = inferBadgeGroup('go-module');
    expect(result).toBe('distribution');
  });

  it('returns runtime for go-version', () => {
    const result = inferBadgeGroup('go-version');
    expect(result).toBe('runtime');
  });

  it('returns quality for go-report', () => {
    const result = inferBadgeGroup('go-report');
    expect(result).toBe('quality');
  });
});
