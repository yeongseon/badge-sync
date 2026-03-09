import { describe, it, expect } from 'vitest';
import {
  extractBadgeBlock,
  replaceBadgeBlock,
  hasBadgeBlock,
  parseExistingBadges,
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
  });
});
