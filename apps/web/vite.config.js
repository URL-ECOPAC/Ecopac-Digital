import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  resolve: {
    alias: {
      "@ecopac/shared": path.resolve(__dirname, "../../packages/shared/index.js"),
      "@ecopac/ui-tokens": path.resolve(__dirname, "../../packages/ui-tokens/index.js"),
    },
  },
});
