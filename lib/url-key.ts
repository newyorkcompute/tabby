export type UrlKeyOptions = {
  includeQuery: boolean;
  includeHash: boolean;
};

/**
 * Identity used for duplicate detection.
 * Always origin + path. Query and hash are optional extras.
 * Non-standard schemes (chrome:, about:, file:) use protocol + host
 * because their URL origin is opaque.
 */
export function urlKey(rawUrl: string, options: UrlKeyOptions): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const origin =
    url.origin === "null" ? `${url.protocol}//${url.host}` : url.origin;
  let key = `${origin}${url.pathname}`;
  if (options.includeQuery) key += url.search;
  if (options.includeHash) key += url.hash;
  return key;
}

export function domainFromUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.replace(/^www\./i, "");
    if (hostname) return hostname;
    if (url.host) return url.host;
    return url.protocol.replace(/:$/, "");
  } catch {
    return "";
  }
}
