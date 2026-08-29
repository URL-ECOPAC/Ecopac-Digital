#!/usr/bin/env node
// Guarda de CI: comprueba que packages/shared solo nombre tablas, columnas y funciones que
// existen en supabase/migrations/ (issue #492).
//
// POR QUE EXISTE
//
// Siete issues distintas describen el mismo defecto: codigo de shared que consulta tablas o
// columnas inexistentes, mergeado con el CI en verde (#454, #396, #489, #490, #491, y #523 y
// #509 abiertas al escribir esto). Nada en el CI comparaba los dos arboles.
//
// Las pruebas no lo tapan, y no es descuido de quien las escribio: el doble del cliente de
// Supabase se construye leyendo el codigo que se va a probar, no la migracion. Reproduce el
// mismo error y verifica los nombres inventados contra si mismos. Pasaria en verde aunque el
// esquema no existiera.
//
// Esto es analisis de texto sobre los dos arboles: no necesita base de datos ni credenciales, y
// corre en un segundo.
//
// QUE NO COMPRUEBA, A PROPOSITO
//
//   - Las columnas de las VISTAS. Salen del SELECT que las define, y vista_reporte_impacto se
//     redefine en la 00027, la 00054 y la 00064. Los siete defectos conocidos eran sobre tablas.
//     Las referencias saltadas se cuentan y se informan: es una omision declarada, no un silencio.
//   - Los .rpc() con nombre dinamico, que no se pueden resolver sin ejecutar el codigo.
//   - Las Edge Functions, hasta que se cierre la issue #523 (ver VERIFICAR_EDGE_FUNCTIONS).
//
// Uso:
//   npm run verificar:shared-esquema
//   npm run verificar:shared-esquema -- --autoprueba

import { appendFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR_MIGRACIONES = join(RAIZ, "supabase", "migrations");
const DIR_SHARED = join(RAIZ, "packages", "shared");
const DIR_EDGE_FUNCTIONS = join(RAIZ, "supabase", "functions");

// La comprobacion de Edge Functions esta escrita y probada, pero apagada: hoy encontraria
// functions.invoke("invitar-usuario") contra un supabase/functions/ que solo tiene .gitkeep, y
// eso es la issue #523, que ya tiene dueno. Se enciende poniendo esto en true en el mismo PR que
// escriba la funcion; no hace falta escribir nada mas.
const VERIFICAR_EDGE_FUNCTIONS = false;

const FILTROS_CON_COLUMNA = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "is",
  "like",
  "ilike",
  "contains",
  "order",
];

// ============================================================================
// Utilidades de recorrido de texto
// ============================================================================

/** Devuelve el indice del parentesis/llave que cierra al que abre en `desde`. */
function cierreDe(texto, desde) {
  const abre = texto[desde];
  const cierra = abre === "(" ? ")" : abre === "{" ? "}" : "]";
  let profundidad = 0;
  for (let i = desde; i < texto.length; i += 1) {
    if (texto[i] === abre) profundidad += 1;
    else if (texto[i] === cierra) {
      profundidad -= 1;
      if (profundidad === 0) return i;
    }
  }
  return -1;
}

/**
 * Parte `texto` por las comas que estan al nivel mas externo, ignorando las que caen dentro
 * de parentesis, llaves, corchetes o cadenas. Es la base de casi todo lo que sigue: sin esto,
 * una relacion embebida o un objeto anidado se confunden con una lista de columnas.
 */
function partirPorComasDeNivelCero(texto) {
  const partes = [];
  let actual = "";
  let profundidad = 0;
  let comilla = null;
  for (let i = 0; i < texto.length; i += 1) {
    const ch = texto[i];
    if (comilla) {
      if (ch === "\\") {
        actual += ch + (texto[i + 1] ?? "");
        i += 1;
        continue;
      }
      if (ch === comilla) comilla = null;
      actual += ch;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      comilla = ch;
      actual += ch;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") profundidad += 1;
    else if (ch === ")" || ch === "}" || ch === "]") profundidad -= 1;
    if (ch === "," && profundidad === 0) {
      partes.push(actual);
      actual = "";
      continue;
    }
    actual += ch;
  }
  partes.push(actual);
  return partes;
}

function lineaDe(texto, indice) {
  let n = 1;
  for (let i = 0; i < indice && i < texto.length; i += 1) if (texto[i] === "\n") n += 1;
  return n;
}

function listarArchivos(dir, filtro) {
  if (!existsSync(dir)) return [];
  const salida = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...listarArchivos(ruta, filtro));
    else if (filtro(entrada)) salida.push(ruta);
  }
  return salida;
}

