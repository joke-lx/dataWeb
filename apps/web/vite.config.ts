import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { apiProxyPlugin } from "./plugins/samplesMockPlugin";

export default defineConfig({
  plugins: [react(), apiProxyPlugin()],
  optimizeDeps: {
    include: ['plotly.js-dist-min'],
  },
  server: {
    port: 8181,
    strictPort: true,
    host: true,
  },
});