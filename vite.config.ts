import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
) as { version: string };

export default defineConfig({
  define: {
    __MARC_VERSION__: JSON.stringify(version)
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src")
    }
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4187"
    }
  },
  build: {
    outDir: "dist/public",
    emptyOutDir: true
  }
});
