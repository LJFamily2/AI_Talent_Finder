import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Plugin to replace environment variables in HTML
      {
        name: "html-transform",
        transformIndexHtml: {
          order: "pre",
          handler(html) {
            const backendUrl = env.VITE_BACKEND_URL || "http://localhost:5000";

            // Generate WebSocket URLs based on backend URL
            const wsUrl = backendUrl.replace(/^https?:/, "ws:");
            const wssUrl = backendUrl.replace(/^https?:/, "wss:");

            return html
              .replace(/%%VITE_BACKEND_URL%%/g, backendUrl)
              .replace(/%%VITE_WS_URL%%/g, wsUrl)
              .replace(/%%VITE_WSS_URL%%/g, wssUrl);
          },
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(
          fileURLToPath(new URL(".", import.meta.url)),
          "./src"
        ),
      },
    },
  };
});
