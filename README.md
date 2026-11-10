# QuickNote – Chrome Extension

> Take instant, per-page notes while browsing. Notes auto-save to local storage
> and re-appear every time you revisit the same URL. No backend. No sign-up.
> Works entirely offline.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Setup Instructions](#4-setup-instructions)
5. [Development Workflow](#5-development-workflow)
6. [Building for Production](#6-building-for-production)
7. [Loading the Extension into Chrome](#7-loading-the-extension-into-chrome)
8. [Core Features](#8-core-features)
9. [Keyboard Shortcuts](#9-keyboard-shortcuts)
10. [How Chrome Storage Works](#10-how-chrome-storage-works)
11. [Architecture Decisions](#11-architecture-decisions)
12. [Why This Build Was Rejected (and What We Fixed)](#12-why-this-build-was-rejected-and-what-we-fixed)
13. [Possible Future Improvements](#13-possible-future-improvements)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Project Overview

QuickNote is a Manifest V3 Chrome extension that lets you jot notes on any
webpage without leaving the tab.

**Key behaviours:**

| Behaviour | Detail |
|---|---|
| Activate | `Ctrl+Shift+Y` (Windows/Linux) or `Cmd+Shift+Y` (macOS) |
| Auto-save | 500 ms debounce after every keystroke |
| Scope | Notes are stored per URL (search params & hash stripped) |
| Persistence | `chrome.storage.local` – survives browser restarts |
| CSS isolation | Shadow DOM – the panel never breaks host-page styles |
| Dark mode | Follows OS preference via `prefers-color-scheme` |
| Context menu | Right-click selected text → "Save selection to QuickNote" |

---

## 2. Tech Stack

| Tool | Version | Why |
|---|---|---|
| **React** | 18 | Component-based UI for both popup and floating panel |
| **Vite** | 5 | Fast bundler; two separate configs for clean output |
| **TypeScript** | 5 | Type safety across the entire codebase |
| **TailwindCSS** | 3 | Utility CSS; tree-shaken at build time, zero runtime overhead |
| **Manifest V3** | – | Required by Chrome Web Store since Jan 2023 |
| **chrome.storage.local** | – | Persistent local storage accessible from all extension contexts |

### What we deliberately did NOT use

| Package | Reason avoided |
|---|---|
| `@crxjs/vite-plugin` | v1.x only works with Vite 2/3. v2 beta has a known Vite 5 bug that produces empty `<script>` tags (broken popup) and injects `localhost` HMR URLs into production builds → **Chrome Web Store rejection for "remotely hosted code"** |
| Any CDN `<script>` tag | CWS policy strictly forbids loading remote code at runtime |
| `localStorage` | Not accessible from extension service workers; `chrome.storage.local` works everywhere |

---

## 3. Folder Structure

```
quicknote-extension/
│
├── manifest.json            ← Chrome extension manifest (MV3)
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
│
├── vite.popup.config.ts     ← Build config: popup SPA  → dist/popup.html
├── vite.scripts.config.ts   ← Build config: content + background → dist/*.js
│
├── scripts/
│   ├── generate-icons.mjs   ← Generates PNG icons programmatically (no binaries)
│   └── postbuild.mjs        ← Copies manifest + icons into dist/, fixes paths
│
├── public/
│   └── icons/               ← Generated PNG icons (16, 48, 128 px)
│
└── src/
    ├── vite-env.d.ts         ← Type declaration for CSS ?inline imports
    │
    ├── background/
    │   └── background.ts     ← Service worker: keyboard shortcut + context menu
    │
    ├── content/
    │   └── content.tsx       ← Injected into every page; mounts React in Shadow DOM
    │
    ├── components/
    │   └── FloatingNote.tsx  ← The floating note panel UI
    │
    ├── popup/
    │   ├── popup.html        ← Entry HTML (no CDN links)
    │   ├── main.tsx          ← React root for the popup page
    │   └── Popup.tsx         ← Notes list: search, delete, open page
    │
    ├── storage/
    │   └── storage.ts        ← CRUD wrappers for chrome.storage.local
    │
    └── styles/
        ├── tailwind.css      ← Tailwind entry for popup page
        └── shadow.css        ← Tailwind entry for Shadow DOM (imported ?inline)
```

---

## 4. Setup Instructions

### Prerequisites

- **Node.js** ≥ 18.0 (check with `node -v`)
- **npm** ≥ 9.0 (check with `npm -v`)
- **Google Chrome** ≥ 109 (Manifest V3 support)

### Step 1 – Clone or download the project

```bash
# If using git:
git clone <your-repo-url> quicknote-extension
cd quicknote-extension

# Or just unzip the project folder and cd into it.
```

### Step 2 – Install dependencies

```bash
npm install
```

This installs React, Vite, TypeScript, TailwindCSS and all dev tools.
There are **no native C++ addons** required for the build itself.

> **Optional:** Install the `canvas` package to generate nicer icons:
> ```bash
> npm install canvas
> ```
> Without it, build still succeeds but icons are 1×1 placeholder PNGs.
> Replace `public/icons/*.png` with your own artwork if you prefer.

---

## 5. Development Workflow

```bash
npm run dev
```

This runs both Vite configs in watch mode simultaneously:

- `vite.popup.config.ts --watch` → rebuilds popup on changes
- `vite.scripts.config.ts --watch` → rebuilds content.js + background.js on changes

**After any change:**

1. Wait for Vite to finish (you'll see "built in X ms" in the terminal)
2. Go to `chrome://extensions`
3. Click the **↺ refresh** button on the QuickNote card
4. Hard-reload any tab where you want to test the content script

> There is no HMR (Hot Module Replacement) for Chrome extensions – extension
> scripts run in a privileged context that the browser controls, not Vite's
> dev server.

---

## 6. Building for Production

```bash
npm run build
```

This runs three steps in sequence:

| Step | Command | Output |
|---|---|---|
| 1 | `prebuild` (auto) | Generates `public/icons/*.png` |
| 2 | `build:popup` | `dist/src/popup/popup.html` + `dist/assets/popup.js` + CSS |
| 3 | `build:scripts` | `dist/content.js` + `dist/background.js` (IIFE format) |
| 4 | `postbuild` | Copies `manifest.json`, icons; moves `popup.html` to `dist/` root |

The final `dist/` folder is your loadable extension:

```
dist/
├── manifest.json
├── popup.html
├── background.js
├── content.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── assets/
    ├── popup.js
    └── popup.css
```

---

## 7. Loading the Extension into Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the **`dist/`** folder inside your project
5. QuickNote will appear in your extensions list
6. Pin it to the toolbar by clicking the puzzle-piece icon → pin QuickNote

**To reload after a rebuild:**

- Go to `chrome://extensions` and click the **↺** refresh button on the
  QuickNote card, OR
- Press `Ctrl+R` while on `chrome://extensions`

---

## 8. Core Features

### Floating Note Panel

- Opens/closes with `Ctrl+Shift+Y`
- Positioned top-right, above all page content (`z-index: 2147483647`)
- Note text auto-saves 500 ms after you stop typing
- Shows "saving…" → "✓ saved" status
- Clear button to wipe the current note
- Character counter
- Escape key closes the panel

### Popup Page (toolbar icon click)

- Lists all saved notes, newest first
- Shows page title, URL, note preview and timestamp ("5m ago", "2d ago")
- Hover a card to reveal **↗ open page** and **✕ delete** buttons
- Delete requires two clicks (second click confirms) to prevent accidents
- Search bar filters by URL, title, or note content
- "Clear all" button (also requires confirmation)
- "+ Note" button opens the floating panel on the current tab

### Context Menu

- Select any text on a page → right-click → "Save selection to QuickNote"
- Opens the panel on that page and appends the selected text to the current note

### Dark Mode

- Automatically follows your OS `prefers-color-scheme` setting
- Works both in the floating panel and the popup page

---

## 9. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+Y` (Win/Linux) | Toggle floating note panel |
| `Cmd+Shift+Y` (macOS) | Toggle floating note panel |
| `Escape` | Close floating panel |

### Customising the shortcut

1. Go to `chrome://extensions/shortcuts`
2. Find **QuickNote** in the list
3. Click the pencil icon next to "Toggle QuickNote floating panel"
4. Press your desired key combination

The shortcut is defined in `manifest.json` under `"commands"`:

```json
"commands": {
  "toggle-quicknote": {
    "suggested_key": {
      "default": "Ctrl+Shift+Y",
      "mac": "Command+Shift+Y"
    },
    "description": "Toggle QuickNote floating panel"
  }
}
```

---

## 10. How Chrome Storage Works

All notes are stored using `chrome.storage.local` via
`src/storage/storage.ts`.

### Why `chrome.storage.local` instead of `localStorage`?

| | `localStorage` | `chrome.storage.local` |
|---|---|---|
| Available in service workers | ❌ | ✅ |
| Available in content scripts | ✅ (page's storage) | ✅ (extension's storage) |
| Available in popup page | ✅ (popup's storage) | ✅ (shared) |
| Shared across all extension contexts | ❌ | ✅ |
| Persists across browser sessions | ✅ | ✅ |
| Quota | ~5 MB | ~5 MB (unlimited with `unlimitedStorage` permission) |

### Storage Schema

Each note is one key-value pair:

```
key   → "https://example.com/docs/guide"    (URL without query/hash)
value → {
  url:       "https://example.com/docs/guide",
  note:      "Remember to check section 3.2",
  timestamp: 1710000000000,
  title:     "The Ultimate Guide – Example.com"
}
```

### URL normalisation

Query parameters and URL fragments are stripped before storing:

```
"https://example.com/page?ref=twitter#section2"
→ stored as "https://example.com/page"
```

This means notes persist across UTM-tracked links, hash navigation, etc.

### Storage utility functions

```ts
saveNote(url, note, title?)  // Create or update
getNote(url)                  // Returns NoteEntry | null
getAllNotes()                  // Returns NoteEntry[], newest first
deleteNote(url)               // Remove one note
clearAllNotes()               // Wipe everything
```

---

## 11. Architecture Decisions

### Two Vite configs instead of one

Chrome extensions require different output formats for different scripts:

| Script | Format | Why |
|---|---|---|
| `popup.html` + `popup.js` | ESM SPA | Standard Vite build; loaded as a web page |
| `content.js` | IIFE | Chrome injects content scripts as plain scripts; dynamic `import()` fails |
| `background.js` | IIFE | Service workers can use ESM but IIFE is safer across all Chrome versions |

A single Vite config cannot produce both a multi-page SPA and IIFE scripts.
Two configs, run sequentially, is the cleanest solution.

### Shadow DOM for CSS isolation

The floating panel is rendered inside a `closed` Shadow DOM:

```
<body>
  <div id="quicknote-shadow-host">  ← appended to <html>, not <body>
    #shadow-root (closed)
      <style>/* compiled Tailwind CSS */</style>
      <div id="react-root">
        <FloatingNote />
      </div>
  </div>
```

Benefits:
- Tailwind's `preflight` (CSS reset) does not bleed into the host page
- The host page's CSS cannot override our component styles
- Works on 100% of websites regardless of their CSS architecture

### CSS `?inline` import

```ts
import shadowStyles from '../styles/shadow.css?inline'
```

Vite runs PostCSS (Tailwind + autoprefixer) on the file at **build time** and
embeds the result as a string literal inside `content.js`. At runtime, the
string is injected as a `<style>` element inside the Shadow DOM.

This means:
- ✅ Zero network requests at runtime (no CDN)
- ✅ Tailwind classes are available inside the Shadow DOM
- ✅ The CWS "remotely hosted code" policy is not violated

---

## 12. Why This Build Was Rejected (and What We Fixed)

The previous version was rejected by the Chrome Web Store for two violations:

### Violation 1: "Including remotely hosted code"

**Cause:** `@crxjs/vite-plugin` v2 beta injects a `<script>` tag pointing to
`http://localhost:5173/...` into the built HTML files.  This is an HMR
(Hot Module Replacement) URL that only works in development, but the plugin
included it in the production build.  Chrome Web Store's automated scanner
flags any `<script src="http://...">` or `<link href="http://...">` as
remotely hosted code.

**Fix:** Removed `@crxjs/vite-plugin` entirely.  Our `vite.popup.config.ts`
uses the standard Vite `rollupOptions.input` approach which produces a clean
`popup.html` with only local `assets/popup.js` references.

### Violation 2: "Popup functionality not working"

**Cause:** `@crxjs/vite-plugin` v2 has a [known bug with Vite 5][crxjs-bug]
where the built `popup.html` contains empty `<script>` tags (the `src`
attribute is missing).  The popup page renders blank.

**Fix:** Same as above – no CRXJS plugin.  Vite's own HTML processing
correctly emits `<script type="module" crossorigin src="assets/popup.js">`.

[crxjs-bug]: https://github.com/crxjs/chrome-extension-tools/issues/696

---

## 13. Possible Future Improvements

### Short-term (quality of life)

- [ ] **Rich text** – Replace `<textarea>` with a lightweight editor (TipTap/Quill)
- [ ] **Note tags** – Freeform tags to organise notes across sites
- [ ] **Export** – Download all notes as JSON or Markdown
- [ ] **Import** – Restore from a JSON backup file
- [ ] **Resize handle** – Drag to resize the floating panel

### SaaS version

- [ ] **Cloud sync** – Optional account-based sync via Supabase or Firebase
- [ ] **Shared notes** – Share a note via a URL (read-only link)
- [ ] **Workspace** – Team-shared notes per domain
- [ ] **Search across all notes** – Full-text search in the popup
- [ ] **Web app companion** – Browse and edit notes at `app.quicknote.io`
- [ ] **Notion / Obsidian export** – Push notes to your knowledge base
- [ ] **AI summarise** – One-click Claude/GPT summary of a long note

---

## 14. Troubleshooting

### "Could not load extension" when loading unpacked

- Make sure you selected the `dist/` folder, not the project root.
- Run `npm run build` first – `dist/` is not committed to git.
- Check that `dist/manifest.json` exists.

### Panel doesn't open with the keyboard shortcut

- Go to `chrome://extensions/shortcuts` and confirm the shortcut is set.
- The shortcut doesn't work on `chrome://` pages, the New Tab page, or the
  Chrome Web Store – this is a Chrome security restriction.
- Try clicking any part of the page first so Chrome knows the tab is focused.

### Popup page is blank

- Open DevTools on the popup: `chrome://extensions` → QuickNote → "Inspect views: popup.html"
- Check the Console tab for errors.
- Make sure `dist/assets/popup.js` exists and is non-empty.

### Notes are not persisting

- Open DevTools on any page → Application tab → Storage → Extension Storage
- Confirm `chrome.storage.local` entries exist.
- The extension needs the `"storage"` permission in `manifest.json` – it's there.

### Icons look pixelated / placeholder

- Run `npm install canvas` then `npm run build` again to regenerate proper icons.
- Or replace `public/icons/icon16.png`, `icon48.png`, `icon128.png` with
  your own artwork before building.

---

*Built with ❤️ using React 18 + Vite 5 + TailwindCSS 3 + Manifest V3*