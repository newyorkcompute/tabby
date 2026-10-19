import {
  DUPLICATE_SETTINGS_KEY,
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

  chrome.tabs.onCreated.addListener(scheduleBadge);
  chrome.tabs.onUpdated.addListener(scheduleBadge);
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
