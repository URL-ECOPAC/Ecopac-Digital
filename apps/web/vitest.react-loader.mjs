import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const reactPkgPath = require.resolve("react/package.json");
const reactRealURL = pathToFileURL(path.dirname(reactPkgPath)).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "react" || specifier.startsWith("react/")) {
    const sufijo = specifier === "react" ? "" : specifier.slice("react".length);
    const targetUrl = new URL("." + (sufijo || "/index.js"), reactRealURL + "/").href;
    return {
      shortCircuit: true,
      url: targetUrl,
    };
  }
  return nextResolve(specifier, context);
}