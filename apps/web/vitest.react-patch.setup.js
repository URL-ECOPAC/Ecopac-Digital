import Module, { register } from "node:module";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Resuelve la ruta exacta de react usando el require del propio archivo
const reactReal = path.dirname(require.resolve("react/package.json"));

const resolverOriginal = Module._resolveFilename;
Module._resolveFilename = function (request, ...resto) {
  if (request === "react" || request.startsWith("react/")) {
    const sufijo = request === "react" ? "" : request.slice("react".length);
    return resolverOriginal.call(this, path.join(reactReal, sufijo), ...resto);
  }
  return resolverOriginal.call(this, request, ...resto);
};

register("./vitest.react-loader.mjs", import.meta.url);
