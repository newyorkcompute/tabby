import { parseAutoCloseEnabled } from "@/lib/auto-close";
import { parseNamedSessions, type NamedSession } from "@/lib/named-sessions";
import type { UrlKeyOptions } from "@/lib/url-key";

export const DUPLICATE_SETTINGS_KEY = "duplicateMatch";
export const AUTO_CLOSE_KEY = "autoCloseDuplicates";
export const NAMED_SESSIONS_KEY = "namedSessions";

export const DEFAULT_DUPLICATE_SETTINGS: UrlKeyOptions = {
  includeQuery: false,
  includeHash: false,
};

export function parseDuplicateSettings(value: unknown): UrlKeyOptions {
  if (typeof value !== "object" || value === null)
    return DEFAULT_DUPLICATE_SETTINGS;
  const record = value as Record<string, unknown>;
  if (typeof record.includeQuery !== "boolean")
    return DEFAULT_DUPLICATE_SETTINGS;
  if (typeof record.includeHash !== "boolean")
    return DEFAULT_DUPLICATE_SETTINGS;
  return {
    includeQuery: record.includeQuery,
    includeHash: record.includeHash,
  };
}

export async function getDuplicateSettings(): Promise<UrlKeyOptions> {
  const stored: Record<string, unknown> = await chrome.storage.sync.get(
    DUPLICATE_SETTINGS_KEY,
  );
  return parseDuplicateSettings(stored[DUPLICATE_SETTINGS_KEY]);
}

export async function setDuplicateSettings(
  options: UrlKeyOptions,
): Promise<void> {
  await chrome.storage.sync.set({ [DUPLICATE_SETTINGS_KEY]: options });
}

export async function getAutoCloseEnabled(): Promise<boolean> {
  const stored: Record<string, unknown> =
    await chrome.storage.sync.get(AUTO_CLOSE_KEY);
  return parseAutoCloseEnabled(stored[AUTO_CLOSE_KEY]);
}

export async function setAutoCloseEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.sync.set({ [AUTO_CLOSE_KEY]: enabled });
}

export async function getNamedSessions(): Promise<NamedSession[]> {
  const stored: Record<string, unknown> =
    await chrome.storage.local.get(NAMED_SESSIONS_KEY);
  return parseNamedSessions(stored[NAMED_SESSIONS_KEY]);
}

export async function setNamedSessions(
  sessions: readonly NamedSession[],
): Promise<void> {
  await chrome.storage.local.set({ [NAMED_SESSIONS_KEY]: [...sessions] });
}

export async function restoreNamedSession(
  session: NamedSession,
): Promise<void> {
  const urls = session.tabs.map((tab) => tab.url);
  const first = urls[0];
  if (!first) throw new Error("That session has no tabs");
  const created = await chrome.windows.create({
    url: urls.length === 1 ? first : urls,
    focused: true,
  });
  if (!created || created.id == null) return;
  const live = await chrome.tabs.query({ windowId: created.id });
  const ordered = [...live].sort((left, right) => left.index - right.index);
  await Promise.all(
    ordered.map(async (tab, index) => {
      const saved = session.tabs[index];
      if (tab.id == null || !saved?.pinned) return;
      await chrome.tabs.update(tab.id, { pinned: true });
    }),
  );
}

export function queryTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({});
}

export function closeTabs(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) return Promise.resolve();
  return chrome.tabs.remove(tabIds);
}

export function setPinned(
  tabId: number,
  pinned: boolean,
): Promise<chrome.tabs.Tab | undefined> {
  return chrome.tabs.update(tabId, { pinned });
}

export function setMuted(
  tabId: number,
  muted: boolean,
): Promise<chrome.tabs.Tab | undefined> {
  return chrome.tabs.update(tabId, { muted });
}

export async function activateTab(
  tabId: number,
  windowId: number,
): Promise<void> {
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(windowId, { focused: true });
}

export async function moveTabs(
  tabIds: number[],
  windowId: number,
): Promise<void> {
  if (tabIds.length === 0) return;
  if (tabIds.length === 1) {
    const tabId = tabIds[0];
    if (tabId === undefined) return;
    await chrome.tabs.move(tabId, { windowId, index: -1 });
    return;
  }
  await chrome.tabs.move(tabIds, { windowId, index: -1 });
}

