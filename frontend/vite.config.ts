import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5175,
    host: "0.0.0.0",
    proxy: {
      // Proxy API calls and WebSocket connections to the Render FastAPI backend.
      "/api": {
        target: process.env.VITE_API_BASE_URL || "https://agentverse-1f1a.onrender.com",
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
