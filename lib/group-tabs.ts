export type GroupMode = "window" | "site";

export type GroupableTab = {
  windowId: number;
  domain: string;
};

export type TabGroup<T> = {
  id: string;
  label: string;
  tabs: T[];
};

export function groupTabs<T extends GroupableTab>(
  tabs: readonly T[],
  mode: GroupMode,
  options?: { currentWindowId?: number },
): TabGroup<T>[] {
  if (mode === "site") return groupBySite(tabs);
  return groupByWindow(tabs, options?.currentWindowId);
}

function groupByWindow<T extends GroupableTab>(
  tabs: readonly T[],
  currentWindowId: number | undefined,
): TabGroup<T>[] {
  const order: number[] = [];
  const groups = new Map<number, T[]>();

  for (const tab of tabs) {
    const existing = groups.get(tab.windowId);
    if (existing) {
      existing.push(tab);
      continue;
    }
    groups.set(tab.windowId, [tab]);
    order.push(tab.windowId);
  }

  return order.map((windowId, index) => {
    const label =
      currentWindowId === windowId
        ? `Window ${index + 1} · this window`
        : `Window ${index + 1}`;
    return {
      id: `window:${windowId}`,
      label,
      tabs: groups.get(windowId) ?? [],
    };
  });
}

const OTHER_KEY = "\uFFFF";

function groupBySite<T extends GroupableTab>(
  tabs: readonly T[],
): TabGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const tab of tabs) {
    const key = tab.domain || OTHER_KEY;
    const existing = groups.get(key);
    if (existing) existing.push(tab);
    else groups.set(key, [tab]);
  }

  return [...groups.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map((key) => ({
      id: `site:${key}`,
      label: key === OTHER_KEY ? "Other" : key,
      tabs: groups.get(key) ?? [],
    }));
}
