#!/usr/bin/env node
/* global console, process */
// Genera docs/DICCIONARIO-DE-DATOS.md leyendo el catalogo de PostgreSQL (issue #233).
//
// POR QUE SE GENERA Y NO SE ESCRIBE A MANO
//
// El diccionario tiene que coincidir con lo que de verdad hay en la base: 52 tablas con cientos
// de columnas, sus restricciones, sus politicas RLS y sus triggers. Escrito a mano se desfasa con
// la primera migracion que agrega una columna. Aqui cada dato sale del catalogo (pg_class,
// information_schema, pg_constraint, pg_policies, pg_trigger, pg_proc) de una base a la que se le
// aplicaron TODAS las migraciones, y los textos descriptivos salen de los COMMENT ON que cada
// migracion deja. Si una columna no tiene descripcion, el remedio es un COMMENT ON en una
// migracion nueva, no editar el documento.
//
// COMO SE CORRE
//
//   npx supabase start            (una vez; levanta la base local en Docker)
//   npx supabase db reset --local (aplica todas las migraciones desde cero)
//   npm run docs:diccionario
//
// Por defecto consulta el contenedor local de Supabase (supabase_db_ecopac-digital) con
// `docker exec ... psql`. Con DATABASE_URL definida usa `psql "$DATABASE_URL"` en su lugar.

