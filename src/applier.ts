import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { DEFAULT_CACHE_TTL, loadCache, saveCache } from "./cache.js";
import { DEFAULT_CONFIG } from "./config.js";
import { detectMetadata, detectReadmeFile } from "./detector.js";
import { formatBadges } from "./formatter.js";
import {
	hasBadgeBlock,
	insertBadgeMarkers,
	parseExistingBadges,
	readBadgeBlock,
	START_MARKER,
	writeBadgeBlock,
} from "./readme.js";
import { inferBadgeGroup, inferBadgeType, resolveBadges } from "./resolver.js";
import { detectMigrations } from "./migrator.js";
import type { MigrationResult } from "./migrator.js";
import type {
	Badge,
	Config,
	MonorepoPackage,
	ValidationResult,
} from "./types.js";
import { validateBadges } from "./validator.js";

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

/** Result from workspace-wide apply */
export interface WorkspaceApplyResult {
	results: Array<{
		packageName: string;
		packagePath: string;
		result: ApplyResult;
		error?: string;
	}>;
	totalApplied: number;
	totalChanged: number;
}

/** Result from workspace-wide check */
export interface WorkspaceCheckResult {
	results: Array<{
		packageName: string;
		packagePath: string;
		result: CheckResult;
		error?: string;
	}>;
	allInSync: boolean;
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

export interface MigrateResult {
	migrations: MigrationResult[];
	applied: boolean;
}

export interface ListResult {
	isMonorepo: boolean;
	packages: MonorepoPackage[];
	badges: Badge[];
}

export interface InitResult {
	readmeCreated: boolean;
	markersInserted: boolean;
	markersAlreadyExist: boolean;
	badgesApplied: number;
	badges: Badge[];
}

/**
 * Filter badges by config include/exclude rules.
 * Matches the filtering logic used in formatBadges.
 */
function applyBadgeFilters(badges: Badge[], config: Config): Badge[] {
	const exclude = config.badges.exclude ?? [];
	const include = config.badges.include ?? [];
	return badges.filter((badge) => {
		if (include.length > 0 && include.includes(badge.type)) {
			return true;
		}
		return !exclude.includes(badge.type);
	});
}

function resolveReadmePath(
	cwd: string,
	config: Config,
	packageDir?: string,
): string {
	if (packageDir) {
		return resolve(cwd, packageDir, "README.md");
	}

	const readmeFile =
		config.readme === DEFAULT_CONFIG.readme
			? detectReadmeFile(cwd)
			: config.readme;

	return resolve(cwd, readmeFile);
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
	packageDir?: string,
): Promise<ApplyResult> {
	const targetCwd = packageDir ? resolve(cwd, packageDir) : cwd;
	const readmePath = resolveReadmePath(cwd, config, packageDir);

	if (!existsSync(readmePath)) {
		throw new Error(`README file not found: ${readmePath}`);
	}

	const metadata = await detectMetadata(targetCwd);

	if (metadata.ecosystem.length === 0) {
		throw new Error(
			"No recognizable ecosystem files found. Cannot detect badges.",
		);
	}

	const badges = resolveBadges(metadata);
	const formatted = formatBadges(badges, config);

	// Auto-insert markers if missing
	const readmeContent = await readFile(readmePath, 'utf-8');
	if (!hasBadgeBlock(readmeContent)) {
		const updated = insertBadgeMarkers(readmeContent);
		await writeFile(readmePath, updated, 'utf-8');
	}

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
export async function checkBadges(
	cwd: string,
	config: Config,
	packageDir?: string,
): Promise<CheckResult> {
	const targetCwd = packageDir ? resolve(cwd, packageDir) : cwd;
	const readmePath = resolveReadmePath(cwd, config, packageDir);

	if (!existsSync(readmePath)) {
		throw new Error(`README file not found: ${readmePath}`);
	}

	const metadata = await detectMetadata(targetCwd);
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

export async function applyWorkspace(
	cwd: string,
	config: Config,
	options: { dryRun?: boolean } = {},
): Promise<WorkspaceApplyResult> {
	const metadata = await detectMetadata(cwd);
	if (!metadata.isMonorepo || metadata.packages.length === 0) {
		throw new Error(
			"No monorepo packages detected. Use --package <name> for single packages.",
		);
	}

	const results: WorkspaceApplyResult["results"] = [];
	let totalApplied = 0;
	let totalChanged = 0;

	for (const pkg of metadata.packages) {
		try {
			const result = await applyBadges(cwd, config, options, pkg.path);
			results.push({
				packageName: pkg.name,
				packagePath: pkg.path,
				result,
			});
			totalApplied += result.applied;
			if (result.changed) {
				totalChanged += 1;
			}
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Unknown error during apply";
			results.push({
				packageName: pkg.name,
				packagePath: pkg.path,
				result: {
					applied: 0,
					badges: [],
					changed: false,
				},
				error: message,
			});
		}
	}

	return {
		results,
		totalApplied,
		totalChanged,
	};
}

export async function checkWorkspace(
	cwd: string,
	config: Config,
): Promise<WorkspaceCheckResult> {
	const metadata = await detectMetadata(cwd);
	if (!metadata.isMonorepo || metadata.packages.length === 0) {
		throw new Error(
			"No monorepo packages detected. Use --package <name> for single packages.",
		);
	}

	const results: WorkspaceCheckResult["results"] = [];
	let allInSync = true;

	for (const pkg of metadata.packages) {
		try {
			const result = await checkBadges(cwd, config, pkg.path);
			results.push({
				packageName: pkg.name,
				packagePath: pkg.path,
				result,
			});
			if (!result.inSync) {
				allInSync = false;
			}
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Unknown error during check";
			results.push({
				packageName: pkg.name,
				packagePath: pkg.path,
				result: {
					inSync: false,
					expected: "",
					current: "",
				},
				error: message,
			});
			allInSync = false;
		}
	}

	return {
		results,
		allInSync,
	};
}

/**
 * Execute the `doctor` command.
 * Validates badge URLs and cross-references.
 */
export async function doctorBadges(
	cwd: string,
	config: Config,
	options: { timeout?: number; noCache?: boolean; refreshCache?: boolean } = {},
): Promise<DoctorResult> {
	const readmePath = resolveReadmePath(cwd, config);

	if (!existsSync(readmePath)) {
		throw new Error(`README file not found: ${readmePath}`);
	}

	const metadata = await detectMetadata(cwd);
	let currentBlock: string;
	try {
		currentBlock = await readBadgeBlock(readmePath);
	} catch {
		throw new Error(
			`Badge block markers not found in ${config.readme}. Add these markers to your README:\n<!-- BADGES:START -->\n<!-- BADGES:END -->`,
		);
	}

	const badges = parseExistingBadges(currentBlock).map((badge) =>
		toExistingBadgeDefinition(badge),
	);
	const cache = options.noCache
		? undefined
		: options.refreshCache
			? {}
			: await loadCache(cwd);

	const issues = await validateBadges(badges, cwd, {
		timeout: options.timeout,
		expectedOwner: metadata.owner,
		expectedRepo: metadata.repo,
		cache,
		noCache: options.noCache,
		cacheTtl: DEFAULT_CACHE_TTL,
	});

	if (!options.noCache && cache) {
		await saveCache(cwd, cache);
	}

	return { issues };
}

export async function listBadges(
	cwd: string,
	_config: Config,
): Promise<ListResult> {
	const metadata = await detectMetadata(cwd);
	const badges = resolveBadges(metadata);
	return {
		isMonorepo: metadata.isMonorepo,
		packages: metadata.packages,
		badges,
	};
}

export async function migrateBadges(
	cwd: string,
	config: Config,
	options: { dryRun?: boolean; normalize?: boolean } = {},
): Promise<MigrateResult> {
	const readmePath = resolveReadmePath(cwd, config);

	if (!existsSync(readmePath)) {
		throw new Error(`README file not found: ${readmePath}`);
	}

	let currentBlock: string;
	try {
		currentBlock = await readBadgeBlock(readmePath);
	} catch {
		throw new Error(
			`Badge block markers not found in ${config.readme}. Add these markers to your README:\n<!-- BADGES:START -->\n<!-- BADGES:END -->`,
		);
	}

	const existingBadges = parseExistingBadges(currentBlock);
	const metadata = await detectMetadata(cwd);
	const migrations = detectMigrations(
		existingBadges,
		{
			owner: metadata.owner,
			repo: metadata.repo,
			workflows: metadata.workflows,
		},
		{ normalize: options.normalize },
	);

	if (options.dryRun || migrations.length === 0) {
		return { migrations, applied: false };
	}

	const pending = [...migrations];
	const migratedLines: string[] = [];
	for (const badge of existingBadges) {
		const migrationIndex = pending.findIndex(
			(migration) =>
				migration.original.raw === badge.raw
				&& migration.original.label === badge.label
				&& migration.original.imageUrl === badge.imageUrl
				&& migration.original.linkUrl === badge.linkUrl,
		);

		if (migrationIndex === -1) {
			migratedLines.push(badge.raw);
			continue;
		}

		const [migration] = pending.splice(migrationIndex, 1);
		if (!migration.migrated) {
			continue;
		}

		migratedLines.push(
			`[![${migration.migrated.label}](${migration.migrated.imageUrl})](${migration.migrated.linkUrl})`,
		);
	}

	await writeBadgeBlock(readmePath, migratedLines.join("\n"));
	return { migrations, applied: true };
}

/**
 * Execute the `repair` command.
 * Diagnoses issues and attempts to fix them automatically.
 * Preserves user-added custom badges that are not auto-detected.
 */
export async function repairBadges(
	cwd: string,
	config: Config,
	options: {
		dryRun?: boolean;
		timeout?: number;
		noCache?: boolean;
		refreshCache?: boolean;
	} = {},
): Promise<RepairResult> {
	const readmePath = resolveReadmePath(cwd, config);

	if (!existsSync(readmePath)) {
		throw new Error(`README file not found: ${readmePath}`);
	}

	// Run doctor first
	const { issues } = await doctorBadges(cwd, config, {
		timeout: options.timeout,
		noCache: options.noCache,
		refreshCache: options.refreshCache,
	});

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
	let currentBlock = "";
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

export async function initBadges(
	cwd: string,
	config: Config,
	options: { markersOnly?: boolean; dryRun?: boolean } = {},
): Promise<InitResult> {
	const readmePath = resolveReadmePath(cwd, config);
	let readmeCreated = false;

	if (!existsSync(readmePath)) {
		if (options.dryRun) {
			// In dry-run mode, detect badges without creating files
			const metadata = await detectMetadata(cwd);
			const badges = resolveBadges(metadata);
			const filtered = applyBadgeFilters(badges, config);
			return {
				readmeCreated: false,
				markersInserted: false,
				markersAlreadyExist: false,
				badgesApplied: filtered.length,
				badges: filtered,
			};
		}
		const projectName = basename(cwd) || "project";
		await writeFile(readmePath, `# ${projectName}\n\n`, "utf-8");
		readmeCreated = true;
	}

	const content = await readFile(readmePath, "utf-8");
	if (content.includes(START_MARKER)) {
		return {
			readmeCreated,
			markersInserted: false,
			markersAlreadyExist: true,
			badgesApplied: 0,
			badges: [],
		};
	}

	const updatedReadme = insertBadgeMarkers(content);
	if (!options.dryRun) {
		await writeFile(readmePath, updatedReadme, "utf-8");
	}

	if (options.markersOnly) {
		return {
			readmeCreated,
			markersInserted: true,
			markersAlreadyExist: false,
			badgesApplied: 0,
			badges: [],
		};
	}

	if (options.dryRun) {
		const metadata = await detectMetadata(cwd);
		const badges = resolveBadges(metadata);
		const filtered = applyBadgeFilters(badges, config);
		return {
			readmeCreated: false,
			markersInserted: false,
			markersAlreadyExist: false,
			badgesApplied: filtered.length,
			badges: filtered,
		};
	}
	const applyResult = await applyBadges(cwd, config);
	return {
		readmeCreated,
		markersInserted: true,
		markersAlreadyExist: false,
		badgesApplied: applyResult.applied,
		badges: applyResult.badges,
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
	if (currentBlock.trim() === "") {
		return formattedAutoDetected;
	}

	const existingParsed = parseExistingBadges(currentBlock);

	// If no existing badges parsed, nothing to preserve
	if (existingParsed.length === 0) {
		return formattedAutoDetected;
	}

	const autoDetectedImageUrls = new Set(
		autoDetectedBadges.map((badge) => badge.imageUrl),
	);
	const autoDetectedTypes = new Set(
		autoDetectedBadges.map((badge) => badge.type),
	);

	// Preserve only badges that are neither current auto-detected matches nor managed badge types.
	const customBadges = existingParsed.filter((existing) => {
		if (autoDetectedImageUrls.has(existing.imageUrl)) {
			return false;
		}

		const inferredType = inferBadgeType(existing.imageUrl, existing.linkUrl);
		return !inferredType || !autoDetectedTypes.has(inferredType);
	});

	// If no custom badges, return just the auto-detected formatted output
	if (customBadges.length === 0) {
		return formattedAutoDetected;
	}

	// Append custom badges after auto-detected badges
	const customLines = customBadges.map((b) => b.raw);
	if (formattedAutoDetected.trim() === "") {
		return customLines.join("\n");
	}

	return `${formattedAutoDetected}\n${customLines.join("\n")}`;
}

function toExistingBadgeDefinition(existing: {
	label: string;
	imageUrl: string;
	linkUrl: string;
	raw: string;
}): Badge {
	const type = inferBadgeType(existing.imageUrl, existing.linkUrl) ?? "custom";
	return {
		type,
		group: inferBadgeGroup(type),
		label: existing.label,
		imageUrl: existing.imageUrl,
		linkUrl: existing.linkUrl,
	};
}

/** Categorized badge entry for dry-run reporting */
export interface DryRunEntry {
	badge: Badge;
	marker: "+" | "~" | "=";
}

/** Dry-run report data */
export interface DryRunReport {
	total: number;
	newCount: number;
	updatedCount: number;
	unchangedCount: number;
	entries: DryRunEntry[];
	customBadges: Array<{
		label: string;
		imageUrl: string;
		linkUrl: string;
		raw: string;
	}>;
}

/**
 * Build a dry-run report comparing auto-detected badges against the current badge block.
 * Returns structured data that the CLI can format for display.
 */
export async function buildDryRunReport(
	cwd: string,
	config: Config,
	packageDir?: string,
): Promise<DryRunReport> {
	const targetCwd = packageDir ? resolve(cwd, packageDir) : cwd;
	const metadata = await detectMetadata(targetCwd);
	const badges = resolveBadges(metadata);
	const readmePath = resolveReadmePath(cwd, config, packageDir);

	let currentBlock = "";
	try {
		currentBlock = await readBadgeBlock(readmePath);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "";
		const markerError = message.includes("Badge block markers not found");
		const missingReadme = message.includes("ENOENT");
		if (!markerError && !missingReadme) {
			throw error;
		}
	}

	const existingParsed = parseExistingBadges(currentBlock);
	const existingByImageUrl = new Map(
		existingParsed.map((b) => [b.imageUrl, b]),
	);
	const autoImageUrls = new Set(badges.map((b) => b.imageUrl));

	let newCount = 0;
	let updatedCount = 0;
	let unchangedCount = 0;

	const entries: DryRunEntry[] = badges.map((badge) => {
		const existing = existingByImageUrl.get(badge.imageUrl);
		if (!existing) {
			newCount += 1;
			return { badge, marker: "+" as const };
		}

		const changed =
			existing.label !== badge.label || existing.linkUrl !== badge.linkUrl;
		if (changed) {
			updatedCount += 1;
			return { badge, marker: "~" as const };
		}

		unchangedCount += 1;
		return { badge, marker: "=" as const };
	});

	const customBadges = existingParsed.filter(
		(b) => !autoImageUrls.has(b.imageUrl),
	);

	return {
		total: badges.length,
		newCount,
		updatedCount,
		unchangedCount,
		entries,
		customBadges,
	};
}
