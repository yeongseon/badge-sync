import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { loadConfig, findConfigFile } from '../src/config.js';
import { DEFAULT_GROUP_ORDER } from '../src/types.js';

const TMP = resolve(import.meta.dirname, '.tmp-config');

beforeEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
});

describe('config', () => {
  describe('findConfigFile', () => {
    it('finds badgesync.config.json', () => {
      writeFileSync(resolve(TMP, 'badgesync.config.json'), '{}');
      const result = findConfigFile(TMP);
      expect(result).toBe(resolve(TMP, 'badgesync.config.json'));
    });

    it('finds badgesync.config.yaml', () => {
      writeFileSync(resolve(TMP, 'badgesync.config.yaml'), '');
      const result = findConfigFile(TMP);
      expect(result).toBe(resolve(TMP, 'badgesync.config.yaml'));
    });

    it('finds badgesync.config.yml', () => {
      writeFileSync(resolve(TMP, 'badgesync.config.yml'), '');
      const result = findConfigFile(TMP);
      expect(result).toBe(resolve(TMP, 'badgesync.config.yml'));
    });

    it('returns null when no config file exists', () => {
      const result = findConfigFile(TMP);
      expect(result).toBeNull();
    });

    it('prefers json over yaml', () => {
      writeFileSync(resolve(TMP, 'badgesync.config.json'), '{}');
      writeFileSync(resolve(TMP, 'badgesync.config.yaml'), '');
      const result = findConfigFile(TMP);
      expect(result).toContain('.json');
    });
  });

  describe('loadConfig', () => {
    it('returns defaults when no config file exists', async () => {
      const config = await loadConfig(TMP);
      expect(config.readme).toBe('README.md');
      expect(config.badges.order).toEqual(DEFAULT_GROUP_ORDER);
      expect(config.badges.exclude).toEqual([]);
      expect(config.badges.include).toEqual([]);
    });

    it('loads JSON config file', async () => {
      writeFileSync(
        resolve(TMP, 'badgesync.config.json'),
        JSON.stringify({
          badges: {
            order: ['build', 'distribution'],
            exclude: ['stars'],
          },
        }),
      );
      const config = await loadConfig(TMP);
      expect(config.badges.order).toEqual(['build', 'distribution']);
      expect(config.badges.exclude).toEqual(['stars']);
    });

    it('loads YAML config file', async () => {
      writeFileSync(
        resolve(TMP, 'badgesync.config.yaml'),
        'badges:\n  order:\n    - social\n    - metadata\n  exclude:\n    - license\n',
      );
      const config = await loadConfig(TMP);
      expect(config.badges.order).toEqual(['social', 'metadata']);
      expect(config.badges.exclude).toEqual(['license']);
    });

    it('loads config from explicit path', async () => {
      const customPath = resolve(TMP, 'custom.json');
      writeFileSync(
        customPath,
        JSON.stringify({ readme: 'docs/README.md' }),
      );
      const config = await loadConfig(TMP, customPath);
      expect(config.readme).toBe('docs/README.md');
    });

    it('throws for non-existent explicit config path', async () => {
      await expect(
        loadConfig(TMP, resolve(TMP, 'nonexistent.json')),
      ).rejects.toThrow('Config file not found');
    });

    it('throws for invalid config schema', async () => {
      writeFileSync(
        resolve(TMP, 'badgesync.config.json'),
        JSON.stringify({ badges: { order: ['invalid-group'] } }),
      );
      await expect(loadConfig(TMP)).rejects.toThrow();
    });

    it('uses defaults for missing optional fields', async () => {
      writeFileSync(
        resolve(TMP, 'badgesync.config.json'),
        JSON.stringify({ badges: {} }),
      );
      const config = await loadConfig(TMP);
      expect(config.badges.order).toEqual(DEFAULT_GROUP_ORDER);
      expect(config.badges.exclude).toEqual([]);
      expect(config.badges.include).toEqual([]);
    });
  });
});
