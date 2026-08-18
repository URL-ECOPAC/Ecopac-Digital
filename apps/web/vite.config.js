import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Los .env viven en la raiz del monorepo, no en apps/web. Sin esto Vite los busca junto a
  // este archivo y nunca encuentra el .env.development que docs/QUICKSTART.md manda crear,
  // asi que VITE_SUPABASE_URL llegaria vacia en local. En Docker no se notaba porque
  // docker-compose.yml inyecta ese mismo archivo como variables de proceso.
  envDir: path.resolve(__dirname, "../.."),
  server: {
    host: true,
    port: 5173,
  },
  resolve: {
    alias: {
      "@ecopac/shared": path.resolve(__dirname, "../../packages/shared/index.js"),
      "@ecopac/ui-tokens": path.resolve(__dirname, "../../packages/ui-tokens/index.js"),
    },
    // El monorepo tiene react en dos versiones (web 19.2.8 y mobile 19.2.3,
    // fijada por Expo). Dedupe garantiza que Vite use una sola copia de
    // react/react-dom al compilar la web, evitando el "duplicate React".
    dedupe: ["react", "react-dom"],
  },
});
