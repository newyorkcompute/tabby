import { decideAutoClose, type AutoCloseTab } from "@/lib/auto-close";
import {
  activateTab,
  closeTabs,
  DUPLICATE_SETTINGS_KEY,
  getAutoCloseEnabled,
  getDuplicateSettings,
  openSidePanel,
} from "@/lib/browser";
import { duplicateCount, type DuplicateTab } from "@/lib/duplicates";

const BADGE_COLOR = "#c2410c";

export default defineBackground(() => {
  let requestId = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const scheduleBadge = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void updateBadge();
    }, 50);
  };

  const updateBadge = async () => {
    const id = ++requestId;
    const [tabs, settings] = await Promise.all([
      chrome.tabs.query({}),
      getDuplicateSettings(),
    ]);
    if (id !== requestId) return;

    const count = duplicateCount(tabs.flatMap(toDuplicateTab), settings);
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  };

  const closing = new Set<number>();

  const considerAutoClose = (tabId: number) => {
    if (closing.has(tabId)) return;
    void maybeAutoClose(tabId, closing);
  };

  chrome.tabs.onCreated.addListener((tab) => {
    scheduleBadge();
    if (tab.id != null) considerAutoClose(tab.id);
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    scheduleBadge();
    if (changeInfo.url != null || changeInfo.status === "complete") {
      considerAutoClose(tabId);
    }
  });
  chrome.tabs.onRemoved.addListener(scheduleBadge);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (
      area === "sync" &&
      Object.prototype.hasOwnProperty.call(changes, DUPLICATE_SETTINGS_KEY)
    ) {
      scheduleBadge();
    }
  });

  // The manifest command is not the reserved `_execute_side_panel` name,
  // so the shortcut has to open the panel from the service worker.
  chrome.commands.onCommand.addListener((command) => {
    if (command !== "open-side-panel") return;
    void chrome.windows
      .getCurrent()
      .then((current) => {
        if (current.id == null) return;
        return openSidePanel(current.id);
      })
      .catch(() => {
        // The shortcut can fire before a window is ready. Ignore it.
      });
  });

  scheduleBadge();
});

async function maybeAutoClose(
  tabId: number,
  closing: Set<number>,
): Promise<void> {
  try {
    const enabled = await getAutoCloseEnabled();
    if (!enabled || closing.has(tabId)) return;
    const [settings, tabs] = await Promise.all([
      getDuplicateSettings(),
      chrome.tabs.query({}),
    ]);
    const opened = tabs.find((tab) => tab.id === tabId);
    const openedTab = opened ? toAutoCloseTab(opened) : null;
    if (!openedTab) return;
    const decision = decideAutoClose(
      openedTab,
      tabs.flatMap((tab) => {
        const candidate = toAutoCloseTab(tab);
        return candidate ? [candidate] : [];
      }),
      settings,
    );
    if (!decision || closing.has(decision.closeId)) return;
    closing.add(decision.closeId);
    try {
      await activateTab(decision.keepId, decision.keepWindowId);
      await closeTabs([decision.closeId]);
    } finally {
      closing.delete(decision.closeId);
    }
  } catch {
    // A tab can disappear while the URL is still settling.
  }
}

function toAutoCloseTab(tab: chrome.tabs.Tab): AutoCloseTab | null {
  if (tab.id == null) return null;
  return {
    id: tab.id,
    url: tab.url ?? "",
    pendingUrl: tab.pendingUrl,
    pinned: tab.pinned,
    windowId: tab.windowId,
  };
}

function toDuplicateTab(tab: chrome.tabs.Tab): DuplicateTab[] {
  if (tab.id == null || !tab.url) return [];
  return [
    {
      id: tab.id,
      url: tab.url,
      active: tab.active,
      pinned: tab.pinned,
      lastAccessed: tab.lastAccessed ?? 0,
    },
  ];
}
