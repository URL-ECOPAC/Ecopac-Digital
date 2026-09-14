#!/usr/bin/env node
/* global console, process */
// Red de seguridad de la migracion de colores (issue #700).
//
// EL PROBLEMA QUE RESUELVE
//
// apps/ tiene 662 colores hexadecimales escritos a mano en 31 archivos, y AGENTS.md dice que
// ninguno deberia existir: todo color sale de @ecopac/ui-tokens. Migrarlos es mecanico, pero las
// dos apps **no tienen ni una prueba que detecte una regresion visual**: cambiar "#64748b" por el
// token equivocado no rompe ninguna prueba, no rompe el build, y nadie se entera hasta abrir la
// pantalla.
//
// COMO FUNCIONA
//
// Para cada archivo se calcula el CONJUNTO DE COLORES EFECTIVOS: los hexadecimales que escribe a
// mano, mas el valor de los tokens que menciona -sea por `colors.primary`, por `var(--color-*)` o
// por una clave de statusColors-. Ese conjunto se guarda en una linea base.
//
// Sustituir "#2A9C36" por `colors.primary` NO cambia el conjunto: el color efectivo es el mismo.
// Sustituirlo por `colors.info` SI lo cambia, y ahi la comprobacion falla diciendo que color
// entro y cual salio. Es decir: prueba que la migracion no movio ningun pixel, que es justo lo
// que ninguna prueba del repositorio sabia hacer.
//
// No sustituye a mirar la pantalla -no sabe de layout ni de contraste- pero convierte "confia en
// que no cambie nada" en algo que falla solo.
//
// Uso:
//   npm run verificar:paleta              compara contra la linea base
//   npm run verificar:paleta -- --capturar  reescribe la linea base (con el diff a la vista)
//   npm run verificar:paleta -- --autoprueba

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR_APPS = join(RAIZ, "apps");
const LINEA_BASE = join(RAIZ, "scripts", "paleta-linea-base.json");
const IGNORADOS = new Set(["node_modules", "dist", "build", ".expo", "coverage", "android", "ios"]);
const EXTENSIONES = [".js", ".jsx", ".css"];

