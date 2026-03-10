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

  // Quality badges — coverage
  if (metadata.coverageService && metadata.owner && metadata.repo) {
    if (metadata.coverageService === 'codecov') {
      badges.push({
        type: 'coverage',
        group: 'quality',
        label: 'coverage',
        imageUrl: `https://codecov.io/gh/${metadata.owner}/${metadata.repo}/branch/main/graph/badge.svg`,
        linkUrl: `https://codecov.io/gh/${metadata.owner}/${metadata.repo}`,
      });
    } else if (metadata.coverageService === 'coveralls') {
      badges.push({
        type: 'coverage',
        group: 'quality',
        label: 'coverage',
        imageUrl: `https://coveralls.io/repos/github/${metadata.owner}/${metadata.repo}/badge.svg?branch=main`,
        linkUrl: `https://coveralls.io/github/${metadata.owner}/${metadata.repo}?branch=main`,
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

/**
 * Infer badge type from image and link URLs.
 * Used to identify managed badge types in existing badge blocks.
 */
export function inferBadgeType(imageUrl: string, linkUrl: string): string | null {
  if (imageUrl.includes('img.shields.io/npm/v/')) {
    return 'npm-version';
  }
  if (imageUrl.includes('img.shields.io/node/v/')) {
    return 'node-version';
  }
  if (imageUrl.includes('img.shields.io/pypi/v/')) {
    return 'pypi-version';
  }
  if (imageUrl.includes('img.shields.io/pypi/pyversions/')) {
    return 'python-version';
  }
  if (imageUrl.includes('img.shields.io/crates/v/')) {
    return 'crates-version';
  }
  if (imageUrl.includes('/actions/workflows/') && imageUrl.includes('/badge.svg')) {
    const workflow = imageUrl.match(/\/actions\/workflows\/([^/]+)\/badge\.svg/i)?.[1];
    const workflowName = workflow
      ? decodeURIComponent(workflow).replace(/\.(yml|yaml)$/i, '')
      : 'workflow';
    return `github-actions-${workflowName}`;
  }
  if (imageUrl.includes('codecov.io/gh/') || imageUrl.includes('coveralls.io/')) {
    return 'coverage';
  }
  if (imageUrl.includes('img.shields.io/github/license/')) {
    return 'license';
  }
  if (imageUrl.includes('img.shields.io/github/stars/')) {
    return 'stars';
  }
  // Custom shields.io badge: img.shields.io/badge/License-...
  if (/img\.shields\.io\/badge\/licen[cs]e/i.test(imageUrl)) {
    return 'license';
  }
  // linkUrl pointing to LICENSE file is a strong license signal
  if (/\/LICENSE(\..+)?$/i.test(linkUrl)) {
    return 'license';
  }
  if (linkUrl.includes('/actions/workflows/')) {
    const workflow = linkUrl.match(/\/actions\/workflows\/([^/?#]+)/i)?.[1];
    const workflowName = workflow
      ? decodeURIComponent(workflow).replace(/\.(yml|yaml)$/i, '')
      : 'workflow';
    return `github-actions-${workflowName}`;
  }

  return null;
}

/**
 * Infer badge group from badge type.
 */
export function inferBadgeGroup(type: string): Badge['group'] {
  if (type === 'npm-version' || type === 'pypi-version' || type === 'crates-version') {
    return 'distribution';
  }
  if (type === 'node-version' || type === 'python-version') {
    return 'runtime';
  }
  if (type.startsWith('github-actions-')) {
    return 'build';
  }
  if (type === 'coverage') {
    return 'quality';
  }
  if (type === 'license') {
    return 'metadata';
  }
  return 'social';
}
