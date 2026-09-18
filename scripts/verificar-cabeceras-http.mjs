#!/usr/bin/env node
/* global console, process */
// Guarda de cabeceras de seguridad HTTP (issue #760).
//
// POR QUE EXISTE
//
// La SPA se sirve desde dos superficies distintas -Vercel en produccion real, Docker/nginx en el
// flujo local y el entregable del curso- y ninguna declaraba Strict-Transport-Security,
// Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, X-Frame-Options ni
// Permissions-Policy. Igual que el rewrite de SPA (verificar-rewrite-vercel.mjs), hay tres
// lugares que tienen que decir lo mismo -vercel.json de la raiz, apps/web/vercel.json y
// apps/web/nginx.conf- y nada comparaba ni siquiera los dos primeros entre si, mucho menos contra
// nginx. Sin esta guarda, alguien corrige uno y el otro queda desactualizado en silencio: no hay
// error de build, solo una respuesta real sin la cabecera cuando alguien la audite.
//
// Referrer-Policy importa mas de lo normal aqui: las rutas llevan el UUID del paciente
// (/pacientes/:id), y strict-origin-when-cross-origin evita que ese UUID salga en el header
// Referer hacia un origen externo (dentro del mismo origen si viaja completo, que es inocuo).
//
// Uso:
//   npm run verificar:cabeceras-http
//   npm run verificar:cabeceras-http -- --autoprueba

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raizDelRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Las mismas seis cabeceras, con el mismo valor, en los tres lugares. Cambiarlas es cambiar esta
// constante y las tres fuentes que se comparan contra ella.
export const CABECERAS_ESPERADAS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; font-src 'self'; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
};

const ARCHIVOS_VERCEL = ["vercel.json", path.join("apps", "web", "vercel.json")];
const ARCHIVO_NGINX = path.join("apps", "web", "nginx.conf");

/** Vercel: de `{ headers: [{ source, headers: [{key, value}, ...] }] }` a un mapa clave->valor. */
export function extraerDeVercel(contenido) {
  const bloque = contenido?.headers?.[0]?.headers;
  if (!Array.isArray(bloque)) return null;
  const mapa = {};
  for (const { key, value } of bloque) mapa[key] = value;
  return mapa;
}

/** nginx: de lineas `add_header Clave "valor" always;` a un mapa clave->valor. */
export function extraerDeNginx(texto) {
  const mapa = {};
  const regex = /add_header\s+([A-Za-z-]+)\s+"([^"]*)"\s+always;/g;
  let coincidencia;
  while ((coincidencia = regex.exec(texto)) !== null) {
    mapa[coincidencia[1]] = coincidencia[2];
  }
  return mapa;
}

/** Compara dos mapas clave->valor sin importar el orden de las claves. */
export function mapasIguales(a, b) {
  if (!a || !b) return false;
  const clavesA = Object.keys(a);
  const clavesB = Object.keys(b);
  if (clavesA.length !== clavesB.length) return false;
  return clavesA.every((clave) => a[clave] === b[clave]);
}

