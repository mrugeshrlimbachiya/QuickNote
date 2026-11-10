/**
 * vite.content.config.ts
 *
 * Builds ONLY content.tsx → dist/content.js as a self-contained IIFE.
 *
 * WHY A SEPARATE CONFIG PER SCRIPT?
 * ──────────────────────────────────
 * Rollup's IIFE format automatically sets `inlineDynamicImports: true`.
 * That flag is incompatible with multiple entry points in a single build.
 * Solution: one Vite config per IIFE output. Each runs as its own build step.
 *
 * WHY IIFE?
 * ─────────
 * Chrome injects content scripts as plain <script> tags, not ES modules.
 * IIFE wraps everything in one immediately-invoked function — no import(),
 * no shared chunks, zero external dependencies at runtime.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],

  css: {
    postcss: "./postcss.config.js",
  },

  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    global: "globalThis",
  },

  build: {
    outDir: "dist",
    emptyOutDir: false,   // popup build already ran; don't wipe it
    copyPublicDir: false, // postbuild.mjs handles assets
    minify: true,
    target: "esnext",

    rollupOptions: {
      input: resolve(__dirname, "src/content/content.tsx"),
      output: {
        format: "iife",
        entryFileNames: "content.js",
        name: "QuickNoteContent",
      },
    },
  },
});
