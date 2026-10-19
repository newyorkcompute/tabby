import { urlKey, type UrlKeyOptions } from "@/lib/url-key";

export type AutoCloseTab = {
  id: number;
  url: string;
  pendingUrl?: string;
  pinned: boolean;
  windowId: number;
};

export type AutoCloseAction = {
  closeId: number;
  keepId: number;
  keepWindowId: number;
};

const INTERNAL_PROTOCOLS = new Set([
  "about:",
  "chrome:",
  "chrome-extension:",
  "chrome-search:",
  "chrome-untrusted:",
  "devtools:",
  "edge:",
  "view-source:",
]);

export function parseAutoCloseEnabled(value: unknown): boolean {
  return value === true;
}

/**
 * Close the tab that just opened when an older tab already has the same
 * URL key. Never close a pinned tab. Skip about:blank, browser-internal
 * pages, and tabs still navigating to a different URL.
 */
export function decideAutoClose(
  opened: AutoCloseTab,
  tabs: readonly AutoCloseTab[],
  options: UrlKeyOptions,
): AutoCloseAction | null {
  if (opened.pinned || !isSettledUrl(opened)) return null;
  const key = urlKey(opened.url, options);
  if (!key) return null;

  const existing = tabs.reduce<AutoCloseTab | null>((best, tab) => {
    if (tab.id === opened.id || !isSettledUrl(tab)) return best;
    if (urlKey(tab.url, options) !== key) return best;
    if (!best || tab.id < best.id) return tab;
    return best;
  }, null);
  if (!existing || opened.id < existing.id) return null;

  return {
    closeId: opened.id,
    keepId: existing.id,
    keepWindowId: existing.windowId,
  };
}

export function isSettledUrl(tab: {
  url: string;
  pendingUrl?: string;
}): boolean {
  if (!tab.url || tab.url === "about:blank") return false;
  if (tab.pendingUrl && tab.pendingUrl !== tab.url) return false;
  return isAutoCloseUrl(tab.url);
}

function isAutoCloseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return !INTERNAL_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}
