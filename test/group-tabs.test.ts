import { describe, expect, it } from "vitest";

import { groupTabs } from "@/lib/group-tabs";

const tabs = [
  { id: 1, windowId: 10, domain: "github.com" },
  { id: 2, windowId: 10, domain: "example.com" },
  { id: 3, windowId: 20, domain: "github.com" },
  { id: 4, windowId: 20, domain: "" },
];

describe("groupTabs", () => {
  it("groups by window and marks the current one", () => {
    const groups = groupTabs(tabs, "window", { currentWindowId: 20 });
    expect(groups.map((group) => group.label)).toEqual([
      "Window 1",
      "Window 2 · this window",
    ]);
    expect(groups[0]?.tabs.map((tab) => tab.id)).toEqual([1, 2]);
    expect(groups[1]?.tabs.map((tab) => tab.id)).toEqual([3, 4]);
  });

  it("groups by site, sorts domains, and keeps tab order", () => {
    const groups = groupTabs(tabs, "site");
    expect(groups.map((group) => group.label)).toEqual([
      "example.com",
      "github.com",
      "Other",
    ]);
    expect(
      groups
        .find((group) => group.label === "github.com")
        ?.tabs.map((tab) => tab.id),
    ).toEqual([1, 3]);
    expect(
      groups
        .find((group) => group.label === "Other")
        ?.tabs.map((tab) => tab.id),
    ).toEqual([4]);
  });

  it("returns no groups for an empty list", () => {
    expect(groupTabs([], "window")).toEqual([]);
    expect(groupTabs([], "site")).toEqual([]);
  });
});
