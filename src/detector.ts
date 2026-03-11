import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import fg from "fast-glob";
import { parse as parseYaml } from "yaml";
import type { MonorepoPackage, RepositoryMetadata } from "./types.js";

interface CoverageDetection {
	hasCoverage: boolean;
	coverageService: string | null;
}

/**
 * @deprecated Use CI_WORKFLOW_PATTERNS and isCIWorkflow instead.
 */
export const UTILITY_WORKFLOW_PATTERNS = [
	"stale",
	"labeler",
	"label-sync",
	"greetings",
	"welcome",
	"lock",
	"auto-merge",
	"automerge",
	"dependabot",
	"renovate",
	"maintenance",
	"cleanup",
	"close-issues",
	"assign",
] as const;

/**
 * @deprecated Use isCIWorkflow instead.
 */
export function isUtilityWorkflow(filename: string): boolean {
	const name = filename.replace(/\.(yml|yaml)$/, "").toLowerCase();
	return UTILITY_WORKFLOW_PATTERNS.some((pattern) => name.includes(pattern));
}

/**
 * Allowlist patterns for CI workflows that should generate badges.
 * Only workflows matching these patterns will produce build badges.
 * This is deliberately conservative - most workflows (releases, bots,
 * security scans, docs, etc.) are NOT suitable as CI status badges.
 */
export const CI_WORKFLOW_PATTERNS = [
	"ci",
	"test",
	"tests",
	"build",
	"lint",
	"check",
	"e2e",
	"integration",
	"unit-test",
	"unit-tests",
	"typecheck",
	"type-check",
] as const;

/**
 * Check if a workflow filename matches CI patterns that should generate badges.
 * Uses segment matching (split by - and _) to avoid substring false positives.
 * Examples:
 *   "ci.yml" -> true (exact match)
 *   "build_and_test.yml" -> true (contains "build" and "test" segments)
 *   "run-ci.yml" -> true (contains "ci" segment)
 *   "update-sponsor-block.yml" -> false (no CI segments)
 *   "create-cherry-pick-pr.yml" -> false
 */
export function isCIWorkflow(filename: string): boolean {
	const name = filename.replace(/\.(yml|yaml)$/, "").toLowerCase();
	const segments = name.split(/[-_]/);
	return CI_WORKFLOW_PATTERNS.some((pattern) => segments.includes(pattern));
}

/**
 * Auto-detect the README filename by scanning common variants.
 * Returns the first match found, defaults to "README.md".
 */
export function detectReadmeFile(cwd: string): string {
	const candidates = [
		"README.md",
		"Readme.md",
		"readme.md",
		"README.rst",
		"readme.rst",
	];

	try {
		const entries = new Map(
			readdirSync(cwd).map((entry) => [entry.toLowerCase(), entry]),
		);
		for (const name of candidates) {
			const actual = entries.get(name.toLowerCase());
			if (actual) {
				return actual;
			}
		}
	} catch {
		// Fall back to direct existence checks when directory listing fails.
	}

	for (const name of candidates) {
		if (existsSync(join(cwd, name))) {
			return name;
		}
	}
	return "README.md";
}

/**
 * Parse a TOML-like file for basic key-value extraction.
 * This is a minimal parser sufficient for pyproject.toml and Cargo.toml.
 */
function extractTomlValue(content: string, key: string): string | null {
	// Match key = "value" or key = 'value'
	const regex = new RegExp(
		`^\\s*${key.replace(".", "\\.")}\\s*=\\s*["']([^"']*)["']`,
		"m",
	);
	const match = content.match(regex);
	return match?.[1] ?? null;
}

/**
 * Parse TOML section header and extract values within that section.
 */
