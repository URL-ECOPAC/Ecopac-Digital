// Guarda: en packages/shared no se escribe TypeScript (issue #493).
//
// POR QUE EXISTE
//
// El bloque de la frontera de eslint.config.mjs se aplica a
// `files: ["packages/shared/**/*.{js,jsx}"]`. Un archivo `.ts` **no entra en ese glob**, asi que
// queda fuera de todo lo que ese bloque protege: `no-restricted-imports` sobre react-dom,
// react-native, react-bootstrap y react-router-dom, y `no-restricted-globals` sobre window,
// document, localStorage y AsyncStorage.
//
// Es un agujero comprobable, y se comprobo antes de escribir esto: un archivo con
// `import { View } from "react-native";` pasa el lint limpio si se llama `prueba.ts`, y falla con
// el mensaje de la regla si se llama `prueba.js`. Mismo contenido, distinta extension.
//
// POR QUE NO SE ARREGLA AGRANDANDO EL GLOB
//
// Porque el parser por defecto de ESLint no entiende sintaxis de TypeScript: meter `.ts` en el
// glob tal cual haria fallar el lint con errores de sintaxis que no tienen nada que ver con la
// frontera. Cubrirlo de verdad pide `typescript` como dependencia, un `tsconfig.json` y un
// `tsc --noEmit` en el CI -la opcion B de la issue-, y eso es mucho coste para un paquete que
// hoy no tiene una sola linea de TypeScript ejecutable.
//
// Se eligio la opcion A: aqui no hay TypeScript, y los tipos se documentan con JSDoc. Esta
// prueba es lo unico que hace que esa decision se sostenga sola. Sin ella, el dia que alguien
// agregue un `.ts` el agujero se reabre **en silencio**, que es exactamente como estaba.
//
// Si algun dia se quiere TypeScript en shared, lo que hay que hacer no es borrar esta prueba:
// es implementar la opcion B y entonces borrarla, en el mismo PR.

import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

const RAIZ = dirname(fileURLToPath(import.meta.url));
const EXTENSIONES_PROHIBIDAS = [".ts", ".tsx", ".mts", ".cts"];

function archivosDeTypeScript(directorio = RAIZ, encontrados = []) {
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name !== "node_modules" && entrada.name !== "coverage") {
        archivosDeTypeScript(ruta, encontrados);
      }
    } else if (EXTENSIONES_PROHIBIDAS.some((extension) => entrada.name.endsWith(extension))) {
      encontrados.push(relative(RAIZ, ruta));
    }
  }
  return encontrados;
}

it("no hay archivos TypeScript, que quedarian fuera de las guardas de la frontera", () => {
  const encontrados = archivosDeTypeScript();

  expect(
    encontrados,
    `packages/shared se escribe en JavaScript (issue #493, opcion A). Estos archivos quedan ` +
      `fuera del bloque de la frontera de eslint.config.mjs, asi que pueden importar ` +
      `react-native o usar window sin que el lint diga nada: ${encontrados.join(", ")}. ` +
      `Los tipos se documentan con JSDoc en types/index.js.`,
  ).toEqual([]);
});
