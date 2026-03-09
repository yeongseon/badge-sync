import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { applyBadges, checkBadges, doctorBadges, repairBadges } from '../src/applier.js';
import type { Config } from '../src/types.js';
import { DEFAULT_CONFIG } from '../src/types.js';

const FIXTURES = resolve(import.meta.dirname, 'fixtures');
const TMP = resolve(import.meta.dirname, '.tmp-applier');

function copyFixture(name: string): string {
  const src = resolve(FIXTURES, name);
  const dest = resolve(TMP, name);
  cpSync(src, dest, { recursive: true });
  return dest;
}

function makeConfig(overrides: Partial<Config> = {}): Config {
  return { ...DEFAULT_CONFIG, ...overrides };
}

beforeEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
});

describe('applier', () => {
  describe('applyBadges', () => {
    it('applies badges to JavaScript project README', async () => {
      const cwd = copyFixture('javascript-project');
      // Set up git remote for the fixture
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-awesome-lib.git', { cwd, stdio: 'pipe' });

      const config = makeConfig();
      const result = await applyBadges(cwd, config);

      expect(result.applied).toBeGreaterThan(0);
      expect(result.changed).toBe(true);

      // Verify README was updated
      const readme = readFileSync(resolve(cwd, 'README.md'), 'utf-8');
      expect(readme).toContain('img.shields.io/npm/v/my-awesome-lib');
      expect(readme).toContain('<!-- BADGES:START -->');
      expect(readme).toContain('<!-- BADGES:END -->');
    });

    it('applies badges to Python project README', async () => {
      const cwd = copyFixture('python-project');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-python-tool.git', { cwd, stdio: 'pipe' });

      const config = makeConfig();
      const result = await applyBadges(cwd, config);

      expect(result.applied).toBeGreaterThan(0);
      expect(result.changed).toBe(true);

      const readme = readFileSync(resolve(cwd, 'README.md'), 'utf-8');
      expect(readme).toContain('img.shields.io/pypi/v/my-python-tool');
      expect(readme).toContain('pypi.org/project/my-python-tool');
    });

    it('applies badges to Rust project README', async () => {
      const cwd = copyFixture('rust-project');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-rust-crate.git', { cwd, stdio: 'pipe' });

      const config = makeConfig();
      const result = await applyBadges(cwd, config);

      expect(result.applied).toBeGreaterThan(0);
      expect(result.changed).toBe(true);

      const readme = readFileSync(resolve(cwd, 'README.md'), 'utf-8');
      expect(readme).toContain('img.shields.io/crates/v/my-rust-crate');
      expect(readme).toContain('crates.io/crates/my-rust-crate');
    });

    it('applies badges to multi-ecosystem project', async () => {
      const cwd = copyFixture('multi-ecosystem');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/fullstack-app.git', { cwd, stdio: 'pipe' });

      const config = makeConfig();
      const result = await applyBadges(cwd, config);

      const readme = readFileSync(resolve(cwd, 'README.md'), 'utf-8');
      // Should have both npm and pypi badges
      expect(readme).toContain('img.shields.io/npm/v/fullstack-app');
      expect(readme).toContain('img.shields.io/pypi/v/fullstack-backend');
    });

    it('reports no changes when badges are up to date', async () => {
      const cwd = copyFixture('javascript-project');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-awesome-lib.git', { cwd, stdio: 'pipe' });

      const config = makeConfig();

      // Apply once
      await applyBadges(cwd, config);
      // Apply again
      const result = await applyBadges(cwd, config);
      expect(result.changed).toBe(false);
    });

    it('does not write file in dry-run mode', async () => {
      const cwd = copyFixture('javascript-project');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-awesome-lib.git', { cwd, stdio: 'pipe' });

      const readmeBefore = readFileSync(resolve(cwd, 'README.md'), 'utf-8');
      const config = makeConfig();
      await applyBadges(cwd, config, { dryRun: true });
      const readmeAfter = readFileSync(resolve(cwd, 'README.md'), 'utf-8');
      expect(readmeAfter).toBe(readmeBefore);
    });

    it('throws when README is missing', async () => {
      await expect(
        applyBadges(TMP, makeConfig()),
      ).rejects.toThrow('README file not found');
    });

    it('throws when no ecosystem files found', async () => {
      const cwd = copyFixture('minimal-project');
      await expect(
        applyBadges(cwd, makeConfig()),
      ).rejects.toThrow('No recognizable ecosystem');
    });
  });

  describe('checkBadges', () => {
    it('returns inSync=true when badges match', async () => {
      const cwd = copyFixture('javascript-project');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-awesome-lib.git', { cwd, stdio: 'pipe' });

      const config = makeConfig();
      // Apply first
      await applyBadges(cwd, config);
      // Check
      const result = await checkBadges(cwd, config);
      expect(result.inSync).toBe(true);
    });

    it('returns inSync=false when badges differ', async () => {
      const cwd = copyFixture('javascript-project');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-awesome-lib.git', { cwd, stdio: 'pipe' });

      const config = makeConfig();
      // Don't apply — empty block vs expected badges
      const result = await checkBadges(cwd, config);
      expect(result.inSync).toBe(false);
      expect(result.expected).not.toBe('');
      expect(result.current).toBe('');
    });

    it('throws when README is missing', async () => {
      await expect(
        checkBadges(TMP, makeConfig()),
      ).rejects.toThrow('README file not found');
    });

    it('throws when badge block markers are missing', async () => {
      const cwd = copyFixture('javascript-project');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-awesome-lib.git', { cwd, stdio: 'pipe' });

      // Overwrite README without badge markers
      writeFileSync(resolve(cwd, 'README.md'), '# No Badge Markers\nJust content.');

      await expect(
        checkBadges(cwd, makeConfig()),
      ).rejects.toThrow('Badge block markers not found');
    });
  });
  describe('doctorBadges', () => {
    it('throws when README is missing', async () => {
      await expect(
        doctorBadges(TMP, makeConfig()),
      ).rejects.toThrow('README file not found');
    });

    it('returns empty issues for healthy project with mocked fetch', async () => {
      const cwd = copyFixture('javascript-project');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-awesome-lib.git', { cwd, stdio: 'pipe' });

      // First apply badges so doctor has something to validate
      const config = makeConfig();
      await applyBadges(cwd, config);

      // Mock fetch to return ok for all URLs
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      try {
        const result = await doctorBadges(cwd, config, { timeout: 1000 });
        expect(result.issues).toHaveLength(0);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('returns issues when badge URLs are broken', async () => {
      const cwd = copyFixture('javascript-project');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-awesome-lib.git', { cwd, stdio: 'pipe' });

      const config = makeConfig();
      await applyBadges(cwd, config);

      // Mock fetch to return not-ok for all URLs
      const mockFetch = vi.fn().mockResolvedValue({ ok: false });
      vi.stubGlobal('fetch', mockFetch);

      try {
        const result = await doctorBadges(cwd, config, { timeout: 1000 });
        expect(result.issues.length).toBeGreaterThan(0);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('repairBadges', () => {
    it('throws when README is missing', async () => {
      await expect(
        repairBadges(TMP, makeConfig()),
      ).rejects.toThrow('README file not found');
    });

    it('returns no fixes when project is healthy', async () => {
      const cwd = copyFixture('javascript-project');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-awesome-lib.git', { cwd, stdio: 'pipe' });

      const config = makeConfig();
      await applyBadges(cwd, config);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      try {
        const result = await repairBadges(cwd, config, { timeout: 1000 });
        expect(result.fixed).toHaveLength(0);
        expect(result.remaining).toHaveLength(0);
        expect(result.applied).toBe(false);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('repairs fixable issues', async () => {
      const cwd = copyFixture('javascript-project');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-awesome-lib.git', { cwd, stdio: 'pipe' });

      const config = makeConfig();
      await applyBadges(cwd, config);

      // Mock fetch to return broken image on first call series, then ok
      const mockFetch = vi.fn().mockResolvedValue({ ok: false });
      vi.stubGlobal('fetch', mockFetch);

      try {
        const result = await repairBadges(cwd, config, { timeout: 1000 });
        // Should have found fixable issues (broken-image)
        expect(result.fixed.length).toBeGreaterThan(0);
        expect(result.applied).toBe(true);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('does not write in dry-run mode', async () => {
      const cwd = copyFixture('javascript-project');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-awesome-lib.git', { cwd, stdio: 'pipe' });

      const config = makeConfig();
      await applyBadges(cwd, config);
      const readmeBefore = readFileSync(resolve(cwd, 'README.md'), 'utf-8');

      const mockFetch = vi.fn().mockResolvedValue({ ok: false });
      vi.stubGlobal('fetch', mockFetch);

      try {
        const result = await repairBadges(cwd, config, { dryRun: true, timeout: 1000 });
        const readmeAfter = readFileSync(resolve(cwd, 'README.md'), 'utf-8');
        expect(readmeAfter).toBe(readmeBefore);
        expect(result.applied).toBe(false);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it('returns only remaining issues when none are fixable', async () => {
      const cwd = copyFixture('javascript-project');
      const { execSync } = await import('node:child_process');
      execSync('git init', { cwd, stdio: 'pipe' });
      execSync('git remote add origin https://github.com/testuser/my-awesome-lib.git', { cwd, stdio: 'pipe' });

      const config = makeConfig();
      await applyBadges(cwd, config);

      // Mock fetch to return ok for image URLs (shields.io and github.com)
      // but broken for link URLs (npmjs.com, etc.)
      // This produces only broken-link issues which are fixable: false
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('img.shields.io') || url.includes('badge.svg')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: false });
      });
      vi.stubGlobal('fetch', mockFetch);

      try {
        const result = await repairBadges(cwd, config, { timeout: 1000 });
        expect(result.fixed).toHaveLength(0);
        expect(result.remaining.length).toBeGreaterThan(0);
        expect(result.applied).toBe(false);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
