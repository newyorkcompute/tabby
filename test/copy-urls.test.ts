import { describe, expect, it } from "vitest";

import { formatCopiedUrls } from "@/lib/copy-urls";

describe("formatCopiedUrls", () => {
  it("joins the shown URLs with one per line", () => {
    expect(
      formatCopiedUrls([
        { url: "https://example.com/a" },
        { url: "  " },
        { url: "https://example.com/b" },
      ]),
    ).toBe("https://example.com/a\nhttps://example.com/b");
  });

  it("returns an empty string when nothing shown has a URL", () => {
    expect(formatCopiedUrls([{ url: "" }, { url: "   " }])).toBe("");
  });
});
