// Hook de resolucion ESM (node:module register) para el mismo problema que vitest.setup.js
// resuelve del lado de CommonJS: react-router-dom importa "react" via ESM -no via require()-,
// asi que Module._resolveFilename (que solo intercepta CJS) no lo alcanza. Este hook cubre la
// otra mitad.
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

// Resuelve la ubicación real del paquete react independientemente de la estructura del workspace
const reactPkgPath = require.resolve("react/package.json");
const reactRealURL = pathToFileURL(path.dirname(reactPkgPath) + "/").href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "react" || specifier.startsWith("react/")) {
    const sufijo = specifier === "react" ? "index.js" : specifier.slice("react/".length);
    return nextResolve(new URL(sufijo, reactRealURL).href, context);
  }
  return nextResolve(specifier, context);
}