import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Config, Badge, ValidationResult } from '../src/types.js';

// Mock all dependencies BEFORE importing cli
vi.mock('../src/config.js', () => ({
  loadConfig: vi.fn(),
}));
vi.mock('../src/applier.js', () => ({
  applyBadges: vi.fn(),
  checkBadges: vi.fn(),
  doctorBadges: vi.fn(),
  repairBadges: vi.fn(),
}));
vi.mock('../src/formatter.js', () => ({
  formatBadges: vi.fn(),
}));
vi.mock('../src/resolver.js', () => ({
  resolveBadges: vi.fn(),
}));
vi.mock('../src/detector.js', () => ({
  detectMetadata: vi.fn(),
}));

const { createProgram } = await import('../src/cli.js');
const { loadConfig } = await import('../src/config.js');
const { applyBadges, checkBadges, doctorBadges, repairBadges } = await import('../src/applier.js');
const { formatBadges } = await import('../src/formatter.js');
const { resolveBadges } = await import('../src/resolver.js');
const { detectMetadata } = await import('../src/detector.js');

const mockLoadConfig = vi.mocked(loadConfig);
const mockApplyBadges = vi.mocked(applyBadges);
const mockCheckBadges = vi.mocked(checkBadges);
const mockDoctorBadges = vi.mocked(doctorBadges);
const mockRepairBadges = vi.mocked(repairBadges);
const mockFormatBadges = vi.mocked(formatBadges);
const mockResolveBadges = vi.mocked(resolveBadges);
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

    it('prints formatted badges in dry-run mode', async () => {
      mockApplyBadges.mockResolvedValue({
        applied: 1,
        badges: [testBadge],
        changed: true,
      });
      mockDetectMetadata.mockResolvedValue({
        ecosystem: ['javascript'],
        packageName: 'test',
        packageNames: { javascript: 'test' },
        repositoryUrl: null,
        owner: null,
        repo: null,
        license: null,
        workflows: [],
        nodeVersion: null,
        pythonVersion: null,
      });
      mockResolveBadges.mockReturnValue([testBadge]);
      mockFormatBadges.mockReturnValue('formatted badge output');

      const program = createProgram();
      program.exitOverride();
      await program.parseAsync(['node', 'badge-sync', 'apply', '--dry-run']);

      expect(writeSpy).toHaveBeenCalledWith('formatted badge output\n');
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
      expect(exitSpy).toHaveBeenCalledWith(1);
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
  });
});
