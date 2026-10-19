export type SavedSessionTab = {
  url: string;
  title: string;
  pinned: boolean;
};

export type NamedSession = {
  id: string;
  name: string;
  savedAt: number;
  tabs: SavedSessionTab[];
};

export function sessionTabsFromWindow(
  tabs: readonly {
    url: string;
    title: string;
    pinned: boolean;
    index: number;
  }[],
): SavedSessionTab[] {
  return [...tabs]
    .sort((left, right) => left.index - right.index)
    .flatMap((tab) => {
      if (!isWebUrl(tab.url)) return [];
      return [
        {
          url: tab.url,
          title: tab.title.trim() || tab.url,
          pinned: tab.pinned,
        },
      ];
    });
}

export function addNamedSession(
  sessions: readonly NamedSession[],
  input: {
    id: string;
    name: string;
    savedAt: number;
    tabs: readonly SavedSessionTab[];
  },
): NamedSession[] | null {
  const name = input.name.trim();
  if (!input.id || !name || input.tabs.length === 0) return null;
  const session: NamedSession = {
    id: input.id,
    name,
    savedAt: input.savedAt,
    tabs: input.tabs.map((tab) => ({ ...tab })),
  };
  return [session, ...sessions];
}

export function renameNamedSession(
  sessions: readonly NamedSession[],
  id: string,
  name: string,
): NamedSession[] | null {
  const nextName = name.trim();
  if (!nextName) return null;
  if (!sessions.some((session) => session.id === id)) return null;
  return sessions.map((session) =>
    session.id === id ? { ...session, name: nextName } : session,
  );
}

export function deleteNamedSession(
  sessions: readonly NamedSession[],
  id: string,
): NamedSession[] {
  return sessions.filter((session) => session.id !== id);
}

export function parseNamedSessions(value: unknown): NamedSession[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const session = parseNamedSession(item);
    return session ? [session] : [];
  });
}

function parseNamedSession(value: unknown): NamedSession | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.length === 0) return null;
  if (typeof record.name !== "string" || record.name.trim().length === 0) {
    return null;
  }
  if (typeof record.savedAt !== "number" || !Number.isFinite(record.savedAt)) {
    return null;
  }
  if (!Array.isArray(record.tabs)) return null;
  const tabs = record.tabs.flatMap((tab) => {
    const parsed = parseSavedTab(tab);
    return parsed ? [parsed] : [];
  });
  if (tabs.length === 0) return null;
  return {
    id: record.id,
    name: record.name.trim(),
    savedAt: record.savedAt,
    tabs,
  };
}

function parseSavedTab(value: unknown): SavedSessionTab | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.url !== "string" || !isWebUrl(record.url)) return null;
  const title =
    typeof record.title === "string" && record.title.trim().length > 0
      ? record.title
      : record.url;
  return {
    url: record.url,
    title,
    pinned: record.pinned === true,
  };
}

function isWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
