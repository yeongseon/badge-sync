export interface MigrationRule {
	name: string;
	description: string;
	/** Test if this rule applies to a parsed badge */
	matches: (badge: {
		label: string;
		imageUrl: string;
		linkUrl: string;
	}) => boolean;
	/** Return the migrated badge, or null if it should be removed */
	migrate: (
		badge: {
			label: string;
			imageUrl: string;
			linkUrl: string;
		},
		context: MigrationContext,
	) => MigratedBadge | null;
}

export interface MigrationContext {
	owner: string | null;
	repo: string | null;
	workflows: string[];
}

export interface MigratedBadge {
	label: string;
	imageUrl: string;
	linkUrl: string;
}

export interface MigrationResult {
	original: { label: string; imageUrl: string; linkUrl: string; raw: string };
	migrated: MigratedBadge | null;
	rule: string;
	description: string;
}

function buildGithubActionsBadge(
	badge: { label: string; imageUrl: string; linkUrl: string },
	context: MigrationContext,
): MigratedBadge | null {
	const workflow = context.workflows[0];
	if (!workflow || !context.owner || !context.repo) {
		return null;
	}

	const base = `https://github.com/${context.owner}/${context.repo}/actions/workflows/${workflow}`;
	return {
		label: badge.label,
		imageUrl: `${base}/badge.svg`,
		linkUrl: base,
	};
}

function normalizeShieldsPath(url: string): string {
	let normalized = url.replace(/^http:\/\//i, "https://");

	let parsed: URL;
	try {
		parsed = new URL(normalized);
	} catch {
		return normalized;
	}

	if (parsed.hostname === "img.shields.io" || parsed.hostname === "shields.io") {
		parsed.protocol = "https:";
		parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
		normalized = parsed.toString();
	}

	return normalized;
}

function normalizeUrl(url: string): string {
	return normalizeShieldsPath(url).replace(/^http:\/\//i, "https://");
}

function isSameBadge(
	left: { label: string; imageUrl: string; linkUrl: string } | null,
	right: { label: string; imageUrl: string; linkUrl: string } | null,
): boolean {
	if (!left && !right) {
		return true;
	}

	if (!left || !right) {
		return false;
	}

	return (
		left.label === right.label
		&& left.imageUrl === right.imageUrl
		&& left.linkUrl === right.linkUrl
	);
}

export const MIGRATION_RULES: MigrationRule[] = [
	{
		name: "travis-to-github-actions",
		description:
			"Travis CI is deprecated for many open source projects; migrate to GitHub Actions.",
		matches: (badge) =>
			badge.imageUrl.includes("travis-ci.org")
			|| badge.imageUrl.includes("travis-ci.com")
			|| badge.linkUrl.includes("travis-ci.org")
			|| badge.linkUrl.includes("travis-ci.com"),
		migrate: (badge, context) => buildGithubActionsBadge(badge, context),
	},
	{
		name: "circleci-to-github-actions",
		description:
			"CircleCI badges should be replaced with GitHub Actions badges for repository-native CI.",
		matches: (badge) =>
			badge.imageUrl.includes("circleci.com") || badge.linkUrl.includes("circleci.com"),
		migrate: (badge, context) => buildGithubActionsBadge(badge, context),
	},
	{
		name: "remove-david-dm",
		description:
			"david-dm.org is defunct and its dependency status badges should be removed.",
		matches: (badge) =>
			badge.imageUrl.includes("david-dm.org") || badge.linkUrl.includes("david-dm.org"),
		migrate: () => null,
	},
	{
		name: "shields-license-modernize",
		description:
			"Legacy Shields license badge format should use the github/license endpoint.",
		matches: (badge) => /img\.shields\.io\/badge\/license-/iu.test(badge.imageUrl),
		migrate: (badge, context) => {
			if (!context.owner || !context.repo) {
				return badge;
			}

			return {
				label: badge.label,
				imageUrl: `https://img.shields.io/github/license/${context.owner}/${context.repo}`,
				linkUrl: `https://github.com/${context.owner}/${context.repo}/blob/main/LICENSE`,
			};
		},
	},
];

export function detectMigrations(
	badges: Array<{ label: string; imageUrl: string; linkUrl: string; raw: string }>,
	context: MigrationContext,
	options: { normalize?: boolean } = {},
): MigrationResult[] {
	const migrations: MigrationResult[] = [];

	for (const original of badges) {
		let migrated: MigratedBadge | null = {
			label: original.label,
			imageUrl: original.imageUrl,
			linkUrl: original.linkUrl,
		};
		let appliedRule: MigrationRule | null = null;

		for (const rule of MIGRATION_RULES) {
			if (!rule.matches(original)) {
				continue;
			}

			appliedRule = rule;
			migrated = rule.migrate(migrated, context);
			break;
		}

		if (options.normalize && migrated) {
			migrated = {
				label: migrated.label,
				imageUrl: normalizeUrl(migrated.imageUrl),
				linkUrl: normalizeUrl(migrated.linkUrl),
			};
		}

		const changed = !isSameBadge(migrated, {
			label: original.label,
			imageUrl: original.imageUrl,
			linkUrl: original.linkUrl,
		});

		if (!changed) {
			continue;
		}

		if (appliedRule) {
			migrations.push({
				original,
				migrated,
				rule: appliedRule.name,
				description: appliedRule.description,
			});
			continue;
		}

		migrations.push({
			original,
			migrated,
			rule: "normalize-urls",
			description: "Normalized badge URLs to canonical https format.",
		});
	}

	return migrations;
}
