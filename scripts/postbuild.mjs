/**
 * scripts/postbuild.mjs
 *
 * Runs after BOTH Vite build steps complete.
 *
 * What it does:
 *  1. Copies manifest.json → dist/manifest.json
 *  2. Copies public/icons/ → dist/icons/
 *  3. Fixes the popup.html path inside dist/
 *     Vite builds popup.html into dist/src/popup/popup.html because the
 *     input is src/popup/popup.html.  Chrome expects it at dist/popup.html
 *     (as declared in manifest.json).  We move it and rewrite asset paths.
 *  4. Prints a summary of the dist/ directory.
 *
 * WHY NOT USE THE Vite `publicDir` OPTION?
 * ─────────────────────────────────────────
 * publicDir copies files into the build ROOT, but we're running two separate
 * Vite builds (popup + scripts) and only want public/ copied once.
 * A postbuild script gives us exact control.
 */

import {
  copyFileSync,
  cpSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");

// ── 1. Copy manifest.json ─────────────────────────────────────────────────────
copyFileSync(join(root, "manifest.json"), join(dist, "manifest.json"));
console.log("✓ Copied manifest.json");

// ── 2. Copy icons ─────────────────────────────────────────────────────────────
const iconsSource = join(root, "public", "icons");
const iconsDest = join(dist, "icons");
mkdirSync(iconsDest, { recursive: true });

if (existsSync(iconsSource)) {
  cpSync(iconsSource, iconsDest, { recursive: true });
  console.log("✓ Copied icons/");
} else {
  console.warn("⚠  public/icons/ not found – skipping icon copy.");
}

// ── 3. Relocate popup.html from nested path to dist root ──────────────────────
//
// Vite preserves the input file's directory structure relative to the project
// root.  Our input is  src/popup/popup.html  so the output lands at:
//   dist/src/popup/popup.html
//
// We need it at  dist/popup.html  to match the manifest declaration.

const nestedHtml = join(dist, "src", "popup", "popup.html");
const finalHtml = join(dist, "popup.html");

if (existsSync(nestedHtml)) {
  let html = readFileSync(nestedHtml, "utf8");

  // The asset paths inside the HTML currently look like:
  //   assets/popup.js   (relative to src/popup/popup.html → wrong from dist root)
  // Vite already emits absolute-rooted paths with base:'', so they should
  // already be  assets/popup.js  without leading slash – which works fine
  // when the file is at dist/popup.html.  No path rewriting needed.

  writeFileSync(finalHtml, html, "utf8");
  console.log("✓ Moved popup.html → dist/popup.html");
} else if (!existsSync(finalHtml)) {
  // If Vite happened to put it in the right place already, nothing to do.
  console.warn("⚠  Could not find built popup.html – check your build output.");
}

// ── 4. Summary ────────────────────────────────────────────────────────────────
console.log("\n📦 dist/ contents:");
function printTree(dir, prefix = "") {
  const entries = readdirSync(dir);
  entries.forEach((name, i) => {
    const full = join(dir, name);
    const isLast = i === entries.length - 1;
    const branch = isLast ? "└── " : "├── ";
    const stat = statSync(full);
    const size = stat.isFile()
      ? ` (${(stat.size / 1024).toFixed(1)} KB)`
      : "";
    console.log(`${prefix}${branch}${name}${size}`);
    if (stat.isDirectory()) {
      printTree(full, prefix + (isLast ? "    " : "│   "));
    }
  });
}
printTree(dist);
console.log("\n✅  Build complete. Load the dist/ folder in Chrome.");