function leerJSON(relativo) {
  const absoluto = path.join(raizDelRepo, relativo);
  try {
    return JSON.parse(readFileSync(absoluto, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`${relativo} no es JSON valido: ${error.message}`);
  }
}

function leerTexto(relativo) {
  const absoluto = path.join(raizDelRepo, relativo);
  try {
    return readFileSync(absoluto, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function formatearMapa(mapa) {
  if (!mapa) return "(no se pudo leer)";
  return Object.entries(mapa)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");
}

const CASOS = [
  {
    nombre: "extraerDeNginx lee una cabecera de una linea add_header",
    obtenido: () =>
      mapasIguales(extraerDeNginx('add_header X-Frame-Options "DENY" always;'), {
        "X-Frame-Options": "DENY",
      }),
    esperado: true,
  },
  {
    nombre: "extraerDeNginx lee varias cabeceras aunque haya otras lineas nginx alrededor",
    obtenido: () =>
      mapasIguales(
        extraerDeNginx(
          'server {\n  listen 80;\n  add_header X-Content-Type-Options "nosniff" always;\n' +
            '  add_header Referrer-Policy "strict-origin-when-cross-origin" always;\n}',
        ),
        {
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
        },
      ),
    esperado: true,
  },
  {
    nombre: "mapasIguales ignora el orden de las claves",
    obtenido: () => mapasIguales({ A: "1", B: "2" }, { B: "2", A: "1" }),
    esperado: true,
  },
  {
    nombre: "mapasIguales detecta una cabecera faltante",
    obtenido: () => mapasIguales({ A: "1" }, { A: "1", B: "2" }),
    esperado: false,
  },
  {
    nombre: "mapasIguales detecta un valor distinto",
    obtenido: () => mapasIguales({ A: "1" }, { A: "2" }),
    esperado: false,
  },
  {
    nombre: "extraerDeVercel lee el mapa desde headers[0].headers",
    obtenido: () =>
      mapasIguales(
        extraerDeVercel({
          headers: [{ source: "/(.*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] }],
        }),
        { "X-Frame-Options": "DENY" },
      ),
    esperado: true,
  },
  {
    nombre: "extraerDeVercel devuelve null si no hay bloque headers",
    obtenido: () => extraerDeVercel({ rewrites: [] }) === null,
    esperado: true,
  },
];

function autoprueba() {
  let fallos = 0;
  for (const caso of CASOS) {
    const obtenido = caso.obtenido();
    const ok = obtenido === caso.esperado;
    console.log(`  ${ok ? "ok  " : "FALLA"}  ${caso.nombre}`);
    if (!ok) {
      fallos += 1;
      console.log(`         esperado ${caso.esperado}, obtenido ${obtenido}`);
    }
  }
  console.log(`\n${CASOS.length - fallos}/${CASOS.length} casos en verde.`);
  return fallos === 0;
}

function principal() {
  if (process.argv.includes("--autoprueba")) return autoprueba() ? 0 : 1;

  const problemas = [];

  for (const relativo of ARCHIVOS_VERCEL) {
    const contenido = leerJSON(relativo);
    if (contenido === null) {
      problemas.push(`Falta ${relativo}.`);
      continue;
    }
    const mapa = extraerDeVercel(contenido);
    if (!mapasIguales(mapa, CABECERAS_ESPERADAS)) {
      problemas.push(
        `${relativo} no declara las cabeceras esperadas.\n` +
          `  esperado:\n${formatearMapa(CABECERAS_ESPERADAS)}\n` +
          `  encontrado:\n${formatearMapa(mapa)}`,
      );
    }
  }

  const textoNginx = leerTexto(ARCHIVO_NGINX);
  if (textoNginx === null) {
    problemas.push(`Falta ${ARCHIVO_NGINX}.`);
  } else {
    const mapa = extraerDeNginx(textoNginx);
    if (!mapasIguales(mapa, CABECERAS_ESPERADAS)) {
      problemas.push(
        `${ARCHIVO_NGINX} no declara las cabeceras esperadas.\n` +
          `  esperado:\n${formatearMapa(CABECERAS_ESPERADAS)}\n` +
          `  encontrado:\n${formatearMapa(mapa)}`,
      );
    }
  }

  if (problemas.length > 0) {
    console.error("Las cabeceras de seguridad HTTP no coinciden entre las tres fuentes:\n");
    for (const problema of problemas) console.error(`- ${problema}\n`);
    console.error(
      "Vercel (produccion real) y nginx (Docker/local) tienen que servir exactamente las\n" +
        "mismas seis cabeceras. Ver docs/SEGURIDAD.md, seccion de cabeceras HTTP.",
    );
    process.exit(1);
  }

  console.log(
    `Cabeceras de seguridad HTTP declaradas y coincidentes en los ${ARCHIVOS_VERCEL.length} ` +
      `vercel.json y en ${ARCHIVO_NGINX}.`,
  );
  return 0;
}

process.exit(principal());
