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
            return html.replace(/%%VITE_BACKEND_URL%%/g, env.VITE_BACKEND_URL);
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
