import { urlKey, type UrlKeyOptions } from "@/lib/url-key";

export type DuplicateTab = {
  id: number;
  url: string;
  active: boolean;
  pinned: boolean;
  lastAccessed: number;
};

export function duplicateSets<T extends DuplicateTab>(
  tabs: readonly T[],
  options: UrlKeyOptions,
): T[][] {
  const buckets = new Map<string, T[]>();
  for (const tab of tabs) {
    const key = urlKey(tab.url, options);
    if (!key) continue;
    const existing = buckets.get(key);
    if (existing) existing.push(tab);
    else buckets.set(key, [tab]);
  }
  return [...buckets.values()].filter((group) => group.length > 1);
}

/**
 * Tabs to keep inside one duplicate set.
 * Keep every active tab and every pinned tab. When a set has neither,
 * keep the most recently used tab (lastAccessed), breaking ties by id.
 */
export function tabsToKeep<T extends DuplicateTab>(group: readonly T[]): T[] {
  const protectedTabs = group.filter((tab) => tab.active || tab.pinned);
  if (protectedTabs.length > 0) return [...protectedTabs];

  const ranked = [...group].sort((a, b) => {
    if (b.lastAccessed !== a.lastAccessed)
      return b.lastAccessed - a.lastAccessed;
    return a.id - b.id;
  });
  const keeper = ranked[0];
  return keeper ? [keeper] : [];
}

export function tabsToClose<T extends DuplicateTab>(
  tabs: readonly T[],
  options: UrlKeyOptions,
): number[] {
  const closeIds: number[] = [];
  for (const group of duplicateSets(tabs, options)) {
    const keep = new Set(tabsToKeep(group).map((tab) => tab.id));
    for (const tab of group) {
      if (!keep.has(tab.id)) closeIds.push(tab.id);
    }
  }
  return closeIds;
}

export function duplicateCount<T extends DuplicateTab>(
  tabs: readonly T[],
  options: UrlKeyOptions,
): number {
  return tabsToClose(tabs, options).length;
}
