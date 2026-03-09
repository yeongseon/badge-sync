import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	detectMetadata,
	isUtilityWorkflow,
	UTILITY_WORKFLOW_PATTERNS,
} from "../src/detector.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");

beforeEach(() => {
	if (existsSync(TMP_DETECTOR)) rmSync(TMP_DETECTOR, { recursive: true });
	mkdirSync(TMP_DETECTOR, { recursive: true });
});

afterEach(() => {
	if (existsSync(TMP_DETECTOR)) rmSync(TMP_DETECTOR, { recursive: true });
});
const TMP_DETECTOR = resolve(import.meta.dirname, ".tmp-detector");

function copyFixture(name: string): string {
	const src = resolve(FIXTURES, name);
	const dest = resolve(TMP_DETECTOR, name);
	cpSync(src, dest, { recursive: true });
	return dest;
}

describe("detector", () => {
	describe("JavaScript/TypeScript project", () => {
		const cwd = resolve(FIXTURES, "javascript-project");

		it("detects javascript ecosystem", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.ecosystem).toContain("javascript");
		});

		it("extracts package name from package.json", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.packageName).toBe("my-awesome-lib");
		});

		it("extracts node version from engines field", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.nodeVersion).toBe(">=18");
		});

		it("extracts repository URL from package.json", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.repositoryUrl).toBe(
				"https://github.com/testuser/my-awesome-lib.git",
			);
		});

		it("parses owner and repo from repository URL", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.owner).toBe("testuser");
			expect(meta.repo).toBe("my-awesome-lib");
		});

		it("detects MIT license", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.license).toBe("MIT");
		});

		it("detects workflow files", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.workflows).toContain("ci.yml");
		});

		it("excludes utility workflows like stale, labeler, maintenance", async () => {
			const cwd = resolve(TMP_DETECTOR, "workflow-filter");
			mkdirSync(resolve(cwd, ".github", "workflows"), { recursive: true });
			writeFileSync(resolve(cwd, ".github", "workflows", "ci.yml"), "name: CI");
			writeFileSync(resolve(cwd, ".github", "workflows", "test.yml"), "name: Test");
			writeFileSync(resolve(cwd, ".github", "workflows", "stale.yml"), "name: Stale");
			writeFileSync(
				resolve(cwd, ".github", "workflows", "labeler.yml"),
				"name: Labeler",
			);
			writeFileSync(
				resolve(cwd, ".github", "workflows", "maintenance.yml"),
				"name: Maintenance",
			);
			writeFileSync(resolve(cwd, "package.json"), JSON.stringify({ name: "test" }));

			const metadata = await detectMetadata(cwd);
			expect(metadata.workflows).toContain("ci.yml");
			expect(metadata.workflows).toContain("test.yml");
			expect(metadata.workflows).not.toContain("stale.yml");
			expect(metadata.workflows).not.toContain("labeler.yml");
			expect(metadata.workflows).not.toContain("maintenance.yml");
		});

		it("detects coverage tooling from vitest config in fixture project", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.hasCoverage).toBe(true);
			expect(meta.coverageService).toBeNull();
		});

		it("does not detect python or rust", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.ecosystem).not.toContain("python");
			expect(meta.ecosystem).not.toContain("rust");
			expect(meta.pythonVersion).toBeNull();
		});
	});

	describe("Python project", () => {
		const cwd = resolve(FIXTURES, "python-project");

		it("detects python ecosystem", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.ecosystem).toContain("python");
		});

		it("extracts package name from pyproject.toml", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.packageName).toBe("my-python-tool");
		});

		it("extracts python version requirement", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.pythonVersion).toBe(">=3.9");
		});

		it("detects Apache-2.0 license", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.license).toBe("Apache-2.0");
		});

		it("detects multiple workflow files", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.workflows).toHaveLength(2);
			expect(meta.workflows).toContain("lint.yml");
			expect(meta.workflows).toContain("test.yml");
		});
	});

	describe("Rust project", () => {
		const cwd = resolve(FIXTURES, "rust-project");

		it("detects rust ecosystem", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.ecosystem).toContain("rust");
		});

		it("extracts package name from Cargo.toml", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.packageName).toBe("my-rust-crate");
		});

		it("detects workflow files", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.workflows).toContain("rust-ci.yml");
		});

		it("detects MIT license", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.license).toBe("MIT");
		});
	});

	describe("Multi-ecosystem project", () => {
		const cwd = resolve(FIXTURES, "multi-ecosystem");

		it("detects both javascript and python ecosystems", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.ecosystem).toContain("javascript");
			expect(meta.ecosystem).toContain("python");
		});

		it("uses first detected package name (javascript)", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.packageName).toBe("fullstack-app");
		});

		it("extracts node version", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.nodeVersion).toBe(">=20");
		});

		it("extracts python version", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.pythonVersion).toBe(">=3.11");
		});
	});

	describe("Minimal project (no ecosystem files)", () => {
		const cwd = resolve(FIXTURES, "minimal-project");

		it("returns empty ecosystem list", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.ecosystem).toHaveLength(0);
		});

		it("returns null for all metadata fields", async () => {
			const meta = await detectMetadata(cwd);
			expect(meta.packageName).toBeNull();
			expect(meta.coverageService).toBeNull();
			expect(meta.hasCoverage).toBe(false);
			expect(meta.license).toBeNull();
			expect(meta.nodeVersion).toBeNull();
			expect(meta.pythonVersion).toBeNull();
			expect(meta.workflows).toHaveLength(0);
		});
	});

	describe("Edge cases", () => {
		it("exports utility workflow patterns and helper", () => {
			expect(UTILITY_WORKFLOW_PATTERNS).toContain("stale");
			expect(isUtilityWorkflow("dependabot.yml")).toBe(true);
			expect(isUtilityWorkflow("codeql.yml")).toBe(false);
		});

		it("extracts repository URL from package.json string format", async () => {
			const cwd = resolve(TMP_DETECTOR, "string-repo");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({
					name: "string-repo-pkg",
					repository: "https://github.com/owner/string-repo",
				}),
			);
			const meta = await detectMetadata(cwd);
			expect(meta.repositoryUrl).toBe("https://github.com/owner/string-repo");
			expect(meta.owner).toBe("owner");
			expect(meta.repo).toBe("string-repo");
		});

		it("handles invalid JSON in package.json gracefully", async () => {
			const cwd = resolve(TMP_DETECTOR, "invalid-json");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(resolve(cwd, "package.json"), "{ invalid json !!!");
			const meta = await detectMetadata(cwd);
			// Ecosystem is detected (file exists) but no metadata extracted
			expect(meta.ecosystem).toContain("javascript");
			expect(meta.packageName).toBeNull();
		});

		it("parses owner and repo from SSH git remote", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync("git remote add origin git@github.com:sshowner/ssh-repo.git", {
				cwd,
				stdio: "pipe",
			});
			const meta = await detectMetadata(cwd);
			expect(meta.owner).toBe("sshowner");
			expect(meta.repo).toBe("ssh-repo");
		});

		it("populates packageNames per ecosystem", async () => {
			const cwd = resolve(FIXTURES, "multi-ecosystem");
			const meta = await detectMetadata(cwd);
			expect(meta.packageNames.javascript).toBe("fullstack-app");
			expect(meta.packageNames.python).toBe("fullstack-backend");
		});

		it("falls back to python packageName when no JS package", async () => {
			const cwd = resolve(FIXTURES, "python-project");
			const meta = await detectMetadata(cwd);
			expect(meta.packageName).toBe("my-python-tool");
			expect(meta.packageNames.python).toBe("my-python-tool");
		});

		it("populates rust packageNames", async () => {
			const cwd = resolve(FIXTURES, "rust-project");
			const meta = await detectMetadata(cwd);
			expect(meta.packageNames.rust).toBe("my-rust-crate");
		});
	});

	describe("license type detection", () => {
		it("detects GPL-3.0 license", async () => {
			const cwd = resolve(TMP_DETECTOR, "gpl3-project");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "gpl3-pkg" }),
			);
			writeFileSync(
				resolve(cwd, "LICENSE"),
				"GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n",
			);
			const meta = await detectMetadata(cwd);
			expect(meta.license).toBe("GPL-3.0");
		});

		it("detects GPL-2.0 license", async () => {
			const cwd = resolve(TMP_DETECTOR, "gpl2-project");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "gpl2-pkg" }),
			);
			writeFileSync(
				resolve(cwd, "LICENSE"),
				"GNU GENERAL PUBLIC LICENSE\nVersion 2, June 1991\n",
			);
			const meta = await detectMetadata(cwd);
			expect(meta.license).toBe("GPL-2.0");
		});

		it("detects BSD-3-Clause license", async () => {
			const cwd = resolve(TMP_DETECTOR, "bsd3-project");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "bsd3-pkg" }),
			);
			writeFileSync(
				resolve(cwd, "LICENSE"),
				"BSD 3-Clause License\nRedistribution and use in source and binary forms...",
			);
			const meta = await detectMetadata(cwd);
			expect(meta.license).toBe("BSD-3-Clause");
		});

		it("detects BSD-2-Clause license", async () => {
			const cwd = resolve(TMP_DETECTOR, "bsd2-project");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "bsd2-pkg" }),
			);
			writeFileSync(
				resolve(cwd, "LICENSE"),
				"BSD 2-Clause License\nSimplified...",
			);
			const meta = await detectMetadata(cwd);
			expect(meta.license).toBe("BSD-2-Clause");
		});

		it("detects ISC license", async () => {
			const cwd = resolve(TMP_DETECTOR, "isc-project");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "isc-pkg" }),
			);
			writeFileSync(
				resolve(cwd, "LICENSE"),
				"ISC License\nCopyright (c) 2024...",
			);
			const meta = await detectMetadata(cwd);
			expect(meta.license).toBe("ISC");
		});

		it("detects MPL-2.0 license", async () => {
			const cwd = resolve(TMP_DETECTOR, "mpl-project");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "mpl-pkg" }),
			);
			writeFileSync(
				resolve(cwd, "LICENSE"),
				"Mozilla Public License Version 2.0\n",
			);
			const meta = await detectMetadata(cwd);
			expect(meta.license).toBe("MPL-2.0");
		});

		it("detects Unlicense", async () => {
			const cwd = resolve(TMP_DETECTOR, "unlicense-project");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "unlicense-pkg" }),
			);
			writeFileSync(
				resolve(cwd, "LICENSE"),
				"This is free and unencumbered software released into the public domain.\nThe Unlicense",
			);
			const meta = await detectMetadata(cwd);
			expect(meta.license).toBe("Unlicense");
		});

		it("returns null for unrecognized license", async () => {
			const cwd = resolve(TMP_DETECTOR, "unknown-license");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "unknown-pkg" }),
			);
			writeFileSync(
				resolve(cwd, "LICENSE"),
				"Some custom proprietary license terms...",
			);
			const meta = await detectMetadata(cwd);
			expect(meta.license).toBeNull();
		});
	});

	describe("coverage detection", () => {
		it("detects coverage from vitest config", async () => {
			const cwd = resolve(TMP_DETECTOR, "coverage-vitest");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "vitest.config.ts"),
				"export default { test: { coverage: { provider: 'v8' } } };\n",
			);

			const meta = await detectMetadata(cwd);
			expect(meta.hasCoverage).toBe(true);
			expect(meta.coverageService).toBeNull();
		});

		it("detects coverage from jest config", async () => {
			const cwd = resolve(TMP_DETECTOR, "coverage-jest");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(resolve(cwd, "jest.config.js"), "export default {}\n");

			const meta = await detectMetadata(cwd);
			expect(meta.hasCoverage).toBe(true);
			expect(meta.coverageService).toBeNull();
		});

		it("detects coverage from nyc config file", async () => {
			const cwd = resolve(TMP_DETECTOR, "coverage-nyc");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(resolve(cwd, ".nycrc"), '{"all":true}\n');

			const meta = await detectMetadata(cwd);
			expect(meta.hasCoverage).toBe(true);
			expect(meta.coverageService).toBeNull();
		});

		it("detects coverage from package.json scripts", async () => {
			const cwd = resolve(TMP_DETECTOR, "coverage-script");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({
					name: "coverage-script-pkg",
					scripts: {
						"test:coverage": "vitest run --coverage",
					},
				}),
			);

			const meta = await detectMetadata(cwd);
			expect(meta.hasCoverage).toBe(true);
			expect(meta.coverageService).toBeNull();
		});

		it("detects coverage from .coveragerc file", async () => {
			const cwd = resolve(TMP_DETECTOR, "coverage-python");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(resolve(cwd, ".coveragerc"), "[run]\nbranch = True\n");

			const meta = await detectMetadata(cwd);
			expect(meta.hasCoverage).toBe(true);
			expect(meta.coverageService).toBeNull();
		});

		it("detects codecov coverage service", async () => {
			const cwd = resolve(TMP_DETECTOR, "coverage-codecov");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "codecov.yml"),
				"coverage:\n  status:\n    project: default\n",
			);

			const meta = await detectMetadata(cwd);
			expect(meta.hasCoverage).toBe(true);
			expect(meta.coverageService).toBe("codecov");
		});

		it("detects coveralls coverage service", async () => {
			const cwd = resolve(TMP_DETECTOR, "coverage-coveralls");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(resolve(cwd, ".coveralls.yml"), "repo_token: token\n");

			const meta = await detectMetadata(cwd);
			expect(meta.hasCoverage).toBe(true);
			expect(meta.coverageService).toBe("coveralls");
		});

		it("does not detect coverage when no coverage files exist", async () => {
			const cwd = resolve(TMP_DETECTOR, "coverage-none");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "no-coverage-pkg" }),
			);

			const meta = await detectMetadata(cwd);
			expect(meta.hasCoverage).toBe(false);
			expect(meta.coverageService).toBeNull();
		});
	});

	describe("monorepo detection", () => {
		it("detects npm workspaces monorepo", async () => {
			const cwd = resolve(TMP_DETECTOR, "npm-workspaces-monorepo");
			mkdirSync(resolve(cwd, "packages", "pkg-a"), { recursive: true });
			mkdirSync(resolve(cwd, "packages", "pkg-b"), { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "root", workspaces: ["packages/*"] }),
			);
			writeFileSync(
				resolve(cwd, "packages", "pkg-a", "package.json"),
				JSON.stringify({ name: "@scope/pkg-a" }),
			);
			writeFileSync(
				resolve(cwd, "packages", "pkg-b", "package.json"),
				JSON.stringify({ name: "@scope/pkg-b" }),
			);

			const meta = await detectMetadata(cwd);

			expect(meta.isMonorepo).toBe(true);
			expect(meta.packages).toHaveLength(2);
			expect(meta.packages).toEqual(
				expect.arrayContaining([
					{
						name: "@scope/pkg-a",
						path: "packages/pkg-a",
						ecosystem: "javascript",
					},
					{
						name: "@scope/pkg-b",
						path: "packages/pkg-b",
						ecosystem: "javascript",
					},
				]),
			);
		});

		it("detects pnpm workspaces monorepo", async () => {
			const cwd = resolve(TMP_DETECTOR, "pnpm-workspaces-monorepo");
			mkdirSync(resolve(cwd, "packages", "pkg-a"), { recursive: true });
			writeFileSync(
				resolve(cwd, "pnpm-workspace.yaml"),
				"packages:\n  - packages/*\n",
			);
			writeFileSync(
				resolve(cwd, "packages", "pkg-a", "package.json"),
				JSON.stringify({ name: "pkg-a" }),
			);

			const meta = await detectMetadata(cwd);

			expect(meta.isMonorepo).toBe(true);
			expect(meta.packages).toHaveLength(1);
			expect(meta.packages[0]).toEqual({
				name: "pkg-a",
				path: "packages/pkg-a",
				ecosystem: "javascript",
			});
		});

		it("detects lerna monorepo", async () => {
			const cwd = resolve(TMP_DETECTOR, "lerna-monorepo");
			mkdirSync(resolve(cwd, "modules", "core-lib"), { recursive: true });
			writeFileSync(
				resolve(cwd, "lerna.json"),
				JSON.stringify({ packages: ["modules/*"] }),
			);
			writeFileSync(
				resolve(cwd, "modules", "core-lib", "package.json"),
				JSON.stringify({ name: "core-lib" }),
			);

			const meta = await detectMetadata(cwd);

			expect(meta.isMonorepo).toBe(true);
			expect(meta.packages).toEqual([
				{ name: "core-lib", path: "modules/core-lib", ecosystem: "javascript" },
			]);
		});

		it("returns non-monorepo fields for normal project", async () => {
			const cwd = resolve(FIXTURES, "javascript-project");
			const meta = await detectMetadata(cwd);

			expect(meta.isMonorepo).toBe(false);
			expect(meta.packages).toEqual([]);
		});

		it("detects multiple ecosystems across monorepo packages", async () => {
			const cwd = resolve(TMP_DETECTOR, "multi-ecosystem-monorepo");
			mkdirSync(resolve(cwd, "packages", "js-pkg"), { recursive: true });
			mkdirSync(resolve(cwd, "packages", "py-pkg"), { recursive: true });
			mkdirSync(resolve(cwd, "packages", "rust-pkg"), { recursive: true });

			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ workspaces: ["packages/*"] }),
			);
			writeFileSync(
				resolve(cwd, "packages", "js-pkg", "package.json"),
				JSON.stringify({ name: "@scope/js-pkg" }),
			);
			writeFileSync(
				resolve(cwd, "packages", "py-pkg", "pyproject.toml"),
				'[project]\nname = "py-pkg"\n',
			);
			writeFileSync(
				resolve(cwd, "packages", "rust-pkg", "Cargo.toml"),
				'[package]\nname = "rust-pkg"\n',
			);

			const meta = await detectMetadata(cwd);

			expect(meta.isMonorepo).toBe(true);
			expect(meta.packages).toEqual(
				expect.arrayContaining([
					{
						name: "@scope/js-pkg",
						path: "packages/js-pkg",
						ecosystem: "javascript",
					},
					{ name: "py-pkg", path: "packages/py-pkg", ecosystem: "python" },
					{ name: "rust-pkg", path: "packages/rust-pkg", ecosystem: "rust" },
				]),
			);
		});
	});
});
