// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node22",
    outDir: "dist",
    emptyOutDir: true,

    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },

    rollupOptions: {
      external: [
        // native node + deps you DON'T want bundled
        "node:fs",
        "node:path",
        "node:http",
        "node:https",
      ],
    },

    sourcemap: true,
    minify: false, // backend: readability > size
  },

  resolve: {
    alias: {
      "@": "/src",
    },
    preserveSymlinks: false
  },
});