export function discardTab(
  tabId: number,
): Promise<chrome.tabs.Tab | undefined> {
  return chrome.tabs.discard(tabId);
}

export function listWindows(): Promise<chrome.windows.Window[]> {
  return chrome.windows.getAll({ populate: false, windowTypes: ["normal"] });
}

export function getCurrentWindow(): Promise<chrome.windows.Window> {
  return chrome.windows.getCurrent();
}

export function listTabGroups(): Promise<chrome.tabGroups.TabGroup[]> {
  return chrome.tabGroups.query({});
}

export function addTabsToGroup(
  tabIds: number[],
  groupId: number,
): Promise<number> {
  const ids = nonEmptyIds(tabIds);
  if (!ids) return Promise.reject(new Error("No tabs to group"));
  return chrome.tabs.group({ tabIds: ids, groupId });
}

export function ungroupTabs(tabIds: number[]): Promise<void> {
  const ids = nonEmptyIds(tabIds);
  if (!ids) return Promise.resolve();
  return chrome.tabs.ungroup(ids);
}

function nonEmptyIds(tabIds: number[]): [number, ...number[]] | null {
  const [first, ...rest] = tabIds;
  if (first === undefined) return null;
  return [first, ...rest];
}

export function getRecentlyClosed(): Promise<chrome.sessions.Session[]> {
  return chrome.sessions.getRecentlyClosed({ maxResults: 15 });
}

export function restoreSession(
  sessionId: string,
): Promise<chrome.sessions.Session | undefined> {
  return chrome.sessions.restore(sessionId);
}

export function openSidePanel(windowId: number): Promise<void> {
  return chrome.sidePanel.open({ windowId });
}

export function onTabsChanged(listener: () => void): () => void {
  const onCreated = () => listener();
  const onUpdated = () => listener();
  const onRemoved = () => listener();
  const onMoved = () => listener();
  const onAttached = () => listener();
  const onDetached = () => listener();
  const onActivated = () => listener();
  const onGroupUpdated = () => listener();

  chrome.tabs.onCreated.addListener(onCreated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.tabs.onRemoved.addListener(onRemoved);
  chrome.tabs.onMoved.addListener(onMoved);
  chrome.tabs.onAttached.addListener(onAttached);
  chrome.tabs.onDetached.addListener(onDetached);
  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabGroups.onCreated.addListener(onGroupUpdated);
  chrome.tabGroups.onUpdated.addListener(onGroupUpdated);
  chrome.tabGroups.onRemoved.addListener(onGroupUpdated);
  chrome.tabGroups.onMoved.addListener(onGroupUpdated);

  return () => {
    chrome.tabs.onCreated.removeListener(onCreated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.tabs.onRemoved.removeListener(onRemoved);
    chrome.tabs.onMoved.removeListener(onMoved);
    chrome.tabs.onAttached.removeListener(onAttached);
    chrome.tabs.onDetached.removeListener(onDetached);
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabGroups.onCreated.removeListener(onGroupUpdated);
    chrome.tabGroups.onUpdated.removeListener(onGroupUpdated);
    chrome.tabGroups.onRemoved.removeListener(onGroupUpdated);
    chrome.tabGroups.onMoved.removeListener(onGroupUpdated);
  };
}

export function onDuplicateSettingsChanged(listener: () => void): () => void {
  return onStorageKeysChanged(
    "sync",
    [DUPLICATE_SETTINGS_KEY, AUTO_CLOSE_KEY],
    listener,
  );
}

export function onNamedSessionsChanged(listener: () => void): () => void {
  return onStorageKeysChanged("local", [NAMED_SESSIONS_KEY], listener);
}

function onStorageKeysChanged(
  areaName: chrome.storage.AreaName,
  keys: readonly string[],
  listener: () => void,
): () => void {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area !== areaName) return;
    if (
      keys.some((key) => Object.prototype.hasOwnProperty.call(changes, key))
    ) {
      listener();
    }
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}
