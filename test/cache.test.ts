import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CACHE_FILE,
  getCachedResult,
  loadCache,
  saveCache,
  setCacheEntry,
} from '../src/cache.js';

describe('cache', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'badge-sync-cache-test-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('loadCache', () => {
    it('returns empty object for non-existent file', async () => {
      const result = await loadCache(tempDir);
      expect(result).toEqual({});
    });

    it('returns empty object for invalid JSON', async () => {
      await writeFile(join(tempDir, CACHE_FILE), '{invalid-json', 'utf-8');

      const result = await loadCache(tempDir);
      expect(result).toEqual({});
    });

    it('returns parsed data for valid cache file', async () => {
      const data = {
        'https://example.com/a': { accessible: true, checkedAt: 1000 },
        'https://example.com/b': { accessible: false, checkedAt: 2000 },
      };
      await writeFile(join(tempDir, CACHE_FILE), JSON.stringify(data), 'utf-8');

      const result = await loadCache(tempDir);
      expect(result).toEqual(data);
    });
  });

  describe('saveCache', () => {
    it('writes correct JSON', async () => {
      const cache = {
        'https://example.com/a': { accessible: true, checkedAt: 1234 },
      };

      await saveCache(tempDir, cache);
      const content = await readFile(join(tempDir, CACHE_FILE), 'utf-8');

      expect(content).toBe(`${JSON.stringify(cache, null, 2)}`);
    });
  });

  describe('getCachedResult', () => {
    it('returns null for missing URL', () => {
      const result = getCachedResult({}, 'https://example.com/a', 1000);
      expect(result).toBeNull();
    });

    it('returns null for expired entry', () => {
      vi.spyOn(Date, 'now').mockReturnValue(5000);
      const cache = {
        'https://example.com/a': { accessible: true, checkedAt: 1000 },
      };

      const result = getCachedResult(cache, 'https://example.com/a', 3000);
      expect(result).toBeNull();
    });

    it('returns cached value for fresh entry', () => {
      vi.spyOn(Date, 'now').mockReturnValue(3500);
      const cache = {
        'https://example.com/a': { accessible: false, checkedAt: 1000 },
      };

      const result = getCachedResult(cache, 'https://example.com/a', 3000);
      expect(result).toBe(false);
    });
  });

  describe('setCacheEntry', () => {
    it('creates new entry with current timestamp', () => {
      vi.spyOn(Date, 'now').mockReturnValue(9999);
      const cache = {};

      setCacheEntry(cache, 'https://example.com/a', true);

      expect(cache).toEqual({
        'https://example.com/a': { accessible: true, checkedAt: 9999 },
      });
    });
  });
});
