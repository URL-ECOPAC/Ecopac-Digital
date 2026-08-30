// Pruebas de los descriptores del modulo de presupuestos (issue #288).
//
// La version anterior afirmaba justo lo que estaba mal: que CAMPOS_GASTO fuera un objeto indexado
// por nombre de campo, que `monto` tuviera `tipo: 'number'` y que FILTROS_GASTOS.estado llevara
// `opcionesOrigen: 'ui-tokens'`. Nada de eso lo sabe leer FilterBar ni el resto de componentes.
//
// Estas pruebas verifican el contrato de verdad: listas, ids que existen como columnas en
// 00025_presupuesto_gastos.sql, y tipos tomados de descriptores.js.

import { describe, expect, it } from "vitest";

import { TIPOS_DE_CAMPO, TIPOS_DE_FILTRO } from "../descriptores.js";
import {
  CAMPOS_FICHA_GASTO,
  CAMPOS_GASTO,
  CATEGORIAS_DE_GASTO,
  COLUMNAS_GASTO,
  ESTADOS_DE_GASTO,
  FILTROS_GASTO,
} from "./index.js";

// Columnas de la tabla gastos (00025). Un descriptor cuyo id no este aqui apunta a nada.
const COLUMNAS_DE_LA_TABLA = [
  "id",
  "jornada_id",
  "concepto",
  "categoria",
  "monto",
  "fecha",
  "responsable_id",
  "estado",
  "registrado_por",
  "aprobado_por",
  "aprobado_en",
  "created_at",
  "updated_at",
];

describe("CAMPOS_GASTO", () => {
  it("es una lista de descriptores, no un objeto indexado", () => {
    expect(Array.isArray(CAMPOS_GASTO)).toBe(true);
    expect(CAMPOS_GASTO.length).toBeGreaterThan(0);
  });

  it("declara id y label en cada campo, nunca key", () => {
    for (const campo of CAMPOS_GASTO) {
      expect(campo.id).toBeTruthy();
      expect(campo.label).toBeTruthy();
      expect(campo).not.toHaveProperty("key");
    }
  });

  it("solo usa tipos del vocabulario de descriptores.js", () => {
    const tiposValidos = Object.values(TIPOS_DE_CAMPO);
    for (const campo of CAMPOS_GASTO) {
      expect(tiposValidos).toContain(campo.tipo);
    }
  });

  it("solo nombra columnas que existen en la tabla gastos", () => {
    for (const campo of CAMPOS_GASTO) {
      expect(COLUMNAS_DE_LA_TABLA).toContain(campo.id);
    }
  });

  it("no deja que el formulario escriba estado ni el rastro de aprobacion", () => {
    const ids = CAMPOS_GASTO.map((campo) => campo.id);
    expect(ids).not.toContain("estado");
    expect(ids).not.toContain("registrado_por");
    expect(ids).not.toContain("aprobado_por");
    expect(ids).not.toContain("aprobado_en");
  });
});

describe("COLUMNAS_GASTO y CAMPOS_FICHA_GASTO", () => {
  it("son listas y solo nombran columnas de la tabla", () => {
    for (const lista of [COLUMNAS_GASTO, CAMPOS_FICHA_GASTO]) {
      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeGreaterThan(0);
      for (const columna of lista) {
        expect(COLUMNAS_DE_LA_TABLA).toContain(columna.id);
      }
    }
  });
});

describe("FILTROS_GASTO", () => {
  it("es una lista y solo usa tipos de TIPOS_DE_FILTRO", () => {
    expect(Array.isArray(FILTROS_GASTO)).toBe(true);

    const tiposValidos = Object.values(TIPOS_DE_FILTRO);
    for (const filtro of FILTROS_GASTO) {
      expect(filtro.id).toBeTruthy();
      expect(tiposValidos).toContain(filtro.tipo);
    }
  });

  it("resuelve las opciones por opciones u opcionesDesde, nunca por opcionesOrigen", () => {
    for (const filtro of FILTROS_GASTO) {
      expect(filtro).not.toHaveProperty("opcionesOrigen");

      if (filtro.tipo === TIPOS_DE_FILTRO.SELECT) {
        expect(Boolean(filtro.opciones || filtro.opcionesDesde)).toBe(true);
      }
    }
  });

  it("declara la fecha como un solo filtro de rango", () => {
    const fecha = FILTROS_GASTO.find((filtro) => filtro.id === "fecha");

    expect(fecha.tipo).toBe(TIPOS_DE_FILTRO.RANGO);
    // Los dos extremos son los que ya acepta listarGastos() en api.js.
    expect(fecha.desde).toBe("fecha_inicio");
    expect(fecha.hasta).toBe("fecha_fin");
  });
});

describe("valores de enum del modulo", () => {
  it("CATEGORIAS_DE_GASTO replica el enum categoria_gasto de la 00025", () => {
    expect(Object.values(CATEGORIAS_DE_GASTO)).toEqual([
      "Medicamentos",
      "Logistica",
      "Diagnostico",
      "Honorarios",
      "Educacion",
      "Infraestructura",
    ]);
  });

  it("ESTADOS_DE_GASTO usa los valores de estado_gasto (00089)", () => {
    expect(Object.values(ESTADOS_DE_GASTO)).toEqual(["pendiente", "aprobado", "rechazado"]);
  });
});
