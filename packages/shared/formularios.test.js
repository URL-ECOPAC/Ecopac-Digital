// El formulario de crear y el de editar son el mismo (issue #840, regla B1).
//
// "El formulario para crear o editar algo debe ser igual [...] y a lo mucho campos sin acceso de
// escritura si no deberian editarse." Esta prueba es la que falla si alguien vuelve a armar una
// edicion filtrando el descriptor del alta: lo que no se edita tiene que estar, de solo lectura.
//
// Una entidad nueva con alta y edicion se agrega a PARES. Las entidades que ya usan un solo
// descriptor para las dos cosas -proyecto, hito, gasto, jornada, donante, comunidad, diagnostico,
// medicamento, proveedor, bodega- no necesitan entrada: no hay dos juegos que puedan separarse.

import { describe, expect, it } from "vitest";

import {
  CAMPOS_ALTA_USUARIO,
  CAMPOS_ASIGNACION_PERSONAL,
  CAMPOS_CONDICION_CRONICA,
  CAMPOS_CORRECCION_CONDICION,
  CAMPOS_CORRECCION_LOTE,
  CAMPOS_CORRECCION_MOVIMIENTO,
  CAMPOS_EDICION_PACIENTE,
  CAMPOS_EDICION_TURNO,
  CAMPOS_EDICION_USUARIO,
  CAMPOS_LOTE,
  CAMPOS_MOVIMIENTO,
  CAMPOS_REGISTRO_PACIENTE,
  OPCIONES_TIPO_MOVIMIENTO,
  TIPOS_DE_CAMPO,
  camposDeEdicion,
  idsEditables,
  textoDeCampoSoloLectura,
  validarConDescriptores,
} from "./index.js";

/**
 * `soloEnEdicion`: lo que la edicion tiene y el alta no, cada uno con su razon. Tiene que ser la
 * excepcion; una entrada nueva aqui necesita una razon tan concreta como la de `asistio`.
 */
const PARES = [
  { entidad: "paciente", alta: CAMPOS_REGISTRO_PACIENTE, edicion: CAMPOS_EDICION_PACIENTE },
  { entidad: "colaborador", alta: CAMPOS_ALTA_USUARIO, edicion: CAMPOS_EDICION_USUARIO },
  { entidad: "lote", alta: CAMPOS_LOTE, edicion: CAMPOS_CORRECCION_LOTE },
  { entidad: "movimiento", alta: CAMPOS_MOVIMIENTO, edicion: CAMPOS_CORRECCION_MOVIMIENTO },
  {
    entidad: "condicion cronica",
    alta: CAMPOS_CONDICION_CRONICA,
    edicion: CAMPOS_CORRECCION_CONDICION,
  },
  {
    entidad: "turno de jornada",
    alta: CAMPOS_ASIGNACION_PERSONAL,
    edicion: CAMPOS_EDICION_TURNO,
    // Al asignar a alguien todavia no se sabe si va a asistir.
    soloEnEdicion: ["asistio"],
  },
];

const ids = (campos) => campos.map((campo) => campo.id);

describe.each(PARES)("alta y edicion de $entidad", ({ alta, edicion, soloEnEdicion = [] }) => {
  it("tienen los mismos campos, en el mismo orden", () => {
    expect(ids(edicion).filter((id) => !soloEnEdicion.includes(id))).toEqual(ids(alta));
  });

  it("cada campo se llama igual y es del mismo tipo en los dos", () => {
    for (const campo of alta) {
      const enEdicion = edicion.find((otro) => otro.id === campo.id);
      expect(enEdicion.label).toBe(campo.label);
      expect(enEdicion.tipo).toBe(campo.tipo);
    }
  });

  it("el alta no tiene campos de solo lectura: lo que se pide, se puede escribir", () => {
    expect(alta.filter((campo) => campo.soloLectura)).toEqual([]);
  });

  it("la edicion deja cambiar algo", () => {
    expect(idsEditables(edicion).length).toBeGreaterThan(0);
  });
});

describe("camposDeEdicion", () => {
  const CAMPOS = [
    { id: "a", label: "A", tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true } },
    { id: "b", label: "B", tipo: TIPOS_DE_CAMPO.TEXTO },
  ];

  it("marca como solo lectura lo que no es editable, sin quitarlo ni reordenar", () => {
    const edicion = camposDeEdicion(CAMPOS, ["b"]);
    expect(ids(edicion)).toEqual(["a", "b"]);
    expect(edicion[0].soloLectura).toBe(true);
    expect(edicion[1].soloLectura).toBeUndefined();
  });

  it("no toca el descriptor del alta", () => {
    camposDeEdicion(CAMPOS, []);
    expect(CAMPOS[0].soloLectura).toBeUndefined();
  });

  it("la validacion salta lo que es de solo lectura: no viaja al servidor", () => {
    const edicion = camposDeEdicion(CAMPOS, ["b"]);
    expect(validarConDescriptores(CAMPOS, { a: "" })).toHaveProperty("a");
    expect(validarConDescriptores(edicion, { a: "" })).toEqual({});
  });
});

describe("textoDeCampoSoloLectura", () => {
  it("un select muestra la etiqueta de su opcion, no el valor guardado", () => {
    const tipo = CAMPOS_MOVIMIENTO.find((campo) => campo.id === "tipo");
    const opcion = OPCIONES_TIPO_MOVIMIENTO[0];
    expect(textoDeCampoSoloLectura(tipo, opcion.value)).toBe(opcion.label);
  });

  it("un select sin su catalogo cargado muestra el valor que ya trae legible", () => {
    const lote = CAMPOS_MOVIMIENTO.find((campo) => campo.id === "lote");
    expect(textoDeCampoSoloLectura(lote, "Amoxicilina · Lote L-1")).toBe("Amoxicilina · Lote L-1");
  });

  it("una fecha se muestra formateada y un booleano como Si o No", () => {
    expect(textoDeCampoSoloLectura({ tipo: TIPOS_DE_CAMPO.FECHA }, "2026-03-05")).toMatch(/2026/);
    expect(textoDeCampoSoloLectura({ tipo: TIPOS_DE_CAMPO.BOOLEANO }, false)).toBe("No");
  });

  it("vacio es vacio, no 'null' ni 'undefined'", () => {
    expect(textoDeCampoSoloLectura({ tipo: TIPOS_DE_CAMPO.TEXTO }, null)).toBe("");
    expect(textoDeCampoSoloLectura({ tipo: TIPOS_DE_CAMPO.TEXTO }, undefined)).toBe("");
  });
});
