// Guarda de los enums del dominio (issue #397).
//
// Comprueba dos cosas que no se sostienen solas.
//
// 1. QUE CADA NOMBRE NAZCA EN UN SOLO ARCHIVO, Y QUE EL BARRIL LO EXPORTE
//
// Son dos comprobaciones distintas y ninguna sustituye a la otra, algo que se vio al escribirlas:
// se duplico ESTADOS_JORNADA a proposito en enums.js y en jornadas/permisos.js, y **el barril
// siguio devolviendo un valor**, el de enums.js, sin avisar de nada. Es decir, con este bundler
// el fallo de la issue #365 no siempre se manifiesta como `undefined`: puede quedarse en que
// gana una de las dos definiciones en silencio, que es peor, porque las dos pueden divergir sin
// que nadie lo note.
//
// Por eso hay una comprobacion de texto sobre el arbol -un solo `export const` por nombre- que
// no depende de como resuelva el bundler, ademas de la que mira el barril.
//
// 2. QUE LOS CATALOGOS NO SE APARTEN DE SU ENUM
//
// Antes de esta issue cada enum estaba escrito en dos o tres sitios y nada obligaba a que
// coincidieran. Ahora se derivan de enums.js, pero nada impide volver a escribir un catalogo a
// mano. Si alguien lo hace, esto se pone en rojo.
//
// Lo que NO cubre, dicho para que no se le pida de mas: que los valores de enums.js sean los que
// tiene la base. Eso son cadenas contra cadenas, y quien lo puede comprobar de verdad es la
// guarda de esquema (scripts/verificar-shared-vs-esquema.mjs) o una suite pgTAP.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import * as barril from "./index.js";
import {
  ACCIONES_DE_ALERTA,
  CATEGORIAS_DE_GASTO,
  ESTADOS_ALERTA,
  ESTADOS_CONDICION_CRONICA,
  ESTADOS_DE_DONACION,
  ESTADOS_DE_GASTO,
  ESTADOS_JORNADA,
  ESTADOS_MOVIMIENTO,
  ESTADOS_PROYECTO,
  ESTADOS_RECETA,
  ORIGENES_DE_LOTE,
  PRESENTACIONES_DE_MEDICAMENTO,
  TIPOS_DE_DONACION,
  TIPOS_DE_DONANTE,
  TIPOS_DE_MOVIMIENTO,
  TIPOS_DE_PROVEEDOR,
  TIPOS_SANGUINEOS,
  opcionesConClave,
  opcionesDe,
} from "./enums.js";
import {
  OPCIONES_ESTADO_DONACION,
  OPCIONES_TIPO_DONACION,
  OPCIONES_TIPO_DONANTE,
} from "./donaciones/campos.js";
import {
  OPCIONES_ACCION_ALERTA,
  OPCIONES_ORIGEN_LOTE,
  OPCIONES_PRESENTACION,
  OPCIONES_TIPO_MOVIMIENTO,
  OPCIONES_TIPO_PROVEEDOR,
} from "./inventario/campos.js";
import { OPCIONES_ESTADO_JORNADA } from "./jornadas/filtros.js";
import { OPCIONES_TIPO_SANGRE } from "./pacientes/campos.js";
import { OPCIONES_ESTADO_CONDICION } from "./pacientes/condiciones.campos.js";
import { OPCIONES_CATEGORIA_GASTO, OPCIONES_ESTADO_GASTO } from "./presupuestos/campos.js";
import { OPCIONES_ESTADO_PROYECTO } from "./proyectos/campos.js";
import { ESTADOS_JORNADA_REPORTE } from "./reportes/campos.js";

