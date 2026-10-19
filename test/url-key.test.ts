import { describe, expect, it } from "vitest";

import { domainFromUrl, urlKey, type UrlKeyOptions } from "@/lib/url-key";

const pathOnly: UrlKeyOptions = { includeQuery: false, includeHash: false };

describe("urlKey", () => {
  it("matches origin and path while ignoring query and hash", () => {
    const left = urlKey("https://example.com/docs/guide", pathOnly);
    const right = urlKey(
      "https://example.com/docs/guide?q=1#section",
      pathOnly,
    );
    expect(left).toBe("https://example.com/docs/guide");
    expect(left).toBe(right);
  });

  it("can include the query string", () => {
    const options: UrlKeyOptions = { includeQuery: true, includeHash: false };
    expect(urlKey("https://example.com/a?q=1", options)).toBe(
      "https://example.com/a?q=1",
    );
    expect(urlKey("https://example.com/a?q=1", options)).not.toBe(
      urlKey("https://example.com/a?q=2", options),
    );
  });

  it("can include the hash", () => {
    const options: UrlKeyOptions = { includeQuery: false, includeHash: true };
    expect(urlKey("https://example.com/a#one", options)).toBe(
      "https://example.com/a#one",
    );
    expect(urlKey("https://example.com/a#one", options)).not.toBe(
      urlKey("https://example.com/a#two", options),
    );
  });

  it("treats a different path or origin as a different tab", () => {
    expect(urlKey("https://example.com/a", pathOnly)).not.toBe(
      urlKey("https://example.com/b", pathOnly),
    );
    expect(urlKey("https://example.com/a", pathOnly)).not.toBe(
      urlKey("https://other.example/a", pathOnly),
    );
  });

  it("keeps www as a distinct host", () => {
    expect(urlKey("https://www.example.com/a", pathOnly)).not.toBe(
      urlKey("https://example.com/a", pathOnly),
    );
  });

  it("builds a stable key for non-http URLs", () => {
    expect(urlKey("chrome://newtab", pathOnly)).toBe("chrome://newtab");
    expect(urlKey("chrome://extensions/", pathOnly)).toBe(
      "chrome://extensions/",
    );
    expect(urlKey("about:blank", pathOnly)).toBe("about://blank");
    expect(urlKey("file:///tmp/notes.txt", pathOnly)).toBe(
      "file:///tmp/notes.txt",
    );
  });

  it("returns null for an unparseable URL", () => {
    expect(urlKey("not a url", pathOnly)).toBeNull();
  });
});

describe("domainFromUrl", () => {
  it("drops a leading www and falls back for internal pages", () => {
    expect(domainFromUrl("https://www.Example.com/path")).toBe("example.com");
    expect(domainFromUrl("chrome://extensions")).toBe("extensions");
    expect(domainFromUrl("not a url")).toBe("");
  });
});
