import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

function resolveCertPath(filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, filePath);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const httpsKeyPath = env.VITE_HTTPS_KEY;
  const httpsCertPath = env.VITE_HTTPS_CERT;
  const https =
    httpsKeyPath && httpsCertPath
      ? {
          key: fs.readFileSync(resolveCertPath(httpsKeyPath)),
          cert: fs.readFileSync(resolveCertPath(httpsCertPath)),
        }
      : undefined;

  return {
    base: "./",
    plugins: [react()],
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "../shared"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      https,
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "https://10.18.76.36:18080",
          changeOrigin: true,
          secure: false,
        },
        "/ws": {
          target: env.VITE_WS_PROXY_TARGET || "ws://10.18.76.36:8083",
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  };
});
