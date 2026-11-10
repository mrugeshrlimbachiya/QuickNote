/**
 * content/content.tsx
 *
 * Injected into every web page (matches: <all_urls>).
 *
 * HOW IT WORKS
 * ────────────
 * 1. A host <div> is appended to <html> (not <body>, so it survives SPA
 *    frameworks that swap out <body> content like YouTube's navigation).
 * 2. A Shadow DOM root (mode: "closed") is attached — CSS isolation.
 * 3. Compiled Tailwind CSS is injected as a <style> element inside the shadow.
 * 4. A React root mounts <FloatingNote> inside the shadow.
 * 5. Messages from the background service worker toggle the panel.
 *
 * EVENT ISOLATION — belt-and-suspenders approach
 * ───────────────────────────────────────────────
 * Shadow DOM isolates CSS, NOT events. Keyboard events fired inside a shadow
 * root still bubble up to the host document.
 *
 * We stop them at TWO layers:
 *
 *   Layer 1 (React): onKeyDown/onKeyUp/onKeyPress on the panel <div> and the
 *                    <textarea> in FloatingNote.tsx call stopPropagation() and
 *                    stopImmediatePropagation().
 *
 *   Layer 2 (Native DOM, here): A native "keydown"/"keyup" listener on the
 *                    shadow host element intercepts events as they cross the
 *                    shadow boundary and stops them before they reach the page.
 *
 * This two-layer approach is necessary because React's synthetic event system
 * and the native DOM event system are separate; some host-page listeners use
 * native addEventListener() with capture:true and would still fire if we only
 * used React's stopPropagation.
 *
 * NOTE ON ?inline IMPORT
 * ──────────────────────
 * `import shadowStyles from '../styles/shadow.css?inline'`
 * Vite processes the CSS through PostCSS (Tailwind + autoprefixer) at build
 * time and embeds the result as a string literal — no remote fetch ever made.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import FloatingNote from "../components/FloatingNote";
import shadowStyles from "../styles/shadow.css?inline";

const HOST_ID = "quicknote-shadow-host";

// Guard: avoid double-mounting if the script runs twice on the same page
if (!document.getElementById(HOST_ID)) {

  // ── 1. Create shadow host ─────────────────────────────────────────────────
  const host = document.createElement("div");
  host.id = HOST_ID;
  // `all: initial` resets every inherited CSS property so host-page styles
  // cannot cascade into our element.
  host.style.cssText =
    "all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0;" +
    "pointer-events: none;"; // host itself is invisible; children re-enable pointer-events

  // Append to <html> rather than <body> so YouTube / Gmail SPA navigation
  // (which replaces <body> content) doesn't unmount our host element.
  document.documentElement.appendChild(host);

  // ── 2. Shadow DOM ─────────────────────────────────────────────────────────
  const shadow = host.attachShadow({ mode: "closed" });

  // ── 3. Inject Tailwind CSS ────────────────────────────────────────────────
  const styleEl = document.createElement("style");
  styleEl.textContent = shadowStyles;
  shadow.appendChild(styleEl);

  // ── 4. React mount point ──────────────────────────────────────────────────
  const mountEl = document.createElement("div");
  // Re-enable pointer events for the actual UI container
  mountEl.style.cssText = "pointer-events: auto;";
  shadow.appendChild(mountEl);

  // ── 5. Native keyboard event block (Layer 2) ──────────────────────────────
  //
  // Listen on the shadow host with capture:true so we intercept keyboard events
  // AS THEY EXIT the shadow boundary, before any host-page listener sees them.
  //
  // We only block events when the panel is visible (isVisibleRef.current = true)
  // so normal page keyboard shortcuts work when our panel is closed.
  const isVisibleRef = { current: false };

  function blockKeyIfPanelOpen(e: Event) {
    if (!isVisibleRef.current) return;

    const ke = e as KeyboardEvent;

    // Always let Ctrl+Shift+Y through — it toggles us closed
    if ((ke.ctrlKey || ke.metaKey) && ke.shiftKey && ke.key === "Y") return;
    if ((ke.ctrlKey || ke.metaKey) && ke.shiftKey && ke.key === "y") return;

    // Block everything else from reaching the host page
    ke.stopPropagation();
    ke.stopImmediatePropagation();
  }

  // Use capture:true on the DOCUMENT (not the host element) so we intercept
  // events before YouTube/GitHub's own capture listeners on document.
  document.addEventListener("keydown", blockKeyIfPanelOpen, { capture: true });
  document.addEventListener("keyup",   blockKeyIfPanelOpen, { capture: true });
  document.addEventListener("keypress",blockKeyIfPanelOpen, { capture: true });

  // ── 6. React state + render ───────────────────────────────────────────────
  let isVisible = false;
  const root = ReactDOM.createRoot(mountEl);

  function render() {
    isVisibleRef.current = isVisible;
    root.render(
      <React.StrictMode>
        <FloatingNote
          isVisible={isVisible}
          onClose={() => {
            isVisible = false;
            render();
          }}
        />
      </React.StrictMode>
    );
  }

  // Initial render (hidden) — warms up React so first open is instant
  render();

  // ── 7. Message listener ───────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener(
    (message: { type: string; text?: string }) => {
      switch (message.type) {
        case "TOGGLE_QUICKNOTE":
          isVisible = !isVisible;
          render();
          break;

        case "APPEND_TO_NOTE":
          if (message.text) {
            // Open panel then fire custom event so FloatingNote can append text
            isVisible = true;
            render();
            window.dispatchEvent(
              new CustomEvent("quicknote:append", { detail: message.text })
            );
          }
          break;
      }
      return false;
    }
  );
}
