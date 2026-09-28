#!/usr/bin/env node
/* global console, process */
// Genera docs/PANTALLAS.md: cuantas pantallas tiene cada app y que tablas, vistas y funciones de
// la base usa cada una (issue #233).
//
// COMO LO SABE
//
// Lee las rutas donde se declaran -apps/web/src/App.jsx y apps/mobile/src/navigation/AppNavigator.js-
// y, desde el componente de cada pantalla, sigue el grafo de llamadas FUNCION POR FUNCION: lo que
// la pantalla usa de sus propios componentes y de packages/shared, y de ahi lo que esas funciones
// llaman, hasta llegar a las llamadas a Supabase: `.from("tabla")`, `.rpc("funcion")`,
// `.functions.invoke("edge-function")` y `.storage.from("bucket")`. Se sigue por funcion y no por
// archivo a proposito: una pantalla que usa listarProyectos() no toca todas las tablas de
// proyectos/api.js, solo las de esa funcion.
//
// LIMITES CONOCIDOS
//
// - Solo se leen nombres escritos como texto, o como una constante de texto del mismo archivo. Una
//   llamada con el nombre armado en tiempo de ejecucion (`.from(tabla)`) no se puede resolver; el
//   documento cuenta cuantas hay.
// - Es un analisis estatico: dice lo que la pantalla PUEDE consultar, incluidas ramas que solo
//   corren para un rol. Quien protege de verdad es RLS (docs/PERMISOS.md).
//
// Uso: npm run docs:pantallas

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const espree = require("espree");

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHARED = join(RAIZ, "packages", "shared", "index.js");
const SALIDA = join(RAIZ, "docs", "PANTALLAS.md");
const rel = (archivo) => relative(RAIZ, archivo).split(sep).join("/");

// ---------------------------------------------------------------------------
// Lectura y cache de modulos
// ---------------------------------------------------------------------------
const cache = new Map();

/** Arbol, declaraciones de nivel superior, imports, re-exports y constantes de texto de un archivo. */
function modulo(archivo) {
  if (cache.has(archivo)) return cache.get(archivo);
  const fuente = readFileSync(archivo, "utf8");
  const programa = espree.parse(fuente, {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  });
  const declaraciones = new Map();
  const imports = new Map();
  const reexports = [];
  const constantes = new Map();

  const declarar = (nombre, nodo) => declaraciones.set(nombre, nodo);
  for (const nodo of programa.body) {
    if (nodo.type === "ImportDeclaration") {
      for (const e of nodo.specifiers) {
        const importado =
          e.type === "ImportDefaultSpecifier"
            ? "default"
            : e.type === "ImportNamespaceSpecifier"
              ? "*"
              : (e.imported.name ?? e.imported.value);
        imports.set(e.local.name, { fuente: nodo.source.value, importado });
      }
      continue;
    }
    if (nodo.type === "ExportAllDeclaration") {
      reexports.push({ fuente: nodo.source.value, todo: true });
      continue;
    }
    if (nodo.type === "ExportNamedDeclaration" && nodo.source) {
      for (const e of nodo.specifiers) {
        reexports.push({
          fuente: nodo.source.value,
          local: e.local.name ?? e.local.value,
          exportado: e.exported.name ?? e.exported.value,
        });
      }
      continue;
    }
    if (nodo.type === "ExportDefaultDeclaration") {
      const d = nodo.declaration;
      declarar("default", d);
      if (d.id?.name) declarar(d.id.name, d);
      continue;
    }
    const d = nodo.type === "ExportNamedDeclaration" ? nodo.declaration : nodo;
    if (!d) {
      // export { a, b as c } sin fuente: alias de declaraciones locales.
      for (const e of nodo.specifiers ?? []) {
        reexports.push({ fuente: null, local: e.local.name, exportado: e.exported.name });
      }
      continue;
    }
    if (d.type === "FunctionDeclaration" || d.type === "ClassDeclaration") {
      declarar(d.id.name, d);
    } else if (d.type === "VariableDeclaration") {
      for (const v of d.declarations) {
        if (v.id.type !== "Identifier") continue;
        // `const Pagina = lazy(() => import("./pages/Pagina"))`: es un import del default.
        const perezoso =
          v.init?.type === "CallExpression" &&
          (v.init.callee.name === "lazy" || v.init.callee.property?.name === "lazy") &&
          v.init.arguments[0]?.body?.type === "ImportExpression";
        if (perezoso) {
          imports.set(v.id.name, {
            fuente: v.init.arguments[0].body.source.value,
            importado: "default",
          });
          continue;
        }
        declarar(v.id.name, v.init ?? v);
        if (v.init?.type === "Literal" && typeof v.init.value === "string") {
          constantes.set(v.id.name, v.init.value);
        }
      }
    }
  }
  const datos = { archivo, programa, declaraciones, imports, reexports, constantes };
  cache.set(archivo, datos);
  return datos;
}

