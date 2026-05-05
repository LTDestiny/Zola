import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const httpsKeyPath = process.env.VITE_HTTPS_KEY;
const httpsCertPath = process.env.VITE_HTTPS_CERT;
const https =
  httpsKeyPath && httpsCertPath
    ? {
        key: fs.readFileSync(httpsKeyPath),
        cert: fs.readFileSync(httpsCertPath),
      }
    : undefined;

export default defineConfig({
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
  },
});
