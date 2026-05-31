import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend is a single-page app served by the local Fastify server.
// During dev (`npm run dev`) Vite proxies API + websocket calls to the server.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:4317",
      "/ws": { target: "ws://localhost:4317", ws: true },
    },
  },
});
