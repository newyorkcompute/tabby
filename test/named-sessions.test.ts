import { describe, expect, it } from "vitest";

import {
  addNamedSession,
  deleteNamedSession,
  parseNamedSessions,
  renameNamedSession,
  sessionTabsFromWindow,
  type NamedSession,
} from "@/lib/named-sessions";

const windowTabs = [
  {
    index: 2,
    url: "https://example.com/b",
    title: "B",
    pinned: false,
  },
  {
    index: 0,
    url: "chrome://newtab",
    title: "New Tab",
    pinned: false,
  },
  {
    index: 1,
    url: "https://example.com/a",
    title: "A",
    pinned: true,
  },
  {
    index: 3,
    url: "about:blank",
    title: "Blank",
    pinned: false,
  },
  {
    index: 4,
    url: "file:///tmp/notes.txt",
    title: "Notes",
    pinned: false,
  },
];

describe("sessionTabsFromWindow", () => {
  it("keeps http(s) tabs in window order and drops internal pages", () => {
    expect(sessionTabsFromWindow(windowTabs)).toEqual([
      { url: "https://example.com/a", title: "A", pinned: true },
      { url: "https://example.com/b", title: "B", pinned: false },
    ]);
  });
});

describe("named session edits", () => {
  const existing: NamedSession = {
    id: "old",
    name: "Morning",
    savedAt: 1,
    tabs: [{ url: "https://example.com", title: "Example", pinned: false }],
  };

  it("adds a trimmed session at the front", () => {
    const next = addNamedSession([existing], {
      id: "new",
      name: "  Reading  ",
      savedAt: 2,
      tabs: sessionTabsFromWindow(windowTabs),
    });
    expect(next?.map((session) => session.name)).toEqual([
      "Reading",
      "Morning",
    ]);
    expect(next?.[0]?.tabs).toHaveLength(2);
  });

  it("rejects a blank name or a window with no web tabs", () => {
    expect(
      addNamedSession([], {
        id: "new",
        name: "   ",
        savedAt: 2,
        tabs: sessionTabsFromWindow(windowTabs),
      }),
    ).toBeNull();
    expect(
      addNamedSession([], {
        id: "new",
        name: "Empty",
        savedAt: 2,
        tabs: [],
      }),
    ).toBeNull();
  });

  it("renames and deletes by id", () => {
    expect(renameNamedSession([existing], "old", "  Evening ")?.[0]?.name).toBe(
      "Evening",
    );
    expect(renameNamedSession([existing], "missing", "Evening")).toBeNull();
    expect(renameNamedSession([existing], "old", "  ")).toBeNull();
    expect(deleteNamedSession([existing], "old")).toEqual([]);
    expect(deleteNamedSession([existing], "missing")).toEqual([existing]);
  });
});

describe("parseNamedSessions", () => {
  it("drops malformed entries and keeps valid web tabs", () => {
    expect(
      parseNamedSessions([
        null,
        { id: "", name: "Nope", savedAt: 1, tabs: [] },
        {
          id: "ok",
          name: "  Saved  ",
          savedAt: 5,
          tabs: [
            { url: "https://example.com/a", pinned: true },
            { url: "chrome://extensions", title: "Extensions", pinned: false },
          ],
        },
      ]),
    ).toEqual([
      {
        id: "ok",
        name: "Saved",
        savedAt: 5,
        tabs: [
          {
            url: "https://example.com/a",
            title: "https://example.com/a",
            pinned: true,
          },
        ],
      },
    ]);
  });
});