function extractTomlSectionValue(
	content: string,
	section: string,
	key: string,
): string | null {
	const sectionRegex = new RegExp(`^\\[${section.replace(".", "\\.")}\\]`, "m");
	const sectionMatch = content.match(sectionRegex);
	if (!sectionMatch || sectionMatch.index === undefined) return null;

	const afterSection = content.slice(
		sectionMatch.index + sectionMatch[0].length,
	);
	// Stop at next section header
	const nextSection = afterSection.match(/^\[/m);
	const sectionContent =
		nextSection?.index !== undefined
			? afterSection.slice(0, nextSection.index)
			: afterSection;

	return extractTomlValue(sectionContent, key);
}

/**
 * Parse git remote URL to extract owner and repo.
 * Supports:
 *   - https://github.com/owner/repo.git
 *   - https://github.com/owner/repo
 *   - git@github.com:owner/repo.git
 */
function parseGitRemote(url: string): { owner: string; repo: string } | null {
	// HTTPS format
	const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
	if (httpsMatch) {
		return { owner: httpsMatch[1], repo: httpsMatch[2] };
	}

	// SSH format
	const sshMatch = url.match(/github\.com:([^/]+)\/([^/.]+)/);
	if (sshMatch) {
		return { owner: sshMatch[1], repo: sshMatch[2] };
	}

	return null;
}

/**
 * Detect the SPDX license identifier from LICENSE file content.
 */
function detectLicenseType(content: string): string | null {
	const normalized = content.toLowerCase();

	if (
		normalized.includes("mit license") ||
		normalized.includes("permission is hereby granted, free of charge")
	) {
		return "MIT";
	}
	if (
		normalized.includes("apache license") &&
		normalized.includes("version 2.0")
	) {
		return "Apache-2.0";
	}
	if (
		normalized.includes("gnu general public license") &&
		normalized.includes("version 3")
	) {
		return "GPL-3.0";
	}
	if (
		normalized.includes("gnu general public license") &&
		normalized.includes("version 2")
	) {
		return "GPL-2.0";
	}
	if (
		normalized.includes("bsd 3-clause") ||
		normalized.includes("redistribution and use in source and binary forms")
	) {
		return "BSD-3-Clause";
	}
	if (normalized.includes("bsd 2-clause")) {
		return "BSD-2-Clause";
	}
	if (normalized.includes("isc license")) {
		return "ISC";
	}
	if (
		normalized.includes("mozilla public license") &&
		normalized.includes("2.0")
	) {
		return "MPL-2.0";
	}
	if (normalized.includes("the unlicense")) {
		return "Unlicense";
	}

	return null;
}

/**
 * Detect repository metadata by scanning files in the given directory.
 * Returns partial metadata — never throws for missing optional files.
 */
export async function detectMetadata(cwd: string): Promise<RepositoryMetadata> {
	const metadata: RepositoryMetadata = {
		ecosystem: [],
		packageName: null,
		packageNames: {},
		isMonorepo: false,
		packages: [],
		coverageService: null,
		hasCoverage: false,
		repositoryUrl: null,
		owner: null,
		repo: null,
		license: null,
		workflows: [],
		nodeVersion: null,
		pythonVersion: null,
		goVersion: null,
	};

	// Detect ecosystems and package metadata in parallel
	const [
		packageJson,
		pyprojectToml,
		cargoToml,
		goMod,
		workflows,
		licenseContent,
		gitRemote,
		coverage,
		monorepo,
	] = await Promise.all([
		readFileSafe(join(cwd, "package.json")),
		readFileSafe(join(cwd, "pyproject.toml")),
		readFileSafe(join(cwd, "Cargo.toml")),
		readFileSafe(join(cwd, "go.mod")),
		detectWorkflows(cwd),
		detectLicense(cwd),
		detectGitRemote(cwd),
		detectCoverage(cwd),
		detectMonorepo(cwd),
	]);

	metadata.hasCoverage = coverage.hasCoverage;
	metadata.coverageService = coverage.coverageService;
	metadata.isMonorepo = monorepo.isMonorepo;
	metadata.packages = monorepo.packages;

	// JavaScript / TypeScript
	if (packageJson) {
		metadata.ecosystem.push("javascript");
		try {
			const pkg = JSON.parse(packageJson) as Record<string, unknown>;
			const isPrivate = pkg.private === true;
			if (!isPrivate && typeof pkg.name === "string") {
				metadata.packageName = pkg.name;
				metadata.packageNames.javascript = pkg.name;
			}
			if (
				pkg.engines &&
				typeof pkg.engines === "object" &&
				pkg.engines !== null &&
				"node" in pkg.engines &&
				typeof (pkg.engines as Record<string, unknown>).node === "string"
			) {
				metadata.nodeVersion = (pkg.engines as Record<string, string>).node;
			}
			// Try to get repository URL from package.json
			if (pkg.repository) {
				if (typeof pkg.repository === "string") {
					metadata.repositoryUrl = pkg.repository;
				} else if (
					typeof pkg.repository === "object" &&
					pkg.repository !== null &&
					"url" in pkg.repository &&
					typeof (pkg.repository as Record<string, unknown>).url === "string"
				) {
					metadata.repositoryUrl = (
						pkg.repository as Record<string, string>
					).url;
				}
			}
		} catch {
			// Invalid JSON — ecosystem detected but no metadata extracted
		}
	}

	// Python
	if (pyprojectToml) {
		metadata.ecosystem.push("python");
		const name = extractTomlSectionValue(pyprojectToml, "project", "name");
		if (name) {
			metadata.packageNames.python = name;
			if (!metadata.packageName) {
				metadata.packageName = name;
			}
		}
		const pythonVersion = extractTomlSectionValue(
			pyprojectToml,
			"project",
			"requires-python",
		);
		if (pythonVersion) {
			metadata.pythonVersion = pythonVersion;
		}
	}

	// Rust
	if (cargoToml) {
		metadata.ecosystem.push("rust");
		const name = extractTomlSectionValue(cargoToml, "package", "name");
		if (name) {
			metadata.packageNames.rust = name;
			if (!metadata.packageName) {
				metadata.packageName = name;
			}
		}
	}

	// Go
	if (goMod) {
		metadata.ecosystem.push("go");
		const moduleMatch = goMod.match(/^module\s+(.+)$/m);
		if (moduleMatch) {
			const moduleName = moduleMatch[1].trim();
			metadata.packageNames.go = moduleName;
			if (!metadata.packageName) {
				metadata.packageName = moduleName;
			}
		}
		const goVersionMatch = goMod.match(/^go\s+(\S+)$/m);
		if (goVersionMatch) {
			metadata.goVersion = goVersionMatch[1];
		}
	}
	// Workflows
	metadata.workflows = workflows;

	// License
	if (licenseContent) {
		metadata.license = detectLicenseType(licenseContent);
	}

	// Git remote
	if (gitRemote) {
		if (!metadata.repositoryUrl) {
			metadata.repositoryUrl = gitRemote;
		}
		const parsed = parseGitRemote(gitRemote);
		if (parsed) {
			metadata.owner = parsed.owner;
			metadata.repo = parsed.repo;
		}
	}

	// Also try to parse owner/repo from repositoryUrl if git remote didn't provide it
	if (!metadata.owner && metadata.repositoryUrl) {
		const parsed = parseGitRemote(metadata.repositoryUrl);
		if (parsed) {
			metadata.owner = parsed.owner;
			metadata.repo = parsed.repo;
		}
	}

	return metadata;
}

export async function detectMonorepo(
	cwd: string,
): Promise<{ isMonorepo: boolean; packages: MonorepoPackage[] }> {
	const [rootPackageJson, pnpmWorkspaceYaml, lernaJson, cargoToml] =
		await Promise.all([
		readFileSafe(join(cwd, "package.json")),
		readFileSafe(join(cwd, "pnpm-workspace.yaml")),
		readFileSafe(join(cwd, "lerna.json")),
		readFileSafe(join(cwd, "Cargo.toml")),
	]);

	const workspacePatterns = new Set<string>();

	const packageJsonData = parseJsonObject(rootPackageJson);
	const packageJsonWorkspaces = parsePackageJsonWorkspaces(packageJsonData);
	for (const pattern of packageJsonWorkspaces) workspacePatterns.add(pattern);

	const pnpmPatterns = parseWorkspaceYamlPatterns(pnpmWorkspaceYaml);
	for (const pattern of pnpmPatterns) workspacePatterns.add(pattern);

	const lernaPatterns = parseLernaPatterns(lernaJson);
	for (const pattern of lernaPatterns) workspacePatterns.add(pattern);

	const cargoMembers = parseCargoWorkspaceMembers(cargoToml);
	for (const pattern of cargoMembers) workspacePatterns.add(pattern);

	if (workspacePatterns.size === 0) {
		return { isMonorepo: false, packages: [] };
	}

	const packageDirs = await fg([...workspacePatterns], {
		cwd,
		onlyDirectories: true,
		unique: true,
		ignore: ["**/node_modules/**"],
	});

	const packages = (
		await Promise.all(
			packageDirs.map(async (packageDir) =>
				detectMonorepoPackage(cwd, packageDir),
			),
		)
	)
		.filter((pkg): pkg is MonorepoPackage => pkg !== null)
		.sort((a, b) => a.path.localeCompare(b.path));

	return {
		isMonorepo: true,
		packages,
	};
}

async function detectMonorepoPackage(
	cwd: string,
	packageDir: string,
): Promise<MonorepoPackage | null> {
	const packagePath = join(cwd, packageDir);
	const [packageJson, pyprojectToml, cargoToml, goMod] = await Promise.all([
		readFileSafe(join(packagePath, "package.json")),
		readFileSafe(join(packagePath, "pyproject.toml")),
		readFileSafe(join(packagePath, "Cargo.toml")),
		readFileSafe(join(packagePath, "go.mod")),
	]);

	const normalizedPath = packageDir.replaceAll("\\", "/");
	const fallbackName = basename(normalizedPath);

	if (packageJson !== null) {
		const parsed = parseJsonObject(packageJson);
		const packageName =
			parsed !== null && typeof parsed.name === "string"
				? parsed.name
				: fallbackName;
		return {
			name: packageName,
			path: normalizedPath,
			ecosystem: "javascript",
		};
	}

	if (pyprojectToml !== null) {
		const packageName =
			extractTomlSectionValue(pyprojectToml, "project", "name") ?? fallbackName;
		return {
			name: packageName,
			path: normalizedPath,
			ecosystem: "python",
		};
	}

	if (cargoToml !== null) {
		const packageName =
			extractTomlSectionValue(cargoToml, "package", "name") ?? fallbackName;
		return {
			name: packageName,
			path: normalizedPath,
			ecosystem: "rust",
		};
	}

	if (goMod !== null) {
		const moduleMatch = goMod.match(/^module\s+(.+)$/m);
		const packageName = moduleMatch ? moduleMatch[1].trim() : fallbackName;
		return {
			name: packageName,
			path: normalizedPath,
			ecosystem: "go",
		};
	}

	return null;
}

function parsePackageJsonWorkspaces(
	packageJsonObject: Record<string, unknown> | null,
): string[] {
	if (packageJsonObject === null || !("workspaces" in packageJsonObject)) {
		return [];
	}

	const workspaces = packageJsonObject.workspaces;
	if (Array.isArray(workspaces)) {
		return workspaces.filter(
			(entry): entry is string => typeof entry === "string",
		);
	}

	if (
		typeof workspaces === "object" &&
		workspaces !== null &&
		"packages" in workspaces
	) {
		const packages = (workspaces as Record<string, unknown>).packages;
		if (Array.isArray(packages)) {
			return packages.filter(
				(entry): entry is string => typeof entry === "string",
			);
		}
	}

	return [];
}

function parseWorkspaceYamlPatterns(workspaceYaml: string | null): string[] {
	if (workspaceYaml === null) return [];

	try {
		const parsed = parseYaml(workspaceYaml) as unknown;
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			!("packages" in parsed)
		) {
			return [];
		}
		const packages = (parsed as Record<string, unknown>).packages;
		if (!Array.isArray(packages)) {
			return [];
		}
		return packages.filter(
			(entry): entry is string => typeof entry === "string",
		);
	} catch {
		return [];
	}
}

