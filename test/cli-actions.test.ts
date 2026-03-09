import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Badge, Config, ValidationResult } from '../src/types.js';

// Mock all dependencies BEFORE importing cli
vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn(),
}));
vi.mock('../src/applier.js', () => ({
  applyBadges: vi.fn(),
  checkBadges: vi.fn(),
  doctorBadges: vi.fn(),
  repairBadges: vi.fn(),
  listBadges: vi.fn(),
  initBadges: vi.fn(),
}));
vi.mock('../src/formatter.js', () => ({
  formatBadges: vi.fn(),
}));
vi.mock('../src/resolver.js', () => ({
  resolveBadges: vi.fn(),
}));
vi.mock('../src/readme.js', () => ({
  readBadgeBlock: vi.fn(),
  parseExistingBadges: vi.fn(),
}));
vi.mock('../src/detector.js', () => ({
  detectMetadata: vi.fn(),
}));

const { createProgram } = await import('../src/cli.js');
const { loadConfig } = await import('../src/config.js');
const { applyBadges, checkBadges, doctorBadges, repairBadges, listBadges, initBadges } = await import('../src/applier.js');
const { resolveBadges } = await import('../src/resolver.js');
const { readBadgeBlock, parseExistingBadges } = await import('../src/readme.js');
const { detectMetadata } = await import('../src/detector.js');

const mockLoadConfig = vi.mocked(loadConfig);
const mockApplyBadges = vi.mocked(applyBadges);
const mockCheckBadges = vi.mocked(checkBadges);
const mockDoctorBadges = vi.mocked(doctorBadges);
const mockRepairBadges = vi.mocked(repairBadges);
const mockListBadges = vi.mocked(listBadges);
const mockInitBadges = vi.mocked(initBadges);
const mockResolveBadges = vi.mocked(resolveBadges);
const mockReadBadgeBlock = vi.mocked(readBadgeBlock);
const mockParseExistingBadges = vi.mocked(parseExistingBadges);
const mockDetectMetadata = vi.mocked(detectMetadata);

const defaultConfig: Config = {
  readme: 'README.md',
  badges: { order: [], exclude: [], include: [] },
};

const testBadge: Badge = {
  type: 'npm-version',
  group: 'distribution',
  label: 'npm version',
  imageUrl: 'https://img.shields.io/npm/v/test',
  linkUrl: 'https://www.npmjs.com/package/test',
};