/** Ruta de un import relativo o de @ecopac/shared; null si es una dependencia externa. */
function resolverFuente(desde, fuente) {
  let base;
  if (fuente === "@ecopac/shared") return SHARED;
  if (fuente.startsWith("@ecopac/shared/"))
    base = join(RAIZ, "packages", "shared", fuente.slice(15));
  else if (fuente.startsWith(".")) base = resolve(dirname(desde), fuente);
  else return null;
  for (const candidato of [
    base,
    `${base}.js`,
    `${base}.jsx`,
    join(base, "index.js"),
    join(base, "index.jsx"),
  ]) {
    // Solo codigo: un import de un .css o de una imagen no lleva a ninguna consulta.
    if (/\.jsx?$/.test(candidato) && existsSync(candidato) && statSync(candidato).isFile()) {
      return candidato;
    }
  }
  return null;
}

/** Donde se declara de verdad `nombre` exportado por `archivo`, siguiendo barriles. */
function resolverExport(archivo, nombre, vistos = new Set()) {
  const clave = `${archivo}#${nombre}`;
  if (vistos.has(clave)) return null;
  vistos.add(clave);
  const m = modulo(archivo);
  if (m.declaraciones.has(nombre)) return { archivo, nombre };
  if (m.imports.has(nombre)) {
    const imp = m.imports.get(nombre);
    const destino = resolverFuente(archivo, imp.fuente);
    return destino ? resolverExport(destino, imp.importado, vistos) : null;
  }
  for (const r of m.reexports) {
    if (r.todo || r.exportado !== nombre) continue;
    if (r.fuente === null) return resolverExport(archivo, r.local, vistos);
    const destino = resolverFuente(archivo, r.fuente);
    if (destino) return resolverExport(destino, r.local, vistos);
  }
  for (const r of m.reexports) {
    if (!r.todo) continue;
    const destino = resolverFuente(archivo, r.fuente);
    if (!destino) continue;
    const encontrado = resolverExport(destino, nombre, vistos);
    if (encontrado) return encontrado;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Recorrido del grafo de llamadas
// ---------------------------------------------------------------------------
function hijos(nodo) {
  const salida = [];
  for (const [clave, valor] of Object.entries(nodo)) {
    if (clave === "parent" || !valor || typeof valor !== "object") continue;
    if (Array.isArray(valor)) {
      for (const v of valor) if (v && typeof v.type === "string") salida.push(v);
    } else if (typeof valor.type === "string") salida.push(valor);
  }
  return salida;
}

/** Los textos que puede valer una expresion: un literal, o los dos lados de un `a ? "x" : "y"`. */
function textosDeExpresion(expresion) {
  if (!expresion) return null;
  if (expresion.type === "Literal" && typeof expresion.value === "string") return [expresion.value];
  if (expresion.type === "ConditionalExpression") {
    const a = textosDeExpresion(expresion.consequent);
    const b = textosDeExpresion(expresion.alternate);
    return a && b ? [...a, ...b] : null;
  }
  return null;
}

/**
 * Textos de un argumento: literal, constante de texto del archivo, o variable local de la funcion
 * con un texto o un condicional entre dos (`const tabla = x ? "perfiles_directorio" : "perfiles"`).
 */
function textosDe(argumento, m, locales) {
  if (!argumento) return null;
  const directo = textosDeExpresion(argumento);
  if (directo) return directo;
  if (argumento.type === "Identifier") {
    if (locales.has(argumento.name)) return locales.get(argumento.name);
    if (m.constantes.has(argumento.name)) return [m.constantes.get(argumento.name)];
  }
  return null;
}

/** Variables de una funcion que valen un texto conocido. */
function textosLocales(nodo) {
  const locales = new Map();
  const pila = [nodo];
  while (pila.length) {
    const n = pila.pop();
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier") {
      const textos = textosDeExpresion(n.init);
      if (textos) locales.set(n.id.name, textos);
    }
    pila.push(...hijos(n));
  }
  return locales;
}

/**
 * Recoge las llamadas a la base de una declaracion y de todo lo que alcanza.
 *
 * @param {string} archivo
 * @param {string} nombre
 * @param {object} acumulado `{ tablas, rpc, edge, buckets, dinamicas, visitados }`
 */
function analizar(archivo, nombre, acumulado) {
  const clave = `${archivo}#${nombre}`;
  if (acumulado.visitados.has(clave)) return;
  acumulado.visitados.add(clave);
  const m = modulo(archivo);
  const nodo = m.declaraciones.get(nombre);
  if (!nodo) return;

  const referencias = new Set();
  const locales = textosLocales(nodo);
  const pila = [nodo];
  while (pila.length) {
    const n = pila.pop();
    if (n.type === "CallExpression" && n.callee.type === "MemberExpression" && !n.callee.computed) {
      const metodo = n.callee.property.name;
      const objeto = n.callee.object;
      const esStorage =
        objeto.type === "MemberExpression" &&
        !objeto.computed &&
        objeto.property.name === "storage";
      const esFunctions =
        objeto.type === "MemberExpression" &&
        !objeto.computed &&
        objeto.property.name === "functions";
      const esArray = objeto.type === "Identifier" && ["Array", "Object"].includes(objeto.name);
      if (metodo === "from" && !esArray) {
        const textos = textosDe(n.arguments[0], m, locales);
        if (textos) {
          for (const t of textos) (esStorage ? acumulado.buckets : acumulado.tablas).add(t);
        } else if (n.arguments[0] && n.arguments[0].type !== "ArrayExpression") {
          acumulado.dinamicas.add(`${rel(archivo)}, en ${nombre}() (.from)`);
        }
      } else if (metodo === "rpc") {
        const textos = textosDe(n.arguments[0], m, locales);
        if (textos) for (const t of textos) acumulado.rpc.add(t);
        else acumulado.dinamicas.add(`${rel(archivo)}, en ${nombre}() (.rpc)`);
      } else if (metodo === "invoke" && esFunctions) {
        const textos = textosDe(n.arguments[0], m, locales);
        if (textos) for (const t of textos) acumulado.edge.add(t);
      }
    }
    if (n.type === "Identifier") referencias.add(n.name);
    if (n.type === "JSXOpeningElement") {
      let nombreJsx = n.name;
      while (nombreJsx.type === "JSXMemberExpression") nombreJsx = nombreJsx.object;
      if (nombreJsx.type === "JSXIdentifier") referencias.add(nombreJsx.name);
    }
    for (const h of hijos(n)) {
      // La clave de una propiedad y el nombre tras un punto no son referencias.
      if (n.type === "MemberExpression" && !n.computed && h === n.property) continue;
      if (n.type === "Property" && !n.computed && h === n.key && !n.shorthand) continue;
      pila.push(h);
    }
  }

  for (const ref of referencias) {
    if (ref === nombre) continue;
    if (m.declaraciones.has(ref)) {
      analizar(archivo, ref, acumulado);
    } else if (m.imports.has(ref)) {
      const imp = m.imports.get(ref);
      const destino = resolverFuente(archivo, imp.fuente);
      if (!destino) continue;
      const donde = resolverExport(destino, imp.importado);
      if (donde) analizar(donde.archivo, donde.nombre, acumulado);
    }
  }
}

function usoDe(archivo, nombre) {
  const acumulado = {
    tablas: new Set(),
    rpc: new Set(),
    edge: new Set(),
    buckets: new Set(),
    dinamicas: new Set(),
    visitados: new Set(),
  };
  const donde = resolverExport(archivo, nombre) ?? { archivo, nombre };
  analizar(donde.archivo, donde.nombre, acumulado);
  return acumulado;
}

// ---------------------------------------------------------------------------
// Pantallas de la web: App.jsx
// ---------------------------------------------------------------------------
const APP_WEB = join(RAIZ, "apps", "web", "src", "App.jsx");

function atributo(elemento, nombre) {
  const a = elemento.openingElement.attributes.find((x) => x.name?.name === nombre);
  if (!a) return null;
  if (a.value?.type === "Literal") return a.value.value;
  if (a.value?.type === "JSXExpressionContainer") return a.value.expression;
  return null;
}

function pantallasWeb() {
  const m = modulo(APP_WEB);
  const salida = [];
  const recorrer = (nodo, moduloActual) => {
    if (nodo.type === "JSXElement" && nodo.openingElement.name.name === "Route") {
      const elemento = atributo(nodo, "element");
      let moduloRuta = moduloActual;
      if (
        elemento?.type === "JSXElement" &&
        elemento.openingElement.name.name === "RutaProtegida"
      ) {
        moduloRuta = atributo(elemento, "modulo") ?? moduloActual;
      }
      const ruta = atributo(nodo, "path");
      if (ruta && elemento?.type === "JSXElement") {
        const componente = elemento.openingElement.name.name;
        salida.push({ ruta, modulo: moduloRuta, componente });
      }
      for (const h of nodo.children) recorrer(h, moduloRuta);
      return;
    }
    for (const h of hijos(nodo)) recorrer(h, moduloActual);
  };
  recorrer(m.programa, null);

  return salida.map((p) => {
    // El componente de la ruta puede ser un envoltorio de App.jsx (RegistroDonacionConSesion):
    // la pantalla real es la pagina que dibuja.
    let archivoPantalla = null;
    if (m.imports.has(p.componente)) {
      const imp = m.imports.get(p.componente);
      archivoPantalla = resolverFuente(APP_WEB, imp.fuente);
    } else if (m.declaraciones.has(p.componente)) {
      const envoltorio = m.declaraciones.get(p.componente);
      const pila = [envoltorio];
      while (pila.length && !archivoPantalla) {
        const n = pila.pop();
        if (
          n.type === "JSXOpeningElement" &&
          n.name.type === "JSXIdentifier" &&
          m.imports.has(n.name.name)
        ) {
          const destino = resolverFuente(APP_WEB, m.imports.get(n.name.name).fuente);
          if (destino && /[\\/]pages[\\/]/.test(destino)) archivoPantalla = destino;
        }
        pila.push(...hijos(n));
      }
    }
    return { ...p, archivo: archivoPantalla, uso: usoDe(APP_WEB, p.componente) };
  });
}

// ---------------------------------------------------------------------------
// Pantallas del movil: AppNavigator.js
// ---------------------------------------------------------------------------
const NAVEGADOR = join(RAIZ, "apps", "mobile", "src", "navigation", "AppNavigator.js");
const RUTAS_MOVIL = join(RAIZ, "apps", "mobile", "src", "navigation", "rutas.js");

function pantallasMovil() {
  const m = modulo(NAVEGADOR);
  const rutas = new Map();
  const mr = modulo(RUTAS_MOVIL);
  const objetoRutas = mr.declaraciones.get("ROUTES");
  for (const p of objetoRutas?.properties ?? objetoRutas?.arguments?.[0]?.properties ?? []) {
    if (p.key && p.value?.type === "Literal") rutas.set(p.key.name, p.value.value);
  }
  const nombreDeRuta = (expr) =>
    expr?.type === "MemberExpression"
      ? (rutas.get(expr.property.name) ?? expr.property.name)
      : null;

  const salida = [];
  // Arreglos PANTALLAS_<STACK> = [{ name, componente: conGuardaDeRol(X, "modulo"), titulo }]
  for (const [nombre, decl] of m.declaraciones) {
    if (!/^PANTALLAS_/.test(nombre) || decl.type !== "ArrayExpression") continue;
    const stack = nombre.replace("PANTALLAS_", "").toLowerCase();
    for (const obj of decl.elements) {
      const prop = (k) => obj.properties.find((p) => p.key?.name === k)?.value;
      const componente = prop("componente");
      let nombreComponente = null;
      let moduloGuarda = null;
      if (componente?.type === "CallExpression") {
        nombreComponente = componente.arguments[0]?.name;
        const segundo = componente.arguments[1];
        moduloGuarda = segundo?.type === "Literal" ? segundo.value : segundo ? "por roles" : null;
      } else if (componente?.type === "Identifier") {
        nombreComponente = componente.name;
      }
      salida.push({
        stack,
        ruta: nombreDeRuta(prop("name")),
        titulo: prop("titulo")?.value ?? "",
        modulo: moduloGuarda,
        componente: nombreComponente,
      });
    }
  }
  // Pantallas sueltas: <X.Screen name={ROUTES.Y} component={Z} />
  const pila = [m.programa];
  const yaEstan = new Set(salida.map((s) => s.componente));
  while (pila.length) {
    const n = pila.pop();
    if (
      n.type === "JSXOpeningElement" &&
      n.name.type === "JSXMemberExpression" &&
      n.name.property.name === "Screen"
    ) {
      const attr = (k) => n.attributes.find((a) => a.name?.name === k)?.value?.expression;
      const componente = attr("component");
      if (
        componente?.type === "Identifier" &&
        !yaEstan.has(componente.name) &&
        m.imports.has(componente.name)
      ) {
        salida.push({
          stack: n.name.object.name.replace(/Stack$/, "").toLowerCase(),
          ruta: nombreDeRuta(attr("name")),
          titulo: "",
          modulo: null,
          componente: componente.name,
        });
        yaEstan.add(componente.name);
      }
    }
    pila.push(...hijos(n));
  }

  return salida
    .filter((p) => p.componente && m.imports.has(p.componente))
    .map((p) => ({
      ...p,
      archivo: resolverFuente(NAVEGADOR, m.imports.get(p.componente).fuente),
      uso: usoDe(NAVEGADOR, p.componente),
    }));
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------
const web = pantallasWeb();
const movil = pantallasMovil();

const lista = (conjunto) =>
  conjunto.size
    ? [...conjunto]
        .sort()
        .map((x) => `\`${x}\``)
        .join(", ")
    : "—";

const l = [];
l.push("# Pantallas y los datos que usan");
l.push("");
l.push(
  "> **Documento generado.** No se edita a mano: sale de `npm run docs:pantallas` " +
    "(`scripts/generar-mapa-de-pantallas.mjs`), que lee las rutas de las dos apps y sigue, " +
    "funcion por funcion, lo que cada pantalla llama hasta llegar a Supabase.",
);
l.push("");
l.push(
  "Dice que tablas y vistas (`.from`), funciones de la base (`.rpc`), Edge Functions " +
    "(`functions.invoke`) y buckets de Storage **puede** usar cada pantalla, incluidas las " +
    "ramas que solo corren para un rol. Que filas ve cada rol lo decide RLS: ver " +
    "[PERMISOS.md](PERMISOS.md). Las tablas estan descritas en " +
    "[DICCIONARIO-DE-DATOS.md](DICCIONARIO-DE-DATOS.md).",
);
l.push("");
l.push("## Resumen");
l.push("");
l.push("| App | Pantallas (rutas) |");
l.push("| --- | --- |");
l.push(`| Web (\`apps/web\`) | ${web.length} |`);
l.push(`| Movil (\`apps/movil\`) | ${movil.length} |`.replace("apps/movil", "apps/mobile"));
l.push("");
l.push(
  "Una ruta con parametro (`/pacientes/:id`) cuenta una vez. Los dialogos (modales) no son " +
    "pantallas: lo que consultan se suma a la pantalla que los abre.",
);
l.push("");

const fila = (p, ruta, extra) =>
  `| ${ruta} | ${extra} | ${p.archivo ? `\`${rel(p.archivo)}\`` : `\`${p.componente}\``} | ${lista(p.uso.tablas)} | ${lista(p.uso.rpc)} | ${lista(new Set([...p.uso.edge, ...[...p.uso.buckets].map((b) => `storage:${b}`)]))} |`;

l.push("## Web");
l.push("");
l.push(
  "| Ruta | Modulo | Pantalla | Tablas y vistas | Funciones de la base | Edge Functions y Storage |",
);
l.push("| --- | --- | --- | --- | --- | --- |");
for (const p of web) l.push(fila(p, `\`${p.ruta}\``, p.modulo ? `\`${p.modulo}\`` : "publica"));
l.push("");

