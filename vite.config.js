import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("framer-motion")) {
            return "motion";
          }

          if (id.includes("react-router") || id.includes("@remix-run")) {
            return "router";
          }

          if (id.includes("react") || id.includes("scheduler")) {
            return "react-vendor";
          }

          if (
            id.includes("dompurify") ||
            id.includes("lucide-react") ||
            id.includes("clsx") ||
            id.includes("tailwind-merge")
          ) {
            return "ui-vendor";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    proxy: {
      "/index.php": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});