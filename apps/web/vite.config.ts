import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // plotly.js (CJS) references Node globals; stub them so it bundles in browser
    "process.env": {},
    global: "globalThis",
  },
  resolve: {
    alias: {
      // plotly.js requires("buffer/"); provide the browser polyfill
      buffer: "buffer",
    },
  },
  optimizeDeps: {
    // plotly.js is a large CJS bundle; pre-bundle it so the dynamic import
    // resolves quickly in dev and is split into its own chunk in production.
    include: ['plotly.js'],
  },
  server: {
    port: 5173,
    strictPort: true,
    // Allow LAN access (e.g. when running inside WSL or Docker).
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
