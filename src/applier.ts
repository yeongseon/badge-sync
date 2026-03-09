import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { detectMetadata } from './detector.js';
import { resolveBadges } from './resolver.js';
import { formatBadges } from './formatter.js';
import { validateBadges } from './validator.js';
import { readBadgeBlock, writeBadgeBlock, replaceBadgeBlock } from './readme.js';
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

  const changed = currentBlock !== formatted;

  if (!options.dryRun && changed) {
    await writeBadgeBlock(readmePath, formatted);
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
 */
export async function checkBadges(cwd: string, config: Config): Promise<CheckResult> {
  const readmePath = resolve(cwd, config.readme);

  if (!existsSync(readmePath)) {
    throw new Error(`README file not found: ${readmePath}`);
  }

  const metadata = await detectMetadata(cwd);
  const badges = resolveBadges(metadata);
  const expected = formatBadges(badges, config);

  let current: string;
  try {
    current = await readBadgeBlock(readmePath);
  } catch {
    throw new Error(
      `Badge block markers not found in ${config.readme}. Add these markers to your README:\n<!-- BADGES:START -->\n<!-- BADGES:END -->`,
    );
  }

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

  // Remove duplicates
  const seen = new Set<string>();
  const deduplicated = badges.filter((b) => {
    if (seen.has(b.type)) return false;
    seen.add(b.type);
    return true;
  });

  const formatted = formatBadges(deduplicated, config);

  if (!options.dryRun) {
    await writeBadgeBlock(readmePath, formatted);
  }

  return {
    fixed: fixable,
    remaining,
    applied: !options.dryRun,
  };
}
