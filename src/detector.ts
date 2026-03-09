import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import fg from 'fast-glob';
import type { RepositoryMetadata, Ecosystem } from './types.js';

/**
 * Parse a TOML-like file for basic key-value extraction.
 * This is a minimal parser sufficient for pyproject.toml and Cargo.toml.
 */
function extractTomlValue(content: string, key: string): string | null {
  // Match key = "value" or key = 'value'
  const regex = new RegExp(`^\\s*${key.replace('.', '\\.')}\\s*=\\s*["']([^"']*)["']`, 'm');
  const match = content.match(regex);
  return match?.[1] ?? null;
}

/**
 * Parse TOML section header and extract values within that section.
 */
function extractTomlSectionValue(content: string, section: string, key: string): string | null {
  const sectionRegex = new RegExp(`^\\[${section.replace('.', '\\.')}\\]`, 'm');
  const sectionMatch = content.match(sectionRegex);
  if (!sectionMatch || sectionMatch.index === undefined) return null;

  const afterSection = content.slice(sectionMatch.index + sectionMatch[0].length);
  // Stop at next section header
  const nextSection = afterSection.match(/^\[/m);
  const sectionContent = nextSection?.index !== undefined
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

  if (normalized.includes('mit license') || normalized.includes('permission is hereby granted, free of charge')) {
    return 'MIT';
  }
  if (normalized.includes('apache license') && normalized.includes('version 2.0')) {
    return 'Apache-2.0';
  }
  if (normalized.includes('gnu general public license') && normalized.includes('version 3')) {
    return 'GPL-3.0';
  }
  if (normalized.includes('gnu general public license') && normalized.includes('version 2')) {
    return 'GPL-2.0';
  }
  if (normalized.includes('bsd 3-clause') || normalized.includes('redistribution and use in source and binary forms')) {
    return 'BSD-3-Clause';
  }
  if (normalized.includes('bsd 2-clause')) {
    return 'BSD-2-Clause';
  }
  if (normalized.includes('isc license')) {
    return 'ISC';
  }
  if (normalized.includes('mozilla public license') && normalized.includes('2.0')) {
    return 'MPL-2.0';
  }
  if (normalized.includes('the unlicense')) {
    return 'Unlicense';
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
    repositoryUrl: null,
    owner: null,
    repo: null,
    license: null,
    workflows: [],
    nodeVersion: null,
    pythonVersion: null,
  };

  // Detect ecosystems and package metadata in parallel
  const [packageJson, pyprojectToml, cargoToml, workflows, licenseContent, gitRemote] =
    await Promise.all([
      readFileSafe(join(cwd, 'package.json')),
      readFileSafe(join(cwd, 'pyproject.toml')),
      readFileSafe(join(cwd, 'Cargo.toml')),
      detectWorkflows(cwd),
      detectLicense(cwd),
      detectGitRemote(cwd),
    ]);

  // JavaScript / TypeScript
  if (packageJson) {
    metadata.ecosystem.push('javascript');
    try {
      const pkg = JSON.parse(packageJson) as Record<string, unknown>;
      if (typeof pkg.name === 'string') {
        metadata.packageName = pkg.name;
        metadata.packageNames.javascript = pkg.name;
      }
      if (
        pkg.engines &&
        typeof pkg.engines === 'object' &&
        pkg.engines !== null &&
        'node' in pkg.engines &&
        typeof (pkg.engines as Record<string, unknown>).node === 'string'
      ) {
        metadata.nodeVersion = (pkg.engines as Record<string, string>).node;
      }
      // Try to get repository URL from package.json
      if (pkg.repository) {
        if (typeof pkg.repository === 'string') {
          metadata.repositoryUrl = pkg.repository;
        } else if (
          typeof pkg.repository === 'object' &&
          pkg.repository !== null &&
          'url' in pkg.repository &&
          typeof (pkg.repository as Record<string, unknown>).url === 'string'
        ) {
          metadata.repositoryUrl = (pkg.repository as Record<string, string>).url;
        }
      }
    } catch {
      // Invalid JSON — ecosystem detected but no metadata extracted
    }
  }

  // Python
  if (pyprojectToml) {
    metadata.ecosystem.push('python');
    const name = extractTomlSectionValue(pyprojectToml, 'project', 'name');
    if (name) {
      metadata.packageNames.python = name;
      if (!metadata.packageName) {
        metadata.packageName = name;
      }
    }
    const pythonVersion = extractTomlSectionValue(pyprojectToml, 'project', 'requires-python');
    if (pythonVersion) {
      metadata.pythonVersion = pythonVersion;
    }
  }

  // Rust
  if (cargoToml) {
    metadata.ecosystem.push('rust');
    const name = extractTomlSectionValue(cargoToml, 'package', 'name');
    if (name) {
      metadata.packageNames.rust = name;
      if (!metadata.packageName) {
        metadata.packageName = name;
      }
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

async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function detectWorkflows(cwd: string): Promise<string[]> {
  const workflowDir = join(cwd, '.github', 'workflows');
  if (!existsSync(workflowDir)) {
    return [];
  }

  const files = await fg(['*.yml', '*.yaml'], { cwd: workflowDir });
  return files.sort();
}

async function detectLicense(cwd: string): Promise<string | null> {
  const candidates = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md'];
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
  if (!existsSync(join(cwd, '.git'))) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const result = execSync('git remote get-url origin', {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      resolve(result || null);
    } catch {
      resolve(null);
    }
  });
}
