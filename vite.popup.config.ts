/**
 * vite.popup.config.ts
 *
 * Builds the extension popup page (toolbar click → popup.html).
 *
 * Key settings:
 *  - base: ''          → generates RELATIVE asset paths (e.g. assets/popup.js)
 *                        instead of absolute (/assets/popup.js).
 *                        Chrome loads popup.html via chrome-extension:// URLs, so
 *                        absolute paths would 404.
 *  - emptyOutDir: true → clean dist/ before this first build step.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],

  // Relative paths so assets work inside chrome-extension:// origins
  base: "",

  build: {
    outDir: "dist",
    emptyOutDir: true, // Clean on the first build step only

    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup/popup.html"),
      },
      output: {
        // Predictable file names (no hashes) make debugging easier
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
});