function parseLernaPatterns(lernaJson: string | null): string[] {
	const parsed = parseJsonObject(lernaJson);
	if (
		parsed === null ||
		!("packages" in parsed) ||
		!Array.isArray(parsed.packages)
	) {
		return [];
	}
	return parsed.packages.filter(
		(entry): entry is string => typeof entry === "string",
	);
}

function parseCargoWorkspaceMembers(cargoToml: string | null): string[] {
	if (cargoToml === null) return [];

	const workspaceSectionMatch = cargoToml.match(/^\[workspace\]/m);
	if (!workspaceSectionMatch || workspaceSectionMatch.index === undefined) {
		return [];
	}

	const afterSection = cargoToml.slice(
		workspaceSectionMatch.index + workspaceSectionMatch[0].length,
	);
	const nextSection = afterSection.match(/^\[(?!workspace\.)/m);
	const sectionContent =
		nextSection?.index !== undefined
			? afterSection.slice(0, nextSection.index)
			: afterSection;

	const membersMatch = sectionContent.match(/members\s*=\s*\[([\s\S]*?)\]/);
	if (!membersMatch) return [];

	const membersStr = membersMatch[1];
	const members: string[] = [];
	const entryRegex = /["']([^"']+)["']/g;
	let match: RegExpExecArray | null;
	match = entryRegex.exec(membersStr);
	while (match !== null) {
		members.push(match[1]);
		match = entryRegex.exec(membersStr);
	}

	return members;
}

async function detectCoverage(cwd: string): Promise<CoverageDetection> {
	const hasCodecovConfig =
		existsSync(join(cwd, "codecov.yml")) ||
		existsSync(join(cwd, ".codecov.yml"));
	const hasCoverallsConfig = existsSync(join(cwd, ".coveralls.yml"));

	const coverageService = hasCodecovConfig
		? "codecov"
		: hasCoverallsConfig
			? "coveralls"
			: null;

	const [packageJson, pyprojectToml, pytestIni, setupCfg, vitestTs, vitestJs] =
		await Promise.all([
			readFileSafe(join(cwd, "package.json")),
			readFileSafe(join(cwd, "pyproject.toml")),
			readFileSafe(join(cwd, "pytest.ini")),
			readFileSafe(join(cwd, "setup.cfg")),
			readFileSafe(join(cwd, "vitest.config.ts")),
			readFileSafe(join(cwd, "vitest.config.js")),
		]);

	const hasVitestCoverage = [vitestTs, vitestJs].some(
		(config) => config !== null && /\bcoverage\b/i.test(config),
	);
	const hasJestCoverage =
		(await fg(["jest.config.*"], { cwd, onlyFiles: true, deep: 1 })).length > 0;
	const hasNycCoverage = [
		".nycrc",
		".nycrc.json",
		".nycrc.yml",
		"nyc.config.js",
	].some((file) => existsSync(join(cwd, file)));

	const hasC8ConfigFile = [".c8rc", ".c8rc.json"].some((file) =>
		existsSync(join(cwd, file)),
	);
	const packageJsonObject = parseJsonObject(packageJson);
	const hasC8InPackageJson =
		packageJsonObject !== null &&
		"c8" in packageJsonObject &&
		typeof packageJsonObject.c8 === "object" &&
		packageJsonObject.c8 !== null;

	const scripts = packageJsonObject?.scripts;
	const hasCoverageScript =
		typeof scripts === "object" &&
		scripts !== null &&
		Object.entries(scripts).some(([scriptName, scriptCommand]) => {
			if (typeof scriptCommand !== "string") return false;
			return /coverage/i.test(scriptName) || /coverage/i.test(scriptCommand);
		});

	const hasPytestCoverageInPyproject =
		pyprojectToml !== null &&
		hasTomlSection(pyprojectToml, "tool.pytest.ini_options") &&
		/(--cov\b|\bcoverage\b)/i.test(pyprojectToml);
	const hasPytestCoverageInPytestIni =
		pytestIni !== null &&
		/\[pytest\]/i.test(pytestIni) &&
		/(--cov\b|\bcoverage\b)/i.test(pytestIni);
	const hasPytestCoverageInSetupCfg =
		setupCfg !== null &&
		/\[tool:pytest\]/i.test(setupCfg) &&
		/(--cov\b|\bcoverage\b)/i.test(setupCfg);
	const hasCoverageRc = existsSync(join(cwd, ".coveragerc"));
	const hasCoverageToolSection =
		pyprojectToml !== null && hasTomlSection(pyprojectToml, "tool.coverage");

	const hasTarpaulinConfig =
		existsSync(join(cwd, "tarpaulin.toml")) ||
		existsSync(join(cwd, ".tarpaulin.toml"));
	const workflowFiles = await fg(["*.yml", "*.yaml"], {
		cwd: join(cwd, ".github", "workflows"),
		onlyFiles: true,
		deep: 1,
		suppressErrors: true,
	});
	const workflowContents = await Promise.all(
		workflowFiles.map((workflow) =>
			readFileSafe(join(cwd, ".github", "workflows", workflow)),
		),
	);
	const hasTarpaulinWorkflow = workflowContents.some(
		(content) => content !== null && /cargo(?:-|\s+)tarpaulin/i.test(content),
	);

	const hasCoverageTooling =
		hasVitestCoverage ||
		hasJestCoverage ||
		hasNycCoverage ||
		hasC8ConfigFile ||
		hasC8InPackageJson ||
		hasCoverageScript ||
		hasPytestCoverageInPyproject ||
		hasPytestCoverageInPytestIni ||
		hasPytestCoverageInSetupCfg ||
		hasCoverageRc ||
		hasCoverageToolSection ||
		hasTarpaulinConfig ||
		hasTarpaulinWorkflow;

	return {
		hasCoverage: hasCoverageTooling || hasCodecovConfig || hasCoverallsConfig,
		coverageService,
	};
}

function parseJsonObject(
	content: string | null,
): Record<string, unknown> | null {
	if (content === null) return null;
	try {
		const parsed = JSON.parse(content) as unknown;
		if (typeof parsed === "object" && parsed !== null) {
			return parsed as Record<string, unknown>;
		}
		return null;
	} catch {
		return null;
	}
}

function hasTomlSection(content: string, section: string): boolean {
	const escapedSection = section.replaceAll(".", "\\.");
	const sectionRegex = new RegExp(`^\\[${escapedSection}\\]`, "m");
	return sectionRegex.test(content);
}

async function readFileSafe(filePath: string): Promise<string | null> {
	try {
		return await readFile(filePath, "utf-8");
	} catch {
		return null;
	}
}

async function detectWorkflows(cwd: string): Promise<string[]> {
	const workflowDir = join(cwd, ".github", "workflows");
	if (!existsSync(workflowDir)) {
		return [];
	}

	const files = await fg(["*.yml", "*.yaml"], { cwd: workflowDir });
	return files.filter((file) => isCIWorkflow(file)).sort();
}

async function detectLicense(cwd: string): Promise<string | null> {
	const candidates = [
		"LICENSE",
		"LICENSE.md",
		"LICENSE.txt",
		"LICENCE",
		"LICENCE.md",
	];
	for (const name of candidates) {
		const content = await readFileSafe(join(cwd, name));
		if (content) {
			return content;
		}
	}
	return null;
}

function detectGitRemote(cwd: string): Promise<string | null> {
	// Only run git remote if cwd itself contains a .git directory.
	// Without this check, git walks up the directory tree and may find
	// an unrelated parent repository.
	if (!existsSync(join(cwd, ".git"))) {
		return Promise.resolve(null);
	}

	return new Promise((resolve) => {
		try {
			const result = execSync("git remote get-url origin", {
				cwd,
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
			}).trim();
			resolve(result || null);
		} catch {
			resolve(null);
		}
	});
}
