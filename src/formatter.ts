import type { Badge, BadgeGroup, Config } from './types.js';
import { DEFAULT_GROUP_ORDER } from './types.js';

/**
 * Sort badges by group ordering and render as markdown.
 */
export function formatBadges(badges: Badge[], config?: Config): string {
  const order = config?.badges.order ?? DEFAULT_GROUP_ORDER;
  const exclude = config?.badges.exclude ?? [];
  const include = config?.badges.include ?? [];

  // Explicit includes win over excludes.
  const filtered = badges.filter((badge) => {
    if (include.includes(badge.type)) {
      return true;
    }

    return !exclude.includes(badge.type);
  });

  // Sort by group order, then by original order within the same group
  const sorted = [...filtered].sort((a, b) => {
    const aIndex = groupIndex(a.group, order);
    const bIndex = groupIndex(b.group, order);
    return aIndex - bIndex;
  });

  // Render each badge as markdown image link
  const lines = sorted.map((badge) => renderBadge(badge));
  return lines.join('\n');
}

/**
 * Get the ordering index for a badge group.
 * Groups not in the order list are placed at the end.
 */
function groupIndex(group: BadgeGroup, order: BadgeGroup[]): number {
  const index = order.indexOf(group);
  return index === -1 ? order.length : index;
}

/**
 * Render a single badge as a markdown image link.
 * Format: [![label](imageUrl)](linkUrl)
 */
export function renderBadge(badge: Badge): string {
  return `[![${badge.label}](${badge.imageUrl})](${badge.linkUrl})`;
}
