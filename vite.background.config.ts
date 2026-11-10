/**
 * vite.background.config.ts
 *
 * Builds ONLY background.ts → dist/background.js as a self-contained IIFE.
 *
 * Service workers can technically use ESM but IIFE is safer across all
 * Chrome versions and avoids any chunk-splitting that would require
 * web_accessible_resources entries for internal module files.
 */
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    global: "globalThis",
  },

  build: {
    outDir: "dist",
    emptyOutDir: false,   // preserve popup + content builds
    copyPublicDir: false,
    minify: true,
    target: "esnext",

    rollupOptions: {
      input: resolve(__dirname, "src/background/background.ts"),
      output: {
        format: "iife",
        entryFileNames: "background.js",
        name: "QuickNoteBackground",
      },
    },
  },
});
