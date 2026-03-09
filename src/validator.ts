import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Badge, ValidationResult } from './types.js';

/**
 * Validate badges by checking URL accessibility and cross-referencing metadata.
 * Makes HTTP HEAD requests — intended for `doctor` and `repair` commands only.
 */
export async function validateBadges(
  badges: Badge[],
  cwd: string,
  options: { timeout?: number } = {},
): Promise<ValidationResult[]> {
  const timeout = options.timeout ?? 5000;
  const results: ValidationResult[] = [];

  // Check for duplicates first
  const duplicates = findDuplicates(badges);
  results.push(...duplicates);

  // Validate each badge URL in parallel
  const validationPromises = badges.map((badge) =>
    validateSingleBadge(badge, cwd, timeout),
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
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Check badge image URL
  const imageOk = await checkUrl(badge.imageUrl, timeout);
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
  const linkOk = await checkUrl(badge.linkUrl, timeout);
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
    const workflowName = badge.type.replace('github-actions-', '');
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

  return results;
}

/**
 * Check if a URL is accessible via HTTP HEAD request.
 */
async function checkUrl(url: string, timeout: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Find duplicate badges by type.
 */
function findDuplicates(badges: Badge[]): ValidationResult[] {
  const results: ValidationResult[] = [];
  const seen = new Map<string, number>();

  for (const badge of badges) {
    const count = seen.get(badge.type) ?? 0;
    seen.set(badge.type, count + 1);
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
