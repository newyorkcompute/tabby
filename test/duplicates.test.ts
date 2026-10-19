import { describe, expect, it } from "vitest";

import {
  duplicateCount,
  duplicateSets,
  tabsToClose,
  tabsToKeep,
  type DuplicateTab,
} from "@/lib/duplicates";
import type { UrlKeyOptions } from "@/lib/url-key";

const pathOnly: UrlKeyOptions = { includeQuery: false, includeHash: false };

function tab(
  overrides: Partial<DuplicateTab> & Pick<DuplicateTab, "id">,
): DuplicateTab {
  return {
    url: "https://example.com/docs",
    active: false,
    pinned: false,
    lastAccessed: 0,
    ...overrides,
  };
}

describe("tabsToKeep", () => {
  it("keeps the active tab and every pinned tab", () => {
    const group = [
      tab({ id: 1, lastAccessed: 50 }),
      tab({ id: 2, active: true, lastAccessed: 10 }),
      tab({ id: 3, pinned: true, lastAccessed: 5 }),
      tab({ id: 4, lastAccessed: 100 }),
    ];
    expect(tabsToKeep(group).map((item) => item.id)).toEqual([2, 3]);
  });

  it("keeps the most recently used tab when nothing is active or pinned", () => {
    const group = [
      tab({ id: 4, lastAccessed: 20 }),
      tab({ id: 2, lastAccessed: 40 }),
      tab({ id: 9, lastAccessed: 40 }),
    ];
    expect(tabsToKeep(group).map((item) => item.id)).toEqual([2]);
  });

  it("breaks equal lastAccessed ties by the smaller id", () => {
    const group = [
      tab({ id: 8, lastAccessed: 5 }),
      tab({ id: 3, lastAccessed: 5 }),
    ];
    expect(tabsToKeep(group).map((item) => item.id)).toEqual([3]);
  });
});

describe("tabsToClose", () => {
  it("closes only the extra copies", () => {
    const tabs = [
      tab({ id: 1, active: true, lastAccessed: 1 }),
      tab({ id: 2, lastAccessed: 50 }),
      tab({ id: 3, url: "https://example.com/other" }),
    ];
    expect(tabsToClose(tabs, pathOnly)).toEqual([2]);
    expect(duplicateCount(tabs, pathOnly)).toBe(1);
  });

  it("keeps every pinned duplicate and closes the rest", () => {
    const tabs = [
      tab({ id: 1, pinned: true }),
      tab({ id: 2, pinned: true, lastAccessed: 5 }),
      tab({ id: 3, lastAccessed: 99 }),
    ];
    expect(tabsToClose(tabs, pathOnly)).toEqual([3]);
  });

  it("does not treat unique URLs as duplicates", () => {
    const tabs = [
      tab({ id: 1, url: "https://example.com/a" }),
      tab({ id: 2, url: "https://example.com/b" }),
    ];
    expect(duplicateSets(tabs, pathOnly)).toEqual([]);
    expect(tabsToClose(tabs, pathOnly)).toEqual([]);
  });

  it("ignores tabs whose URLs cannot be parsed", () => {
    const tabs = [tab({ id: 1, url: ":::bad" }), tab({ id: 2, url: ":::bad" })];
    expect(tabsToClose(tabs, pathOnly)).toEqual([]);
  });

  it("splits groups when the query or hash is part of the key", () => {
    const tabs = [
      tab({ id: 1, url: "https://example.com/a?x=1#one", lastAccessed: 1 }),
      tab({ id: 2, url: "https://example.com/a?x=1#two", lastAccessed: 2 }),
      tab({ id: 3, url: "https://example.com/a?x=2#two", lastAccessed: 3 }),
    ];
    expect(tabsToClose(tabs, pathOnly).sort()).toEqual([1, 2]);
    expect(
      tabsToClose(tabs, { includeQuery: true, includeHash: false }).sort(),
    ).toEqual([1]);
    expect(
      tabsToClose(tabs, { includeQuery: false, includeHash: true }).sort(),
    ).toEqual([2]);
    expect(
      tabsToClose(tabs, { includeQuery: true, includeHash: true }),
    ).toEqual([]);
  });
});
