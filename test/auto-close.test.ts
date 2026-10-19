import { describe, expect, it } from "vitest";

import {
  decideAutoClose,
  parseAutoCloseEnabled,
  type AutoCloseTab,
} from "@/lib/auto-close";
import type { UrlKeyOptions } from "@/lib/url-key";

const pathOnly: UrlKeyOptions = { includeQuery: false, includeHash: false };

function tab(
  overrides: Partial<AutoCloseTab> & Pick<AutoCloseTab, "id" | "url">,
): AutoCloseTab {
  return {
    pinned: false,
    windowId: 1,
    ...overrides,
  };
}

describe("decideAutoClose", () => {
  it("closes the newer tab and keeps the older one", () => {
    const older = tab({ id: 2, url: "https://example.com/docs", windowId: 4 });
    const newer = tab({
      id: 8,
      url: "https://example.com/docs?q=1#top",
      windowId: 9,
    });
    expect(decideAutoClose(newer, [older, newer], pathOnly)).toEqual({
      closeId: 8,
      keepId: 2,
      keepWindowId: 4,
    });
    expect(decideAutoClose(older, [older, newer], pathOnly)).toBeNull();
  });

  it("never closes a pinned tab", () => {
    const older = tab({ id: 2, url: "https://example.com/docs" });
    const pinned = tab({
      id: 8,
      url: "https://example.com/docs",
      pinned: true,
    });
    expect(decideAutoClose(pinned, [older, pinned], pathOnly)).toBeNull();
  });

  it("ignores blank, about:blank, and browser-internal URLs", () => {
    const cases = [
      "",
      "about:blank",
      "chrome://newtab",
      "chrome-extension://abc/page.html",
    ];
    for (const url of cases) {
      const opened = tab({ id: 3, url });
      const existing = tab({ id: 1, url });
      expect(decideAutoClose(opened, [existing, opened], pathOnly)).toBeNull();
    }
  });

  it("ignores a tab whose URL has not settled", () => {
    const blank = tab({
      id: 5,
      url: "about:blank",
      pendingUrl: "https://example.com/docs",
    });
    const navigating = tab({
      id: 6,
      url: "https://example.com/docs",
      pendingUrl: "https://example.com/other",
    });
    const existing = tab({ id: 1, url: "https://example.com/docs" });
    expect(decideAutoClose(blank, [existing, blank], pathOnly)).toBeNull();
    expect(
      decideAutoClose(navigating, [existing, navigating], pathOnly),
    ).toBeNull();
  });

  it("follows the query and hash settings", () => {
    const older = tab({ id: 1, url: "https://example.com/a?x=1#one" });
    const newer = tab({ id: 2, url: "https://example.com/a?x=2#two" });
    expect(decideAutoClose(newer, [older, newer], pathOnly)?.closeId).toBe(2);
    expect(
      decideAutoClose(newer, [older, newer], {
        includeQuery: true,
        includeHash: false,
      }),
    ).toBeNull();
    expect(
      decideAutoClose(newer, [older, newer], {
        includeQuery: false,
        includeHash: true,
      }),
    ).toBeNull();
  });

  it("keeps the oldest match when several tabs share a key", () => {
    const newest = tab({ id: 9, url: "https://example.com/a", windowId: 3 });
    const tabs = [
      tab({ id: 4, url: "https://example.com/a", windowId: 2 }),
      tab({ id: 7, url: "https://example.com/a", windowId: 3 }),
      newest,
    ];
    expect(decideAutoClose(newest, tabs, pathOnly)).toEqual({
      closeId: 9,
      keepId: 4,
      keepWindowId: 2,
    });
  });
});

describe("parseAutoCloseEnabled", () => {
  it("is off unless the stored value is true", () => {
    expect(parseAutoCloseEnabled(undefined)).toBe(false);
    expect(parseAutoCloseEnabled(false)).toBe(false);
    expect(parseAutoCloseEnabled("true")).toBe(false);
    expect(parseAutoCloseEnabled(true)).toBe(true);
  });
});
