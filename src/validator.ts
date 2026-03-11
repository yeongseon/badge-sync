import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  type CacheStore,
  DEFAULT_CACHE_TTL,
  getCachedResult,
  setCacheEntry,
} from './cache.js';
import type { Badge, ValidationResult } from './types.js';

interface ValidateBadgeOptions {
  timeout?: number;
  expectedOwner?: string | null;
  expectedRepo?: string | null;
  cache?: CacheStore;
  noCache?: boolean;
  cacheTtl?: number;
}

/**
 * Validate badges by checking URL accessibility and cross-referencing metadata.
 * Makes HTTP HEAD requests — intended for `doctor` and `repair` commands only.
 */
export async function validateBadges(
  badges: Badge[],
  cwd: string,
  options: ValidateBadgeOptions = {},
): Promise<ValidationResult[]> {
  const timeout = options.timeout ?? 5000;
  const results: ValidationResult[] = [];

  // Check for duplicates first
  const duplicates = findDuplicates(badges);
  results.push(...duplicates);

  // Validate each badge URL in parallel
  const validationPromises = badges.map((badge) =>
    validateSingleBadge(
      badge,
      cwd,
      timeout,
      options.expectedOwner ?? null,
      options.expectedRepo ?? null,
      options.cache,
      options.noCache ?? false,
      options.cacheTtl ?? DEFAULT_CACHE_TTL,
    ),
  );
  const badgeResults = await Promise.all(validationPromises);
  for (const badgeResult of badgeResults) {
    results.push(...badgeResult);
  }

  return results;
}

/**
 * Validate a single badge's URLs and cross-references.
 */
async function validateSingleBadge(
  badge: Badge,
  cwd: string,
  timeout: number,
  expectedOwner: string | null,
  expectedRepo: string | null,
  cache?: CacheStore,
  noCache = false,
  cacheTtl = DEFAULT_CACHE_TTL,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Check badge image URL
  const imageOk = await checkUrl(badge.imageUrl, timeout, cache, noCache, cacheTtl);
  if (!imageOk) {
    results.push({
      badge,
      issue: 'broken-image',
      severity: 'error',
      message: `Badge image URL is not accessible: ${badge.imageUrl}`,
      fixable: true,
    });
  }

  // Check badge link URL
  const linkOk = await checkUrl(badge.linkUrl, timeout, cache, noCache, cacheTtl);
  if (!linkOk) {
    results.push({
      badge,
      issue: 'broken-link',
      severity: 'warning',
      message: `Badge link URL is not accessible: ${badge.linkUrl}`,
      fixable: false,
    });
  }

  // Check workflow file existence for GitHub Actions badges
  if (badge.type.startsWith('github-actions-')) {
    const workflowName = extractWorkflowName(badge);
    if (workflowName) {
      const ymlPath = join(cwd, '.github', 'workflows', `${workflowName}.yml`);
      const yamlPath = join(cwd, '.github', 'workflows', `${workflowName}.yaml`);
      if (!existsSync(ymlPath) && !existsSync(yamlPath)) {
        results.push({
          badge,
          issue: 'missing-workflow',
          severity: 'error',
          message: `Workflow file not found: ${workflowName}.yml or ${workflowName}.yaml`,
          fixable: false,
        });
      }
    }
  }

  if (expectedOwner && expectedRepo) {
    const repoRef =
      extractGithubRepoRef(badge.imageUrl) ?? extractGithubRepoRef(badge.linkUrl);
    if (repoRef && (repoRef.owner !== expectedOwner || repoRef.repo !== expectedRepo)) {
      results.push({
        badge,
        issue: 'mismatched-repo',
        severity: 'error',
        message: `Badge references ${repoRef.owner}/${repoRef.repo} instead of ${expectedOwner}/${expectedRepo}`,
        fixable: true,
      });
    }
  }

  return results;
}

/**
 * Check if a URL is accessible via HTTP HEAD request.
 */
async function checkUrl(
  url: string,
  timeout: number,
  cache?: CacheStore,
  noCache = false,
  cacheTtl = DEFAULT_CACHE_TTL,
): Promise<boolean> {
  if (!noCache && cache) {
    const cached = getCachedResult(cache, url, cacheTtl);
    if (cached !== null) {
      return cached;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });

    const accessible = response.ok;
    if (!noCache && cache) {
      setCacheEntry(cache, url, accessible);
    }

    return accessible;
  } catch {
    if (!noCache && cache) {
      setCacheEntry(cache, url, false);
    }

    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Find duplicate badges by type.
 */
function findDuplicates(badges: Badge[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  const seen = new Map<string, number>();

  for (const badge of badges) {
    const duplicateKey =
      badge.type === 'custom'
        ? `${badge.imageUrl}|${badge.linkUrl}`
        : badge.type;
    const count = seen.get(duplicateKey) ?? 0;
    seen.set(duplicateKey, count + 1);
    if (count > 0) {
      results.push({
        badge,
        issue: 'duplicate',
        severity: 'warning',
        message: `Duplicate badge found: ${badge.type}`,
        fixable: true,
      });
    }
  }

  return results;
}

function extractWorkflowName(badge: Badge): string | null {
  const workflowMatch =
    badge.imageUrl.match(/\/actions\/workflows\/([^/]+)\/badge\.svg/i) ??
    badge.linkUrl.match(/\/actions\/workflows\/([^/]+)/i);

  if (!workflowMatch?.[1]) {
    return badge.type.replace('github-actions-', '') || null;
  }

  return decodeURIComponent(workflowMatch[1]).replace(/\.(yml|yaml)$/i, '');
}

function extractGithubRepoRef(url: string): { owner: string; repo: string } | null {
  const match =
    url.match(/github\.com\/([^/]+)\/([^/]+)/i) ??
    url.match(/codecov\.io\/gh\/([^/]+)\/([^/?#]+)/i) ??
    url.match(/coveralls\.io\/(?:repos\/github\/|github\/)([^/]+)\/([^/?#]+)/i) ??
    url.match(/img\.shields\.io\/github\/(?:license|stars)\/([^/]+)\/([^/?#]+)/i);

  if (!match?.[1] || !match?.[2]) {
    return null;
  }

  return { owner: match[1], repo: match[2] };
}
