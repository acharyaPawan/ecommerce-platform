// vite.config.ts
import { defineConfig, mergeConfig } from "vite";
import pkg from './package.json'

export default defineConfig({
  build: {
    ssr: true,
    target: "node22",
    outDir: "dist",
    emptyOutDir: true,

    lib: {
      entry: ["src/index.ts", "src/instrumentation.ts"],
      formats: ["es"],
      fileName: (entryName) => `${entryName}.js`,
    },

    rollupOptions: {

    },

    sourcemap: true,
    minify: false, // backend: readability > size
  },

  resolve: {
    alias: {
      "@": "/src",
    },
    preserveSymlinks: true
  },
});