l.push("## Movil");
l.push("");
l.push(
  "| Pantalla (ruta) | Pestana y guarda | Archivo | Tablas y vistas | Funciones de la base | Edge Functions y Storage |",
);
l.push("| --- | --- | --- | --- | --- | --- |");
for (const p of movil) {
  const nombre = p.titulo ? `${p.titulo} (\`${p.ruta}\`)` : `\`${p.ruta}\``;
  const guarda = [
    p.stack,
    p.modulo ? (p.modulo === "por roles" ? "por roles" : `modulo \`${p.modulo}\``) : null,
  ]
    .filter(Boolean)
    .join(", ");
  l.push(fila(p, nombre, guarda));
}
l.push("");

// Indice inverso
const porObjeto = new Map();
const anotar = (objeto, quien) => {
  if (!porObjeto.has(objeto)) porObjeto.set(objeto, { web: new Set(), movil: new Set() });
  porObjeto.get(objeto)[quien.app].add(quien.nombre);
};
for (const p of web)
  for (const t of [...p.uso.tablas, ...p.uso.rpc]) anotar(t, { app: "web", nombre: p.ruta });
for (const p of movil)
  for (const t of [...p.uso.tablas, ...p.uso.rpc]) anotar(t, { app: "movil", nombre: p.ruta });