/** Cada enum del dominio con los valores que declara su migracion, escritos a mano aqui. */
const ENUMS = {
  ACCIONES_DE_ALERTA: [ACCIONES_DE_ALERTA, ["donado", "reubicado", "descartado"]],
  CATEGORIAS_DE_GASTO: [
    CATEGORIAS_DE_GASTO,
    ["Medicamentos", "Logistica", "Diagnostico", "Honorarios", "Educacion", "Infraestructura"],
  ],
  ESTADOS_ALERTA: [ESTADOS_ALERTA, ["pendiente", "atendida"]],
  ESTADOS_CONDICION_CRONICA: [ESTADOS_CONDICION_CRONICA, ["activa", "controlada", "resuelta"]],
  ESTADOS_DE_DONACION: [ESTADOS_DE_DONACION, ["registrada", "anulada"]],
  ESTADOS_DE_GASTO: [ESTADOS_DE_GASTO, ["pendiente", "aprobado", "rechazado"]],
  ESTADOS_JORNADA: [ESTADOS_JORNADA, ["planificada", "en curso", "finalizada", "cancelada"]],
  ESTADOS_MOVIMIENTO: [ESTADOS_MOVIMIENTO, ["pendiente", "aprobado", "rechazado"]],
  ESTADOS_PROYECTO: [ESTADOS_PROYECTO, ["planificado", "en curso", "finalizado", "cancelado"]],
  ESTADOS_RECETA: [ESTADOS_RECETA, ["emitida", "anulada"]],
  ORIGENES_DE_LOTE: [ORIGENES_DE_LOTE, ["compra", "donacion"]],
  PRESENTACIONES_DE_MEDICAMENTO: [
    PRESENTACIONES_DE_MEDICAMENTO,
    ["tableta", "jarabe", "capsula", "inyectable", "pomada", "gotas ophthalmic", "gotas otic"],
  ],
  TIPOS_DE_DONACION: [TIPOS_DE_DONACION, ["medicamentos", "insumos", "dinero", "servicios"]],
  TIPOS_DE_DONANTE: [TIPOS_DE_DONANTE, ["persona", "organizacion"]],
  TIPOS_DE_MOVIMIENTO: [TIPOS_DE_MOVIMIENTO, ["ingreso", "salida"]],
  TIPOS_DE_PROVEEDOR: [TIPOS_DE_PROVEEDOR, ["comercial", "donante"]],
  TIPOS_SANGUINEOS: [TIPOS_SANGUINEOS, ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]],
};

/** Catalogo publicado -> enum del que tiene que salir, sin sobrar ni faltar ninguno. */
const CATALOGOS = {
  ESTADOS_JORNADA_REPORTE: [ESTADOS_JORNADA_REPORTE, ESTADOS_JORNADA],
  OPCIONES_ACCION_ALERTA: [OPCIONES_ACCION_ALERTA, ACCIONES_DE_ALERTA],
  OPCIONES_CATEGORIA_GASTO: [OPCIONES_CATEGORIA_GASTO, CATEGORIAS_DE_GASTO],
  OPCIONES_ESTADO_CONDICION: [OPCIONES_ESTADO_CONDICION, ESTADOS_CONDICION_CRONICA],
  OPCIONES_ESTADO_DONACION: [OPCIONES_ESTADO_DONACION, ESTADOS_DE_DONACION],
  OPCIONES_ESTADO_GASTO: [OPCIONES_ESTADO_GASTO, ESTADOS_DE_GASTO],
  OPCIONES_ESTADO_JORNADA: [OPCIONES_ESTADO_JORNADA, ESTADOS_JORNADA],
  OPCIONES_ESTADO_PROYECTO: [OPCIONES_ESTADO_PROYECTO, ESTADOS_PROYECTO],
  OPCIONES_ORIGEN_LOTE: [OPCIONES_ORIGEN_LOTE, ORIGENES_DE_LOTE],
  OPCIONES_PRESENTACION: [OPCIONES_PRESENTACION, PRESENTACIONES_DE_MEDICAMENTO],
  OPCIONES_TIPO_DONACION: [OPCIONES_TIPO_DONACION, TIPOS_DE_DONACION],
  OPCIONES_TIPO_DONANTE: [OPCIONES_TIPO_DONANTE, TIPOS_DE_DONANTE],
  OPCIONES_TIPO_MOVIMIENTO: [OPCIONES_TIPO_MOVIMIENTO, TIPOS_DE_MOVIMIENTO],
  OPCIONES_TIPO_PROVEEDOR: [OPCIONES_TIPO_PROVEEDOR, TIPOS_DE_PROVEEDOR],
  OPCIONES_TIPO_SANGRE: [OPCIONES_TIPO_SANGRE, TIPOS_SANGUINEOS],
};

