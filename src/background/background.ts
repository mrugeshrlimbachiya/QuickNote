/**
 * background/background.ts
 *
 * Service Worker (Manifest V3 replacement for background pages).
 * Responsibilities:
 *  1. Listen for the keyboard shortcut → send TOGGLE message to the active tab
 *  2. Register a right-click context-menu item → send APPEND message to the active tab
 *
 * The actual UI lives in the content script; the background worker just
 * routes messages from Chrome APIs into that script.
 */

// ─── Keyboard Shortcut ──────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-quicknote") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Guard: some pages (chrome:// URLs, etc.) block content scripts
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_QUICKNOTE" });
  } catch {
    // Silently ignore – page doesn't have our content script (e.g. New Tab page)
  }
});

// ─── Context Menu ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  // Create the right-click menu item once on install / update
  chrome.contextMenus.create({
    id: "quicknote-save-selection",
    title: "Save selection to QuickNote",
    contexts: ["selection"], // Only appears when text is selected
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "quicknote-save-selection") return;
  if (!tab?.id || !info.selectionText) return;

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "APPEND_TO_NOTE",
      text: info.selectionText.trim(),
    });
  } catch {
    // Content script not available on this page
  }
});
