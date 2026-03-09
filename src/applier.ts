import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { detectMetadata } from './detector.js';
import { resolveBadges } from './resolver.js';
import { formatBadges } from './formatter.js';
import { validateBadges } from './validator.js';
import { readBadgeBlock, writeBadgeBlock, parseExistingBadges } from './readme.js';
import type { Config, Badge, ValidationResult } from './types.js';

/** Result from the apply command */
export interface ApplyResult {
  applied: number;
  badges: Badge[];
  changed: boolean;
}

/** Result from the check command */
export interface CheckResult {
  inSync: boolean;
  expected: string;
  current: string;
}

/** Result from the doctor command */
export interface DoctorResult {
  issues: ValidationResult[];
}

/** Result from the repair command */
export interface RepairResult {
  fixed: ValidationResult[];
  remaining: ValidationResult[];
  applied: boolean;
}

/**
 * Execute the `apply` command.
 * Detects metadata, resolves badges, formats them, and writes to README.
 * Preserves user-added custom badges that are not auto-detected.
 */
export async function applyBadges(
  cwd: string,
  config: Config,
  options: { dryRun?: boolean } = {},
): Promise<ApplyResult> {
  const readmePath = resolve(cwd, config.readme);

  if (!existsSync(readmePath)) {
    throw new Error(`README file not found: ${readmePath}`);
  }

  const metadata = await detectMetadata(cwd);

  if (metadata.ecosystem.length === 0) {
    throw new Error('No recognizable ecosystem files found. Cannot detect badges.');
  }

  const badges = resolveBadges(metadata);
  const formatted = formatBadges(badges, config);

  // Read current badge block to check if changes are needed
  let currentBlock: string;
  try {
    currentBlock = await readBadgeBlock(readmePath);
  } catch {
    throw new Error(
      `Badge block markers not found in ${config.readme}. Add these markers to your README:\n<!-- BADGES:START -->\n<!-- BADGES:END -->`,
    );
  }

  // Merge auto-detected badges with existing custom badges
  const merged = mergeBadgesWithExisting(formatted, currentBlock, badges);

  const changed = currentBlock !== merged;

  if (!options.dryRun && changed) {
    await writeBadgeBlock(readmePath, merged);
  }

  return {
    applied: badges.length,
    badges,
    changed,
  };
}

/**
 * Execute the `check` command.
 * Compares expected badges against current README content.
 * Expected includes both auto-detected and preserved custom badges.
 */
export async function checkBadges(cwd: string, config: Config): Promise<CheckResult> {
  const readmePath = resolve(cwd, config.readme);

  if (!existsSync(readmePath)) {
    throw new Error(`README file not found: ${readmePath}`);
  }

  const metadata = await detectMetadata(cwd);
  const badges = resolveBadges(metadata);
  const formatted = formatBadges(badges, config);

  let current: string;
  try {
    current = await readBadgeBlock(readmePath);
  } catch {
    throw new Error(
      `Badge block markers not found in ${config.readme}. Add these markers to your README:\n<!-- BADGES:START -->\n<!-- BADGES:END -->`,
    );
  }

  // Expected = auto-detected badges merged with custom badges from current block
  const expected = mergeBadgesWithExisting(formatted, current, badges);

  return {
    inSync: current === expected,
    expected,
    current,
  };
}

/**
 * Execute the `doctor` command.
 * Validates badge URLs and cross-references.
 */
export async function doctorBadges(
  cwd: string,
  config: Config,
  options: { timeout?: number } = {},
): Promise<DoctorResult> {
  const readmePath = resolve(cwd, config.readme);

  if (!existsSync(readmePath)) {
    throw new Error(`README file not found: ${readmePath}`);
  }

  const metadata = await detectMetadata(cwd);
  const badges = resolveBadges(metadata);
  const issues = await validateBadges(badges, cwd, { timeout: options.timeout });

  return { issues };
}

/**
 * Execute the `repair` command.
 * Diagnoses issues and attempts to fix them automatically.
 * Preserves user-added custom badges that are not auto-detected.
 */
export async function repairBadges(
  cwd: string,
  config: Config,
  options: { dryRun?: boolean; timeout?: number } = {},
): Promise<RepairResult> {
  const readmePath = resolve(cwd, config.readme);

  if (!existsSync(readmePath)) {
    throw new Error(`README file not found: ${readmePath}`);
  }

  // Run doctor first
  const { issues } = await doctorBadges(cwd, config, { timeout: options.timeout });

  if (issues.length === 0) {
    return { fixed: [], remaining: [], applied: false };
  }

  const fixable = issues.filter((i) => i.fixable);
  const remaining = issues.filter((i) => !i.fixable);

  if (fixable.length === 0) {
    return { fixed: [], remaining, applied: false };
  }

  // Re-detect and resolve to get fresh badges (this is the "repair")
  const metadata = await detectMetadata(cwd);
  const badges = resolveBadges(metadata);

  // Remove duplicates among auto-detected badges
  const seen = new Set<string>();
  const deduplicated = badges.filter((b) => {
    if (seen.has(b.type)) return false;
    seen.add(b.type);
    return true;
  });

  const formatted = formatBadges(deduplicated, config);

  // Read current block and merge to preserve custom badges
  let currentBlock = '';
  try {
    currentBlock = await readBadgeBlock(readmePath);
  } catch {
    // If no badge block markers, just write the formatted badges
  }

  const merged = mergeBadgesWithExisting(formatted, currentBlock, deduplicated);

  if (!options.dryRun) {
    await writeBadgeBlock(readmePath, merged);
  }

  return {
    fixed: fixable,
    remaining,
    applied: !options.dryRun,
  };
}

/**
 * Merge auto-detected badges with existing badge block content.
 * Preserves user-added custom badges that are not auto-detected.
 *
 * Strategy:
 * 1. Parse existing badge lines from the current block
 * 2. Identify which existing badges match auto-detected ones (by image URL)
 * 3. Start with the formatted auto-detected badges
 * 4. Append any existing badges not matched by auto-detection (custom badges)
 */
export function mergeBadgesWithExisting(
  formattedAutoDetected: string,
  currentBlock: string,
  autoDetectedBadges: Badge[],
): string {
  // If current block is empty, no custom badges to preserve
  if (currentBlock.trim() === '') {
    return formattedAutoDetected;
  }

  const existingParsed = parseExistingBadges(currentBlock);

  // If no existing badges parsed, nothing to preserve
  if (existingParsed.length === 0) {
    return formattedAutoDetected;
  }

  // Build a set of auto-detected badge image URLs for matching
  const autoDetectedImageUrls = new Set(
    autoDetectedBadges.map((b) => b.imageUrl),
  );

  // Find custom badges: existing badges whose image URL doesn't match any auto-detected badge
  const customBadges = existingParsed.filter(
    (existing) => !autoDetectedImageUrls.has(existing.imageUrl),
  );

  // If no custom badges, return just the auto-detected formatted output
  if (customBadges.length === 0) {
    return formattedAutoDetected;
  }

  // Append custom badges after auto-detected badges
  const customLines = customBadges.map((b) => b.raw);
  if (formattedAutoDetected.trim() === '') {
    return customLines.join('\n');
  }

  return `${formattedAutoDetected}\n${customLines.join('\n')}`;
}
