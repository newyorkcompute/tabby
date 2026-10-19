import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// Chrome only. The toolbar action keeps its popup: do not call
// sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Tabby",
    description: "Search, tidy, and unload Chrome tabs.",
    permissions: [
      "tabs",
      "tabGroups",
      "sessions",
      "sidePanel",
      "storage",
      "clipboardWrite",
    ],
    action: {
      default_title: "Tabby",
    },
    commands: {
      "open-side-panel": {
        description: "Open the Tabby side panel",
        suggested_key: {
          default: "Alt+Shift+T",
          mac: "Alt+Shift+T",
        },
      },
    },
    icons: {
      "16": "icon/16.png",
      "32": "icon/32.png",
      "48": "icon/48.png",
      "128": "icon/128.png",
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "."),
      },
    },
  }),
});
