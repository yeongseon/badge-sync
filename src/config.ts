import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import type { Config, BadgeGroup } from './types.js';
import { DEFAULT_CONFIG, DEFAULT_GROUP_ORDER } from './types.js';

const BADGE_GROUP_VALUES: [BadgeGroup, ...BadgeGroup[]] = [
  'distribution',
  'runtime',
  'build',
  'quality',
  'metadata',
  'social',
];

const configSchema = z.object({
  readme: z.string().optional(),
  badges: z
    .object({
      order: z.array(z.enum(BADGE_GROUP_VALUES)).optional(),
      exclude: z.array(z.string()).optional(),
      include: z.array(z.string()).optional(),
    })
    .optional(),
});

const CONFIG_FILENAMES = [
  'badgesync.config.json',
  'badgesync.config.yaml',
  'badgesync.config.yml',
];

/**
 * Find the configuration file in the given directory.
 * Returns the full path if found, null otherwise.
 */
export function findConfigFile(cwd: string): string | null {
  for (const name of CONFIG_FILENAMES) {
    const fullPath = join(cwd, name);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Parse a config file (JSON or YAML) and return raw content.
 */
async function parseConfigFile(filePath: string): Promise<unknown> {
  const content = await readFile(filePath, 'utf-8');
  if (filePath.endsWith('.json')) {
    return JSON.parse(content) as unknown;
  }
  return parseYaml(content) as unknown;
}

/**
 * Load and validate configuration.
 * - If configPath is provided, use that file directly.
 * - Otherwise, auto-detect from cwd.
 * - If no config file exists, return defaults.
 */
export async function loadConfig(cwd: string, configPath?: string): Promise<Config> {
  const resolvedPath = configPath ? resolve(cwd, configPath) : findConfigFile(cwd);

  if (!resolvedPath) {
    return { ...DEFAULT_CONFIG };
  }

  if (!existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const raw = await parseConfigFile(resolvedPath);
  const parsed = configSchema.parse(raw);

  return {
    readme: parsed.readme ?? DEFAULT_CONFIG.readme,
    badges: {
      order: parsed.badges?.order ?? [...DEFAULT_GROUP_ORDER],
      exclude: parsed.badges?.exclude ?? [],
      include: parsed.badges?.include ?? [],
    },
  };
}
