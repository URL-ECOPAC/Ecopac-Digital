import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, "../.."),
  server: {
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Reparto del vendor en tres piezas (issue #708). Con las pantallas ya cortadas por ruta,
        // lo que quedaba en un solo trozo de 544 kB eran las dependencias que TODA la aplicacion
        // necesita desde el primer render: React, el router, react-bootstrap y el cliente de
        // Supabase -que arranca con la sesion-. Partirlas no baja lo que se descarga la primera vez,
        // y no se pretende que lo haga: lo que gana es la cache entre despliegues. React y
        // react-bootstrap cambian cuando se actualiza una dependencia, no cuando se agrega una
        // pantalla, asi que su trozo sobrevive al siguiente deploy en vez de volver a bajar entero.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("react-bootstrap") || id.includes("@restart")) return "vendor-bootstrap";
          if (
            /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(
              id,
            )
          ) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@ecopac/shared": path.resolve(__dirname, "../../packages/shared/index.js"),
      "@ecopac/ui-tokens": path.resolve(__dirname, "../../packages/ui-tokens/index.js"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.js"],
  },
});
