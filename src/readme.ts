import { readFile, writeFile } from 'node:fs/promises';

export const START_MARKER = '<!-- BADGES:START -->';
export const END_MARKER = '<!-- BADGES:END -->';

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

/**
 * Insert badge block markers into README content.
 * Migrates existing badge lines (markdown or HTML) into the marker block.
 */
export function insertBadgeMarkers(readmeContent: string): string {
  const lines = readmeContent.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.startsWith('# '));

  if (headingIndex > 0) {
    const preHeadingBadges = extractExistingBadgeLines(lines, 0, headingIndex);
    if (
      preHeadingBadges.badgeLines.length > 0
      && preHeadingBadges.badgeStartIndex !== undefined
      && preHeadingBadges.badgeEndIndex !== undefined
    ) {
      const before = lines.slice(0, preHeadingBadges.badgeStartIndex);
      const after = lines.slice(preHeadingBadges.badgeEndIndex);
      return [
        ...before,
        START_MARKER,
        ...preHeadingBadges.badgeLines,
        END_MARKER,
        ...after,
      ].join('\n');
    }
  }

  const searchStart = headingIndex >= 0 ? headingIndex + 1 : 0;
  const extracted = extractExistingBadgeLines(lines, searchStart);
  if (
    extracted.badgeLines.length > 0
    && extracted.badgeStartIndex !== undefined
    && extracted.badgeEndIndex !== undefined
  ) {
    const before = lines.slice(0, extracted.badgeStartIndex);
    const after = lines.slice(extracted.badgeEndIndex);
    return [
      ...before,
      START_MARKER,
      ...extracted.badgeLines,
      END_MARKER,
      ...after,
    ].join('\n');
  }

  const markerLines = [START_MARKER, END_MARKER];
  if (headingIndex >= 0) {
    const before = lines.slice(0, headingIndex + 1);
    const after = lines.slice(headingIndex + 1);
    return [...before, '', ...markerLines, '', ...after].join('\n');
  }

  return [...markerLines, '', ...lines].join('\n');
}

/**
 * Extract existing badge lines from README lines array.
 * Scans from searchStart to searchEnd for markdown and HTML badge patterns.
 */
export function extractExistingBadgeLines(
  lines: string[],
  searchStart: number,
  searchEnd: number = lines.length,
): {
  badgeLines: string[];
  nonBadgeLines: string[];
  badgeStartIndex?: number;
  badgeEndIndex?: number;
} {
  const markdownBadgeRegex = /^\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)$/;
  const htmlBadgeStartRegex = /^\s*<a\s+href=/i;
  const htmlBadgeEndRegex = /<\/a>\s*$/i;
  const htmlImgRegex = /<img\s+/i;
  const centeredParagraphStartRegex = /^\s*<p\b[^>]*\balign=["']center["'][^>]*>/i;
  const paragraphEndRegex = /<\/p>\s*$/i;
  const linkedImageBadgeRegex = /<a\s+href=["'][^"']+["'][^>]*>\s*<img\b[^>]*\/?>\s*<\/a>/i;
  const maxScan = Math.min(lines.length, searchEnd);
  const badgeLines: string[] = [];
  const badgeIndexes = new Set<number>();
  let foundBadge = false;

  let index = searchStart;
  while (index < maxScan) {
    const line = lines[index];
    const trimmed = line.trim();

    if (trimmed === '') {
      index += 1;
      continue;
    }

    if (markdownBadgeRegex.test(trimmed)) {
      foundBadge = true;
      badgeLines.push(trimmed);
      badgeIndexes.add(index);
      index += 1;
      continue;
    }

    if (centeredParagraphStartRegex.test(trimmed)) {
      const paragraphLines = [line];
      const paragraphIndexes = [index];
      let scan = index;
      let hasEnd = paragraphEndRegex.test(trimmed);

      while (!hasEnd && scan + 1 < maxScan) {
        scan += 1;
        const nextLine = lines[scan];
        const nextTrimmed = nextLine.trim();
        paragraphLines.push(nextLine);
        paragraphIndexes.push(scan);
        if (paragraphEndRegex.test(nextTrimmed)) {
          hasEnd = true;
        }
      }

      const paragraphContent = paragraphLines.join(' ');
      const hasLinkedImageBadge = linkedImageBadgeRegex.test(paragraphContent);
      if (hasLinkedImageBadge) {
        foundBadge = true;
        badgeLines.push(...paragraphLines);
        for (const badgeIndex of paragraphIndexes) {
          badgeIndexes.add(badgeIndex);
        }
        index = scan + 1;
        continue;
      }

      if (foundBadge) {
        break;
      }

      index = scan + 1;
      continue;
    }

    if (htmlBadgeStartRegex.test(trimmed)) {
      const htmlLines = [line];
      const htmlIndexes = [index];
      let scan = index;
      let hasImg = htmlImgRegex.test(trimmed);
      let hasEnd = htmlBadgeEndRegex.test(trimmed);

      while (!hasEnd && scan + 1 < maxScan) {
        scan += 1;
        const nextLine = lines[scan];
        const nextTrimmed = nextLine.trim();
        htmlLines.push(nextLine);
        htmlIndexes.push(scan);
        if (htmlImgRegex.test(nextTrimmed)) hasImg = true;
        if (htmlBadgeEndRegex.test(nextTrimmed)) hasEnd = true;
      }

      if (hasImg && hasEnd) {
        foundBadge = true;
        badgeLines.push(...htmlLines);
        for (const badgeIndex of htmlIndexes) {
          badgeIndexes.add(badgeIndex);
        }
        index = scan + 1;
        continue;
      }
    }

    if (foundBadge) {
      break;
    }

    index += 1;
  }

  const nonBadgeLines = lines.filter((_, idx) => !badgeIndexes.has(idx));
  const badgeIndexList = [...badgeIndexes].sort((left, right) => left - right);
  const badgeStartIndex = badgeIndexList[0];
  const badgeEndIndex = badgeIndexList.length > 0
    ? badgeIndexList[badgeIndexList.length - 1] + 1
    : undefined;

  return {
    badgeLines,
    nonBadgeLines,
    badgeStartIndex,
    badgeEndIndex,
  };
}
