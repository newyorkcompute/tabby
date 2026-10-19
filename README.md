# Tabby

Tabby is a Chrome extension for finding and taming open tabs. It fuzzy-searches title, URL, and domain, groups tabs by window or site, and can activate, close, pin, mute, or move them. Duplicate tabs (same origin and path, with optional query and hash) can be closed while keeping the active tab, pinned tabs, and otherwise the most recently used one. The toolbar badge shows how many duplicates can be closed. Background tabs can be discarded, recently closed tabs can be restored, and tabs can be moved into Chrome tab groups.

The toolbar icon opens a compact popup. The same app runs in the side panel, opened from a button in the popup, from Chrome’s side panel menu, or with the **Open the Tabby side panel** shortcut (`Alt+Shift+T` by default).

## Install

```sh
pnpm install
```

## Develop

```sh
pnpm dev
```

Load the unpacked extension:

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select the `.output/chrome-mv3` directory from this repo (WXT’s dev build).

`pnpm build` writes the production extension to `.output/chrome-mv3` as well.

## Checks

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## License

MIT
