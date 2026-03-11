import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface CacheEntry {
  accessible: boolean;
  checkedAt: number;
}

export interface CacheStore {
  [url: string]: CacheEntry;
}

export const CACHE_FILE = '.badge-sync-cache.json';
export const DEFAULT_CACHE_TTL = 86_400_000;

export async function loadCache(cwd: string): Promise<CacheStore> {
  const cachePath = join(cwd, CACHE_FILE);

  try {
    const raw = await readFile(cachePath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    return toCacheStore(parsed);
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return {};
    }

    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return {};
    }

    return {};
  }
}

export async function saveCache(cwd: string, cache: CacheStore): Promise<void> {
  const cachePath = join(cwd, CACHE_FILE);
  await writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
}

export function getCachedResult(
  cache: CacheStore,
  url: string,
  ttl: number,
): boolean | null {
  const entry = cache[url];
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.checkedAt >= ttl) {
    return null;
  }

  return entry.accessible;
}

export function setCacheEntry(
  cache: CacheStore,
  url: string,
  accessible: boolean,
): void {
  cache[url] = {
    accessible,
    checkedAt: Date.now(),
  };
}

function toCacheStore(value: unknown): CacheStore {
  if (!isRecord(value)) {
    return {};
  }

  const store: CacheStore = {};

  for (const [url, entry] of Object.entries(value)) {
    if (!isRecord(entry)) {
      continue;
    }

    const accessible = entry.accessible;
    const checkedAt = entry.checkedAt;
    if (typeof accessible !== 'boolean' || typeof checkedAt !== 'number') {
      continue;
    }

    store[url] = { accessible, checkedAt };
  }

  return store;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
