#!/usr/bin/env node
/* global console, process */
// Guarda de CI: ningun emoji en el codigo de apps/ y packages/ (issue #700).
//
// POR QUE EXISTE
//
// AGENTS.md dice "No usar emojis en codigo, descripciones, mensajes de commit, issues ni PRs", y
// nada lo verificaba. El resultado, medido al escribir esta guarda: 79 lineas con pictogramas en
// 30 archivos. La mitad eran comentarios -"// CORREGIDO: ..."- pero la otra mitad era interfaz, y
// ahi el problema deja de ser de estilo: en ReportesPage el nivel de alerta se mostraba como
// "Critico" precedido de un circulo de color, y ese circulo era el unico portador del nivel
// ademas de la palabra. Un lector de pantalla no lo lee. El estado del dominio sale de enums.js y
// su color de @ecopac/ui-tokens, no de un caracter.
//
// QUE CUENTA COMO EMOJI, Y QUE NO
//
// La regla no es "todo caracter raro": es la presentacion. Se prohiben
//
//   - los caracteres con presentacion emoji por defecto (\p{Emoji_Presentation}): los
//     pictogramas a color, de 🔴 a 📦;
//   - y cualquier caracter seguido del selector U+FE0F, que es como se pide presentacion emoji
//     para un simbolo que por defecto es monocromo. Asi cae "⚠️" y no cae "⚠".
//
// Queda FUERA la tipografia monocroma, y es deliberado: las flechas ← → ↑ ↓ son texto de botones
// ("Avanzar →") y hay pruebas que las buscan por ese texto; ✕ es el cierre de los modales; ⌂ y ⚙
// son simbolos, no dibujos. Prohibirlas obligaria a cambiar interfaz y pruebas, que es un cambio
// de producto disfrazado de limpieza. Si algun dia se decide, el cambio es una linea de esta
// expresion y esta escrito aqui para que se pueda revisar sin volver a investigarlo.
//
// Uso:
//   npm run verificar:sin-emojis
//   npm run verificar:sin-emojis -- --autoprueba

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Ruta relativa a la raiz, siempre con "/" (issue #819).
 *
 * `relative()` devuelve el separador del sistema, asi que en Windows imprimia `apps\\web\\...`
 * y las anotaciones `::error file=` no enlazaban al archivo desde la interfaz de GitHub.
 */
function rutaRelativa(ruta) {
  return relative(RAIZ, ruta).split(sep).join("/");
}
const DIRECTORIOS = ["apps", "packages"];
const EXTENSIONES = [".js", ".jsx", ".ts", ".tsx", ".css", ".json", ".md"];
const IGNORADOS = new Set(["node_modules", "dist", "build", ".expo", "coverage", "android", "ios"]);

/** Presentacion emoji por defecto, o pedida explicitamente con el selector U+FE0F. */
export const EMOJI = /\p{Emoji_Presentation}|️/u;

function archivosDe(dir, acumulado = []) {
  for (const entrada of readdirSync(dir)) {
    if (IGNORADOS.has(entrada)) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivosDe(ruta, acumulado);
    else if (EXTENSIONES.some((e) => entrada.endsWith(e))) acumulado.push(ruta);
  }
  return acumulado;
}

export function emojisDelTexto(texto) {
  const global = new RegExp(EMOJI.source, "gu");
  const hallazgos = [];
  texto.split("\n").forEach((linea, i) => {
    const encontrados = [...linea.matchAll(global)].map((m) => m[0]).filter((c) => c !== "️");
    // Un selector suelto tras un simbolo monocromo tambien cuenta: es pedir presentacion emoji.
    const conSelector = /(.)️/gu;
    for (const m of linea.matchAll(conSelector)) encontrados.push(m[1] + "️");
    if (encontrados.length)
      hallazgos.push({ linea: i + 1, texto: linea.trim(), emojis: [...new Set(encontrados)] });
  });
  return hallazgos;
}

const CASOS = [
  { nombre: "un pictograma en un comentario se detecta", texto: "// listo 🎉", esperado: 1 },
  {
    nombre: "un pictograma en una etiqueta de interfaz se detecta",
    texto: 'const l = "🔴 Critico";',
    esperado: 1,
  },
  { nombre: "el simbolo con selector de emoji se detecta", texto: "// ojo ⚠️", esperado: 1 },
  { nombre: "el mismo simbolo SIN selector pasa", texto: "// ojo ⚠", esperado: 0 },
  { nombre: "las flechas pasan: son texto de botones", texto: 'title="Avanzar →"', esperado: 0 },
  { nombre: "la equis de cerrar pasa", texto: "<span>✕</span>", esperado: 0 },
  { nombre: "los simbolos monocromos pasan", texto: "const i = '⌂'; const j = '⚙';", esperado: 0 },
  {
    nombre: "el texto normal con acentos y guion largo pasa",
    texto: "// jornada — atencion",
    esperado: 0,
  },
];

function autoprueba() {
  let fallos = 0;
  for (const caso of CASOS) {
    const obtenido = emojisDelTexto(caso.texto).length;
    const ok = obtenido === caso.esperado;
    console.log(`  ${ok ? "ok  " : "FALLA"}  ${caso.nombre}`);
    if (!ok) {
      fallos += 1;
      console.log(`         esperado ${caso.esperado} hallazgos, obtenido ${obtenido}`);
    }
  }
  console.log(`\n${CASOS.length - fallos}/${CASOS.length} casos en verde.`);
  return fallos === 0;
}

function principal() {
  if (process.argv.includes("--autoprueba")) return autoprueba() ? 0 : 1;

  const archivos = DIRECTORIOS.flatMap((d) => archivosDe(join(RAIZ, d)));
  const hallazgos = [];
  for (const ruta of archivos) {
    for (const h of emojisDelTexto(readFileSync(ruta, "utf8")))
      hallazgos.push({ ruta: rutaRelativa(ruta), ...h });
  }

  console.log(`Revisado: ${archivos.length} archivos de ${DIRECTORIOS.join("/ y ")}/.`);

  if (!hallazgos.length) {
    console.log("Ningun emoji en el codigo.");
    return 0;
  }

  console.log(`\n${hallazgos.length} lineas con emoji:\n`);
  for (const h of hallazgos) {
    console.log(`  ${h.ruta}:${h.linea}  ${h.emojis.join(" ")}  ${h.texto.slice(0, 70)}`);
    if (process.env.GITHUB_ACTIONS)
      console.log(
        `::error file=${h.ruta},line=${h.linea}::emoji en el codigo (${h.emojis.join(" ")}): AGENTS.md no los admite`,
      );
  }

  console.log(
    "\n  AGENTS.md: no se usan emojis en el codigo. Si es un comentario, quitalo; si es una",
  );
  console.log(
    "  etiqueta de interfaz, el estado sale de enums.js y su color de @ecopac/ui-tokens.",
  );
  console.log(
    "  La tipografia monocroma -flechas, ✕, ⌂, ⚙- no cuenta: ver la cabecera de este archivo.",
  );
  return 1;
}

process.exit(principal());
