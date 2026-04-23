import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiTarget = env.VITE_API_URL ?? "http://127.0.0.1:8080";
  const wsTarget = env.VITE_WS_URL?.replace(/^wss?:/, "http:") ?? "http://127.0.0.1:8083";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: "0.0.0.0",
      allowedHosts: ["192.168.10.234"],
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/ws": {
          target: wsTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