// Seis u ocho digitos siempre; tres o cuatro SOLO dentro de comillas.
//
// El "#135" de un comentario -"issue #135"- es un numero de issue, no un color, y con
// `{3,8}` entraban ochenta de ellos en la linea base como si lo fueran. Los unicos cortos que
// este repositorio usa de verdad son "#000" y "#fff", y siempre van entrecomillados:
// `shadowColor: "#000"`. Exigir la comilla separa los dos casos sin listas de excepciones.
const HEX = /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b|(?<=["'`])#[0-9a-fA-F]{3,4}(?=["'`])/g;
// colors.primary / colors["primary"] / var(--color-primary) / statusColors.aprobado
const TOKEN_JS = /\bcolors\.(\w+)/g;
const TOKEN_CSS = /var\(\s*--color-([a-z-]+)/g;
const TOKEN_ESTADO = /\bstatusColors\[?\.?["']?([\w -]+)["']?\]?/g;

function kebabAcamel(nombre) {
  return nombre.replace(/-([a-z])/g, (todo, letra) => letra.toUpperCase());
}

/**
 * Quita comentarios antes de buscar colores: un color nunca vive en uno, y ahi es donde estan los
 * numeros de issue -`issue #135`, `issues="#209"`- que de otro modo entran como si lo fueran.
 */
function sinComentarios(texto) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

export function coloresEfectivos(textoCrudo, tokens) {
  const { colors, statusColors } = tokens;
  const texto = sinComentarios(textoCrudo);
  const encontrados = new Set();

  for (const m of texto.matchAll(HEX)) encontrados.add(m[0].toLowerCase());
  for (const m of texto.matchAll(TOKEN_JS)) {
    if (colors[m[1]]) encontrados.add(colors[m[1]].toLowerCase());
  }
  for (const m of texto.matchAll(TOKEN_CSS)) {
    const clave = kebabAcamel(m[1]);
    if (colors[clave]) encontrados.add(colors[clave].toLowerCase());
  }
  for (const m of texto.matchAll(TOKEN_ESTADO)) {
    const valor = statusColors[m[1]];
    if (valor) encontrados.add(valor.toLowerCase());
  }

  return [...encontrados].sort();
}

function archivosDe(dir, acumulado = []) {
  for (const entrada of readdirSync(dir)) {
    if (IGNORADOS.has(entrada)) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) archivosDe(ruta, acumulado);
    else if (EXTENSIONES.some((e) => entrada.endsWith(e)) && !entrada.includes(".test."))
      acumulado.push(ruta);
  }
  return acumulado;
}

async function inventario() {
  const tokens = await import("../packages/ui-tokens/index.js");
  const mapa = {};
  for (const ruta of archivosDe(DIR_APPS)) {
    const colores = coloresEfectivos(readFileSync(ruta, "utf8"), tokens);
    // La linea base se comparte entre plataformas (se captura en Windows, se compara en el CI de
    // Linux): `relative()` usa el separador del sistema operativo, y sin normalizar aqui una
    // captura en Windows escribiria claves con "\" que el CI, calculando con "/", nunca volveria
    // a encontrar -toda la linea base se veria "borrada" en la siguiente comparacion.
    if (colores.length) mapa[relative(RAIZ, ruta).split(sep).join("/")] = colores;
  }
  // `readdirSync` no garantiza el mismo orden en todos los sistemas de archivos: capturar en
  // Windows y despues en Linux reordena las claves del objeto aunque el contenido no cambie,
  // y eso ensucia el diff del PR con ruido que no es parte del cambio real.
  return Object.fromEntries(Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b)));
}

const CASOS = [
  {
    nombre: "un hexadecimal a mano cuenta como color efectivo",
    texto: 'const s = { color: "#64748B" };',
    esperado: ["#64748b"],
  },
  {
    nombre: "el token cuenta por su VALOR, no por su nombre",
    texto: "const s = { color: colors.primary };",
    esperado: ["#3db648"],
  },
  {
    nombre: "la variable CSS tambien, y en camelCase",
    texto: "color: var(--color-text-muted);",
    esperado: ["#7a7a8a"],
  },
  {
    nombre: "sustituir el hexadecimal por su token no cambia nada",
    texto: "const s = { color: colors.danger };",
    esperado: ["#e91e8c"],
  },
  {
    nombre: "un numero de issue en un comentario NO es un color",
    texto: "// Ver la issue #135 y la #700 para el detalle.",
    esperado: [],
  },
  {
    nombre: "ni siquiera entrecomillado dentro de un comentario",
    texto: '// Antes renderizaba <PaginaPendiente issues="#209" />, y la #209 ya se cerro.',
    esperado: [],
  },
  {
    nombre: "pero el negro corto entrecomillado si lo es",
    texto: 'const s = { shadowColor: "#000" };',
    esperado: ["#000"],
  },
  {
    nombre: "el mismo color escrito de las dos formas cuenta una vez",
    texto: 'const a = "#3DB648"; const b = colors.primary;',
    esperado: ["#3db648"],
  },
];

async function autoprueba() {
  const tokens = await import("../packages/ui-tokens/index.js");
  let fallos = 0;
  for (const caso of CASOS) {
    const obtenido = coloresEfectivos(caso.texto, tokens);
    const ok = JSON.stringify(obtenido) === JSON.stringify(caso.esperado);
    console.log(`  ${ok ? "ok  " : "FALLA"}  ${caso.nombre}`);
    if (!ok) {
      fallos += 1;
      console.log(`         esperado ${JSON.stringify(caso.esperado)}`);
      console.log(`         obtenido ${JSON.stringify(obtenido)}`);
    }
  }
  console.log(`\n${CASOS.length - fallos}/${CASOS.length} casos en verde.`);
  return fallos === 0;
}

async function principal() {
  if (process.argv.includes("--autoprueba")) return (await autoprueba()) ? 0 : 1;

  const actual = await inventario();

  if (process.argv.includes("--capturar")) {
    writeFileSync(LINEA_BASE, JSON.stringify(actual, null, 2) + "\n");
    const archivos = Object.keys(actual).length;
    const colores = new Set(Object.values(actual).flat()).size;
    console.log(`Linea base escrita: ${archivos} archivos, ${colores} colores distintos.`);
    console.log("Revisa el diff antes de commitear: es la foto contra la que se compara despues.");
    return 0;
  }

  if (!existsSync(LINEA_BASE)) {
    console.log("No hay linea base. Creala con: npm run verificar:paleta -- --capturar");
    return 1;
  }

  const base = JSON.parse(readFileSync(LINEA_BASE, "utf8"));
  const diferencias = [];
  for (const ruta of new Set([...Object.keys(base), ...Object.keys(actual)])) {
    const antes = new Set(base[ruta] ?? []);
    const ahora = new Set(actual[ruta] ?? []);
    const entraron = [...ahora].filter((c) => !antes.has(c));
    const salieron = [...antes].filter((c) => !ahora.has(c));
    if (entraron.length || salieron.length) diferencias.push({ ruta, entraron, salieron });
  }

  console.log(`Revisado: ${Object.keys(actual).length} archivos de apps/ con color.`);

  if (!diferencias.length) {
    console.log("Ningun color efectivo cambio respecto de la linea base.");
    return 0;
  }

  console.log(`\n${diferencias.length} archivos cambiaron de color:\n`);
  for (const d of diferencias) {
    console.log(`  ${d.ruta}`);
    if (d.salieron.length) console.log(`     ya no usa: ${d.salieron.join(" ")}`);
    if (d.entraron.length) console.log(`     ahora usa: ${d.entraron.join(" ")}`);
  }
  console.log("\n  Si el cambio es deliberado, actualiza la linea base con --capturar y explica");
  console.log("  en el PR que se ve distinto. Si no lo es, es una regresion visual.");
  return 1;
}

process.exit(await principal());
