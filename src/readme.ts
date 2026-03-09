import { readFile, writeFile } from 'node:fs/promises';

const START_MARKER = '<!-- BADGES:START -->';
const END_MARKER = '<!-- BADGES:END -->';

/**
 * Read badge block content from a README file.
 * Returns the content between BADGES:START and BADGES:END markers.
 * Throws if the file is missing or markers are malformed.
 */
export async function readBadgeBlock(readmePath: string): Promise<string> {
  const content = await readFile(readmePath, 'utf-8');
  return extractBadgeBlock(content);
}

/**
 * Extract badge block from README content string.
 * Throws if markers are missing or malformed.
 */
export function extractBadgeBlock(content: string): string {
  const startIndex = content.indexOf(START_MARKER);
  const endIndex = content.indexOf(END_MARKER);

  if (startIndex === -1 && endIndex === -1) {
    throw new Error(
      `Badge block markers not found in README. Add these markers:\n${START_MARKER}\n${END_MARKER}`,
    );
  }

  if (startIndex === -1) {
    throw new Error(`Missing start marker: ${START_MARKER}`);
  }

  if (endIndex === -1) {
    throw new Error(`Missing end marker: ${END_MARKER}`);
  }

  if (endIndex < startIndex) {
    throw new Error('Badge block markers are in wrong order: END appears before START');
  }

  // Check for nested markers
  const afterStart = content.indexOf(START_MARKER, startIndex + START_MARKER.length);
  if (afterStart !== -1 && afterStart < endIndex) {
    throw new Error('Nested badge block markers detected');
  }

  const blockStart = startIndex + START_MARKER.length;
  const blockContent = content.slice(blockStart, endIndex).trim();
  return blockContent;
}

/**
 * Replace badge block content in a README string.
 * Returns the updated README content.
 */
export function replaceBadgeBlock(content: string, newBadges: string): string {
  const startIndex = content.indexOf(START_MARKER);
  const endIndex = content.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error('Badge block markers not found in README');
  }

  const before = content.slice(0, startIndex + START_MARKER.length);
  const after = content.slice(endIndex);

  if (newBadges.trim() === '') {
    return `${before}\n${after}`;
  }

  return `${before}\n${newBadges}\n${after}`;
}

/**
 * Write updated badge block to a README file.
 */
export async function writeBadgeBlock(
  readmePath: string,
  newBadges: string,
): Promise<void> {
  const content = await readFile(readmePath, 'utf-8');
  const updated = replaceBadgeBlock(content, newBadges);
  await writeFile(readmePath, updated, 'utf-8');
}

/**
 * Check if README content has badge block markers.
 */
export function hasBadgeBlock(content: string): boolean {
  return content.includes(START_MARKER) && content.includes(END_MARKER);
}

/** Regex to match a markdown badge line: [![label](imageUrl)](linkUrl) */
const BADGE_LINE_REGEX = /^\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)$/;
const HTML_BADGE_REGEX = /<a\s+href=["']([^"']+)["'][^>]*>\s*(<img\b[^>]*\/?>)\s*<\/a>/i;
const HTML_IMG_SRC_REGEX = /\bsrc=["']([^"']+)["']/i;
const HTML_IMG_ALT_REGEX = /\balt=["']([^"']*)["']/i;

/** A parsed badge line from existing README content */
export interface ParsedBadgeLine {
  label: string;
  imageUrl: string;
  linkUrl: string;
  raw: string;
}

/**
 * Parse existing badge lines from a badge block content string.
 * Returns an array of parsed badge lines.
 * Non-badge lines (empty lines, comments, other markdown) are ignored.
 */
export function parseExistingBadges(blockContent: string): ParsedBadgeLine[] {
  if (blockContent.trim() === '') return [];

  const lines = blockContent.split('\n');
  const badges: ParsedBadgeLine[] = [];
  const htmlBadgeStartRegex = /^<a\s+href=/i;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed === '') continue;

    const match = BADGE_LINE_REGEX.exec(trimmed);
    if (match) {
      badges.push({
        label: match[1],
        imageUrl: match[2],
        linkUrl: match[3],
        raw: trimmed,
      });
      continue;
    }

    if (!htmlBadgeStartRegex.test(trimmed)) {
      continue;
    }

    const htmlLines = [trimmed];
    let htmlMatch = HTML_BADGE_REGEX.exec(trimmed);

    let scan = index + 1;
    while (!htmlMatch && scan < lines.length) {
      htmlLines.push(lines[scan].trim());
      const candidate = htmlLines.join(' ');
      htmlMatch = HTML_BADGE_REGEX.exec(candidate);
      scan += 1;
    }

    if (htmlMatch) {
      const imgTag = htmlMatch[2];
      const srcMatch = HTML_IMG_SRC_REGEX.exec(imgTag);
      if (!srcMatch) {
        index = scan - 1;
        continue;
      }
      const altMatch = HTML_IMG_ALT_REGEX.exec(imgTag);
      badges.push({
        label: altMatch?.[1] ?? '',
        imageUrl: srcMatch[1],
        linkUrl: htmlMatch[1],
        raw: htmlLines.join('\n'),
      });
      index = scan - 1;
    }
  }

  return badges;
}