import { execFileSync } from "node:child_process";
import { writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = join(RAIZ, "docs", "DICCIONARIO-DE-DATOS.md");
const CONTENEDOR = process.env.ECOPAC_DB_CONTENEDOR ?? "supabase_db_ecopac-digital";

/** Corre una consulta que devuelve un solo valor JSON y lo parsea. */
function consultar(sql) {
  const argumentos = ["-At", "-v", "ON_ERROR_STOP=1", "-c", sql];
  const salida = process.env.DATABASE_URL
    ? execFileSync("psql", [process.env.DATABASE_URL, ...argumentos], { encoding: "utf8" })
    : execFileSync("docker", ["exec", CONTENEDOR, "psql", "-U", "postgres", ...argumentos], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
  return JSON.parse(salida.trim() || "null") ?? [];
}

// ---------------------------------------------------------------------------
// Modulos: a que parte del sistema pertenece cada tabla. Una tabla nueva que no este aqui sale
// en "Otras" y el script avisa, para que alguien la ubique.
// ---------------------------------------------------------------------------
const MODULOS = [
  {
    id: "usuarios",
    titulo: "Usuarios, roles y permisos",
    tablas: [
      "perfiles",
      "perfil_especialidad",
      "permisos",
      "rol_permiso",
      "usuario_permiso",
      "rol_modulo",
      "limites_de_uso",
    ],
  },
  {
    id: "territorio",
    titulo: "Territorio y catalogos generales",
    tablas: ["departamentos", "municipios", "comunidades", "idiomas"],
  },
  {
    id: "pacientes",
    titulo: "Pacientes y expediente",
    tablas: [
      "pacientes",
      "expedientes",
      "fusiones_pacientes",
      "padecimientos_cronicos",
      "condiciones_cronicas",
      "triajes",
    ],
  },
  {
    id: "clinica",
    titulo: "Atencion clinica: consultas, diagnosticos y recetas",
    tablas: [
      "atenciones",
      "consultas",
      "diagnosticos",
      "consulta_diagnostico",
      "recetas",
      "receta_detalle",
    ],
  },
  {
    id: "inventario",
    titulo: "Inventario de medicamentos e insumos",
    tablas: [
      "medicamentos",
      "principios_activos",
      "medicamento_principio",
      "presentaciones",
      "bodegas",
      "proveedores",
      "lotes",
      "existencias",
      "movimientos_inventario",
      "alertas_caducidad",
      "alerta_caducidad_detalle",
    ],
  },
  {
    id: "jornadas",
    titulo: "Jornadas",
    tablas: ["jornadas", "jornada_personal", "jornada_estado_historial", "jornada_insumos"],
  },
  {
    id: "presupuestos",
    titulo: "Presupuestos y gastos",
    tablas: ["gastos", "fuentes_de_presupuesto", "jornada_presupuesto_origen"],
  },
  {
    id: "proyectos",
    titulo: "Proyectos sociales",
    tablas: [
      "proyectos",
      "proyecto_hitos",
      "proyecto_seguimiento",
      "proyecto_estado_historial",
      "proyecto_personal",
      "proyecto_insumos",
    ],
  },
  {
    id: "donaciones",
    titulo: "Donaciones",
    tablas: ["donantes", "donaciones", "donacion_detalle"],
  },
  {
    id: "sistema",
    titulo: "Notificaciones y auditoria",
    tablas: ["notificaciones", "eventos_auditoria"],
  },
];

// ---------------------------------------------------------------------------
// Consultas al catalogo
// ---------------------------------------------------------------------------
const tablas = consultar(`
  SELECT json_agg(t ORDER BY t.nombre) FROM (
    SELECT c.relname AS nombre,
           obj_description(c.oid, 'pg_class') AS descripcion,
           c.relrowsecurity AS rls,
           c.relforcerowsecurity AS rls_forzado
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  ) t`);

const columnas = consultar(`
  SELECT json_agg(t ORDER BY t.tabla, t.posicion) FROM (
    SELECT c.relname AS tabla, a.attnum AS posicion, a.attname AS nombre,
           format_type(a.atttypid, a.atttypmod) AS tipo,
           NOT a.attnotnull AS nulo,
           pg_get_expr(d.adbin, d.adrelid) AS defecto,
           CASE WHEN a.attgenerated = 's' THEN true ELSE false END AS generada,
           col_description(c.oid, a.attnum) AS descripcion
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v') AND a.attnum > 0 AND NOT a.attisdropped
  ) t`);

const restricciones = consultar(`
  SELECT json_agg(t ORDER BY t.tabla, t.tipo, t.nombre) FROM (
    SELECT c.relname AS tabla, con.conname AS nombre, con.contype AS tipo,
           pg_get_constraintdef(con.oid) AS definicion,
           ref.relname AS referencia,
           (SELECT array_agg(a.attname ORDER BY k.ord)
              FROM unnest(con.conkey) WITH ORDINALITY k(num, ord)
              JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.num) AS columnas,
           obj_description(con.oid, 'pg_constraint') AS descripcion
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_class ref ON ref.oid = con.confrelid
    WHERE n.nspname = 'public'
  ) t`);

const politicas = consultar(`
  SELECT json_agg(t ORDER BY t.tabla, t.cmd, t.nombre) FROM (
    SELECT tablename AS tabla, policyname AS nombre, cmd, roles::text[] AS roles,
           permissive AS permisiva, qual AS usando, with_check AS verificando
    FROM pg_policies WHERE schemaname = 'public'
  ) t`);

const triggers = consultar(`
  SELECT json_agg(t ORDER BY t.tabla, t.nombre) FROM (
    SELECT c.relname AS tabla, tg.tgname AS nombre, p.proname AS funcion,
           pg_get_triggerdef(tg.oid) AS definicion
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = tg.tgfoid
    WHERE n.nspname = 'public' AND NOT tg.tgisinternal
  ) t`);

const privilegios = consultar(`
  SELECT json_agg(t ORDER BY t.tabla, t.rol) FROM (
    SELECT table_name AS tabla, grantee AS rol, array_agg(privilege_type ORDER BY privilege_type) AS privilegios
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
    GROUP BY table_name, grantee
  ) t`);

const vistas = consultar(`
  SELECT json_agg(t ORDER BY t.nombre) FROM (
    SELECT c.relname AS nombre, obj_description(c.oid, 'pg_class') AS descripcion,
           coalesce(c.reloptions::text, '') AS opciones
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
  ) t`);

const enums = consultar(`
  SELECT json_agg(t ORDER BY t.nombre) FROM (
    SELECT ty.typname AS nombre, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS valores,
           obj_description(ty.oid, 'pg_type') AS descripcion
    FROM pg_type ty
    JOIN pg_enum e ON e.enumtypid = ty.oid
    JOIN pg_namespace n ON n.oid = ty.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY ty.oid, ty.typname
  ) t`);

const funciones = consultar(`
  SELECT json_agg(t ORDER BY t.nombre, t.argumentos) FROM (
    SELECT p.proname AS nombre,
           pg_get_function_identity_arguments(p.oid) AS argumentos,
           pg_get_function_result(p.oid) AS resultado,
           p.prosecdef AS definer,
           p.prorettype = 'trigger'::regtype AS es_trigger,
           obj_description(p.oid, 'pg_proc') AS descripcion,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ejecuta_authenticated,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS ejecuta_anon
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  ) t`);

// ---------------------------------------------------------------------------
// Utilidades de formato
// ---------------------------------------------------------------------------
/** Texto seguro dentro de una celda de tabla Markdown. */
function celda(texto) {
  if (texto === null || texto === undefined || texto === "") return "";
  return String(texto).replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
}

/** Codigo en linea, seguro dentro de una celda. */
function codigo(texto) {
  if (!texto) return "";
  const limpio = celda(texto).replace(/`/g, "'");
  return `\`${limpio}\``;
}

/** Tipo legible: sin el esquema public. y con los nombres cortos de siempre. */
function tipoCorto(tipo) {
  return tipo
    .replace(/^public\./, "")
    .replace("timestamp with time zone", "timestamptz")
    .replace("timestamp without time zone", "timestamp")
    .replace("character varying", "varchar")
    .replace("double precision", "float8");
}

/** Tipo aceptable como atributo de un erDiagram de Mermaid (una palabra, sin simbolos). */
function tipoMermaid(tipo) {
  return tipoCorto(tipo)
    .replace(/\(.*\)/, "")
    .replace(/\[\]$/, "_array")
    .replace(/[^A-Za-z0-9_]/g, "_");
}

const OPERACION = {
  SELECT: "Leer",
  INSERT: "Crear",
  UPDATE: "Editar",
  DELETE: "Borrar",
  ALL: "Todo",
};

const porTabla = (lista) => {
  const mapa = new Map();
  for (const fila of lista) {
    if (!mapa.has(fila.tabla)) mapa.set(fila.tabla, []);
    mapa.get(fila.tabla).push(fila);
  }
  return mapa;
};

const columnasPorTabla = porTabla(columnas);
const restriccionesPorTabla = porTabla(restricciones);
const politicasPorTabla = porTabla(politicas);
const triggersPorTabla = porTabla(triggers);
const privilegiosPorTabla = porTabla(privilegios);

const nombresDeTabla = new Set(tablas.map((t) => t.nombre));
const moduloDeTabla = new Map();
for (const modulo of MODULOS) for (const t of modulo.tablas) moduloDeTabla.set(t, modulo);
const sinModulo = tablas.filter((t) => !moduloDeTabla.has(t.nombre)).map((t) => t.nombre);
const inexistentes = MODULOS.flatMap((m) => m.tablas).filter((t) => !nombresDeTabla.has(t));
if (sinModulo.length) console.warn(`Tablas sin modulo (salen en "Otras"): ${sinModulo.join(", ")}`);
if (inexistentes.length) console.warn(`En MODULOS pero no en la base: ${inexistentes.join(", ")}`);
const modulos = [
  ...MODULOS.map((m) => ({ ...m, tablas: m.tablas.filter((t) => nombresDeTabla.has(t)) })),
  ...(sinModulo.length ? [{ id: "otras", titulo: "Otras", tablas: sinModulo }] : []),
];

const llavesForaneas = restricciones.filter((r) => r.tipo === "f");
const entrantes = new Map();
for (const fk of llavesForaneas) {
  if (!entrantes.has(fk.referencia)) entrantes.set(fk.referencia, []);
  entrantes.get(fk.referencia).push(fk);
}

/** "FOREIGN KEY (x) REFERENCES t(id) ON DELETE CASCADE" -> "al borrar: CASCADE". */
function alBorrar(definicion) {
  const m = /ON DELETE (CASCADE|RESTRICT|SET NULL|SET DEFAULT|NO ACTION)/.exec(definicion);
  return m ? m[1] : "NO ACTION";
}

/** Cardinalidad Mermaid de una FK: muchos (o uno si la columna es unica) a uno (u opcional). */
function relacionMermaid(fk) {
  const cols = columnasPorTabla.get(fk.tabla) ?? [];
  const nula = fk.columnas.some((c) => cols.find((x) => x.nombre === c)?.nulo);
  const unica = (restriccionesPorTabla.get(fk.tabla) ?? []).some(
    (r) =>
      (r.tipo === "u" || r.tipo === "p") &&
      r.columnas.length === fk.columnas.length &&
      r.columnas.every((c) => fk.columnas.includes(c)),
  );
  const lado = nula ? "|o" : "||";
  const muchos = unica ? "o|" : "o{";
  return `${fk.referencia} ${lado}--${muchos} ${fk.tabla}`;
}

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------
const ultimaMigracion = readdirSync(join(RAIZ, "supabase", "migrations"))
  .filter((n) => /^\d{5}_.*\.sql$/.test(n))
  .sort()
  .at(-1);

const politicasTotales = politicas.length;
const funcionesDeNegocio = funciones.filter((f) => !f.es_trigger);
const funcionesDeTrigger = funciones.filter((f) => f.es_trigger);

const l = [];
l.push("# Diccionario de datos");
l.push("");
l.push(
  "> **Documento generado.** No se edita a mano: sale de `npm run docs:diccionario` " +
    "(`scripts/generar-diccionario-de-datos.mjs`), que lee el catalogo de PostgreSQL de una base con " +
    `todas las migraciones aplicadas, hasta la \`${ultimaMigracion}\`. Las descripciones son los ` +
    "`COMMENT ON` de las migraciones: si falta una, se agrega con una migracion nueva y se regenera.",
);
l.push("");
l.push(
  "Complementa a [MODELO-DE-DATOS.md](MODELO-DE-DATOS.md), que explica el porque de cada decision, " +
    "y a [PERMISOS.md](PERMISOS.md), que explica que puede hacer cada rol. Este documento es la " +
    "referencia exhaustiva: cada tabla, cada campo, cada restriccion, cada politica y cada trigger.",
);
l.push("");
l.push("## Resumen");
l.push("");
l.push("| Objeto | Cantidad |");
l.push("| --- | --- |");
l.push(`| Tablas | ${tablas.length} |`);
l.push(`| Tablas con RLS activo | ${tablas.filter((t) => t.rls).length} |`);
l.push(`| Vistas | ${vistas.length} |`);
l.push(`| Tipos enumerados | ${enums.length} |`);
l.push(`| Columnas (tablas y vistas) | ${columnas.length} |`);
l.push(`| Llaves foraneas | ${llavesForaneas.length} |`);
l.push(`| Restricciones CHECK | ${restricciones.filter((r) => r.tipo === "c").length} |`);
l.push(`| Politicas RLS | ${politicasTotales} |`);
l.push(`| Triggers | ${triggers.length} |`);
l.push(`| Funciones (sin contar las de trigger) | ${funcionesDeNegocio.length} |`);
l.push(`| Funciones de trigger | ${funcionesDeTrigger.length} |`);
l.push("");
l.push("### Como leer las tablas de este documento");
l.push("");
l.push("- **Nulo**: `si` si la columna admite NULL.");
l.push(
  "- **Por defecto**: el valor que pone la base si el INSERT no lo manda (`auth.uid()` es quien esta conectado).",
);
l.push(
  "- **Llaves**: `PK` llave primaria, `FK` llave foranea (con la tabla a la que apunta y que pasa al borrar la fila referida), `UNIQUE` y `CHECK`.",
);
l.push(
  "- **Proteccion**: si la tabla tiene Row Level Security, que privilegios tienen los roles `authenticated` (sesion iniciada) y `anon` (sin sesion) y cada politica, con su condicion `USING` (que filas se ven o se tocan) y `WITH CHECK` (que filas se pueden dejar escritas).",
);
l.push("- **Triggers**: la logica que corre la base sola al escribir, con la funcion que ejecuta.");
l.push("");

// Indice
l.push("## Indice por modulo");
l.push("");
for (const modulo of modulos) {
  l.push(`### ${modulo.titulo}`);
  l.push("");
  l.push("| Tabla | Descripcion |");
  l.push("| --- | --- |");
  for (const nombre of modulo.tablas) {
    const tabla = tablas.find((t) => t.nombre === nombre);
    const descripcion = celda(tabla.descripcion) || "_Sin COMMENT ON_";
    l.push(`| [\`${nombre}\`](#${nombre.replace(/_/g, "_")}) | ${descripcion} |`);
  }
  l.push("");
}

// Diagramas
l.push("## Diagramas entidad-relacion");
l.push("");
l.push(
  "Un diagrama por modulo, con todas las columnas de sus tablas. Las tablas de otros modulos a las " +
    "que apuntan aparecen solo con su nombre. `||` es obligatorio, `|o` opcional (FK que admite " +
    'NULL); `o{` es "muchos" y `o|` "a lo sumo uno" (FK unica). GitHub dibuja los bloques ' +
    "`mermaid`.",
);
l.push("");
for (const modulo of modulos) {
  const propias = new Set(modulo.tablas);
  const relaciones = llavesForaneas.filter(
    (fk) => propias.has(fk.tabla) || propias.has(fk.referencia),
  );
  l.push(`### ${modulo.titulo}`);
  l.push("");
  l.push("```mermaid");
  l.push("erDiagram");
  for (const nombre of modulo.tablas) {
    const cols = columnasPorTabla.get(nombre) ?? [];
    const rs = restriccionesPorTabla.get(nombre) ?? [];
    const pk = new Set(rs.filter((r) => r.tipo === "p").flatMap((r) => r.columnas));
    const fks = new Set(rs.filter((r) => r.tipo === "f").flatMap((r) => r.columnas));
    const uks = new Set(
      rs.filter((r) => r.tipo === "u" && r.columnas.length === 1).flatMap((r) => r.columnas),
    );
    l.push(`  ${nombre} {`);
    for (const c of cols) {
      const marcas = [
        pk.has(c.nombre) && "PK",
        fks.has(c.nombre) && "FK",
        uks.has(c.nombre) && "UK",
      ]
        .filter(Boolean)
        .join(",");
      l.push(`    ${tipoMermaid(c.tipo)} ${c.nombre}${marcas ? ` ${marcas}` : ""}`);
    }
    l.push("  }");
  }
  const vistasRel = new Set();
  for (const fk of relaciones) {
    const linea = `  ${relacionMermaid(fk)} : "${fk.columnas.join(", ")}"`;
    if (!vistasRel.has(linea)) {
      vistasRel.add(linea);
      l.push(linea);
    }
  }
  l.push("```");
  l.push("");
}

// Diccionario
l.push("## Tablas");
l.push("");
for (const modulo of modulos) {
  l.push(`### Modulo: ${modulo.titulo}`);
  l.push("");
  for (const nombre of modulo.tablas) {
    const tabla = tablas.find((t) => t.nombre === nombre);
    const cols = columnasPorTabla.get(nombre) ?? [];
    const rs = restriccionesPorTabla.get(nombre) ?? [];
    l.push(`#### ${nombre}`);
    l.push("");
    l.push(tabla.descripcion ? celda(tabla.descripcion) : "_Sin descripcion (COMMENT ON TABLE)._");
    l.push("");

    // Columnas
    const pk = new Set(rs.filter((r) => r.tipo === "p").flatMap((r) => r.columnas));
    const fkDe = new Map();
    for (const fk of rs.filter((r) => r.tipo === "f")) {
      for (const c of fk.columnas) fkDe.set(c, fk);
    }
    l.push("| Campo | Tipo | Nulo | Por defecto | Llave | Descripcion |");
    l.push("| --- | --- | --- | --- | --- | --- |");
    for (const c of cols) {
      const llave = [
        pk.has(c.nombre) ? "PK" : "",
        fkDe.has(c.nombre) ? `FK -> \`${fkDe.get(c.nombre).referencia}\`` : "",
      ]
        .filter(Boolean)
        .join(", ");
      const defecto = c.generada ? `generada: ${codigo(c.defecto)}` : codigo(c.defecto);
      l.push(
        `| \`${c.nombre}\` | \`${celda(tipoCorto(c.tipo))}\` | ${c.nulo ? "si" : "no"} | ${defecto} | ${llave} | ${celda(c.descripcion)} |`,
      );
    }
    l.push("");

    // Restricciones
    const otras = rs;
    if (otras.length) {
      l.push("**Llaves y restricciones**");
      l.push("");
      l.push("| Nombre | Tipo | Definicion |");
      l.push("| --- | --- | --- |");
      const TIPO = { p: "PK", f: "FK", u: "UNIQUE", c: "CHECK", x: "EXCLUDE", t: "TRIGGER" };
      for (const r of otras) {
        const extra = r.tipo === "f" ? ` (al borrar: ${alBorrar(r.definicion)})` : "";
        const descripcion = r.descripcion ? ` ${celda(r.descripcion)}` : "";
        l.push(
          `| \`${r.nombre}\` | ${TIPO[r.tipo] ?? r.tipo} | ${codigo(r.definicion)}${extra}${descripcion} |`,
        );
      }
      l.push("");
    }

    // Relaciones entrantes
    const deOtras = entrantes.get(nombre) ?? [];
    if (deOtras.length) {
      l.push(
        `**La referencian:** ${deOtras
          .map((fk) => `\`${fk.tabla}.${fk.columnas.join(", ")}\` (${alBorrar(fk.definicion)})`)
          .join(", ")}.`,
      );
      l.push("");
    }

    // Proteccion
    const privs = privilegiosPorTabla.get(nombre) ?? [];
    const privDe = (rol) => privs.find((p) => p.rol === rol)?.privilegios.join(", ") || "ninguno";
    l.push(
      `**Proteccion.** RLS ${tabla.rls ? "activo" : "**INACTIVO**"}. Privilegios: \`authenticated\`: ${privDe("authenticated")}; \`anon\`: ${privDe("anon")}.`,
    );
    l.push("");
    const pols = politicasPorTabla.get(nombre) ?? [];
    if (pols.length) {
      l.push("| Politica | Operacion | Roles | USING | WITH CHECK |");
      l.push("| --- | --- | --- | --- | --- |");
      for (const p of pols) {
        l.push(
          `| ${celda(p.nombre)} | ${OPERACION[p.cmd] ?? p.cmd}${p.permisiva === "RESTRICTIVE" ? " (restrictiva)" : ""} | ${celda((p.roles ?? []).join(", "))} | ${codigo(p.usando)} | ${codigo(p.verificando)} |`,
        );
      }
      l.push("");
    } else if (tabla.rls) {
      l.push(
        "Sin politicas: con RLS activo y ninguna politica, nadie la lee ni la escribe directamente; solo funciones SECURITY DEFINER.",
      );
      l.push("");
    }

    // Triggers
    const tgs = triggersPorTabla.get(nombre) ?? [];
    if (tgs.length) {
      l.push("**Triggers**");
      l.push("");
      l.push("| Trigger | Cuando | Funcion |");
      l.push("| --- | --- | --- |");
      for (const t of tgs) {
        const cuando = /CREATE (?:CONSTRAINT )?TRIGGER \S+ (.*?) ON /.exec(t.definicion)?.[1] ?? "";
        const condicion = /WHEN \((.*)\) EXECUTE/.exec(t.definicion)?.[1];
        l.push(
          `| \`${t.nombre}\` | ${celda(cuando)}${condicion ? ` cuando ${codigo(condicion)}` : ""} | \`${t.funcion}()\` |`,
        );
      }
      l.push("");
    }
  }
}

// Vistas
l.push("## Vistas");
l.push("");
for (const v of vistas) {
  l.push(`### ${v.nombre}`);
  l.push("");
  l.push(celda(v.descripcion) || "_Sin descripcion._");
  l.push("");
  const invoker = /security_invoker=(true|on)/.test(v.opciones);
  l.push(
    `Seguridad: ${invoker ? "`security_invoker = true` (aplica la RLS de quien consulta)" : "corre con los permisos de su dueno; filtra con su propio WHERE"}. Privilegios: \`authenticated\`: ${
      (privilegiosPorTabla.get(v.nombre) ?? [])
        .find((p) => p.rol === "authenticated")
        ?.privilegios.join(", ") || "ninguno"
    }; \`anon\`: ${(privilegiosPorTabla.get(v.nombre) ?? []).find((p) => p.rol === "anon")?.privilegios.join(", ") || "ninguno"}.`,
  );
  l.push("");
  l.push("| Campo | Tipo |");
  l.push("| --- | --- |");
  for (const c of columnasPorTabla.get(v.nombre) ?? []) {
    l.push(`| \`${c.nombre}\` | \`${celda(tipoCorto(c.tipo))}\` |`);
  }
  l.push("");
}

// Enums
l.push("## Tipos enumerados");
l.push("");
l.push("| Tipo | Valores | Descripcion |");
l.push("| --- | --- | --- |");
for (const e of enums) {
  l.push(
    `| \`${e.nombre}\` | ${e.valores.map((v) => `\`${v}\``).join(", ")} | ${celda(e.descripcion)} |`,
  );
}
l.push("");

// Funciones
l.push("## Funciones");
l.push("");
l.push(
  "`DEFINER` corre con los permisos de su dueno y salta la RLS: por eso cada una valida por dentro " +
    "quien la llama. `INVOKER` corre con los de quien la llama. **Ejecuta** dice si una sesion " +
    "(`authenticated`) o un visitante sin sesion (`anon`) puede llamarla directamente.",
);
l.push("");
l.push("| Funcion | Devuelve | Seguridad | Ejecuta | Descripcion |");
l.push("| --- | --- | --- | --- | --- |");
for (const f of funcionesDeNegocio) {
  const ejecuta =
    [f.ejecuta_authenticated && "authenticated", f.ejecuta_anon && "anon"]
      .filter(Boolean)
      .join(", ") || "nadie";
  l.push(
    `| \`${f.nombre}(${celda(f.argumentos)})\` | \`${celda(f.resultado)}\` | ${f.definer ? "DEFINER" : "INVOKER"} | ${ejecuta} | ${celda(f.descripcion)} |`,
  );
}
l.push("");
l.push("### Funciones de trigger");
l.push("");
l.push("| Funcion | Seguridad | Descripcion |");
l.push("| --- | --- | --- |");
for (const f of funcionesDeTrigger) {
  l.push(`| \`${f.nombre}()\` | ${f.definer ? "DEFINER" : "INVOKER"} | ${celda(f.descripcion)} |`);
}
l.push("");

writeFileSync(SALIDA, `${l.join("\n")}\n`, "utf8");
console.log(
  `docs/DICCIONARIO-DE-DATOS.md: ${tablas.length} tablas, ${vistas.length} vistas, ${columnas.length} columnas, ` +
    `${politicasTotales} politicas, ${triggers.length} triggers, ${funciones.length} funciones.`,
);