// ============================================================================
// 1. Inventario del esquema
// ============================================================================

/**
 * Construye el inventario de tablas, vistas y funciones leyendo las migraciones en orden.
 * El orden importa: una columna agregada en la 00060 y borrada en la 00072 no existe.
 */
export function leerEsquema(sqlPorArchivo) {
  const tablas = new Map();
  const vistas = new Set();
  const funciones = new Set();

  for (const sqlCrudo of sqlPorArchivo) {
    // Los comentarios primero: "-- ADD COLUMN foo" no agrega ninguna columna.
    let sql = sqlCrudo.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

    for (const m of sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)/gi))
      funciones.add(m[1]);
    for (const m of sql.matchAll(
      /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/gi,
    ))
      vistas.add(m[1]);

    // El cuerpo de una funcion puede traer INSERT INTO, CREATE TABLE temporales y demas, que no
    // son parte del esquema publico. Se quita despues de haber sacado los nombres de funcion.
    sql = sql.replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, " ");

    for (const m of sql.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(/gi,
    )) {
      const abre = sql.indexOf("(", m.index + m[0].length - 1);
      const cierra = cierreDe(sql, abre);
      if (cierra === -1) continue;
      const columnas = tablas.get(m[1]) ?? new Set();
      for (const definicion of partirPorComasDeNivelCero(sql.slice(abre + 1, cierra))) {
        const limpia = definicion.trim();
        if (!limpia) continue;
        if (/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE|LIKE|INHERITS)\b/i.test(limpia))
          continue;
        const nombre = limpia.match(/^"?(\w+)"?\s+\S/);
        if (nombre) columnas.add(nombre[1]);
      }
      tablas.set(m[1], columnas);
    }

    // Trampa 1: un ALTER TABLE puede llevar varias clausulas separadas por coma
    // (ALTER TABLE recetas ADD COLUMN a, ADD COLUMN b, ADD COLUMN c). Hay seis migraciones asi,
    // y una regex que solo mire la primera da por inexistentes las demas columnas.
    for (const m of sql.matchAll(
      /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(?:public\.)?(\w+)([\s\S]*?);/gi,
    )) {
      const [, tabla, cuerpo] = m;
      if (!tablas.has(tabla)) tablas.set(tabla, new Set());
      const columnas = tablas.get(tabla);
      for (const c of cuerpo.matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi))
        columnas.add(c[1]);
      for (const c of cuerpo.matchAll(/DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?/gi))
        columnas.delete(c[1]);
      for (const c of cuerpo.matchAll(/RENAME\s+(?:COLUMN\s+)?"?(\w+)"?\s+TO\s+"?(\w+)"?/gi)) {
        columnas.delete(c[1]);
        columnas.add(c[2]);
      }
    }

    for (const m of sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)/gi))
      tablas.delete(m[1]);
  }

  return { tablas, vistas, funciones };
}

// ============================================================================
// 2. Inventario de lo que pide packages/shared
// ============================================================================

/**
 * Constantes de columnas declaradas en un archivo. El 60% de los .select() del repositorio no
 * usa un literal sino una constante, y sin resolverla se pierde esa cobertura entera.
 * Se admiten las dos formas que usa el codigo: string y array de strings.
 */
