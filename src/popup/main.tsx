/**
 * popup/main.tsx
 *
 * React entry point for the toolbar popup page.
 * Imported by popup.html via <script type="module">.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import Popup from "./Popup";
import "../styles/tailwind.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
