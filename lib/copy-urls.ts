export function formatCopiedUrls(tabs: readonly { url: string }[]): string {
  return tabs
    .map((tab) => tab.url.trim())
    .filter((url) => url.length > 0)
    .join("\n");
}
