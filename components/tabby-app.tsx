import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HistoryIcon,
  MoonIcon,
  MoreHorizontalIcon,
  PanelRightIcon,
  PinIcon,
  Volume2Icon,
  VolumeXIcon,
  GlobeIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandInput, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  activateTab,
  addTabsToGroup,
  closeTabs,
  discardTab,
  getCurrentWindow,
  getDuplicateSettings,
  getRecentlyClosed,
  listTabGroups,
  listWindows,
  moveTabs,
  onDuplicateSettingsChanged,
  onTabsChanged,
  openSidePanel,
  queryTabs,
  restoreSession,
  setDuplicateSettings,
  setMuted,
  setPinned,
  ungroupTabs,
} from "@/lib/browser";
import {
  duplicateCount,
  duplicateSets,
  tabsToClose,
  type DuplicateTab,
} from "@/lib/duplicates";
import { groupTabs, type GroupMode } from "@/lib/group-tabs";
import { searchTabs } from "@/lib/search";
import { domainFromUrl, type UrlKeyOptions } from "@/lib/url-key";

const NO_GROUP = -1;

const GROUP_COLORS: Record<string, string> = {
  grey: "bg-zinc-400",
  blue: "bg-blue-500",
  red: "bg-red-500",
  yellow: "bg-yellow-400",
  green: "bg-green-500",
  pink: "bg-pink-500",
  purple: "bg-purple-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
};

type Surface = "popup" | "sidepanel";

type TabModel = DuplicateTab & {
  windowId: number;
  index: number;
  title: string;
  domain: string;
  favIconUrl: string;
  muted: boolean;
  discarded: boolean;
  audible: boolean;
  groupId: number;
};

type ClosedEntry = {
  sessionId: string;
  title: string;
  detail: string;
};

export function TabbyApp({ surface }: { surface: Surface }) {
  const shell =
    surface === "popup"
      ? "flex h-[600px] w-[400px] flex-col overflow-hidden bg-background text-foreground"
      : "flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground";

  return (
    <TooltipProvider>
      <ThemeSync />
      <div className={shell}>
        <TabbyScreen surface={surface} />
      </div>
      <Toaster position="top-center" theme="system" />
    </TooltipProvider>
  );
}

