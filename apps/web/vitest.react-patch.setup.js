// Fuerza la resolucion de Node de "react" a la copia de este workspace (19.2.8) antes de que
// cargue cualquier otra cosa. Necesario solo para las pruebas: react-dom (hosteado en la raiz
// del monorepo porque mobile fija react a un exacto distinto, 19.2.3, ver vitest.config.js) hace
// un require("react") interno que Node resuelve por ubicacion fisica, no por lo que declare
// package.json, y encuentra la copia de la raiz -la de mobile- en vez de la de este workspace.
// resolve.alias de Vite no llega a interceptar ese require interno porque ocurre dentro de
// codigo CJS ya cargado como modulo externo de Node, no a traves del resolver de Vite.
//
// Archivo aparte de vitest.setup.js, y primero en la lista de setupFiles: un import de ES
// modules se evalua entero antes que el resto del cuerpo del archivo (hoisting), sin importar
// donde este escrito textualmente. Si este parche y el afterEach(cleanup) de testing-library
// vivieran en el mismo archivo, el propio `import { cleanup } from "@testing-library/react"`
// cargaria react-dom -sin parche todavia- antes de que el codigo de abajo llegara a correr.
//
// No toca nada instalado ni nada fuera de este proceso: es un parche en memoria, vivo solo
// mientras corre `vitest run` en este workspace.
import Module, { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reactReal = path.resolve(__dirname, "node_modules/react");

// Mitad CommonJS: react-dom hace require("react") internamente.
const resolverOriginal = Module._resolveFilename;
Module._resolveFilename = function (request, ...resto) {
  if (request === "react" || request.startsWith("react/")) {
    const sufijo = request === "react" ? "" : request.slice("react".length);
    return resolverOriginal.call(this, reactReal + sufijo, ...resto);
  }
  return resolverOriginal.call(this, request, ...resto);
};

// Mitad ESM: react-router-dom importa "react" via import, no via require(). Ver
// vitest.react-loader.mjs.
register("./vitest.react-loader.mjs", import.meta.url);
