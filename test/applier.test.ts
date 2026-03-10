import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	applyBadges,
	buildDryRunReport,
	checkBadges,
	doctorBadges,
	initBadges,
	listBadges,
	mergeBadgesWithExisting,
	repairBadges,
} from "../src/applier.js";
import type { Config } from "../src/types.js";
import { DEFAULT_CONFIG } from "../src/config.js";

const FIXTURES = resolve(import.meta.dirname, "fixtures");
const TMP = resolve(import.meta.dirname, ".tmp-applier");

function copyFixture(name: string): string {
	const src = resolve(FIXTURES, name);
	const dest = resolve(TMP, name);
	cpSync(src, dest, { recursive: true });
	return dest;
}

function makeConfig(overrides: Partial<Config> = {}): Config {
	return { ...DEFAULT_CONFIG, ...overrides };
}

beforeEach(() => {
	if (existsSync(TMP)) rmSync(TMP, { recursive: true });
	mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
	if (existsSync(TMP)) rmSync(TMP, { recursive: true });
});

describe("applier", () => {
	describe("applyBadges", () => {
		it("applies badges to JavaScript project README", async () => {
			const cwd = copyFixture("javascript-project");
			// Set up git remote for the fixture
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			const result = await applyBadges(cwd, config);

			expect(result.applied).toBeGreaterThan(0);
			expect(result.changed).toBe(true);

			// Verify README was updated
			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			expect(readme).toContain("img.shields.io/npm/v/my-awesome-lib");
			expect(readme).toContain("<!-- BADGES:START -->");
			expect(readme).toContain("<!-- BADGES:END -->");
		});

		it("applies badges to Python project README", async () => {
			const cwd = copyFixture("python-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-python-tool.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			const result = await applyBadges(cwd, config);

			expect(result.applied).toBeGreaterThan(0);
			expect(result.changed).toBe(true);

			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			expect(readme).toContain("img.shields.io/pypi/v/my-python-tool");
			expect(readme).toContain("pypi.org/project/my-python-tool");
		});

		it("applies badges to Rust project README", async () => {
			const cwd = copyFixture("rust-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-rust-crate.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			const result = await applyBadges(cwd, config);

			expect(result.applied).toBeGreaterThan(0);
			expect(result.changed).toBe(true);

			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			expect(readme).toContain("img.shields.io/crates/v/my-rust-crate");
			expect(readme).toContain("crates.io/crates/my-rust-crate");
		});

		it("applies badges to multi-ecosystem project", async () => {
			const cwd = copyFixture("multi-ecosystem");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/fullstack-app.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			const result = await applyBadges(cwd, config);
			expect(result.applied).toBeGreaterThan(0);

			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			// Should have both npm and pypi badges
			expect(readme).toContain("img.shields.io/npm/v/fullstack-app");
			expect(readme).toContain("img.shields.io/pypi/v/fullstack-backend");
		});

		it("reports no changes when badges are up to date", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();

			// Apply once
			await applyBadges(cwd, config);
			// Apply again
			const result = await applyBadges(cwd, config);
			expect(result.changed).toBe(false);
		});

		it("does not write file in dry-run mode", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const readmeBefore = readFileSync(resolve(cwd, "README.md"), "utf-8");
			const config = makeConfig();
			await applyBadges(cwd, config, { dryRun: true });
			const readmeAfter = readFileSync(resolve(cwd, "README.md"), "utf-8");
			expect(readmeAfter).toBe(readmeBefore);
		});

		it("throws when README is missing", async () => {
			await expect(applyBadges(TMP, makeConfig())).rejects.toThrow(
				"README file not found",
			);
		});

		it("throws when no ecosystem files found", async () => {
			const cwd = copyFixture("minimal-project");
			await expect(applyBadges(cwd, makeConfig())).rejects.toThrow(
				"No recognizable ecosystem",
			);
		});

		it("applies badges to a targeted monorepo package README", async () => {
			const cwd = resolve(TMP, "monorepo-target-apply");
			mkdirSync(resolve(cwd, "packages", "pkg-a"), { recursive: true });
			mkdirSync(resolve(cwd, "packages", "pkg-b"), { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ workspaces: ["packages/*"] }),
			);
			writeFileSync(
				resolve(cwd, "packages", "pkg-a", "package.json"),
				JSON.stringify({ name: "pkg-a" }),
			);
			writeFileSync(
				resolve(cwd, "packages", "pkg-b", "package.json"),
				JSON.stringify({ name: "pkg-b" }),
			);
			writeFileSync(
				resolve(cwd, "packages", "pkg-a", "README.md"),
				"<!-- BADGES:START -->\n<!-- BADGES:END -->\n",
			);
			writeFileSync(
				resolve(cwd, "packages", "pkg-b", "README.md"),
				"<!-- BADGES:START -->\n<!-- BADGES:END -->\n",
			);

			const result = await applyBadges(cwd, makeConfig(), {}, "packages/pkg-a");

			expect(result.changed).toBe(true);
			const pkgAReadme = readFileSync(
				resolve(cwd, "packages", "pkg-a", "README.md"),
				"utf-8",
			);
			const pkgBReadme = readFileSync(
				resolve(cwd, "packages", "pkg-b", "README.md"),
				"utf-8",
			);
			expect(pkgAReadme).toContain("img.shields.io/npm/v/pkg-a");
			expect(pkgBReadme).not.toContain("img.shields.io/npm/v/pkg-a");
		});
	});

	describe("checkBadges", () => {
		it("returns inSync=true when badges match", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			// Apply first
			await applyBadges(cwd, config);
			// Check
			const result = await checkBadges(cwd, config);
			expect(result.inSync).toBe(true);
		});

		it("returns inSync=false when badges differ", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			// Don't apply — empty block vs expected badges
			const result = await checkBadges(cwd, config);
			expect(result.inSync).toBe(false);
			expect(result.expected).not.toBe("");
			expect(result.current).toBe("");
		});

		it("throws when README is missing", async () => {
			await expect(checkBadges(TMP, makeConfig())).rejects.toThrow(
				"README file not found",
			);
		});

		it("throws when badge block markers are missing", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			// Overwrite README without badge markers
			writeFileSync(
				resolve(cwd, "README.md"),
				"# No Badge Markers\nJust content.",
			);

			await expect(checkBadges(cwd, makeConfig())).rejects.toThrow(
				"Badge block markers not found",
			);
		});

		it("checks a targeted monorepo package README", async () => {
			const cwd = resolve(TMP, "monorepo-target-check");
			mkdirSync(resolve(cwd, "packages", "pkg-a"), { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ workspaces: ["packages/*"] }),
			);
			writeFileSync(
				resolve(cwd, "packages", "pkg-a", "package.json"),
				JSON.stringify({ name: "pkg-a" }),
			);
			writeFileSync(
				resolve(cwd, "packages", "pkg-a", "README.md"),
				"<!-- BADGES:START -->\n<!-- BADGES:END -->\n",
			);

			await applyBadges(cwd, makeConfig(), {}, "packages/pkg-a");
			const result = await checkBadges(cwd, makeConfig(), "packages/pkg-a");

			expect(result.inSync).toBe(true);
		});
	});
	describe("doctorBadges", () => {
		it("throws when README is missing", async () => {
			await expect(doctorBadges(TMP, makeConfig())).rejects.toThrow(
				"README file not found",
			);
		});

		it("returns empty issues for healthy project with mocked fetch", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			// First apply badges so doctor has something to validate
			const config = makeConfig();
			await applyBadges(cwd, config);

			// Mock fetch to return ok for all URLs
			const mockFetch = vi.fn().mockResolvedValue({ ok: true });
			vi.stubGlobal("fetch", mockFetch);

			try {
				const result = await doctorBadges(cwd, config, { timeout: 1000 });
				expect(result.issues).toHaveLength(0);
			} finally {
				vi.unstubAllGlobals();
			}
		});

		it("returns issues when badge URLs are broken", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			await applyBadges(cwd, config);

			// Mock fetch to return not-ok for all URLs
			const mockFetch = vi.fn().mockResolvedValue({ ok: false });
			vi.stubGlobal("fetch", mockFetch);

			try {
				const result = await doctorBadges(cwd, config, { timeout: 1000 });
				expect(result.issues.length).toBeGreaterThan(0);
			} finally {
				vi.unstubAllGlobals();
			}
		});

		it("validates the current README badges rather than regenerated badges", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			writeFileSync(
				resolve(cwd, "README.md"),
				[
					"# My Awesome Lib",
					"",
					"<!-- BADGES:START -->",
					"[![license](https://img.shields.io/github/license/other/repo)](https://github.com/other/repo/blob/main/LICENSE)",
					"<!-- BADGES:END -->",
					"",
				].join("\n"),
			);

			const mockFetch = vi.fn().mockResolvedValue({ ok: true });
			vi.stubGlobal("fetch", mockFetch);

			try {
				const result = await doctorBadges(cwd, makeConfig(), { timeout: 1000 });
				expect(
					result.issues.some((issue) => issue.issue === "mismatched-repo"),
				).toBe(true);
			} finally {
				vi.unstubAllGlobals();
			}
		});

		it("throws when README exists but has no badge markers", async () => {
			const cwd = resolve(TMP, "doctor-no-markers");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "test-pkg" }),
			);
			writeFileSync(
				resolve(cwd, "README.md"),
				"# My Project\n\nNo badge markers here.\n",
			);

			await expect(
				doctorBadges(cwd, makeConfig(), { timeout: 1000 }),
			).rejects.toThrow("Badge block markers not found");
		});
	});

	describe("repairBadges", () => {
		it("throws when README is missing", async () => {
			await expect(repairBadges(TMP, makeConfig())).rejects.toThrow(
				"README file not found",
			);
		});

		it("returns no fixes when project is healthy", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			await applyBadges(cwd, config);

			const mockFetch = vi.fn().mockResolvedValue({ ok: true });
			vi.stubGlobal("fetch", mockFetch);

			try {
				const result = await repairBadges(cwd, config, { timeout: 1000 });
				expect(result.fixed).toHaveLength(0);
				expect(result.remaining).toHaveLength(0);
				expect(result.applied).toBe(false);
			} finally {
				vi.unstubAllGlobals();
			}
		});

		it("repairs fixable issues", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			await applyBadges(cwd, config);

			// Mock fetch to return broken image on first call series, then ok
			const mockFetch = vi.fn().mockResolvedValue({ ok: false });
			vi.stubGlobal("fetch", mockFetch);

			try {
				const result = await repairBadges(cwd, config, { timeout: 1000 });
				// Should have found fixable issues (broken-image)
				expect(result.fixed.length).toBeGreaterThan(0);
				expect(result.applied).toBe(true);
			} finally {
				vi.unstubAllGlobals();
			}
		});

		it("does not write in dry-run mode", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			await applyBadges(cwd, config);
			const readmeBefore = readFileSync(resolve(cwd, "README.md"), "utf-8");

			const mockFetch = vi.fn().mockResolvedValue({ ok: false });
			vi.stubGlobal("fetch", mockFetch);

			try {
				const result = await repairBadges(cwd, config, {
					dryRun: true,
					timeout: 1000,
				});
				const readmeAfter = readFileSync(resolve(cwd, "README.md"), "utf-8");
				expect(readmeAfter).toBe(readmeBefore);
				expect(result.applied).toBe(false);
			} finally {
				vi.unstubAllGlobals();
			}
		});

		it("returns only remaining issues when none are fixable", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			await applyBadges(cwd, config);

			// Mock fetch to return ok for image URLs (shields.io and github.com)
			// but broken for link URLs (npmjs.com, etc.)
			// This produces only broken-link issues which are fixable: false
			const mockFetch = vi.fn().mockImplementation((url: string) => {
				if (url.includes("img.shields.io") || url.includes("badge.svg")) {
					return Promise.resolve({ ok: true });
				}
				return Promise.resolve({ ok: false });
			});
			vi.stubGlobal("fetch", mockFetch);

			try {
				const result = await repairBadges(cwd, config, { timeout: 1000 });
				expect(result.fixed).toHaveLength(0);
				expect(result.remaining.length).toBeGreaterThan(0);
				expect(result.applied).toBe(false);
			} finally {
				vi.unstubAllGlobals();
			}
		});

		it("throws when README has no badge markers", async () => {
			const cwd = resolve(TMP, "repair-no-markers");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "test-pkg" }),
			);
			writeFileSync(
				resolve(cwd, "README.md"),
				"# My Project\n\nNo badge markers here.\n",
			);

			await expect(
				repairBadges(cwd, makeConfig(), { timeout: 1000 }),
			).rejects.toThrow("Badge block markers not found");
		});
	});

	describe("initBadges", () => {
		it("inserts markers and applies badges when README has no markers", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			writeFileSync(
				resolve(cwd, "README.md"),
				"# My Awesome Lib\n\nA great JavaScript library.\n",
				"utf-8",
			);

			const result = await initBadges(cwd, makeConfig());

			expect(result.markersInserted).toBe(true);
			expect(result.badgesApplied).toBeGreaterThan(0);

			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			expect(readme).toContain("<!-- BADGES:START -->");
			expect(readme).toContain("<!-- BADGES:END -->");
			expect(readme).toContain("img.shields.io/npm/v/my-awesome-lib");
		});

		it("returns already-exists result when markers are present", async () => {
			const cwd = copyFixture("javascript-project");
			const before = readFileSync(resolve(cwd, "README.md"), "utf-8");

			const result = await initBadges(cwd, makeConfig());

			expect(result.markersAlreadyExist).toBe(true);
			expect(result.markersInserted).toBe(false);
			expect(result.badgesApplied).toBe(0);

			const after = readFileSync(resolve(cwd, "README.md"), "utf-8");
			expect(after).toBe(before);
		});

		it("supports markers-only mode", async () => {
			const cwd = copyFixture("javascript-project");
			writeFileSync(
				resolve(cwd, "README.md"),
				"# My Awesome Lib\n\nA great JavaScript library.\n",
				"utf-8",
			);

			const result = await initBadges(cwd, makeConfig(), { markersOnly: true });

			expect(result.markersInserted).toBe(true);
			expect(result.badgesApplied).toBe(0);

			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			expect(readme).toContain("<!-- BADGES:START -->");
			expect(readme).toContain("<!-- BADGES:END -->");
			expect(readme).not.toContain("img.shields.io/npm/v/my-awesome-lib");
		});

		it("migrates existing markdown badges into markers during init", async () => {
			const cwd = resolve(TMP, "init-migration-markdown");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "README.md"),
				"# My Project\n\n[![badge](https://example.com/badge.svg)](https://example.com)\n\nSome content\n",
				"utf-8",
			);

			await initBadges(cwd, makeConfig(), { markersOnly: true });

			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			expect(readme).toContain("<!-- BADGES:START -->");
			expect(readme).toContain("<!-- BADGES:END -->");
			const startIdx = readme.indexOf("<!-- BADGES:START -->");
			const endIdx = readme.indexOf("<!-- BADGES:END -->");
			const badgeIdx = readme.indexOf(
				"[![badge](https://example.com/badge.svg)](https://example.com)",
			);
			expect(badgeIdx).toBeGreaterThan(startIdx);
			expect(badgeIdx).toBeLessThan(endIdx);
			const afterEnd = readme.slice(endIdx);
			expect(afterEnd).not.toContain("[![badge]");
		});

		it("migrates existing HTML badges into markers during init", async () => {
			const cwd = resolve(TMP, "init-migration-html");
			mkdirSync(cwd, { recursive: true });
			const htmlBadge =
				'<a href="https://example.com"><img src="https://example.com/badge.svg" alt="badge" /></a>';
			writeFileSync(
				resolve(cwd, "README.md"),
				`# My Project\n\n${htmlBadge}\n\nSome content\n`,
				"utf-8",
			);

			await initBadges(cwd, makeConfig(), { markersOnly: true });

			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			const startIdx = readme.indexOf("<!-- BADGES:START -->");
			const endIdx = readme.indexOf("<!-- BADGES:END -->");
			const badgeIdx = readme.indexOf(htmlBadge);
			expect(badgeIdx).toBeGreaterThan(startIdx);
			expect(badgeIdx).toBeLessThan(endIdx);
			const afterEnd = readme.slice(endIdx);
			expect(afterEnd).not.toContain("https://example.com/badge.svg");
		});

		it("creates README when missing", async () => {
			const cwd = resolve(TMP, "brand-new-project");
			mkdirSync(cwd, { recursive: true });

			const result = await initBadges(cwd, makeConfig(), { markersOnly: true });

			expect(result.readmeCreated).toBe(true);
			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			expect(readme).toContain("# brand-new-project");
			expect(readme).toContain("<!-- BADGES:START -->");
			expect(readme).toContain("<!-- BADGES:END -->");
		});

		it("inserts markers after the first heading", async () => {
			const cwd = resolve(TMP, "heading-insertion");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "README.md"),
				"Intro text\n\n# Project Title\n\nDetails\n",
				"utf-8",
			);

		await initBadges(cwd, makeConfig(), { markersOnly: true });

		const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
		const headingIndex = readme.indexOf("# Project Title");
		const startIndex = readme.indexOf("<!-- BADGES:START -->");
		const endIndex = readme.indexOf("<!-- BADGES:END -->");
		const detailsIndex = readme.indexOf("Details");
		expect(headingIndex).toBeGreaterThan(-1);
		expect(startIndex).toBeGreaterThan(headingIndex);
		expect(endIndex).toBeGreaterThan(startIndex);
		expect(detailsIndex).toBeGreaterThan(endIndex);
	});

		it("inserts markers at top when no heading exists", async () => {
			const cwd = resolve(TMP, "no-heading");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "README.md"),
				"No heading here\nMore text\n",
				"utf-8",
			);

			await initBadges(cwd, makeConfig(), { markersOnly: true });

			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			expect(
				readme.startsWith("<!-- BADGES:START -->\n<!-- BADGES:END -->\n\n"),
			).toBe(true);
		});

		it("does not duplicate badges when init runs on README with existing overlapping badges", async () => {
			const cwd = resolve(TMP, "init-overlap-test");
			mkdirSync(cwd, { recursive: true });

			writeFileSync(
				resolve(cwd, "pyproject.toml"),
				'[project]\nname = "my-python-tool"\nrequires-python = ">=3.9"\n',
				"utf-8",
			);

			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-python-tool.git",
				{ cwd, stdio: "pipe" },
			);

			writeFileSync(resolve(cwd, "LICENSE"), "MIT License\n", "utf-8");

			const existingReadme = [
				"# my-python-tool",
				"",
				'[![PyPI](https://img.shields.io/pypi/v/my-python-tool.svg)](https://pypi.org/project/my-python-tool/)',
				'[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)',
				"",
				"A great Python tool.",
				"",
			].join("\n");
			writeFileSync(resolve(cwd, "README.md"), existingReadme, "utf-8");

			const result = await initBadges(cwd, makeConfig());
			expect(result.badgesApplied).toBeGreaterThanOrEqual(0);

			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");

			const badgeLines = readme.split("\n").filter(
				(line) => line.includes("![") && /licen[cs]e/i.test(line),
			);
			expect(badgeLines.length).toBeLessThanOrEqual(1);

			const pypiLines = readme
				.split("\n")
				.filter((line) => line.includes("![") && line.includes("/pypi/v/"));
			expect(pypiLines.length).toBeLessThanOrEqual(1);

			expect(readme).toContain("<!-- BADGES:START -->");
			expect(readme).toContain("<!-- BADGES:END -->");
		});

		it("preserves truly custom badges (pre-commit, docs) during init with overlap", async () => {
			const cwd = resolve(TMP, "init-preserve-custom");
			mkdirSync(cwd, { recursive: true });

			writeFileSync(
				resolve(cwd, "pyproject.toml"),
				'[project]\nname = "my-tool"\nrequires-python = ">=3.9"\n',
				"utf-8",
			);

			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync("git remote add origin https://github.com/testuser/my-tool.git", {
				cwd,
				stdio: "pipe",
			});

			writeFileSync(resolve(cwd, "LICENSE"), "MIT License\n", "utf-8");

			const existingReadme = [
				"# my-tool",
				"",
				'[![PyPI](https://img.shields.io/pypi/v/my-tool.svg)](https://pypi.org/project/my-tool/)',
				'[![pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen?logo=pre-commit)](https://pre-commit.com/)',
				'[![Docs](https://img.shields.io/badge/docs-gh--pages-blue)](https://testuser.github.io/my-tool/)',
				'[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)',
				"",
				"A great tool.",
				"",
			].join("\n");
			writeFileSync(resolve(cwd, "README.md"), existingReadme, "utf-8");

			await initBadges(cwd, makeConfig());

			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");

			expect(readme).toContain("pre--commit-enabled-brightgreen");
			expect(readme).toContain("docs-gh--pages-blue");

			const pypiLines = readme
				.split("\n")
				.filter((line) => line.includes("![") && line.includes("/pypi/v/"));
			expect(pypiLines.length).toBeLessThanOrEqual(1);
		});

		it("supports --dry-run option without modifying files", async () => {
			const cwd = resolve(TMP, "init-dry-run");
			mkdirSync(cwd, { recursive: true });

			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "test-pkg", version: "1.0.0" }),
				"utf-8",
			);

			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync("git remote add origin https://github.com/testuser/test-pkg.git", {
				cwd,
				stdio: "pipe",
			});

			writeFileSync(resolve(cwd, "LICENSE"), "MIT License\n", "utf-8");

			const existingReadme = "# test-pkg\n\nA test package.\n";
			writeFileSync(resolve(cwd, "README.md"), existingReadme, "utf-8");

			const result = await initBadges(cwd, makeConfig(), { dryRun: true });

			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			expect(readme).toBe(existingReadme);

			expect(result.badgesApplied).toBeGreaterThan(0);
			expect(result.badges.length).toBeGreaterThan(0);
			expect(result.markersInserted).toBe(false);
			expect(result.readmeCreated).toBe(false);
		});
	});

	describe("badge preservation (Conservative by Default)", () => {
		it("preserves custom badges when applying auto-detected badges", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();

			// First apply to get auto-detected badges
			await applyBadges(cwd, config);

			// Now manually add a custom badge to the block
			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			const customBadge =
				"[![custom](https://example.com/badge.svg)](https://example.com)";
			const updatedReadme = readme.replace(
				"<!-- BADGES:END -->",
				`${customBadge}\n<!-- BADGES:END -->`,
			);
			writeFileSync(resolve(cwd, "README.md"), updatedReadme);

			// Apply again — custom badge should be preserved
			await applyBadges(cwd, config);

			const finalReadme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			expect(finalReadme).toContain(customBadge);
			expect(finalReadme).toContain("img.shields.io/npm/v/my-awesome-lib");
		});

		it("preserves custom badges during repair", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();

			// Apply auto-detected badges
			await applyBadges(cwd, config);

			// Add a custom badge
			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			const customBadge =
				"[![custom](https://example.com/badge.svg)](https://example.com)";
			const updatedReadme = readme.replace(
				"<!-- BADGES:END -->",
				`${customBadge}\n<!-- BADGES:END -->`,
			);
			writeFileSync(resolve(cwd, "README.md"), updatedReadme);

			// Mock fetch to return broken for some badges (triggers repair)
			const mockFetch = vi.fn().mockResolvedValue({ ok: false });
			vi.stubGlobal("fetch", mockFetch);

			try {
				await repairBadges(cwd, config, { timeout: 1000 });
				const finalReadme = readFileSync(resolve(cwd, "README.md"), "utf-8");
				expect(finalReadme).toContain(customBadge);
			} finally {
				vi.unstubAllGlobals();
			}
		});

		it("check includes custom badges in expected output", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();

			// Apply, then add custom badge, then apply again to normalize
			await applyBadges(cwd, config);
			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			const customBadge =
				"[![custom](https://example.com/badge.svg)](https://example.com)";
			const updatedReadme = readme.replace(
				"<!-- BADGES:END -->",
				`${customBadge}\n<!-- BADGES:END -->`,
			);
			writeFileSync(resolve(cwd, "README.md"), updatedReadme);

			// Apply again — normalizes the block with custom badge preserved
			await applyBadges(cwd, config);

			// Check should report inSync=true since block matches expected (auto + custom)
			const result = await checkBadges(cwd, config);
			expect(result.inSync).toBe(true);
		});
	});

	describe("listBadges", () => {
		it("returns monorepo packages and root badges", async () => {
			const cwd = resolve(TMP, "monorepo-list");
			mkdirSync(resolve(cwd, "packages", "pkg-a"), { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "root", workspaces: ["packages/*"] }),
			);
			writeFileSync(
				resolve(cwd, "packages", "pkg-a", "package.json"),
				JSON.stringify({ name: "pkg-a" }),
			);

			const result = await listBadges(cwd, makeConfig());

			expect(result.isMonorepo).toBe(true);
			expect(result.packages).toEqual([
				{ name: "pkg-a", path: "packages/pkg-a", ecosystem: "javascript" },
			]);
			expect(result.badges.some((badge) => badge.type === "npm-version")).toBe(
				true,
			);
		});
	});

	describe("mergeBadgesWithExisting", () => {
		it("returns formatted when current block is empty", () => {
			const result = mergeBadgesWithExisting("badge1\nbadge2", "", []);
			expect(result).toBe("badge1\nbadge2");
		});

		it("returns formatted when no existing badges match pattern", () => {
			const result = mergeBadgesWithExisting("badge1", "not a badge line", []);
			expect(result).toBe("badge1");
		});

		it("preserves custom badges not in auto-detected set", () => {
			const autoDetected = [
				{
					type: "npm-version",
					group: "distribution" as const,
					label: "npm",
					imageUrl: "https://img.shields.io/npm/v/pkg",
					linkUrl: "https://npmjs.com/package/pkg",
				},
			];
			const formatted =
				"[![npm](https://img.shields.io/npm/v/pkg)](https://npmjs.com/package/pkg)";
			const current = [
				"[![npm](https://img.shields.io/npm/v/pkg)](https://npmjs.com/package/pkg)",
				"[![custom](https://example.com/badge.svg)](https://example.com)",
			].join("\n");

			const result = mergeBadgesWithExisting(formatted, current, autoDetected);
			expect(result).toContain(
				"[![npm](https://img.shields.io/npm/v/pkg)](https://npmjs.com/package/pkg)",
			);
			expect(result).toContain(
				"[![custom](https://example.com/badge.svg)](https://example.com)",
			);
		});

		it("does not duplicate auto-detected badges", () => {
			const autoDetected = [
				{
					type: "npm-version",
					group: "distribution" as const,
					label: "npm",
					imageUrl: "https://img.shields.io/npm/v/pkg",
					linkUrl: "https://npmjs.com/package/pkg",
				},
			];
			const formatted =
				"[![npm](https://img.shields.io/npm/v/pkg)](https://npmjs.com/package/pkg)";
			const current =
				"[![npm](https://img.shields.io/npm/v/pkg)](https://npmjs.com/package/pkg)";

			const result = mergeBadgesWithExisting(formatted, current, autoDetected);
			const npmCount = (result.match(/img\.shields\.io\/npm\/v\/pkg/g) ?? [])
				.length;
			expect(npmCount).toBe(1);
		});

		it("handles empty formatted with custom badges only", () => {
			const current =
				"[![custom](https://example.com/badge.svg)](https://example.com)";
			const result = mergeBadgesWithExisting("", current, []);
			expect(result).toBe(
				"[![custom](https://example.com/badge.svg)](https://example.com)",
			);
		});

		it("replaces stale managed badges instead of preserving them as custom", () => {
			const autoDetected = [
				{
					type: "license",
					group: "metadata" as const,
					label: "license",
					imageUrl: "https://img.shields.io/github/license/new/repo",
					linkUrl: "https://github.com/new/repo/blob/main/LICENSE",
				},
			];
			const formatted =
				"[![license](https://img.shields.io/github/license/new/repo)](https://github.com/new/repo/blob/main/LICENSE)";
			const current =
				"[![license](https://img.shields.io/github/license/old/repo)](https://github.com/old/repo/blob/main/LICENSE)";

			const result = mergeBadgesWithExisting(formatted, current, autoDetected);
			expect(result).toBe(formatted);
		});
	});

	describe("buildDryRunReport", () => {
		it("categorizes badges as new when README has empty badge block", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			const report = await buildDryRunReport(cwd, config);

			expect(report.total).toBeGreaterThan(0);
			expect(report.newCount).toBe(report.total);
			expect(report.updatedCount).toBe(0);
			expect(report.unchangedCount).toBe(0);
			expect(report.entries.every((e) => e.marker === "+")).toBe(true);
			expect(report.customBadges).toHaveLength(0);
		});

		it("categorizes badges as unchanged after apply", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			await applyBadges(cwd, config);
			const report = await buildDryRunReport(cwd, config);

			expect(report.total).toBeGreaterThan(0);
			expect(report.newCount).toBe(0);
			expect(report.updatedCount).toBe(0);
			expect(report.unchangedCount).toBe(report.total);
			expect(report.entries.every((e) => e.marker === "=")).toBe(true);
		});

		it("detects custom badges in badge block", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			await applyBadges(cwd, config);

			// Add a custom badge
			const readme = readFileSync(resolve(cwd, "README.md"), "utf-8");
			const customBadge =
				"[![custom](https://example.com/badge.svg)](https://example.com)";
			const updatedReadme = readme.replace(
				"<!-- BADGES:END -->",
				`${customBadge}\n<!-- BADGES:END -->`,
			);
			writeFileSync(resolve(cwd, "README.md"), updatedReadme);

			const report = await buildDryRunReport(cwd, config);

			expect(report.customBadges).toHaveLength(1);
			expect(report.customBadges[0].label).toBe("custom");
		});

		it("handles missing badge markers gracefully", async () => {
			const cwd = resolve(TMP, "dryrun-no-markers");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "test-pkg" }),
			);
			writeFileSync(
				resolve(cwd, "README.md"),
				"# Test\n\nNo markers here\n",
			);

			const config = makeConfig();
			const report = await buildDryRunReport(cwd, config);

			// Should still return a report (all badges are new)
			expect(report.total).toBeGreaterThan(0);
			expect(report.newCount).toBe(report.total);
		});

		it("rethrows non-marker, non-ENOENT errors", async () => {
			// Use a path that will cause an error other than marker/ENOENT
			const cwd = resolve(TMP, "dryrun-rethrow");
			mkdirSync(cwd, { recursive: true });
			writeFileSync(
				resolve(cwd, "package.json"),
				JSON.stringify({ name: "test-pkg" }),
			);
			// Create README.md as a directory to trigger a read error
			mkdirSync(resolve(cwd, "README.md"), { recursive: true });

			const config = makeConfig();
			await expect(buildDryRunReport(cwd, config)).rejects.toThrow();
		});

		it("categorizes badges as updated when label or linkUrl differs", async () => {
			const cwd = copyFixture("javascript-project");
			const { execSync } = await import("node:child_process");
			execSync("git init", { cwd, stdio: "pipe" });
			execSync(
				"git remote add origin https://github.com/testuser/my-awesome-lib.git",
				{ cwd, stdio: "pipe" },
			);

			const config = makeConfig();
			await applyBadges(cwd, config);

			// Modify badge label in README to simulate a changed badge
			const readmePath = resolve(cwd, "README.md");
			const readme = readFileSync(readmePath, "utf-8");
			const modified = readme.replace("npm version", "NPM VERSION MODIFIED");
			writeFileSync(readmePath, modified, "utf-8");

			const report = await buildDryRunReport(cwd, config);

			expect(report.updatedCount).toBeGreaterThan(0);
			expect(report.entries.some((e) => e.marker === "~")).toBe(true);
		});
	});
});
