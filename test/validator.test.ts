import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Badge } from '../src/types.js';

// Mock fetch globally before importing validator
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { validateBadges } = await import('../src/validator.js');

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

describe('validator', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('URL validation', () => {
    it('reports no issues when all URLs are accessible', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const badges = [makeBadge()];
      const results = await validateBadges(badges, '/tmp', { timeout: 1000 });
      expect(results).toHaveLength(0);
    });

    it('reports broken-image when image URL fails', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === 'https://img.shields.io/test') {
          return Promise.resolve({ ok: false });
        }
        return Promise.resolve({ ok: true });
      });
      const badges = [makeBadge()];
      const results = await validateBadges(badges, '/tmp', { timeout: 1000 });
      const imageIssue = results.find((r) => r.issue === 'broken-image');
      expect(imageIssue).toBeDefined();
      expect(imageIssue!.severity).toBe('error');
      expect(imageIssue!.fixable).toBe(true);
    });

    it('reports broken-link when link URL fails', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === 'https://example.com') {
          return Promise.resolve({ ok: false });
        }
        return Promise.resolve({ ok: true });
      });
      const badges = [makeBadge()];
      const results = await validateBadges(badges, '/tmp', { timeout: 1000 });
      const linkIssue = results.find((r) => r.issue === 'broken-link');
      expect(linkIssue).toBeDefined();
      expect(linkIssue!.severity).toBe('warning');
    });

    it('handles fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const badges = [makeBadge()];
      const results = await validateBadges(badges, '/tmp', { timeout: 1000 });
      // Both image and link should fail
      expect(results.filter((r) => r.issue === 'broken-image')).toHaveLength(1);
      expect(results.filter((r) => r.issue === 'broken-link')).toHaveLength(1);
    });
  });

  describe('Duplicate detection', () => {
    it('detects duplicate badges by type', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const badges = [
        makeBadge({ type: 'npm-version' }),
        makeBadge({ type: 'npm-version' }),
      ];
      const results = await validateBadges(badges, '/tmp', { timeout: 1000 });
      const dupes = results.filter((r) => r.issue === 'duplicate');
      expect(dupes).toHaveLength(1);
      expect(dupes[0].fixable).toBe(true);
    });

    it('does not report unique badges as duplicates', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const badges = [
        makeBadge({ type: 'npm-version' }),
        makeBadge({ type: 'pypi-version' }),
      ];
      const results = await validateBadges(badges, '/tmp', { timeout: 1000 });
      expect(results.filter((r) => r.issue === 'duplicate')).toHaveLength(0);
    });

    it('detects duplicate custom badges by URL pair', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const badges = [
        makeBadge({ type: 'custom', imageUrl: 'https://example.com/a.svg', linkUrl: 'https://example.com/a' }),
        makeBadge({ type: 'custom', imageUrl: 'https://example.com/a.svg', linkUrl: 'https://example.com/a' }),
      ];
      const results = await validateBadges(badges, '/tmp', { timeout: 1000 });
      expect(results.filter((r) => r.issue === 'duplicate')).toHaveLength(1);
    });
  });

  describe('Workflow validation', () => {
    it('reports missing workflow file', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const badges = [
        makeBadge({
          type: 'github-actions-ci',
          imageUrl: 'https://github.com/user/repo/actions/workflows/ci.yml/badge.svg',
          linkUrl: 'https://github.com/user/repo/actions/workflows/ci.yml',
        }),
      ];
      const results = await validateBadges(badges, '/tmp/nonexistent', { timeout: 1000 });
      const workflow = results.find((r) => r.issue === 'missing-workflow');
      expect(workflow).toBeDefined();
      expect(workflow!.severity).toBe('error');
      expect(workflow!.fixable).toBe(false);
    });
  });

  describe('Repository validation', () => {
    it('reports mismatched repository references', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const badges = [
        makeBadge({
          type: 'license',
          imageUrl: 'https://img.shields.io/github/license/old-owner/old-repo',
          linkUrl: 'https://github.com/old-owner/old-repo/blob/main/LICENSE',
        }),
      ];
      const results = await validateBadges(badges, '/tmp', {
        timeout: 1000,
        expectedOwner: 'new-owner',
        expectedRepo: 'new-repo',
      });
      const mismatch = results.find((r) => r.issue === 'mismatched-repo');
      expect(mismatch).toBeDefined();
      expect(mismatch!.fixable).toBe(true);
    });
  });
});
