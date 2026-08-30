// Hook de resolucion ESM (node:module register) para el mismo problema que vitest.setup.js
// resuelve del lado de CommonJS: react-router-dom importa "react" via ESM -no via require()-,
// asi que Module._resolveFilename (que solo intercepta CJS) no lo alcanza. Este hook cubre la
// otra mitad.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reactRealURL = pathToFileURL(path.resolve(__dirname, "node_modules/react/") + "/").href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "react" || specifier.startsWith("react/")) {
    const sufijo = specifier === "react" ? "index.js" : specifier.slice("react/".length);
    return nextResolve(new URL(sufijo, reactRealURL).href, context);
  }
  return nextResolve(specifier, context);
}