l.push("## Que pantallas usan cada tabla, vista o funcion");
l.push("");
l.push("| Objeto de la base | Web | Movil |");
l.push("| --- | --- | --- |");
for (const [objeto, usos] of [...porObjeto].sort(([a], [b]) => a.localeCompare(b))) {
  l.push(
    `| \`${objeto}\` | ${
      [...usos.web]
        .sort()
        .map((r) => `\`${r}\``)
        .join(", ") || "—"
    } | ${
      [...usos.movil]
        .sort()
        .map((r) => `\`${r}\``)
        .join(", ") || "—"
    } |`,
  );
}
l.push("");

const dinamicas = new Set([...web, ...movil].flatMap((p) => [...p.uso.dinamicas]));
if (dinamicas.size) {
  l.push("## Llamadas con nombre dinamico");
  l.push("");
  l.push(
    "Estas llamadas arman el nombre de la tabla o funcion en tiempo de ejecucion y el analisis no " +
      "las puede resolver; lo que tocan hay que leerlo en el archivo:",
  );
  l.push("");
  for (const d of [...dinamicas].sort()) l.push(`- ${d}`);
  l.push("");
}

writeFileSync(SALIDA, `${l.join("\n")}\n`, "utf8");
console.log(
  `docs/PANTALLAS.md: ${web.length} pantallas web, ${movil.length} moviles, ${porObjeto.size} objetos de la base.`,
);