describe('cli action handlers', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadConfig.mockResolvedValue({ ...defaultConfig });
    mockListBadges.mockResolvedValue({ isMonorepo: false, packages: [], badges: [] });
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe('apply command', () => {
    it('reports applied badges when changed', async () => {
      mockApplyBadges.mockResolvedValue({
        applied: 3,
        badges: [testBadge],
        changed: true,
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'apply']);

      expect(mockApplyBadges).toHaveBeenCalled();
      expect(writeSpy).toHaveBeenCalledWith('Applied 3 badges\n');
    });

    it('reports "up to date" when no changes', async () => {
      mockApplyBadges.mockResolvedValue({
        applied: 3,
        badges: [testBadge],
        changed: false,
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'apply']);

      expect(writeSpy).toHaveBeenCalledWith('Badges are up to date\n');
    });

    it('dry-run shows categorized output', async () => {
      mockApplyBadges.mockResolvedValue({
        applied: 1,
        badges: [testBadge],
        changed: true,
      });
      mockDetectMetadata.mockResolvedValue({
        ecosystem: ['javascript'],
        packageName: 'test',
        packageNames: { javascript: 'test' },
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
      });
      const changedBadge: Badge = {
        ...testBadge,
        group: 'build',
        label: 'ci workflow',
        type: 'ci-workflow',
        imageUrl: 'https://github.com/acme/repo/actions/workflows/ci.yml/badge.svg',
        linkUrl: 'https://github.com/acme/repo/actions/workflows/ci.yml',
      };
      const unchangedBadge: Badge = {
        ...testBadge,
        group: 'quality',
        label: 'coverage',
        type: 'coverage',
        imageUrl: 'https://codecov.io/gh/acme/repo/branch/main/graph/badge.svg',
        linkUrl: 'https://codecov.io/gh/acme/repo',
      };
      const newBadge: Badge = {
        ...testBadge,
        group: 'metadata',
        label: 'license',
        type: 'license',
        imageUrl: 'https://img.shields.io/github/license/acme/repo',
        linkUrl: 'https://github.com/acme/repo/blob/main/LICENSE',
      };

      mockResolveBadges.mockReturnValue([changedBadge, unchangedBadge, newBadge]);
      mockReadBadgeBlock.mockResolvedValue('existing badges');
      mockParseExistingBadges.mockReturnValue([
        {
          label: 'ci old workflow',
          imageUrl: changedBadge.imageUrl,
          linkUrl: 'https://github.com/acme/repo/actions/workflows/old-ci.yml',
          raw: '[![ci old workflow](https://github.com/acme/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/acme/repo/actions/workflows/old-ci.yml)',
        },
        {
          label: unchangedBadge.label,
          imageUrl: unchangedBadge.imageUrl,
          linkUrl: unchangedBadge.linkUrl,
          raw: '[![coverage](https://codecov.io/gh/acme/repo/branch/main/graph/badge.svg)](https://codecov.io/gh/acme/repo)',
        },
        {
          label: 'pre-commit',
          imageUrl: 'https://img.shields.io/badge/pre--commit-enabled-brightgreen',
          linkUrl: 'https://pre-commit.com',
          raw: '[![pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen)](https://pre-commit.com)',
        },
      ]);

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'apply', '--dry-run']);

      expect(writeSpy).toHaveBeenCalledWith('Dry run - no changes written\n\n');
      expect(writeSpy).toHaveBeenCalledWith('Would apply 3 badge(s) (1 new, 1 updated, 1 unchanged):\n');
      expect(writeSpy).toHaveBeenCalledWith('  ~ [build] ci workflow\n');
      expect(writeSpy).toHaveBeenCalledWith('  = [quality] coverage\n');
      expect(writeSpy).toHaveBeenCalledWith('  + [metadata] license\n');
      expect(writeSpy).toHaveBeenCalledWith('\n1 custom badge(s) preserved:\n');
      expect(writeSpy).toHaveBeenCalledWith('  = [custom] pre-commit\n');
    });

    it('dry-run handles readBadgeBlock error with non-Error object', async () => {
      mockApplyBadges.mockResolvedValue({
        applied: 1,
        badges: [testBadge],
        changed: true,
      });
      mockDetectMetadata.mockResolvedValue({
        ecosystem: ['javascript'],
        packageName: 'test',
        packageNames: { javascript: 'test' },
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
      });
      mockResolveBadges.mockReturnValue([testBadge]);
      mockReadBadgeBlock.mockRejectedValue('not an error object');
      mockParseExistingBadges.mockReturnValue([]);

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'apply', '--dry-run']);
        expect.fail('should have thrown');
      } catch (error: unknown) {
        expect(error).toBe('not an error object');
      }
    });

    it('dry-run rethrows readBadgeBlock errors that are not marker or ENOENT', async () => {
      mockApplyBadges.mockResolvedValue({
        applied: 1,
        badges: [testBadge],
        changed: true,
      });
      mockDetectMetadata.mockResolvedValue({
        ecosystem: ['javascript'],
        packageName: 'test',
        packageNames: { javascript: 'test' },
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
      });
      const testError = new Error('Some other read error');
      mockReadBadgeBlock.mockRejectedValue(testError);

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'apply', '--dry-run']);
        expect.fail('should have thrown');
      } catch (error: unknown) {
        expect(error).toBe(testError);
      }
    })
  });

  describe('check command', () => {
    it('reports "in sync" when badges match', async () => {
      mockCheckBadges.mockResolvedValue({
        inSync: true,
        expected: 'badges',
        current: 'badges',
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'check']);
      } catch {
        // process.exit(0) throws due to mock
      }

      expect(writeSpy).toHaveBeenCalledWith('Badges are in sync\n');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('reports "out of sync" when badges differ', async () => {
      mockCheckBadges.mockResolvedValue({
        inSync: false,
        expected: 'expected badges',
        current: 'current badges',
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'check']);
      } catch {
        // process.exit(1) throws due to mock
      }

      expect(writeSpy).toHaveBeenCalledWith('Badges are out of sync\n\n');
      expect(writeSpy).toHaveBeenCalledWith('Detected 1 difference(s)\n\n');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('passes --package option to checkBadges', async () => {
      mockCheckBadges.mockResolvedValue({
        inSync: true,
        expected: 'badges',
        current: 'badges',
      });
      mockDetectMetadata.mockResolvedValue({
        ecosystem: ['javascript'],
        packageName: 'root',
        packageNames: { javascript: 'root' },
        isMonorepo: true,
        packages: [{ name: 'pkg-a', path: 'packages/pkg-a', ecosystem: 'javascript' }],
        coverageService: null,
        hasCoverage: false,
        repositoryUrl: null,
        owner: null,
        repo: null,
        license: null,
        workflows: [],
        nodeVersion: null,
        pythonVersion: null,
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'check', '--package', 'pkg-a']);
      } catch (error: unknown) {
        void error;
      }

      expect(mockCheckBadges).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 'packages/pkg-a');
    });
  });

  describe('list command', () => {
    it('prints monorepo package and badge lists', async () => {
      mockListBadges.mockResolvedValue({
        isMonorepo: true,
        packages: [{ name: 'pkg-a', path: 'packages/pkg-a', ecosystem: 'javascript' }],
        badges: [testBadge],
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'list']);

      expect(writeSpy).toHaveBeenCalledWith('Monorepo packages:\n');
      expect(writeSpy).toHaveBeenCalledWith('Detected badges:\n');
      expect(mockListBadges).toHaveBeenCalled();
    });

    it('prints "none" for non-monorepo packages', async () => {
      mockListBadges.mockResolvedValue({
        isMonorepo: false,
        packages: [],
        badges: [testBadge],
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'list']);

      expect(writeSpy).toHaveBeenCalledWith('Monorepo packages: none\n');
      expect(writeSpy).toHaveBeenCalledWith('Detected badges:\n');
      expect(mockListBadges).toHaveBeenCalled();
    });
  });

  describe('doctor command', () => {
    it('reports "no issues" when healthy', async () => {
      mockDoctorBadges.mockResolvedValue({ issues: [] });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'doctor']);
      } catch {
        // process.exit(0) throws due to mock
      }

      expect(writeSpy).toHaveBeenCalledWith('No issues found\n');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('reports issues when found', async () => {
      const issue: ValidationResult = {
        badge: testBadge,
        issue: 'broken-image',
        severity: 'error',
        message: 'Badge image URL is not accessible',
        fixable: true,
      };
      mockDoctorBadges.mockResolvedValue({ issues: [issue] });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'doctor']);
      } catch {
        // process.exit(1) throws due to mock
      }

      expect(writeSpy).toHaveBeenCalledWith('Found 1 issue(s)\n\n');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('uses warning icon for warnings', async () => {
      const issue: ValidationResult = {
        badge: testBadge,
        issue: 'broken-link',
        severity: 'warning',
        message: 'Link is broken',
        fixable: false,
      };
      mockDoctorBadges.mockResolvedValue({ issues: [issue] });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'doctor']);
      } catch {
        // process.exit(1) throws
      }

      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('⚠'));
    });
  });

  describe('repair command', () => {
    it('reports "no issues to repair" when clean', async () => {
      mockRepairBadges.mockResolvedValue({
        fixed: [],
        remaining: [],
        applied: false,
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'repair']);
      } catch {
        // process.exit(0) throws
      }

      expect(writeSpy).toHaveBeenCalledWith('No issues to repair\n');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('reports fixed issues', async () => {
      const fixed: ValidationResult = {
        badge: testBadge,
        issue: 'broken-image',
        severity: 'error',
        message: 'Fixed badge image',
        fixable: true,
      };
      mockRepairBadges.mockResolvedValue({
        fixed: [fixed],
        remaining: [],
        applied: true,
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'repair']);

      expect(writeSpy).toHaveBeenCalledWith('Fixed 1 issue(s)\n');
    });

    it('reports remaining unfixable issues and exits 1', async () => {
      const remaining: ValidationResult = {
        badge: testBadge,
        issue: 'broken-link',
        severity: 'warning',
        message: 'Cannot fix link',
        fixable: false,
      };
      mockRepairBadges.mockResolvedValue({
        fixed: [],
        remaining: [remaining],
        applied: false,
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'repair']);
      } catch {
        // process.exit(1) throws
      }

      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('require manual intervention'),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('passes --readme option to config for repair', async () => {
      mockRepairBadges.mockResolvedValue({
        fixed: [],
        remaining: [],
        applied: false,
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'repair', '--readme', 'CUSTOM.md']);
      } catch {
        // process.exit(0) throws
      }

      const calledConfig = mockRepairBadges.mock.calls[0][1] as Config;
      expect(calledConfig.readme).toBe('CUSTOM.md');
    });
  });

  describe('init command', () => {
    it('reports marker insertion and applied badges', async () => {
      mockInitBadges.mockResolvedValue({
        readmeCreated: true,
        markersInserted: true,
        markersAlreadyExist: false,
        badgesApplied: 1,
        badges: [testBadge],
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'init']);

      expect(writeSpy).toHaveBeenCalledWith('Created README.md\n');
      expect(writeSpy).toHaveBeenCalledWith('Inserted badge markers\n');
      expect(writeSpy).toHaveBeenCalledWith('Applied 1 badges\n');
    });

    it('reports when markers already exist', async () => {
      mockInitBadges.mockResolvedValue({
        readmeCreated: false,
        markersInserted: false,
        markersAlreadyExist: true,
        badgesApplied: 0,
        badges: [],
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'init']);

      expect(writeSpy).toHaveBeenCalledWith('Badge markers already exist in README\n');
      expect(writeSpy).toHaveBeenCalledWith('Run `badge-sync apply` to update badges\n');
    });

    it('passes --markers-only option to initBadges', async () => {
      mockInitBadges.mockResolvedValue({
        readmeCreated: false,
        markersInserted: true,
        markersAlreadyExist: false,
        badgesApplied: 0,
        badges: [],
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'init', '--markers-only']);

      const calledOptions = mockInitBadges.mock.calls[0][2] as { markersOnly?: boolean };
      expect(calledOptions.markersOnly).toBe(true);
    });
  });

  describe('option passthrough', () => {
    it('passes --readme option to config for apply', async () => {
      mockApplyBadges.mockResolvedValue({
        applied: 1,
        badges: [testBadge],
        changed: false,
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'apply', '--readme', 'CUSTOM.md']);

      const calledConfig = mockApplyBadges.mock.calls[0][1] as Config;
      expect(calledConfig.readme).toBe('CUSTOM.md');
    });

    it('passes --package option to applyBadges', async () => {
      mockApplyBadges.mockResolvedValue({
        applied: 1,
        badges: [testBadge],
        changed: false,
      });
      mockDetectMetadata.mockResolvedValue({
        ecosystem: ['javascript'],
        packageName: 'root',
        packageNames: { javascript: 'root' },
        isMonorepo: true,
        packages: [{ name: 'pkg-a', path: 'packages/pkg-a', ecosystem: 'javascript' }],
        coverageService: null,
        hasCoverage: false,
        repositoryUrl: null,
        owner: null,
        repo: null,
        license: null,
        workflows: [],
        nodeVersion: null,
        pythonVersion: null,
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'apply', '--package', 'pkg-a']);

      expect(mockApplyBadges).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ dryRun: false }),
        'packages/pkg-a',
      );
    });

    it('throws error when --package name not found in monorepo', async () => {
      mockDetectMetadata.mockResolvedValue({
        ecosystem: ['javascript'],
        packageName: 'root',
        packageNames: { javascript: 'root' },
        isMonorepo: true,
        packages: [{ name: 'pkg-a', path: 'packages/pkg-a', ecosystem: 'javascript' }],
        coverageService: null,
        hasCoverage: false,
        repositoryUrl: null,
        owner: null,
        repo: null,
        license: null,
        workflows: [],
        nodeVersion: null,
        pythonVersion: null,
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'apply', '--package', 'nonexistent']);
        expect.fail('should have thrown');
      } catch (error: unknown) {
        if (error instanceof Error) {
          expect(error.message).toContain('Monorepo package not found: nonexistent');
        }
      }
    });

    it('passes --config option to loadConfig for apply', async () => {
      mockApplyBadges.mockResolvedValue({
        applied: 1,
        badges: [testBadge],
        changed: false,
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'apply', '--config', 'custom.yaml']);

      expect(mockLoadConfig).toHaveBeenCalledWith(expect.any(String), 'custom.yaml');
    });

    it('passes --readme option to config for check', async () => {
      mockCheckBadges.mockResolvedValue({
        inSync: true,
        expected: 'badges',
        current: 'badges',
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'check', '--readme', 'CUSTOM.md']);
      } catch {
        // process.exit(0) throws due to mock
      }

      const calledConfig = mockCheckBadges.mock.calls[0][1] as Config;
      expect(calledConfig.readme).toBe('CUSTOM.md');
    });

    it('passes --readme option to config for doctor', async () => {
      mockDoctorBadges.mockResolvedValue({ issues: [] });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'doctor', '--readme', 'CUSTOM.md']);
      } catch {
        // process.exit(0) throws due to mock
      }

      const calledConfig = mockDoctorBadges.mock.calls[0][1] as Config;
      expect(calledConfig.readme).toBe('CUSTOM.md');
    });

    it('passes --timeout option to doctorBadges', async () => {
      mockDoctorBadges.mockResolvedValue({ issues: [] });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'doctor', '--timeout', '3000']);
      } catch {
        // process.exit(0) throws due to mock
      }

      const calledOptions = mockDoctorBadges.mock.calls[0][2] as { timeout: number };
      expect(calledOptions.timeout).toBe(3000);
    });

    it('passes --timeout option to repairBadges', async () => {
      mockRepairBadges.mockResolvedValue({
        fixed: [],
        remaining: [],
        applied: false,
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'repair', '--timeout', '7000']);
      } catch {
        // process.exit(0) throws due to mock
      }

      const calledOptions = mockRepairBadges.mock.calls[0][2] as { dryRun?: boolean; timeout: number };
      expect(calledOptions.timeout).toBe(7000);
    });

    it('passes --readme option to config for init', async () => {
      mockInitBadges.mockResolvedValue({
        readmeCreated: false,
        markersInserted: true,
        markersAlreadyExist: false,
        badgesApplied: 0,
        badges: [],
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'init', '--readme', 'CUSTOM.md']);

      const calledConfig = mockInitBadges.mock.calls[0][1] as Config;
      expect(calledConfig.readme).toBe('CUSTOM.md');
    });
  });
});
