import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const reactPkgPath = require.resolve("react/package.json");
const reactDir = path.dirname(reactPkgPath);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "react" || specifier.startsWith("react/")) {
    const sufijo = specifier === "react" ? "index.js" : specifier.slice("react/".length);
    const targetPath = path.resolve(reactDir, sufijo);
    const targetUrl = pathToFileURL(targetPath).href;

    // Delegamos a nextResolve con el specifier sustituido por la URL exacta
    return nextResolve(targetUrl, context);
  }
  return nextResolve(specifier, context);
}