describe("los enums del dominio", () => {
  it.each(Object.entries(ENUMS))(
    "%s tiene los valores de su migracion",
    (_, [enumObj, valores]) => {
      expect(Object.values(enumObj)).toEqual(valores);
    },
  );

  it.each(Object.keys(ENUMS))("%s se congela, para que nadie lo mute en caliente", (nombre) => {
    expect(Object.isFrozen(ENUMS[nombre][0])).toBe(true);
  });
});

const RAIZ = dirname(fileURLToPath(import.meta.url));

/** Archivos .js de packages/shared, sin pruebas ni node_modules. */
function fuentesDeShared(directorio = RAIZ, encontrados = []) {
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name !== "node_modules" && entrada.name !== "coverage") {
        fuentesDeShared(ruta, encontrados);
      }
    } else if (entrada.name.endsWith(".js") && !entrada.name.endsWith(".test.js")) {
      encontrados.push(ruta);
    }
  }
  return encontrados;
}

describe("cada nombre nace en un solo archivo", () => {
  // No depende del bundler: es texto sobre el arbol. Si un nombre vuelve a declararse fuera de
  // enums.js, aqui se ve, aunque el barril siga devolviendo algo (ver la cabecera).
  const fuentes = fuentesDeShared();

  it.each(Object.keys(ENUMS))("%s solo se declara en enums.js", (nombre) => {
    const declarantes = fuentes
      .filter((ruta) =>
        new RegExp(`^export const ${nombre}\\b`, "m").test(readFileSync(ruta, "utf8")),
      )
      .map((ruta) => relative(RAIZ, ruta));

    expect(declarantes, `${nombre} declarado en: ${declarantes.join(", ")}`).toEqual(["enums.js"]);
  });
});

describe("el barril raiz los exporta todos", () => {
  it.each(Object.keys(ENUMS))("@ecopac/shared exporta %s", (nombre) => {
    expect(barril[nombre], `el barril no exporta ${nombre}`).toBeDefined();
  });

  it.each(Object.keys(CATALOGOS))("@ecopac/shared exporta %s", (nombre) => {
    expect(barril[nombre], `el barril no exporta ${nombre}`).toBeDefined();
  });

  it("exporta tambien los dos helpers, que es como se derivan los catalogos", () => {
    expect(barril.opcionesDe).toBeTypeOf("function");
    expect(barril.opcionesConClave).toBeTypeOf("function");
  });
});

describe("los catalogos salen de su enum", () => {
  it.each(Object.entries(CATALOGOS))(
    "%s cubre su enum exactamente, sin inventar ni omitir",
    (_, [catalogo, enumObj]) => {
      expect(catalogo.map((opcion) => opcion.value)).toEqual(Object.values(enumObj));
    },
  );

  it.each(Object.entries(CATALOGOS))("%s da una etiqueta a cada opcion", (_, [catalogo]) => {
    for (const opcion of catalogo) {
      expect(opcion.label, `${opcion.value} sin etiqueta`).toBeTruthy();
    }
  });
});

describe("los helpers", () => {
  const VALORES = Object.freeze({ UNO: "uno", DOS: "dos" });

  it("opcionesDe respeta el orden en que el enum declara sus valores", () => {
    expect(opcionesDe(VALORES, { uno: "Uno", dos: "Dos" })).toEqual([
      { value: "uno", label: "Uno" },
      { value: "dos", label: "Dos" },
    ]);
  });

  it("opcionesDe cae en el propio valor cuando no hay etiqueta", () => {
    expect(opcionesDe(VALORES, {})).toEqual([
      { value: "uno", label: "uno" },
      { value: "dos", label: "dos" },
    ]);
  });

  it("opcionesConClave repite el valor en clave, que es lo que indexa statusColors", () => {
    expect(opcionesConClave(VALORES, { uno: "Uno", dos: "Dos" })).toEqual([
      { value: "uno", clave: "uno", label: "Uno" },
      { value: "dos", clave: "dos", label: "Dos" },
    ]);
  });
});
