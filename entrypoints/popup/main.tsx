import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { TabbyApp } from "@/components/tabby-app";
import "@/assets/tailwind.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");

createRoot(root).render(
  <StrictMode>
    <TabbyApp surface="popup" />
  </StrictMode>,
);
