/**
 * scripts/generate-icons.mjs
 *
 * Generates the three PNG icons Chrome requires (16×16, 48×48, 128×128)
 * using the built-in Node.js `canvas` package.
 *
 * We deliberately avoid any native C++ addon (sharp, jimp with native deps)
 * so this script works on any machine out of the box after `npm install`.
 *
 * HOW IT WORKS
 * ────────────
 * 1. We use the `canvas` npm package which provides a Node.js-compatible
 *    implementation of the HTML5 Canvas API.
 * 2. We draw a rounded-rectangle gradient background + a notepad emoji.
 * 3. We save each canvas to PNG in public/icons/.
 *
 * WHY BOTHER?
 * ───────────
 * Chrome Web Store requires PNG icons, not SVG.  If icons are missing Chrome
 * will refuse to load the extension.  By generating them programmatically we
 * avoid the need to check in binary PNG files.
 *
 * FALLBACK
 * ────────
 * If the `canvas` package is not available (e.g. install fails on some CI),
 * the script falls back to writing minimal 1×1 transparent PNGs so the build
 * still succeeds and you can replace the icons manually.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");

mkdirSync(iconsDir, { recursive: true });

const SIZES = [16, 48, 128];

// ── Try to draw a proper icon ─────────────────────────────────────────────────

async function drawIcon(size) {
  // Dynamic import so the script doesn't hard-crash if canvas isn't installed
  let createCanvas;
  try {
    ({ createCanvas } = await import("canvas"));
  } catch {
    return null; // Signal to fall back
  }

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const r = size * 0.22; // corner radius

  // ── Background gradient ────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#6366f1"); // indigo-500
  grad.addColorStop(1, "#8b5cf6"); // violet-500

  // Rounded rectangle helper (works in all Node canvas versions)
  function roundRect(x, y, w, h, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  roundRect(0, 0, size, size, r);
  ctx.fillStyle = grad;
  ctx.fill();

  // ── Notepad lines (manual drawing – emoji rendering is inconsistent) ───
  const padding = size * 0.2;
  const lineH = (size - padding * 2) / 5;
  const lineW = size - padding * 2;

  ctx.fillStyle = "rgba(255,255,255,0.9)";

  // "Page" rectangle
  roundRect(padding, padding, lineW, size - padding * 2, size * 0.08);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill();

  // Horizontal "text" lines
  const lineColor = "#6366f1";
  const lineThickness = Math.max(1, size * 0.065);
  const linePad = size * 0.28;
  const lineXStart = linePad;
  const lineXEnd = size - linePad;

  for (let i = 0; i < 3; i++) {
    const y = padding + lineH * (i + 1.2);
    ctx.fillStyle = lineColor;
    ctx.globalAlpha = 0.7 - i * 0.15;
    ctx.fillRect(
      lineXStart,
      y,
      (lineXEnd - lineXStart) * (i === 2 ? 0.6 : 1),
      lineThickness
    );
  }
  ctx.globalAlpha = 1;

  return canvas.toBuffer("image/png");
}

// ── Minimal fallback PNG (1×1 transparent) ────────────────────────────────────

// A valid 1×1 transparent PNG as a base64-encoded buffer
// (avoids a hard crash when the canvas package isn't available)
const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

// ── Main ──────────────────────────────────────────────────────────────────────

let canvasAvailable = true;

for (const size of SIZES) {
  const outPath = join(iconsDir, `icon${size}.png`);
  if (canvasAvailable) {
    const buf = await drawIcon(size);
    if (buf) {
      writeFileSync(outPath, buf);
      console.log(`✓ Generated icon${size}.png`);
    } else {
      canvasAvailable = false;
    }
  }

  if (!canvasAvailable) {
    writeFileSync(outPath, FALLBACK_PNG);
    console.warn(
      `⚠  canvas package not found – wrote placeholder icon${size}.png.` +
        " Run: npm install canvas  to generate proper icons."
    );
  }
}
