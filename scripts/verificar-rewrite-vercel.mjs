#!/usr/bin/env node
/* global console, process */
// Guarda del rewrite de SPA de Vercel (issue #59).
//
// POR QUE HAY DOS vercel.json
//
// Vercel lee el vercel.json que este DENTRO del Root Directory configurado en el proyecto, y
// ese ajuste vive en el Dashboard, no en el repositorio. Las dos opciones razonables para este
// monorepo son la raiz (el valor por defecto) y apps/web. Con un solo archivo, elegir la otra
// opcion deja el rewrite sin aplicarse **en silencio**: no hay error de build, no hay aviso;
// simplemente cualquier ruta que no sea / empieza a dar 404 al recargar la pagina.
//
// Por eso hay uno en cada sitio y funciona con cualquiera de las dos configuraciones. El de la
// raiz ademas trae buildCommand y outputDirectory, porque desde la raiz Vercel no sabe por su
// cuenta que hay que compilar apps/web.
//
// QUE COMPRUEBA ESTE SCRIPT
//
// Que los dos archivos existan y declaren exactamente el mismo rewrite. Sin esto, la duplicacion
// se convierte en el problema que venia a resolver: alguien corrige uno, no el otro, y el fallo
// vuelve a depender de un ajuste que no se ve desde el repositorio.
//
// Uso: npm run verificar:rewrite-vercel

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raizDelRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ARCHIVOS = ["vercel.json", path.join("apps", "web", "vercel.json")];

// El fallback de SPA: cualquier ruta que no corresponda a un archivo real sirve index.html.
// Vercel comprueba el sistema de archivos ANTES de aplicar los rewrites, asi que /assets/*.js
// sigue resolviendo al archivo real y no cae aqui. Es el equivalente del
// `try_files $uri $uri/ /index.html` de apps/web/nginx.conf.
const REWRITE_ESPERADO = [{ source: "/(.*)", destination: "/index.html" }];

function leer(relativo) {
  const absoluto = path.join(raizDelRepo, relativo);
  try {
    return JSON.parse(readFileSync(absoluto, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`${relativo} no es JSON valido: ${error.message}`);
  }
}

const problemas = [];

for (const relativo of ARCHIVOS) {
  const contenido = leer(relativo);

  if (contenido === null) {
    problemas.push(
      `Falta ${relativo}. Tiene que existir uno en la raiz y otro en apps/web: Vercel solo lee ` +
        `el que este dentro del Root Directory del proyecto, y ese ajuste no se ve desde aqui.`,
    );
    continue;
  }

  if (JSON.stringify(contenido.rewrites) !== JSON.stringify(REWRITE_ESPERADO)) {
    problemas.push(
      `${relativo} no declara el rewrite de SPA esperado.\n` +
        `  esperado: ${JSON.stringify(REWRITE_ESPERADO)}\n` +
        `  encontrado: ${JSON.stringify(contenido.rewrites)}`,
    );
  }
}

if (problemas.length > 0) {
  console.error("El rewrite de SPA de Vercel no esta bien declarado:\n");
  for (const problema of problemas) console.error(`- ${problema}\n`);
  console.error(
    "Sin el, cualquier ruta que no sea / da 404 al recargar la pagina o al abrir un enlace\n" +
      "directo. Navegando con clics desde / nunca falla, por eso se escapa en las pruebas.\n" +
      "Ver la seccion de Vercel en docs/QUICKSTART.md.",
  );
  process.exit(1);
}

console.log(`Rewrite de SPA declarado en los ${ARCHIVOS.length} vercel.json y coinciden.`);