function constantesDeColumnas(texto) {
  const constantes = new Map();
  for (const m of texto.matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*(["`])/g)) {
    const comilla = m[2];
    const inicio = m.index + m[0].length;
    const fin = texto.indexOf(comilla, inicio);
    if (fin !== -1) constantes.set(m[1], texto.slice(inicio, fin));
  }
  for (const m of texto.matchAll(/(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*\[/g)) {
    const abre = texto.indexOf("[", m.index);
    const cierra = cierreDe(texto, abre);
    if (cierra === -1) continue;
    // Solo vale si TODOS los elementos son cadenas literales. Asi se descarta un array de
    // objetos -que no es una lista de columnas- sin descartar de paso los que traen una
    // relacion embebida dentro de la cadena, como "comunidad:comunidades(nombre)".
    const partes = partirPorComasDeNivelCero(texto.slice(abre + 1, cierra))
      .map((x) => x.replace(/\/\/[^\n]*/g, "").trim())
      .filter(Boolean);
    // Un elemento puede ser otra constante ya conocida: bodegas.api.js compone
    // COLUMNAS_CON_EXISTENCIAS a partir de COLUMNAS_DE_LA_BODEGA. Sin resolverlo, el modulo
    // donde vivio el defecto #454 se quedaba entero sin comprobar.
    const resueltas = partes.map((x) =>
      /^"[^"]*"$/.test(x) ? x.slice(1, -1) : (constantes.get(x) ?? null),
    );
    if (!resueltas.length || resueltas.some((x) => x === null)) continue;
    constantes.set(m[1], resueltas.join(", "));
  }
  return constantes;
}

/**
 * Columnas que pide una cadena de .select().
 *
 * Trampa 2: una relacion embebida -`jornada:jornadas(nombre, fecha)`, y anidada dentro de otra
 * en triaje.api.js- no es una columna de la tabla consultada. Se descarta el token entero,
 * nombre de la relacion incluido; borrar solo los parentesis deja el nombre suelto y lo
 * convierte en un falso positivo.
 */
export function columnasDeSeleccion(seleccion) {
  const columnas = [];
  for (const bruto of partirPorComasDeNivelCero(seleccion)) {
    const token = bruto.trim();
    if (!token) continue;
    if (token.includes("(")) continue; // relacion embebida
    if (token === "*" || token === "count" || token.startsWith("$")) continue;
    const sinAlias = token.includes(":") ? token.slice(token.lastIndexOf(":") + 1).trim() : token;
    const nombre = sinAlias.replace(/!.*$/, "").trim();
    if (/^\w+$/.test(nombre) && nombre !== "count") columnas.push(nombre);
  }
  return columnas;
}

/**
 * Claves de un objeto literal de .insert()/.update()/.upsert().
 *
 * Trampa 3: solo el nivel exterior. `insert({ ...aColumnasDeTabla({ motivoConsulta }) })` pasa
 * por un helper que traduce camelCase a snake_case; leer dentro da falsos positivos.
 * Trampa 4: la propiedad shorthand `{ tipo, nombre, documento_identidad }` no lleva dos puntos.
 * Es exactamente como entro el bug #509, y un parser que solo busque `clave:` no la ve.
 */
export function clavesDeObjeto(cuerpo) {
  const claves = [];
  for (const bruto of partirPorComasDeNivelCero(cuerpo)) {
    const parte = bruto.trim();
    if (!parte || parte.startsWith("...")) continue;
    const m = parte.match(/^"?(\w+)"?\s*(:|$)/);
    if (m) claves.push(m[1]);
  }
  return claves;
}

/** Analiza un archivo de shared y devuelve lo que le pide a cada tabla. */
export function peticionesDelArchivo(texto, constantesImportadas = new Map()) {
  const constantes = new Map([...constantesImportadas, ...constantesDeColumnas(texto)]);
  const peticiones = [];
  const rpc = [];
  const edge = [];
  const omitido = { vistas: [], rpcDinamicos: 0, constantesSinResolver: [] };

  for (const m of texto.matchAll(/\.rpc\(\s*"(\w+)"/g)) rpc.push({ nombre: m[1], indice: m.index });
  omitido.rpcDinamicos = [...texto.matchAll(/\.rpc\(\s*[a-z_$]/gi)].length;
  for (const m of texto.matchAll(/functions\.invoke\(\s*(?:"([\w-]+)"|([A-Z][A-Z0-9_]*))/g)) {
    const nombre = m[1] ?? constantes.get(m[2]);
    if (nombre) edge.push({ nombre, indice: m.index });
  }

  const puntos = [...texto.matchAll(/\.from\(\s*"(\w+)"\s*\)/g)];
  for (let i = 0; i < puntos.length; i += 1) {
    const m = puntos[i];
    const tabla = m[1];
    // La ventana es el mismo statement: hasta el siguiente .from() o el primer punto y coma.
    // Sin acotarla, un .insert() de mas abajo se atribuye a esta tabla.
    let fin = i + 1 < puntos.length ? puntos[i + 1].index : texto.length;
    const puntoYComa = texto.indexOf(";", m.index + m[0].length);
    if (puntoYComa !== -1) fin = Math.min(fin, puntoYComa);
    const desde = m.index + m[0].length;
    const ventana = texto.slice(desde, fin);
    const pedidas = [];

    for (const s of ventana.matchAll(/\.select\(\s*(["`])/g)) {
      const comilla = s[1];
      const inicio = s.index + s[0].length;
      const cierra = ventana.indexOf(comilla, inicio);
      if (cierra === -1) continue;
      let contenido = ventana.slice(inicio, cierra);
      // Interpolacion en plantilla: `${COLUMNAS_DEL_TRIAJE}, atencion:atenciones!inner(...)`.
      contenido = contenido.replace(/\$\{(\w+)\}/g, (todo, nombre) =>
        constantes.has(nombre) ? constantes.get(nombre) : "",
      );
      for (const columna of columnasDeSeleccion(contenido))
        pedidas.push({ operacion: "select", columna, indice: desde + inicio });
    }

    for (const s of ventana.matchAll(/\.select\(\s*([A-Z][A-Z0-9_]*)\s*[,)]/g)) {
      if (constantes.has(s[1])) {
        for (const columna of columnasDeSeleccion(constantes.get(s[1])))
          pedidas.push({ operacion: "select", columna, indice: desde + s.index });
      } else {
        omitido.constantesSinResolver.push({ nombre: s[1], indice: desde + s.index });
      }
    }

    const filtros = new RegExp(`\\.(${FILTROS_CON_COLUMNA.join("|")})\\(\\s*"([\\w.]+)"`, "g");
    for (const s of ventana.matchAll(filtros)) {
      // "atenciones.paciente_id" filtra sobre la tabla embebida, no sobre esta.
      if (!s[2].includes("."))
        pedidas.push({ operacion: s[1], columna: s[2], indice: desde + s.index });
    }

    for (const s of ventana.matchAll(/\.(insert|update|upsert)\(\s*\{/g)) {
      const abre = ventana.indexOf("{", s.index + s[0].length - 1);
      const cierra = cierreDe(ventana, abre);
      if (cierra === -1) continue;
      for (const columna of clavesDeObjeto(ventana.slice(abre + 1, cierra)))
        pedidas.push({ operacion: s[1], columna, indice: desde + abre });
    }

    peticiones.push({ tabla, indice: m.index, pedidas });
  }

  return { peticiones, rpc, edge, omitido };
}

// ============================================================================
// 3. Comparacion
// ============================================================================

export function comparar(archivos, esquema, opciones = {}) {
  const { verificarEdgeFunctions = false, edgeFunctionsExistentes = new Set() } = opciones;
  const hallazgos = [];
  const resumen = {
    tablasRevisadas: 0,
    columnasRevisadas: 0,
    vistasOmitidas: new Map(),
    rpcDinamicos: 0,
    constantesSinResolver: [],
  };

  for (const { ruta, texto, constantesImportadas } of archivos) {
    const { peticiones, rpc, edge, omitido } = peticionesDelArchivo(texto, constantesImportadas);
    resumen.rpcDinamicos += omitido.rpcDinamicos;
    for (const c of omitido.constantesSinResolver)
      resumen.constantesSinResolver.push({
        ruta,
        nombre: c.nombre,
        linea: lineaDe(texto, c.indice),
      });

    for (const { tabla, indice, pedidas } of peticiones) {
      if (esquema.vistas.has(tabla)) {
        resumen.vistasOmitidas.set(tabla, (resumen.vistasOmitidas.get(tabla) ?? 0) + 1);
        continue;
      }
      if (!esquema.tablas.has(tabla)) {
        hallazgos.push({
          ruta,
          linea: lineaDe(texto, indice),
          clase: "tabla",
          detalle: `la tabla "${tabla}" no existe en supabase/migrations/`,
        });
        continue;
      }
      resumen.tablasRevisadas += 1;
      const columnas = esquema.tablas.get(tabla);
      const yaReportadas = new Set();
      for (const { operacion, columna, indice: donde } of pedidas) {
        resumen.columnasRevisadas += 1;
        if (columnas.has(columna)) continue;
        const clave = `${tabla}.${columna}`;
        if (yaReportadas.has(clave)) continue;
        yaReportadas.add(clave);
        hallazgos.push({
          ruta,
          linea: lineaDe(texto, donde),
          clase: "columna",
          detalle: `${tabla}.${columna} no existe (la pide .${operacion}())`,
        });
      }
    }

    for (const { nombre, indice } of rpc) {
      if (esquema.funciones.has(nombre)) continue;
      hallazgos.push({
        ruta,
        linea: lineaDe(texto, indice),
        clase: "funcion",
        detalle: `la funcion "${nombre}" no existe en supabase/migrations/`,
      });
    }

    if (verificarEdgeFunctions) {
      for (const { nombre, indice } of edge) {
        if (edgeFunctionsExistentes.has(nombre)) continue;
        hallazgos.push({
          ruta,
          linea: lineaDe(texto, indice),
          clase: "edge-function",
          detalle: `la Edge Function "${nombre}" no existe en supabase/functions/`,
        });
      }
    }
  }

  return { hallazgos, resumen };
}

// ============================================================================
// Aviso aparte: archivos que ningun barril reexporta
// ============================================================================

// Fue el segundo motivo por el que #454 paso el CI: si el barril no lo exporta, vite build ni lo
// compila, asi que el error solo aparece cuando alguien conecta la pantalla. Es aviso y no fallo:
// un archivo recien creado y todavia sin conectar es legitimo.
function archivosHuerfanos(dirShared) {
  const modulos = readdirSync(dirShared).filter((n) => existsSync(join(dirShared, n, "index.js")));
  const huerfanos = [];
  for (const modulo of modulos) {
    const barril = readFileSync(join(dirShared, modulo, "index.js"), "utf8");
    for (const archivo of readdirSync(join(dirShared, modulo))) {
      if (!archivo.endsWith(".js")) continue;
      if (archivo === "index.js" || archivo.includes(".test.")) continue;
      if (!barril.includes(`./${archivo}`)) huerfanos.push(`${modulo}/${archivo}`);
    }
  }
  return huerfanos;
}

// ============================================================================
// Autoprueba
// ============================================================================

// scripts/ no es un workspace, asi que npm test no lo alcanza. Estas fixtures cubren las cinco
// trampas que el prototipo encontro contra el repositorio real, y un caso bueno de cada forma
// para que una correccion de mas se note como falso positivo.
const CASOS = [
  {
    nombre: "ALTER TABLE multi-clausula: las tres columnas cuentan",
    sql: `CREATE TABLE recetas (id UUID PRIMARY KEY, estado TEXT NOT NULL);
          ALTER TABLE recetas
            ADD COLUMN motivo_anulacion TEXT,
            ADD COLUMN anulada_por UUID,
            ADD COLUMN anulada_en TIMESTAMPTZ;`,
    js: `supabase.from("recetas").update({ motivo_anulacion: m, anulada_por: p, anulada_en: f });`,
    esperado: [],
  },
  {
    nombre: "relacion embebida anidada: no son columnas de la tabla consultada",
    sql: `CREATE TABLE triajes (id UUID PRIMARY KEY, tomado_en TIMESTAMPTZ);
          CREATE TABLE atenciones (id UUID PRIMARY KEY, paciente_id UUID, jornada_id UUID);`,
    js: 'supabase.from("triajes").select(`id, atencion:atenciones!inner(pacienteId:paciente_id, jornada:jornadas(nombre, fecha))`);',
    esperado: [],
  },
  {
    nombre: "objeto anidado dentro de una llamada: no se lee",
    sql: `CREATE TABLE consultas (id UUID PRIMARY KEY, expediente_id UUID);`,
    js: `supabase.from("consultas").insert({ expediente_id: e, ...aColumnas({ motivoConsulta: x }) });`,
    esperado: [],
  },
  {
    nombre: "propiedad shorthand inexistente: se detecta (asi entro #509)",
    sql: `CREATE TABLE donantes (id UUID PRIMARY KEY, nombre TEXT, tipo TEXT, telefono TEXT);`,
    js: `supabase.from("donantes").insert({ tipo, nombre, documento_identidad, telefono });`,
    esperado: ["donantes.documento_identidad"],
  },
  {
    // Es la forma real del repositorio: const X = [...].join(", ") y luego .select(X).
    nombre: "constante de columnas resuelta desde un array",
    sql: `CREATE TABLE proyectos (id UUID PRIMARY KEY, nombre TEXT);`,
    js: `const COLUMNAS_DEL_PROYECTO = ["id", "nombre", "presupuesto_total"].join(", ");
         supabase.from("proyectos").select(COLUMNAS_DEL_PROYECTO);`,
    esperado: ["proyectos.presupuesto_total"],
  },
  {
    // triaje.api.js interpola la constante dentro de una plantilla y le agrega embebidos.
    nombre: "constante interpolada en una plantilla",
    sql: `CREATE TABLE triajes (id UUID PRIMARY KEY, tomado_en TIMESTAMPTZ);
          CREATE TABLE atenciones (id UUID PRIMARY KEY, paciente_id UUID);`,
    js:
      'const COLUMNAS_DEL_TRIAJE = "id, tomado_en, presion_arterial";\n' +
      'supabase.from("triajes").select(`${COLUMNAS_DEL_TRIAJE}, atencion:atenciones!inner(paciente_id)`);',
    esperado: ["triajes.presion_arterial"],
  },
  {
    nombre: "columna borrada por una migracion posterior ya no vale",
    sql: `CREATE TABLE lotes (id UUID PRIMARY KEY, cantidad_disponible INT);
          ALTER TABLE lotes DROP COLUMN cantidad_disponible;`,
    js: `supabase.from("lotes").select("id, cantidad_disponible");`,
    esperado: ["lotes.cantidad_disponible"],
  },
  {
    nombre: "columna renombrada: vale la nueva, no la vieja",
    sql: `CREATE TABLE bodegas (id UUID PRIMARY KEY, clase TEXT);
          ALTER TABLE bodegas RENAME COLUMN clase TO tipo;`,
    js: `supabase.from("bodegas").select("id, tipo").eq("clase", x);`,
    esperado: ["bodegas.clase"],
  },
  {
    nombre: "filtro sobre tabla embebida: no es columna de esta tabla",
    sql: `CREATE TABLE triajes (id UUID PRIMARY KEY);
          CREATE TABLE atenciones (id UUID PRIMARY KEY, paciente_id UUID);`,
    js: `supabase.from("triajes").select("id").eq("atenciones.paciente_id", p);`,
    esperado: [],
  },
  {
    nombre: "tabla inexistente",
    sql: `CREATE TABLE receta_detalle (id UUID PRIMARY KEY);`,
    js: `supabase.from("recetas_detalle").select("id");`,
    esperado: ['la tabla "recetas_detalle" no existe en supabase/migrations/'],
  },
  {
    nombre: "rpc inexistente, y el dinamico no se cuenta",
    sql: `CREATE FUNCTION fn_registrar_paciente(p UUID) RETURNS UUID AS $$ SELECT p; $$ LANGUAGE sql;`,
    js: `supabase.rpc("fn_registrar_paciente", {}); supabase.rpc("fn_inventada", {}); supabase.rpc(nombre, {});`,
    esperado: ['la funcion "fn_inventada" no existe en supabase/migrations/'],
  },
  {
    nombre: "el cuerpo de una funcion no define el esquema publico",
    sql: `CREATE TABLE perfiles (id UUID PRIMARY KEY);
          CREATE FUNCTION f() RETURNS void AS $$ BEGIN CREATE TABLE tmp_x (colada INT); END; $$ LANGUAGE plpgsql;`,
    js: `supabase.from("tmp_x").select("colada");`,
    esperado: ['la tabla "tmp_x" no existe en supabase/migrations/'],
  },
  {
    nombre: "un comentario SQL no agrega columnas",
    sql: `CREATE TABLE gastos (id UUID PRIMARY KEY);
          -- ALTER TABLE gastos ADD COLUMN rechazado_por UUID;`,
    js: `supabase.from("gastos").update({ rechazado_por: p });`,
    esperado: ["gastos.rechazado_por"],
  },
  {
    nombre: "dos statements seguidos no se mezclan",
    sql: `CREATE TABLE a (id UUID PRIMARY KEY, uno TEXT);
          CREATE TABLE b (id UUID PRIMARY KEY, dos TEXT);`,
    js: `await supabase.from("a").select("uno");
         await supabase.from("b").select("dos");`,
    esperado: [],
  },
];

function autoprueba() {
  let fallos = 0;
  for (const caso of CASOS) {
    const esquema = leerEsquema([caso.sql]);
    const { hallazgos } = comparar([{ ruta: "fixture.js", texto: caso.js }], esquema);
    const obtenido = hallazgos.map((h) =>
      h.clase === "columna" ? h.detalle.split(" ")[0] : h.detalle,
    );
    const ok =
      obtenido.length === caso.esperado.length && caso.esperado.every((e) => obtenido.includes(e));
    console.log(`  ${ok ? "ok  " : "FALLA"}  ${caso.nombre}`);
    if (!ok) {
      fallos += 1;
      console.log(`         esperado: ${JSON.stringify(caso.esperado)}`);
      console.log(`         obtenido: ${JSON.stringify(obtenido)}`);
    }
  }
  console.log(`\n${CASOS.length - fallos}/${CASOS.length} casos en verde.`);
  return fallos === 0;
}

// ============================================================================
// Entrada
// ============================================================================

function cargarArchivosDeShared() {
  const rutas = listarArchivos(
    DIR_SHARED,
    (n) => n.endsWith(".js") && !n.includes(".test.") && n !== "index.js",
  );
  const textos = new Map(rutas.map((r) => [r, readFileSync(r, "utf8")]));

  return rutas.map((ruta) => {
    // Un solo nivel de import: condiciones.api.js trae COLUMNAS_DE_CONDICION_CRONICA de ./api.js.
    const texto = textos.get(ruta);
    const constantesImportadas = new Map();
    for (const m of texto.matchAll(/import\s*\{([^}]*)\}\s*from\s*"(\.[^"]*)"/g)) {
      const destino = resolve(dirname(ruta), m[2]);
      const origen = textos.get(destino) ?? textos.get(`${destino}.js`);
      if (!origen) continue;
      const disponibles = constantesDeColumnas(origen);
      for (const nombre of m[1].split(",").map((x) => x.trim())) {
        if (disponibles.has(nombre)) constantesImportadas.set(nombre, disponibles.get(nombre));
      }
    }
    return { ruta, texto, constantesImportadas };
  });
}

function principal() {
  if (process.argv.includes("--autoprueba")) {
    console.log("Autoprueba del analizador\n");
    process.exit(autoprueba() ? 0 : 1);
  }

  const sql = readdirSync(DIR_MIGRACIONES)
    .filter((n) => n.endsWith(".sql"))
    .sort()
    .map((n) => readFileSync(join(DIR_MIGRACIONES, n), "utf8"));
  const esquema = leerEsquema(sql);

  const edgeFunctionsExistentes = new Set(
    existsSync(DIR_EDGE_FUNCTIONS)
      ? readdirSync(DIR_EDGE_FUNCTIONS).filter((n) =>
          statSync(join(DIR_EDGE_FUNCTIONS, n)).isDirectory(),
        )
      : [],
  );

  const archivos = cargarArchivosDeShared();
  const { hallazgos, resumen } = comparar(archivos, esquema, {
    verificarEdgeFunctions: VERIFICAR_EDGE_FUNCTIONS,
    edgeFunctionsExistentes,
  });

  console.log(
    `Esquema: ${esquema.tablas.size} tablas, ${esquema.vistas.size} vistas, ` +
      `${esquema.funciones.size} funciones, desde ${sql.length} migraciones.`,
  );
  console.log(
    `Revisado: ${archivos.length} archivos de packages/shared, ` +
      `${resumen.tablasRevisadas} consultas, ${resumen.columnasRevisadas} referencias a columnas.`,
  );

  // Lo omitido se dice, no se calla: quien lea la salida tiene que saber que no se comprobo.
  if (resumen.vistasOmitidas.size) {
    const detalle = [...resumen.vistasOmitidas].map(([v, n]) => `${v} (${n})`).join(", ");
    console.log(
      `Omitido: ${detalle}. Las columnas de una vista salen de su SELECT y no se resuelven con texto.`,
    );
  }
  if (resumen.rpcDinamicos)
    console.log(`Omitido: ${resumen.rpcDinamicos} .rpc() con nombre dinamico.`);
  if (resumen.constantesSinResolver.length) {
    console.log(
      `Omitido: ${resumen.constantesSinResolver.length} .select() con una constante que no se pudo resolver.`,
    );
    for (const c of resumen.constantesSinResolver)
      console.log(`  ${relative(RAIZ, c.ruta)}:${c.linea}  ${c.nombre}`);
  }
  if (!VERIFICAR_EDGE_FUNCTIONS)
    console.log("Omitido: las Edge Functions (ver VERIFICAR_EDGE_FUNCTIONS, issue #523).");

  const huerfanos = archivosHuerfanos(DIR_SHARED);
  if (huerfanos.length) {
    console.log(`\nAviso: ${huerfanos.length} archivos que ningun barril reexporta.`);
    for (const h of huerfanos) console.log(`  packages/shared/${h}`);
    console.log("  vite build no los compila, asi que un error suyo no aparece hasta conectarlos.");
  }

  if (!hallazgos.length) {
    console.log("\nTodo lo que packages/shared nombra existe en supabase/migrations/.");
    return 0;
  }

  console.log(`\n${hallazgos.length} hallazgos:\n`);
  for (const h of hallazgos) {
    const donde = `${relative(RAIZ, h.ruta)}:${h.linea}`;
    console.log(`  ${donde}  ${h.detalle}`);
    if (process.env.GITHUB_ACTIONS)
      console.log(`::error file=${relative(RAIZ, h.ruta)},line=${h.linea}::${h.detalle}`);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const lineas = [
      "## packages/shared no coincide con el esquema",
      "",
      "Este codigo nombra tablas, columnas o funciones que **no existen en `supabase/migrations/`**.",
      "Las pruebas no lo detectan: el doble del cliente de Supabase se escribe leyendo el codigo",
      "que se va a probar, asi que reproduce el mismo error y lo verifica contra si mismo.",
      "",
      "| Archivo | Que falta |",
      "| --- | --- |",
      ...hallazgos.map((h) => `| \`${relative(RAIZ, h.ruta)}:${h.linea}\` | ${h.detalle} |`),
      "",
      "**Que hacer:** corregir el nombre si es una errata, o agregar la columna con una migracion",
      "nueva (revisar que numero corresponde: tiene que ser mayor que el ultimo de `develop`).",
      "",
      "Si el analizador se equivoca -por ejemplo con una vista cuyas columnas no sabe resolver-,",
      "agrega la etiqueta `esquema-verificado-a-mano` al PR y explica por que en la descripcion.",
    ];
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lineas.join("\n")}\n`);
  }

  return 1;
}

// Solo al ejecutarlo, no al importarlo: asi las funciones de arriba siguen siendo
// utilizables desde otro modulo sin disparar la verificacion entera.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(principal());
}
