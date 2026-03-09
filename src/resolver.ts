import type { Badge, RepositoryMetadata } from './types.js';

/**
 * Resolve badges from detected repository metadata.
 * Maps metadata to Badge[] — skips badges when required metadata is insufficient.
 * Never throws.
 */
export function resolveBadges(metadata: RepositoryMetadata): Badge[] {
  const badges: Badge[] = [];

  // Distribution badges
  const jsPackage = metadata.packageNames?.javascript ?? metadata.packageName;
  if (metadata.ecosystem.includes('javascript') && jsPackage) {
    badges.push({
      type: 'npm-version',
      group: 'distribution',
      label: 'npm version',
      imageUrl: `https://img.shields.io/npm/v/${jsPackage}`,
      linkUrl: `https://www.npmjs.com/package/${jsPackage}`,
    });
  }

  const pyPackage = metadata.packageNames?.python ?? metadata.packageName;
  if (metadata.ecosystem.includes('python') && pyPackage) {
    badges.push({
      type: 'pypi-version',
      group: 'distribution',
      label: 'PyPI version',
      imageUrl: `https://img.shields.io/pypi/v/${pyPackage}`,
      linkUrl: `https://pypi.org/project/${pyPackage}`,
    });
  }

  const rustPackage = metadata.packageNames?.rust ?? metadata.packageName;
  if (metadata.ecosystem.includes('rust') && rustPackage) {
    badges.push({
      type: 'crates-version',
      group: 'distribution',
      label: 'crates.io version',
      imageUrl: `https://img.shields.io/crates/v/${rustPackage}`,
      linkUrl: `https://crates.io/crates/${rustPackage}`,
    });
  }

  // Runtime badges
  if (metadata.ecosystem.includes('javascript') && metadata.nodeVersion) {
    badges.push({
      type: 'node-version',
      group: 'runtime',
      label: 'node version',
      imageUrl: `https://img.shields.io/node/v/${jsPackage ?? 'unknown'}`,
      linkUrl: 'https://nodejs.org',
    });
  }

  if (metadata.ecosystem.includes('python') && metadata.pythonVersion) {
    badges.push({
      type: 'python-version',
      group: 'runtime',
      label: 'python version',
      imageUrl: `https://img.shields.io/pypi/pyversions/${pyPackage ?? 'unknown'}`,
      linkUrl: 'https://www.python.org',
    });
  }

  // Build / CI badges — one per workflow
  if (metadata.owner && metadata.repo) {
    for (const workflow of metadata.workflows) {
      const encodedWorkflow = encodeURIComponent(workflow);
      const workflowName = workflow.replace(/\.(yml|yaml)$/, '');
      badges.push({
        type: `github-actions-${workflowName}`,
        group: 'build',
        label: `${workflowName} workflow`,
        imageUrl: `https://github.com/${metadata.owner}/${metadata.repo}/actions/workflows/${encodedWorkflow}/badge.svg`,
        linkUrl: `https://github.com/${metadata.owner}/${metadata.repo}/actions/workflows/${encodedWorkflow}`,
      });
    }
  }

  // Metadata badges
  if (metadata.license && metadata.owner && metadata.repo) {
    badges.push({
      type: 'license',
      group: 'metadata',
      label: 'license',
      imageUrl: `https://img.shields.io/github/license/${metadata.owner}/${metadata.repo}`,
      linkUrl: `https://github.com/${metadata.owner}/${metadata.repo}/blob/main/LICENSE`,
    });
  }

  // Social badges
  if (metadata.owner && metadata.repo) {
    badges.push({
      type: 'stars',
      group: 'social',
      label: 'GitHub stars',
      imageUrl: `https://img.shields.io/github/stars/${metadata.owner}/${metadata.repo}`,
      linkUrl: `https://github.com/${metadata.owner}/${metadata.repo}`,
    });
  }

  return badges;
}
