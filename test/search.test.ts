import { describe, expect, it } from "vitest";

import { searchTabs, type SearchableTab } from "@/lib/search";

const tabs: SearchableTab[] = [
  { title: "README", url: "https://example.com/start", domain: "example.com" },
  { title: "Notes", url: "https://example.com/readme", domain: "example.com" },
  {
    title: "GitHub",
    url: "https://github.com/acme/tabby",
    domain: "github.com",
  },
  {
    title: "Inbox",
    url: "https://mail.example.com/",
    domain: "mail.example.com",
  },
];

describe("searchTabs", () => {
  it("returns every tab in order when the query is empty", () => {
    expect(searchTabs(tabs, "   ")).toEqual(tabs);
  });

  it("ranks a title match ahead of a URL-only match", () => {
    const results = searchTabs(tabs, "readme");
    expect(results.map((tab) => tab.title)).toEqual(["README", "Notes"]);
  });

  it("matches the domain and is case insensitive", () => {
    expect(searchTabs(tabs, "GiTHuB").map((tab) => tab.title)).toEqual([
      "GitHub",
    ]);
  });

  it("fuzzy-matches characters in order", () => {
    expect(searchTabs(tabs, "gthb").map((tab) => tab.domain)).toContain(
      "github.com",
    );
  });

  it("ranks a prefix ahead of a later substring", () => {
    const ranked = searchTabs(
      [
        {
          title: "The cat",
          url: "https://example.com/a",
          domain: "example.com",
        },
        {
          title: "Cat photos",
          url: "https://example.com/b",
          domain: "example.com",
        },
      ],
      "cat",
    );
    expect(ranked.map((tab) => tab.title)).toEqual(["Cat photos", "The cat"]);
  });

  it("drops tabs that do not match", () => {
    expect(searchTabs(tabs, "zzzz")).toEqual([]);
  });
});
