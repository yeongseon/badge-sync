import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import type { Badge, Config, ValidationResult } from '../src/types.js';

// Mock all dependencies BEFORE importing cli
vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn(),
}));
vi.mock('../src/applier.js', () => ({
  applyBadges: vi.fn(),
  applyWorkspace: vi.fn(),
  buildDryRunReport: vi.fn(),
  checkBadges: vi.fn(),
  checkWorkspace: vi.fn(),
  doctorBadges: vi.fn(),
  repairBadges: vi.fn(),
  listBadges: vi.fn(),
  initBadges: vi.fn(),
  migrateBadges: vi.fn(),
}));
vi.mock('../src/detector.js', () => ({
  detectMetadata: vi.fn(),
}));

const { createProgram } = await import('../src/cli.js');
const { loadConfig } = await import('../src/config.js');
const { applyBadges, applyWorkspace, buildDryRunReport, checkBadges, checkWorkspace, doctorBadges, repairBadges, listBadges, initBadges, migrateBadges } = await import('../src/applier.js');
const { detectMetadata } = await import('../src/detector.js');

const mockLoadConfig = vi.mocked(loadConfig);
const mockApplyBadges = vi.mocked(applyBadges);
const mockApplyWorkspace = vi.mocked(applyWorkspace);
const mockBuildDryRunReport = vi.mocked(buildDryRunReport);
const mockCheckBadges = vi.mocked(checkBadges);
const mockCheckWorkspace = vi.mocked(checkWorkspace);
const mockDoctorBadges = vi.mocked(doctorBadges);
const mockRepairBadges = vi.mocked(repairBadges);
const mockListBadges = vi.mocked(listBadges);
const mockInitBadges = vi.mocked(initBadges);
const mockDetectMetadata = vi.mocked(detectMetadata);
const mockMigrateBadges = vi.mocked(migrateBadges);

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
  let writeSpy: MockInstance<typeof process.stdout.write>;
  let exitSpy: MockInstance<typeof process.exit>;

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

      mockBuildDryRunReport.mockResolvedValue({
        total: 3,
        newCount: 1,
        updatedCount: 1,
        unchangedCount: 1,
        entries: [
          { badge: changedBadge, marker: '~' },
          { badge: unchangedBadge, marker: '=' },
          { badge: newBadge, marker: '+' },
        ],
        customBadges: [
          {
            label: 'pre-commit',
            imageUrl: 'https://img.shields.io/badge/pre--commit-enabled-brightgreen',
            linkUrl: 'https://pre-commit.com',
            raw: '[![pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen)](https://pre-commit.com)',
          },
        ],
      });

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

    it('dry-run handles buildDryRunReport error with non-Error object', async () => {
      mockApplyBadges.mockResolvedValue({
        applied: 1,
        badges: [testBadge],
        changed: true,
      });
      mockBuildDryRunReport.mockRejectedValue('not an error object');

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'apply', '--dry-run']);
        expect.fail('should have thrown');
      } catch (error: unknown) {
        expect(error).toBe('not an error object');
      }
    });

    it('dry-run rethrows buildDryRunReport errors', async () => {
      mockApplyBadges.mockResolvedValue({
        applied: 1,
        badges: [testBadge],
        changed: true,
      });
      const testError = new Error('Some other read error');
      mockBuildDryRunReport.mockRejectedValue(testError);

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'apply', '--dry-run']);
        expect.fail('should have thrown');
      } catch (error: unknown) {
        expect(error).toBe(testError);
      }
    })

    it('runs workspace apply and prints summary', async () => {
      mockApplyWorkspace.mockResolvedValue({
        results: [
          {
            packageName: 'pkg-a',
            packagePath: 'packages/pkg-a',
            result: { applied: 4, badges: [testBadge], changed: true },
          },
          {
            packageName: 'pkg-b',
            packagePath: 'packages/pkg-b',
            result: { applied: 3, badges: [testBadge], changed: false },
          },
          {
            packageName: 'pkg-c',
            packagePath: 'packages/pkg-c',
            result: { applied: 0, badges: [], changed: false },
            error: 'README file not found',
          },
        ],
        totalApplied: 7,
        totalChanged: 1,
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'apply', '--workspace']);

      expect(writeSpy).toHaveBeenCalledWith('Workspace: applying badges to 3 packages\n\n');
      expect(writeSpy).toHaveBeenCalledWith('  ✓ pkg-a — Applied 4 badges\n');
      expect(writeSpy).toHaveBeenCalledWith('  ✓ pkg-b — Applied 3 badges (unchanged)\n');
      expect(writeSpy).toHaveBeenCalledWith('  ✗ pkg-c — Error: README file not found\n');
      expect(writeSpy).toHaveBeenCalledWith('\nApplied badges to 2/3 packages\n');
      expect(mockApplyBadges).not.toHaveBeenCalled();
    });

    it('runs workspace apply dry-run and prints per-package report', async () => {
      mockApplyWorkspace.mockResolvedValue({
        results: [
          {
            packageName: 'pkg-a',
            packagePath: 'packages/pkg-a',
            result: { applied: 4, badges: [testBadge], changed: true },
          },
          {
            packageName: 'pkg-b',
            packagePath: 'packages/pkg-b',
            result: { applied: 3, badges: [testBadge], changed: false },
          },
        ],
        totalApplied: 7,
        totalChanged: 1,
      });
      mockBuildDryRunReport
        .mockResolvedValueOnce({
          total: 4,
          newCount: 1,
          updatedCount: 2,
          unchangedCount: 1,
          entries: [],
          customBadges: [],
        })
        .mockResolvedValueOnce({
          total: 3,
          newCount: 0,
          updatedCount: 0,
          unchangedCount: 3,
          entries: [],
          customBadges: [],
        });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'apply', '--workspace', '--dry-run']);

      expect(writeSpy).toHaveBeenCalledWith('Workspace: dry run for 2 packages\n\n');
      expect(writeSpy).toHaveBeenCalledWith('  pkg-a — Would apply 4 badge(s) (1 new, 2 updated, 1 unchanged)\n');
      expect(writeSpy).toHaveBeenCalledWith('  pkg-b — Would apply 3 badge(s) (0 new, 0 updated, 3 unchanged)\n');
      expect(writeSpy).toHaveBeenCalledWith('\nDry run complete for 2 packages\n');
    });
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

    it('counts multiple line differences correctly', async () => {
      mockCheckBadges.mockResolvedValue({
        inSync: false,
        expected: 'line1\nline2\nline3',
        current: 'lineA\nline2',
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'check']);
      } catch {
        // process.exit(1) throws due to mock
      }

      expect(writeSpy).toHaveBeenCalledWith('Badges are out of sync\n\n');
      expect(writeSpy).toHaveBeenCalledWith('Detected 2 difference(s)\n\n');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('--summary prints structured summary when in sync', async () => {
      mockBuildDryRunReport.mockResolvedValue({
        total: 4,
        newCount: 0,
        updatedCount: 0,
        unchangedCount: 4,
        entries: [],
        customBadges: [],
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'check', '--summary']);
      } catch {
        // process.exit(0) throws due to mock
      }

      const output = writeSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
      expect(output).toBe('badges summary\n\n  valid:    4\n  outdated: 0\n  missing:  0\n');
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(mockCheckBadges).not.toHaveBeenCalled();
    });

    it('--summary prints structured summary when out of sync', async () => {
      mockBuildDryRunReport.mockResolvedValue({
        total: 4,
        newCount: 1,
        updatedCount: 2,
        unchangedCount: 1,
        entries: [],
        customBadges: [],
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'check', '--summary']);
      } catch {
        // process.exit(1) throws due to mock
      }

      const output = writeSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
      expect(output).toBe('badges summary\n\n  valid:    1\n  outdated: 2\n  missing:  1\n');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockCheckBadges).not.toHaveBeenCalled();
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

    it('runs workspace check and exits 1 when any package is out of sync', async () => {
      mockCheckWorkspace.mockResolvedValue({
        results: [
          {
            packageName: 'pkg-a',
            packagePath: 'packages/pkg-a',
            result: { inSync: true, expected: 'same', current: 'same' },
          },
          {
            packageName: 'pkg-b',
            packagePath: 'packages/pkg-b',
            result: { inSync: false, expected: 'a\nb', current: 'a\nc' },
          },
        ],
        allInSync: false,
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'check', '--workspace']);
      } catch {
        // process.exit(1) throws due to mock
      }

      expect(writeSpy).toHaveBeenCalledWith('Workspace: checking 2 packages\n\n');
      expect(writeSpy).toHaveBeenCalledWith('  ✓ pkg-a — in sync\n');
      expect(writeSpy).toHaveBeenCalledWith('  ✗ pkg-b — out of sync (1 differences)\n');
      expect(writeSpy).toHaveBeenCalledWith('\n1/2 packages in sync\n');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockCheckBadges).not.toHaveBeenCalled();
    });

    it('runs workspace check and exits 0 when all packages are in sync', async () => {
      mockCheckWorkspace.mockResolvedValue({
        results: [
          {
            packageName: 'pkg-a',
            packagePath: 'packages/pkg-a',
            result: { inSync: true, expected: 'same', current: 'same' },
          },
        ],
        allInSync: true,
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'check', '--workspace']);
      } catch {
        // process.exit(0) throws due to mock
      }

      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('--summary works with --workspace', async () => {
      mockCheckWorkspace.mockResolvedValue({
        results: [
          {
            packageName: 'pkg-a',
            packagePath: 'packages/pkg-a',
            result: { inSync: true, expected: 'same', current: 'same' },
          },
          {
            packageName: 'pkg-b',
            packagePath: 'packages/pkg-b',
            result: { inSync: false, expected: 'a', current: 'b' },
          },
        ],
        allInSync: false,
      });

      mockBuildDryRunReport
        .mockResolvedValueOnce({
          total: 4,
          newCount: 0,
          updatedCount: 0,
          unchangedCount: 4,
          entries: [],
          customBadges: [],
        })
        .mockResolvedValueOnce({
          total: 4,
          newCount: 1,
          updatedCount: 1,
          unchangedCount: 2,
          entries: [],
          customBadges: [],
        });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'check', '--workspace', '--summary']);
      } catch {
        // process.exit(1) throws due to mock
      }

      const output = writeSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
      expect(output).toBe(
        'badges summary\n\n  pkg-a\n    valid:    4\n    outdated: 0\n    missing:  0\n\n  pkg-b\n    valid:    2\n    outdated: 1\n    missing:  1\n\n  total\n    valid:    6\n    outdated: 1\n    missing:  1\n',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockBuildDryRunReport).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.any(Object),
        'packages/pkg-a',
      );
      expect(mockBuildDryRunReport).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.any(Object),
        'packages/pkg-b',
      );
    });

    it('--summary works with --package', async () => {
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
      mockBuildDryRunReport.mockResolvedValue({
        total: 4,
        newCount: 0,
        updatedCount: 0,
        unchangedCount: 4,
        entries: [],
        customBadges: [],
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'check', '--package', 'pkg-a', '--summary']);
      } catch {
        // process.exit(0) throws due to mock
      }

      const output = writeSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
      expect(output).toBe('badges summary\n\n  valid:    4\n  outdated: 0\n  missing:  0\n');
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(mockBuildDryRunReport).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 'packages/pkg-a');
      expect(mockCheckBadges).not.toHaveBeenCalled();
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

    it('passes --readme option to config for list', async () => {
      mockListBadges.mockResolvedValue({
        isMonorepo: false,
        packages: [],
        badges: [testBadge],
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'list', '--readme', 'CUSTOM.md']);

      const calledConfig = mockListBadges.mock.calls[0][1] as Config;
      expect(calledConfig.readme).toBe('CUSTOM.md');
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

    it('uses default timeout of 5000 when --timeout is not specified', async () => {
      mockDoctorBadges.mockResolvedValue({ issues: [] });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'doctor']);
      } catch {
        // process.exit(0) throws due to mock
      }

      expect(mockDoctorBadges).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ timeout: 5000 }),
      );
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

    it('uses default timeout of 5000 when --timeout is not specified', async () => {
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
        // process.exit(0) throws due to mock
      }

      expect(mockRepairBadges).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ timeout: 5000 }),
      );
    });
  });

  describe('migrate command', () => {
    it('prints no migrations needed when none found', async () => {
      mockMigrateBadges.mockResolvedValue({
        migrations: [],
        applied: false,
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'migrate']);
      } catch {
        // process.exit(0) throws due to mock
      }

      expect(writeSpy).toHaveBeenCalledWith('No migrations needed\n');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('prints migrations in dry-run mode', async () => {
      mockMigrateBadges.mockResolvedValue({
        migrations: [
          {
            original: { label: 'Build', imageUrl: 'https://travis-ci.org/acme/repo.svg', linkUrl: 'https://travis-ci.org/acme/repo', raw: '...' },
            migrated: { label: 'Build', imageUrl: 'https://github.com/acme/repo/actions/workflows/ci.yml/badge.svg', linkUrl: 'https://github.com/acme/repo/actions/workflows/ci.yml' },
            rule: 'travis-to-github-actions',
            description: 'Travis CI is deprecated for many open source projects; migrate to GitHub Actions.',
          },
        ],
        applied: false,
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'migrate', '--dry-run']);
      } catch {
        // process.exit(0) throws due to mock
      }

      expect(writeSpy).toHaveBeenCalledWith('Found 1 migration(s)\n\n');
      expect(mockMigrateBadges).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ dryRun: true }),
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('prints applied migrations', async () => {
      mockMigrateBadges.mockResolvedValue({
        migrations: [
          {
            original: { label: 'Build', imageUrl: 'https://travis-ci.org/acme/repo.svg', linkUrl: 'https://travis-ci.org/acme/repo', raw: '...' },
            migrated: { label: 'Build', imageUrl: 'https://github.com/acme/repo/actions/workflows/ci.yml/badge.svg', linkUrl: 'https://github.com/acme/repo/actions/workflows/ci.yml' },
            rule: 'travis-to-github-actions',
            description: 'Travis CI is deprecated for many open source projects; migrate to GitHub Actions.',
          },
        ],
        applied: true,
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'migrate']);
      } catch {
        // process.exit(0) throws due to mock
      }

      expect(writeSpy).toHaveBeenCalledWith('Applied 1 migration(s)\n\n');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('prints removal action for null migrations', async () => {
      mockMigrateBadges.mockResolvedValue({
        migrations: [
          {
            original: { label: 'Dependencies', imageUrl: 'https://david-dm.org/acme/repo.svg', linkUrl: 'https://david-dm.org/acme/repo', raw: '...' },
            migrated: null,
            rule: 'remove-david-dm',
            description: 'david-dm.org is defunct and its dependency status badges should be removed.',
          },
        ],
        applied: true,
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'migrate']);
      } catch {
        // process.exit(0) throws due to mock
      }

      expect(writeSpy).toHaveBeenCalledWith('Applied 1 migration(s)\n\n');
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('\u2717'));
      expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('remove'));
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('passes --normalize option to migrateBadges', async () => {
      mockMigrateBadges.mockResolvedValue({
        migrations: [],
        applied: false,
      });

      const program = createProgram();
      program.exitOverride();

      try {
        await program.parseAsync(['node', 'badge-sync', 'migrate', '--normalize']);
      } catch {
        // process.exit(0) throws due to mock
      }

      expect(mockMigrateBadges).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ normalize: true }),
      );
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

    it('passes --dry-run option to initBadges', async () => {
      mockInitBadges.mockResolvedValue({
        readmeCreated: false,
        markersInserted: false,
        markersAlreadyExist: false,
        badgesApplied: 2,
        badges: [testBadge, testBadge],
      });

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'init', '--dry-run']);

      const calledOptions = mockInitBadges.mock.calls[0][2] as { dryRun?: boolean };
      expect(calledOptions.dryRun).toBe(true);
      expect(writeSpy).toHaveBeenCalledWith('Dry run - no changes written\n\n');
      expect(writeSpy).toHaveBeenCalledWith('Would apply 2 badge(s):\n');
    });
  });

  describe('option passthrough', () => {
    it('throws when --workspace and --package are used together for apply', async () => {
      const program = createProgram();
      program.exitOverride();

      await expect(
        program.parseAsync(['node', 'badge-sync', 'apply', '--workspace', '--package', 'pkg-a']),
      ).rejects.toThrow('Cannot use --workspace and --package together');
    });

    it('throws when --workspace and --package are used together for check', async () => {
      const program = createProgram();
      program.exitOverride();

      await expect(
        program.parseAsync(['node', 'badge-sync', 'check', '--workspace', '--package', 'pkg-a']),
      ).rejects.toThrow('Cannot use --workspace and --package together');
    });

    it('rethrows workspace apply errors (non-monorepo)', async () => {
      mockApplyWorkspace.mockRejectedValue(
        new Error('No monorepo packages detected. Use --package <name> for single packages.'),
      );

      const program = createProgram();
      program.exitOverride();

      await expect(
        program.parseAsync(['node', 'badge-sync', 'apply', '--workspace']),
      ).rejects.toThrow('No monorepo packages detected. Use --package <name> for single packages.');
    });

    it('rethrows workspace check errors (non-monorepo)', async () => {
      mockCheckWorkspace.mockRejectedValue(
        new Error('No monorepo packages detected. Use --package <name> for single packages.'),
      );

      const program = createProgram();
      program.exitOverride();

      await expect(
        program.parseAsync(['node', 'badge-sync', 'check', '--workspace']),
      ).rejects.toThrow('No monorepo packages detected. Use --package <name> for single packages.');
    });

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
