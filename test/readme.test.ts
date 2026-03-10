import { describe, expect, it } from 'vitest';
import {
  extractBadgeBlock,
  hasBadgeBlock,
  insertBadgeMarkers,
  parseExistingBadges,
  replaceBadgeBlock,
} from '../src/readme.js';

describe('readme', () => {
  describe('extractBadgeBlock', () => {
    it('extracts content between markers', () => {
      const content = [
        '# My Project',
        '',
        '<!-- BADGES:START -->',
        '[![npm](https://img.shields.io/npm/v/my-lib)](https://www.npmjs.com/package/my-lib)',
        '<!-- BADGES:END -->',
        '',
        'Some content',
      ].join('\n');

      const block = extractBadgeBlock(content);
      expect(block).toBe('[![npm](https://img.shields.io/npm/v/my-lib)](https://www.npmjs.com/package/my-lib)');
    });

    it('returns empty string when block is empty', () => {
      const content = [
        '<!-- BADGES:START -->',
        '<!-- BADGES:END -->',
      ].join('\n');

      const block = extractBadgeBlock(content);
      expect(block).toBe('');
    });

    it('trims whitespace from block content', () => {
      const content = [
        '<!-- BADGES:START -->',
        '',
        '  [![badge](url)](link)  ',
        '',
        '<!-- BADGES:END -->',
      ].join('\n');

      const block = extractBadgeBlock(content);
      expect(block).toBe('[![badge](url)](link)');
    });

    it('throws when both markers are missing', () => {
      const content = '# No markers here';
      expect(() => extractBadgeBlock(content)).toThrow('Badge block markers not found');
    });

    it('throws when start marker is missing', () => {
      const content = '<!-- BADGES:END -->';
      expect(() => extractBadgeBlock(content)).toThrow('Missing start marker');
    });

    it('throws when end marker is missing', () => {
      const content = '<!-- BADGES:START -->';
      expect(() => extractBadgeBlock(content)).toThrow('Missing end marker');
    });

    it('throws when markers are in wrong order', () => {
      const content = [
        '<!-- BADGES:END -->',
        '<!-- BADGES:START -->',
      ].join('\n');
      expect(() => extractBadgeBlock(content)).toThrow('wrong order');
    });

    it('throws on nested markers', () => {
      const content = [
        '<!-- BADGES:START -->',
        '<!-- BADGES:START -->',
        '<!-- BADGES:END -->',
      ].join('\n');
      expect(() => extractBadgeBlock(content)).toThrow('Nested');
    });
  });

  describe('replaceBadgeBlock', () => {
    it('replaces badge block content', () => {
      const content = [
        '# My Project',
        '',
        '<!-- BADGES:START -->',
        'old badges',
        '<!-- BADGES:END -->',
        '',
        'Some content',
      ].join('\n');

      const result = replaceBadgeBlock(content, 'new badges');
      expect(result).toContain('new badges');
      expect(result).not.toContain('old badges');
      expect(result).toContain('Some content');
    });

    it('handles empty new badges', () => {
      const content = [
        '<!-- BADGES:START -->',
        'old badges',
        '<!-- BADGES:END -->',
      ].join('\n');

      const result = replaceBadgeBlock(content, '');
      expect(result).toContain('<!-- BADGES:START -->');
      expect(result).toContain('<!-- BADGES:END -->');
      expect(result).not.toContain('old badges');
    });

    it('preserves content before and after markers', () => {
      const content = [
        'before',
        '<!-- BADGES:START -->',
        'badges',
        '<!-- BADGES:END -->',
        'after',
      ].join('\n');

      const result = replaceBadgeBlock(content, 'updated');
      expect(result).toContain('before');
      expect(result).toContain('after');
      expect(result).toContain('updated');
    });

    it('throws when markers are missing', () => {
      expect(() => replaceBadgeBlock('no markers', 'badges')).toThrow('not found');
    });
  });

  describe('hasBadgeBlock', () => {
    it('returns true when both markers present', () => {
      const content = '<!-- BADGES:START -->\n<!-- BADGES:END -->';
      expect(hasBadgeBlock(content)).toBe(true);
    });

    it('returns false when markers are missing', () => {
      expect(hasBadgeBlock('no markers')).toBe(false);
    });

    it('returns false when only start marker present', () => {
      expect(hasBadgeBlock('<!-- BADGES:START -->')).toBe(false);
    });

    it('returns false when only end marker present', () => {
      expect(hasBadgeBlock('<!-- BADGES:END -->')).toBe(false);
    });
  });

  describe('parseExistingBadges', () => {
    it('parses standard badge lines', () => {
      const block = [
        '[![npm](https://img.shields.io/npm/v/my-lib)](https://www.npmjs.com/package/my-lib)',
        '[![license](https://img.shields.io/github/license/user/repo)](https://github.com/user/repo/blob/main/LICENSE)',
      ].join('\n');

      const badges = parseExistingBadges(block);
      expect(badges).toHaveLength(2);
      expect(badges[0].label).toBe('npm');
      expect(badges[0].imageUrl).toBe('https://img.shields.io/npm/v/my-lib');
      expect(badges[0].linkUrl).toBe('https://www.npmjs.com/package/my-lib');
      expect(badges[1].label).toBe('license');
    });

    it('returns empty array for empty block', () => {
      expect(parseExistingBadges('')).toHaveLength(0);
      expect(parseExistingBadges('  ')).toHaveLength(0);
    });

    it('skips non-badge lines', () => {
      const block = [
        '[![npm](https://img.shields.io/npm/v/my-lib)](https://www.npmjs.com/package/my-lib)',
        '',
        'Some random text',
        '[![license](https://img.shields.io/github/license/user/repo)](https://github.com/user/repo)',
      ].join('\n');

      const badges = parseExistingBadges(block);
      expect(badges).toHaveLength(2);
    });

    it('preserves raw badge line text', () => {
      const line = '[![custom badge](https://example.com/badge.svg)](https://example.com)';
      const badges = parseExistingBadges(line);
      expect(badges).toHaveLength(1);
      expect(badges[0].raw).toBe(line);
    });

    it('parses HTML badge patterns', () => {
      const block = '<a href="https://example.com"><img src="https://example.com/badge.svg" alt="badge" /></a>';
      const result = parseExistingBadges(block);
      expect(result).toHaveLength(1);
      expect(result[0].imageUrl).toBe('https://example.com/badge.svg');
      expect(result[0].linkUrl).toBe('https://example.com');
      expect(result[0].label).toBe('badge');
    });

    it('parses multi-line HTML badge patterns', () => {
      const block = '<a href="https://github.com/test/repo/actions">\n  <img src="https://github.com/test/repo/badge.svg" alt="CI" />\n</a>';
      const result = parseExistingBadges(block);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('CI');
      expect(result[0].imageUrl).toBe('https://github.com/test/repo/badge.svg');
      expect(result[0].linkUrl).toBe('https://github.com/test/repo/actions');
    });
  });

  describe('insertBadgeMarkers', () => {
    it('wraps pre-heading centered HTML badge block and skips centered logo block', () => {
      const content = [
        '<p align="center">',
        '  <img src="https://example.com/logo.png" alt="Logo" width="320" />',
        '</p>',
        '',
        '<p align="center">',
        '  <a href="https://example.com/test"><img src="https://img.shields.io/badge/test-passing-brightgreen" alt="Test Status" /></a>',
        '  <a href="https://example.com/release"><img src="https://img.shields.io/badge/release-stable-blue" alt="Release Status" /></a>',
        '  <a href="https://pypi.org/project/example"><img src="https://img.shields.io/pypi/v/example" alt="PyPI Version" /></a>',
        '</p>',
        '',
        '---',
        '',
        '# Azure Functions Doctor for Python',
      ].join('\n');

      const result = insertBadgeMarkers(content);

      const expected = [
        '<p align="center">',
        '  <img src="https://example.com/logo.png" alt="Logo" width="320" />',
        '</p>',
        '',
        '<!-- BADGES:START -->',
        '<p align="center">',
        '  <a href="https://example.com/test"><img src="https://img.shields.io/badge/test-passing-brightgreen" alt="Test Status" /></a>',
        '  <a href="https://example.com/release"><img src="https://img.shields.io/badge/release-stable-blue" alt="Release Status" /></a>',
        '  <a href="https://pypi.org/project/example"><img src="https://img.shields.io/pypi/v/example" alt="PyPI Version" /></a>',
        '</p>',
        '<!-- BADGES:END -->',
        '',
        '---',
        '',
        '# Azure Functions Doctor for Python',
      ].join('\n');

      expect(result).toBe(expected);
      expect(result.match(/<a href=/g)).toHaveLength(3);
      expect(result.match(/<!-- BADGES:START -->/g)).toHaveLength(1);
      expect(result.match(/<!-- BADGES:END -->/g)).toHaveLength(1);
    });

    it('wraps markdown badges after heading', () => {
      const content = [
        '# azure-functions-openapi',
        '',
        '[![PyPI](https://img.shields.io/pypi/v/azure-functions-openapi)](https://pypi.org/project/azure-functions-openapi/)',
        '[![Python Version](https://img.shields.io/pypi/pyversions/azure-functions-openapi)](https://pypi.org/project/azure-functions-openapi/)',
        '[![CI](https://github.com/example/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/example/repo/actions/workflows/ci.yml)',
      ].join('\n');

      const result = insertBadgeMarkers(content);
      const expected = [
        '# azure-functions-openapi',
        '',
        '<!-- BADGES:START -->',
        '[![PyPI](https://img.shields.io/pypi/v/azure-functions-openapi)](https://pypi.org/project/azure-functions-openapi/)',
        '[![Python Version](https://img.shields.io/pypi/pyversions/azure-functions-openapi)](https://pypi.org/project/azure-functions-openapi/)',
        '[![CI](https://github.com/example/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/example/repo/actions/workflows/ci.yml)',
        '<!-- BADGES:END -->',
      ].join('\n');

      expect(result).toBe(expected);
    });
  });
});
