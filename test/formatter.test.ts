import { describe, it, expect } from 'vitest';
import { formatBadges, renderBadge } from '../src/formatter.js';
import type { Badge, Config } from '../src/types.js';
import { DEFAULT_CONFIG } from '../src/config.js';

function makeBadge(overrides: Partial<Badge> = {}): Badge {
  return {
    type: 'test-badge',
    group: 'distribution',
    label: 'test',
    imageUrl: 'https://img.shields.io/test',
    linkUrl: 'https://example.com',
    ...overrides,
  };
}

describe('formatter', () => {
  describe('renderBadge', () => {
    it('renders a badge as markdown image link', () => {
      const badge = makeBadge({
        label: 'npm version',
        imageUrl: 'https://img.shields.io/npm/v/my-lib',
        linkUrl: 'https://www.npmjs.com/package/my-lib',
      });
      expect(renderBadge(badge)).toBe(
        '[![npm version](https://img.shields.io/npm/v/my-lib)](https://www.npmjs.com/package/my-lib)',
      );
    });
  });

  describe('formatBadges', () => {
    it('sorts badges by default group order', () => {
      const badges: Badge[] = [
        makeBadge({ type: 'stars', group: 'social', label: 'stars' }),
        makeBadge({ type: 'npm-version', group: 'distribution', label: 'npm' }),
        makeBadge({ type: 'ci', group: 'build', label: 'CI' }),
        makeBadge({ type: 'license', group: 'metadata', label: 'license' }),
        makeBadge({ type: 'node', group: 'runtime', label: 'node' }),
      ];
      const result = formatBadges(badges);
      const lines = result.split('\n');
      expect(lines[0]).toContain('npm');        // distribution
      expect(lines[1]).toContain('node');        // runtime
      expect(lines[2]).toContain('CI');          // build
      expect(lines[3]).toContain('license');     // metadata
      expect(lines[4]).toContain('stars');       // social
    });

    it('preserves order within the same group', () => {
      const badges: Badge[] = [
        makeBadge({ type: 'npm', group: 'distribution', label: 'npm' }),
        makeBadge({ type: 'pypi', group: 'distribution', label: 'pypi' }),
      ];
      const result = formatBadges(badges);
      const lines = result.split('\n');
      expect(lines[0]).toContain('npm');
      expect(lines[1]).toContain('pypi');
    });

    it('excludes badges listed in config.badges.exclude', () => {
      const badges: Badge[] = [
        makeBadge({ type: 'npm-version', group: 'distribution', label: 'npm' }),
        makeBadge({ type: 'stars', group: 'social', label: 'stars' }),
      ];
      const config: Config = {
        ...DEFAULT_CONFIG,
        badges: {
          ...DEFAULT_CONFIG.badges,
          exclude: ['stars'],
        },
      };
      const result = formatBadges(badges, config);
      expect(result).toContain('npm');
      expect(result).not.toContain('stars');
    });

    it('keeps explicitly included badges even when excluded', () => {
      const badges: Badge[] = [
        makeBadge({ type: 'stars', group: 'social', label: 'stars' }),
      ];
      const config: Config = {
        ...DEFAULT_CONFIG,
        badges: {
          ...DEFAULT_CONFIG.badges,
          exclude: ['stars'],
          include: ['stars'],
        },
      };
      const result = formatBadges(badges, config);
      expect(result).toContain('stars');
    });

    it('uses custom group order from config', () => {
      const badges: Badge[] = [
        makeBadge({ type: 'npm', group: 'distribution', label: 'npm' }),
        makeBadge({ type: 'ci', group: 'build', label: 'CI' }),
        makeBadge({ type: 'stars', group: 'social', label: 'stars' }),
      ];
      const config: Config = {
        ...DEFAULT_CONFIG,
        badges: {
          ...DEFAULT_CONFIG.badges,
          order: ['social', 'build', 'distribution'],
        },
      };
      const result = formatBadges(badges, config);
      const lines = result.split('\n');
      expect(lines[0]).toContain('stars');       // social first
      expect(lines[1]).toContain('CI');          // build second
      expect(lines[2]).toContain('npm');         // distribution third
    });

    it('places unknown groups at the end', () => {
      const badges: Badge[] = [
        makeBadge({ type: 'npm', group: 'distribution', label: 'npm' }),
        makeBadge({ type: 'quality', group: 'quality', label: 'quality' }),
      ];
      const config: Config = {
        ...DEFAULT_CONFIG,
        badges: {
          ...DEFAULT_CONFIG.badges,
          order: ['distribution'],  // quality not listed
        },
      };
      const result = formatBadges(badges, config);
      const lines = result.split('\n');
      expect(lines[0]).toContain('npm');
      expect(lines[1]).toContain('quality');
    });

    it('returns empty string for empty badge list', () => {
      const result = formatBadges([]);
      expect(result).toBe('');
    });

    it('returns empty string when all badges are excluded', () => {
      const badges: Badge[] = [
        makeBadge({ type: 'npm', group: 'distribution', label: 'npm' }),
      ];
      const config: Config = {
        ...DEFAULT_CONFIG,
        badges: {
          ...DEFAULT_CONFIG.badges,
          exclude: ['npm'],
        },
      };
      const result = formatBadges(badges, config);
      expect(result).toBe('');
    });
  });
});