function TabbyScreen({ surface }: { surface: Surface }) {
  const model = useTabbyModel();
  const [query, setQuery] = useState("");
  const [groupMode, setGroupMode] = useState<GroupMode>("window");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [anchorId, setAnchorId] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);

  const ordered = useMemo(
    () =>
      [...model.tabs].sort(
        (left, right) =>
          left.windowId - right.windowId || left.index - right.index,
      ),
    [model.tabs],
  );
  const visible = useMemo(() => searchTabs(ordered, query), [ordered, query]);
  const groups = useMemo(
    () =>
      groupTabs(visible, groupMode, {
        currentWindowId: model.currentWindowId,
      }),
    [visible, groupMode, model.currentWindowId],
  );
  const visual = useMemo(() => groups.flatMap((group) => group.tabs), [groups]);
  const byId = useMemo(
    () => new Map(model.tabs.map((tab) => [tab.id, tab])),
    [model.tabs],
  );
  const duplicateTabs = useMemo(
    () => model.tabs.map(toDuplicateTab),
    [model.tabs],
  );
  const closableIds = useMemo(
    () => tabsToClose(duplicateTabs, model.settings),
    [duplicateTabs, model.settings],
  );
  const duplicateIds = useMemo(() => {
    const ids = new Set<number>();
    for (const group of duplicateSets(duplicateTabs, model.settings)) {
      for (const tab of group) ids.add(tab.id);
    }
    return ids;
  }, [duplicateTabs, model.settings]);
  const closableCount = duplicateCount(duplicateTabs, model.settings);
  const groupById = useMemo(
    () => new Map(model.groups.map((group) => [group.id, group])),
    [model.groups],
  );
  const windows = useMemo(
    () =>
      model.windows
        .filter(
          (item): item is chrome.windows.Window & { id: number } =>
            item.id != null,
        )
        .sort((left, right) => left.id - right.id),
    [model.windows],
  );

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(visual.length - 1, 0)));
  }, [visual.length]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => byId.has(id)));
  }, [byId]);

  useEffect(() => {
    const current = visual[cursor];
    if (!current) return;
    document
      .getElementById(`tabby-tab-${current.id}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, visual]);

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>(
      "[data-slot=command-input]",
    );
    input?.focus();
  }, []);

  const selectIndex = useCallback(
    (index: number, shift: boolean) => {
      const tab = visual[index];
      if (!tab) return;
      setCursor(index);
      if (shift) {
        const anchor = anchorId ?? tab.id;
        const anchorIndex = visual.findIndex((item) => item.id === anchor);
        const start = Math.min(anchorIndex < 0 ? index : anchorIndex, index);
        const end = Math.max(anchorIndex < 0 ? index : anchorIndex, index);
        setSelectedIds(visual.slice(start, end + 1).map((item) => item.id));
        if (anchorId == null) setAnchorId(anchor);
        return;
      }
      setSelectedIds([tab.id]);
      setAnchorId(tab.id);
    },
    [anchorId, visual],
  );

  const actionIds = useCallback((): number[] => {
    const selected = selectedIds.filter((id) => byId.has(id));
    if (selected.length > 0) return selected;
    const current = visual[cursor];
    return current ? [current.id] : [];
  }, [byId, cursor, selectedIds, visual]);

  const closeIds = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    await closeTabs(ids);
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
  }, []);

  const discardIds = useCallback(
    async (ids: number[]) => {
      const targets = ids.flatMap((id) => {
        const tab = byId.get(id);
        if (!tab || tab.active || tab.discarded) return [];
        return [tab];
      });
      const skippedActive = ids.some((id) => byId.get(id)?.active);
      if (targets.length === 0) {
        toast.message(
          skippedActive
            ? "The active tab stays awake"
            : "Those tabs are already asleep",
        );
        return;
      }
      await Promise.all(targets.map((tab) => discardTab(tab.id)));
      const suffix = targets.length === 1 ? "" : "s";
      toast.success(`Discarded ${targets.length} tab${suffix}`);
    },
    [byId],
  );

  const moveIds = useCallback(
    async (ids: number[], windowId: number) => {
      const movable = ids.filter((id) => byId.get(id)?.windowId !== windowId);
      if (movable.length === 0) return;
      await moveTabs(movable, windowId);
    },
    [byId],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (visual.length === 0) return;
      const typing =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const next = Math.min(
          visual.length - 1,
          Math.max(0, cursor + direction),
        );
        selectIndex(next, event.shiftKey);
        return;
      }

      if (event.key === "Enter") {
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        event.stopPropagation();
        const tab = visual[cursor];
        if (!tab) return;
        void runAction(
          () => activateTab(tab.id, tab.windowId),
          "Couldn't activate that tab",
        );
        return;
      }

      if (typing) return;

      if (
        event.key === "x" ||
        event.key === "Backspace" ||
        event.key === "Delete"
      ) {
        event.preventDefault();
        event.stopPropagation();
        void runAction(
          () => closeIds(actionIds()),
          "Couldn't close those tabs",
        );
        return;
      }
      if (event.key === "p") {
        event.preventDefault();
        event.stopPropagation();
        const tab = visual[cursor];
        if (!tab) return;
        void runAction(
          () => setPinned(tab.id, !tab.pinned),
          "Couldn't change pin",
        );
        return;
      }
      if (event.key === "d") {
        event.preventDefault();
        event.stopPropagation();
        void runAction(
          () => discardIds(actionIds()),
          "Couldn't discard those tabs",
        );
      }
    },
    [actionIds, closeIds, cursor, discardIds, selectIndex, visual],
  );

  const matchValues = [
    ...(model.settings.includeQuery ? ["query"] : []),
    ...(model.settings.includeHash ? ["hash"] : []),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDownCapture={onKeyDown}>
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-xs font-semibold">
          T
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-none font-semibold">Tabby</div>
          <div className="text-muted-foreground text-xs">
            {model.tabs.length === 1 ? "1 tab" : `${model.tabs.length} tabs`}
          </div>
        </div>
        {closableCount > 0 ? <Badge>{closableCount}</Badge> : null}
        <ClosedMenu sessions={model.closed} />
        {surface === "popup" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Open side panel"
                disabled={model.currentWindowId == null}
                onClick={() => {
                  if (model.currentWindowId == null) return;
                  void openSidePanel(model.currentWindowId).catch(
                    (error: unknown) => {
                      toast.error(
                        messageFrom(error, "Couldn't open the side panel"),
                      );
                    },
                  );
                }}
              >
                <PanelRightIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open side panel</TooltipContent>
          </Tooltip>
        ) : null}
      </header>

      <Command
        shouldFilter={false}
        className="bg-transparent flex min-h-0 flex-1 flex-col rounded-none p-0"
      >
        <div className="px-3">
          <CommandInput
            autoFocus
            placeholder="Search title, URL, or domain"
            value={query}
            onValueChange={setQuery}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            spacing={0}
            value={groupMode}
            onValueChange={(value) => {
              if (value === "window" || value === "site") setGroupMode(value);
            }}
          >
            <ToggleGroupItem value="window">Window</ToggleGroupItem>
            <ToggleGroupItem value="site">Site</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="multiple"
            size="sm"
            variant="outline"
            spacing={0}
            value={matchValues}
            onValueChange={(values) => {
              void model.saveSettings({
                includeQuery: values.includes("query"),
                includeHash: values.includes("hash"),
              });
            }}
          >
            <ToggleGroupItem value="query" aria-label="Compare query strings">
              Query
            </ToggleGroupItem>
            <ToggleGroupItem value="hash" aria-label="Compare hashes">
              Hash
            </ToggleGroupItem>
          </ToggleGroup>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="ml-auto"
            disabled={closableCount === 0}
            onClick={() => {
              void runAction(async () => {
                await closeIds(closableIds);
                const suffix = closableCount === 1 ? "" : "s";
                toast.success(`Closed ${closableCount} duplicate${suffix}`);
              }, "Couldn't close duplicates");
            }}
          >
            Close duplicates
          </Button>
        </div>

        {selectedIds.length > 0 ? (
          <div className="bg-muted/60 mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5">
            <span className="text-xs font-medium">
              {selectedIds.length === 1
                ? "1 selected"
                : `${selectedIds.length} selected`}
            </span>
            <Button
              type="button"
              size="xs"
              variant="destructive"
              onClick={() => {
                void runAction(
                  () => closeIds(selectedIds),
                  "Couldn't close those tabs",
                );
              }}
            >
              Close
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => {
                void runAction(
                  () => discardIds(selectedIds),
                  "Couldn't discard those tabs",
                );
              }}
            >
              Discard
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="xs" variant="outline">
                  Move
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>Move to window</DropdownMenuLabel>
                {windows.length === 0 ? (
                  <DropdownMenuItem disabled>No windows</DropdownMenuItem>
                ) : (
                  windows.map((item, index) => (
                    <DropdownMenuItem
                      key={item.id}
                      onSelect={() => {
                        void runAction(
                          () => moveIds(selectedIds, item.id),
                          "Couldn't move those tabs",
                        );
                      }}
                    >
                      {windowName(item, index, model.currentWindowId)}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="ml-auto"
              onClick={() => setSelectedIds([])}
            >
              Clear
            </Button>
          </div>
        ) : null}

        <Separator />

        <CommandList className="max-h-none min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {model.loadError ? (
              <p className="text-destructive px-3 py-6 text-center text-sm">
                {model.loadError}
              </p>
            ) : !model.ready ? (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                Loading tabs…
              </p>
            ) : visual.length === 0 ? (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                {query.trim() ? "No matching tabs" : "No tabs open"}
              </p>
            ) : (
              <div role="listbox" aria-label="Tabs" className="py-1">
                {groups.map((group) => (
                  <section key={group.id} className="mb-1">
                    <h2 className="text-muted-foreground px-3 py-1 text-[11px] font-medium tracking-wide uppercase">
                      {group.label}
                      <span className="ml-1 tabular-nums">
                        ({group.tabs.length})
                      </span>
                    </h2>
                    {group.tabs.map((tab) => {
                      const index = visual.findIndex(
                        (item) => item.id === tab.id,
                      );
                      return (
                        <TabRow
                          key={tab.id}
                          tab={tab}
                          selected={selectedIds.includes(tab.id)}
                          highlighted={visual[cursor]?.id === tab.id}
                          duplicate={duplicateIds.has(tab.id)}
                          group={groupById.get(tab.groupId)}
                          windows={windows}
                          groups={model.groups}
                          currentWindowId={model.currentWindowId}
                          onSelect={(shift) => selectIndex(index, shift)}
                          onActivate={() => {
                            void runAction(
                              () => activateTab(tab.id, tab.windowId),
                              "Couldn't activate that tab",
                            );
                          }}
                          onClose={() => {
                            void runAction(
                              () => closeIds([tab.id]),
                              "Couldn't close that tab",
                            );
                          }}
                          onPin={() => {
                            void runAction(
                              () => setPinned(tab.id, !tab.pinned),
                              "Couldn't change pin",
                            );
                          }}
                          onMute={() => {
                            void runAction(
                              () => setMuted(tab.id, !tab.muted),
                              "Couldn't change mute",
                            );
                          }}
                          onDiscard={() => {
                            void runAction(
                              () => discardIds([tab.id]),
                              "Couldn't discard that tab",
                            );
                          }}
                          onMove={(windowId) => {
                            void runAction(
                              () => moveIds([tab.id], windowId),
                              "Couldn't move that tab",
                            );
                          }}
                          onGroup={(groupId) => {
                            void runAction(async () => {
                              if (groupId === NO_GROUP)
                                await ungroupTabs([tab.id]);
                              else await addTabsToGroup([tab.id], groupId);
                            }, "Couldn't move that tab into the group");
                          }}
                        />
                      );
                    })}
                  </section>
                ))}
              </div>
            )}
          </ScrollArea>
        </CommandList>
      </Command>

      <Separator />
      <p className="text-muted-foreground px-3 py-1.5 text-[11px]">
        ↑↓ move · Enter open · x close · p pin · d discard
      </p>
    </div>
  );
}

function TabRow({
  tab,
  selected,
  highlighted,
  duplicate,
  group,
  windows,
  groups,
  currentWindowId,
  onSelect,
  onActivate,
  onClose,
  onPin,
  onMute,
  onDiscard,
  onMove,
  onGroup,
}: {
  tab: TabModel;
  selected: boolean;
  highlighted: boolean;
  duplicate: boolean;
  group: chrome.tabGroups.TabGroup | undefined;
  windows: (chrome.windows.Window & { id: number })[];
  groups: chrome.tabGroups.TabGroup[];
  currentWindowId: number | undefined;
  onSelect: (shift: boolean) => void;
  onActivate: () => void;
  onClose: () => void;
  onPin: () => void;
  onMute: () => void;
  onDiscard: () => void;
  onMove: (windowId: number) => void;
  onGroup: (groupId: number) => void;
}) {
  return (
    <div
      id={`tabby-tab-${tab.id}`}
      role="option"
      aria-selected={selected || highlighted}
      className={`flex items-center gap-2 px-2 py-1 ${highlighted ? "bg-accent" : ""} ${selected && !highlighted ? "bg-muted/70" : ""}`}
      onClick={(event) => {
        if (isControlTarget(event.target)) return;
        onSelect(event.shiftKey);
      }}
      onDoubleClick={(event) => {
        if (isControlTarget(event.target)) return;
        onActivate();
      }}
    >
      <Checkbox
        checked={selected}
        aria-label={`Select ${tab.title}`}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(event.shiftKey);
        }}
      />
      <Favicon src={tab.favIconUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {tab.active ? (
            <span className="bg-primary size-1.5 shrink-0 rounded-full" />
          ) : null}
          <span className="truncate text-sm">{tab.title}</span>
        </div>
        <div className="text-muted-foreground truncate text-xs">
          {tab.domain || tab.url || "No URL"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {group ? (
          <span
            className={`size-2 rounded-full ${groupColorClass(group.color)}`}
            title={group.title || "Tab group"}
          />
        ) : null}
        {tab.pinned ? (
          <PinIcon className="text-muted-foreground size-3" />
        ) : null}
        {tab.muted ? (
          <VolumeXIcon className="text-muted-foreground size-3" />
        ) : tab.audible ? (
          <Volume2Icon className="text-muted-foreground size-3" />
        ) : null}
        {tab.discarded ? (
          <MoonIcon className="text-muted-foreground size-3" />
        ) : null}
        {duplicate ? (
          <Badge variant="outline" className="px-1">
            Dup
          </Badge>
        ) : null}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={`Actions for ${tab.title}`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onActivate}>Activate</DropdownMenuItem>
          <DropdownMenuItem onSelect={onPin}>
            {tab.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onMute}>
            {tab.muted ? "Unmute" : "Mute"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={tab.active || tab.discarded}
            onSelect={onDiscard}
          >
            {tab.discarded ? "Asleep" : "Discard"}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onClose}>
            Close
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to window</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              {windows.map((item, index) => (
                <DropdownMenuItem
                  key={item.id}
                  disabled={item.id === tab.windowId}
                  onSelect={() => onMove(item.id)}
                >
                  {windowName(item, index, currentWindowId)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to group</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {tab.groupId !== NO_GROUP ? (
                <DropdownMenuItem onSelect={() => onGroup(NO_GROUP)}>
                  Remove from group
                </DropdownMenuItem>
              ) : null}
              {groups.length === 0 ? (
                <DropdownMenuItem disabled>No tab groups</DropdownMenuItem>
              ) : (
                groups.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    disabled={item.id === tab.groupId}
                    onSelect={() => onGroup(item.id)}
                  >
                    <span
                      className={`size-2 rounded-full ${groupColorClass(item.color)}`}
                    />
                    {item.title || "Untitled group"}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ClosedMenu({ sessions }: { sessions: chrome.sessions.Session[] }) {
  const entries = closedEntries(sessions);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Recently closed"
            >
              <HistoryIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Recently closed</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Recently closed</DropdownMenuLabel>
        {entries.length === 0 ? (
          <DropdownMenuItem disabled>Nothing to restore</DropdownMenuItem>
        ) : (
          entries.map((entry) => (
            <DropdownMenuItem
              key={entry.sessionId}
              onSelect={() => {
                void runAction(async () => {
                  await restoreSession(entry.sessionId);
                  toast.success("Restored");
                }, "Couldn't restore that session");
              }}
            >
              <span className="min-w-0">
                <span className="block truncate">{entry.title}</span>
                <span className="text-muted-foreground block truncate text-xs">
                  {entry.detail}
                </span>
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Favicon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return <GlobeIcon className="text-muted-foreground size-4 shrink-0" />;
  return (
    <img
      src={src}
      alt=""
      className="size-4 shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle("dark", media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return null;
}

function useTabbyModel() {
  const [tabs, setTabs] = useState<TabModel[]>([]);
  const [windows, setWindows] = useState<chrome.windows.Window[]>([]);
  const [groups, setGroups] = useState<chrome.tabGroups.TabGroup[]>([]);
  const [closed, setClosed] = useState<chrome.sessions.Session[]>([]);
  const [settings, setSettings] = useState<UrlKeyOptions>({
    includeQuery: false,
    includeHash: false,
  });
  const [currentWindowId, setCurrentWindowId] = useState<number | undefined>(
    undefined,
  );
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [
        nextTabs,
        nextWindows,
        nextGroups,
        nextClosed,
        nextSettings,
        current,
      ] = await Promise.all([
        queryTabs(),
        listWindows(),
        listTabGroups(),
        getRecentlyClosed(),
        getDuplicateSettings(),
        getCurrentWindow(),
      ]);
      setTabs(nextTabs.flatMap(toTabModel));
      setWindows(nextWindows);
      setGroups(nextGroups);
      setClosed(nextClosed);
      setSettings(nextSettings);
      setCurrentWindowId(current.id);
      setLoadError(null);
      setReady(true);
    } catch (error: unknown) {
      setLoadError(messageFrom(error, "Couldn't load tabs"));
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const stopTabs = onTabsChanged(() => {
      void refresh();
    });
    const stopSettings = onDuplicateSettingsChanged(() => {
      void refresh();
    });
    return () => {
      stopTabs();
      stopSettings();
    };
  }, [refresh]);

  const saveSettings = useCallback(async (next: UrlKeyOptions) => {
    setSettings(next);
    try {
      await setDuplicateSettings(next);
    } catch (error: unknown) {
      toast.error(messageFrom(error, "Couldn't save duplicate settings"));
    }
  }, []);

  return {
    tabs,
    windows,
    groups,
    closed,
    settings,
    currentWindowId,
    ready,
    loadError,
    saveSettings,
  };
}

function toTabModel(tab: chrome.tabs.Tab): TabModel[] {
  if (tab.id == null) return [];
  const url = tab.url ?? tab.pendingUrl ?? "";
  return [
    {
      id: tab.id,
      windowId: tab.windowId,
      index: tab.index,
      title: tab.title || url || "Untitled",
      url,
      domain: domainFromUrl(url),
      favIconUrl: tab.favIconUrl ?? "",
      active: tab.active,
      pinned: tab.pinned,
      muted: tab.mutedInfo?.muted ?? false,
      discarded: tab.discarded ?? false,
      audible: tab.audible ?? false,
      groupId: tab.groupId ?? NO_GROUP,
      lastAccessed: tab.lastAccessed ?? 0,
    },
  ];
}

function toDuplicateTab(tab: TabModel): DuplicateTab {
  return {
    id: tab.id,
    url: tab.url,
    active: tab.active,
    pinned: tab.pinned,
    lastAccessed: tab.lastAccessed,
  };
}

function closedEntries(
  sessions: readonly chrome.sessions.Session[],
): ClosedEntry[] {
  const entries: ClosedEntry[] = [];
  for (const session of sessions) {
    const tab = session.tab;
    if (tab?.sessionId) {
      entries.push({
        sessionId: tab.sessionId,
        title: tab.title || tab.url || "Closed tab",
        detail: tab.url ? domainFromUrl(tab.url) || tab.url : "Tab",
      });
      continue;
    }
    const windowSession = session.window;
    if (windowSession?.sessionId) {
      const count = windowSession.tabs?.length ?? 0;
      entries.push({
        sessionId: windowSession.sessionId,
        title:
          count === 1
            ? "Closed window · 1 tab"
            : `Closed window · ${count} tabs`,
        detail: "Window",
      });
    }
  }
  return entries;
}

function windowName(
  item: chrome.windows.Window & { id: number },
  index: number,
  currentWindowId: number | undefined,
): string {
  if (item.id === currentWindowId) return "This window";
  return `Window ${index + 1}`;
}

function groupColorClass(color: string): string {
  return GROUP_COLORS[color] ?? "bg-zinc-400";
}

function isControlTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("button, a, [data-slot=checkbox]"))
  );
}

async function runAction(
  action: () => Promise<unknown>,
  failure: string,
): Promise<void> {
  try {
    await action();
  } catch (error: unknown) {
    toast.error(messageFrom(error, failure));
  }
}

function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
