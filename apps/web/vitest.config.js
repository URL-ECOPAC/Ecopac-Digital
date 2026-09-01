// Configuracion de pruebas de apps/web.
//
// environment "jsdom" y no "node": a diferencia de packages/shared (que no puede tocar el DOM,
// ver docs/ARQUITECTURA-FRONTEND.md), este workspace SI renderiza componentes React reales con
// @testing-library/react, que necesita un DOM para montar.
//
// Alias @ecopac/shared -> packages/shared/index.js, igual que vite.config.js: sin el alias,
// vitest resolveria el paquete contra node_modules (el symlink de npm workspaces), no contra el
// codigo fuente, y una prueba no veria un cambio recien hecho en shared hasta un reinstall.
//
// El problema de version de React (el monorepo tiene react en dos versiones, 19.2.8 en web y
// 19.2.3 fijada por Expo en mobile) se resuelve en vitest.react-patch.setup.js, no aca: es un
// problema de resolucion de modulos de Node en tiempo de ejecucion (un require() interno de
// react-dom, no algo que resolve.alias de Vite pueda interceptar), asi que la config de Vite no
// es donde corresponde. Ver el comentario de ese archivo para el detalle completo.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ecopac/shared": path.resolve(__dirname, "../../packages/shared/index.js"),
      "@ecopac/ui-tokens": path.resolve(__dirname, "../../packages/ui-tokens/index.js"),
    },
    // Mismo dedupe que vite.config.js, y por la misma razon. El alias de arriba hace que
    // packages/shared se compile desde el fuente, asi que su `import { useRef } from "react"`
    // lo resuelve Vite subiendo desde packages/ y encuentra la copia de la raiz (la de mobile),
    // mientras que los componentes de apps/web usan la de este workspace. Con dos copias de
    // react en el mismo arbol el dispatcher de hooks queda en null y cualquier componente que
    // llame a un hook de shared revienta con "Cannot read properties of null (reading 'useRef')".
    //
    // No lo cubre vitest.react-patch.setup.js: ese parche es para el require() interno de
    // react-dom, que pasa por el resolver de Node. Este import pasa por el de Vite.
    //
    // No se noto hasta la issue #601 porque ninguna prueba de este workspace habia renderizado
    // todavia un componente que montara un hook de packages/shared.
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["**/*.test.jsx", "**/*.test.js"],
    exclude: ["**/node_modules/**"],
    setupFiles: ["./vitest.react-patch.setup.js", "./vitest.setup.js"],
  },
});
