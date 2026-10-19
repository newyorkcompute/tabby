export type SearchableTab = {
  title: string;
  url: string;
  domain: string;
};

const TITLE_WEIGHT = 1_000_000;
const DOMAIN_WEIGHT = 10_000;
const URL_WEIGHT = 100;

export function searchTabs<T extends SearchableTab>(
  tabs: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...tabs];

  const ranked: { tab: T; index: number; score: number }[] = [];
  tabs.forEach((tab, index) => {
    const score = scoreTab(tab, needle);
    if (score !== null) ranked.push({ tab, index, score });
  });

  ranked.sort(
    (left, right) => right.score - left.score || left.index - right.index,
  );
  return ranked.map((row) => row.tab);
}

export function scoreTab(tab: SearchableTab, query: string): number | null {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;

  const title = fuzzyScore(tab.title, needle);
  const domain = fuzzyScore(tab.domain, needle);
  const url = fuzzyScore(tab.url, needle);
  if (title === null && domain === null && url === null) return null;

  return (
    (title === null ? 0 : TITLE_WEIGHT + title) +
    (domain === null ? 0 : DOMAIN_WEIGHT + domain) +
    (url === null ? 0 : URL_WEIGHT + url)
  );
}

function fuzzyScore(text: string, needle: string): number | null {
  const haystack = text.toLowerCase();
  if (haystack.length === 0) return null;

  if (haystack === needle) return 800;
  const substringAt = haystack.indexOf(needle);
  if (substringAt >= 0) {
    let score = 500;
    if (substringAt === 0) score += 80;
    else if (isBoundary(haystack, substringAt)) score += 40;
    score += Math.max(0, 40 - substringAt);
    return score;
  }

  let queryIndex = 0;
  let score = 0;
  let streak = 0;
  let firstMatch = -1;

  for (
    let index = 0;
    index < haystack.length && queryIndex < needle.length;
    index += 1
  ) {
    const char = haystack[index];
    const expected = needle[queryIndex];
    if (char === undefined || expected === undefined || char !== expected) {
      streak = 0;
      continue;
    }
    if (firstMatch < 0) firstMatch = index;
    streak += 1;
    score += 8 + streak * 6 + (isBoundary(haystack, index) ? 12 : 0);
    queryIndex += 1;
  }

  if (queryIndex < needle.length) return null;
  return score - Math.min(30, Math.max(0, firstMatch));
}

function isBoundary(haystack: string, index: number): boolean {
  if (index <= 0) return true;
  const previous = haystack[index - 1];
  return (
    previous === " " ||
    previous === "." ||
    previous === "/" ||
    previous === "-" ||
    previous === "_" ||
    previous === "?" ||
    previous === "&" ||
    previous === "=" ||
    previous === ":"
  );
}
