// Pruebas de los ayudantes de validacion compartidos.
//
// Nacieron con la issue #117, que fue la primera en validar campos numericos con
// validarConDescriptores() y destapo que esTextoVacio() los trataba como vacios.

import { describe, expect, it } from "vitest";

import {
  combinarErrores,
  esTextoVacio,
  hayErrores,
  normalizarTexto,
  validarConDescriptores,
} from "./index.js";

describe("esTextoVacio", () => {
  it("un numero NO esta vacio, ni siquiera el cero", () => {
    // El cero importa: una cantidad de 0 o una temperatura de 0 son valores, no ausencias.
    // Antes de la issue #117 todos los numeros se reportaban como vacios.
    expect(esTextoVacio(120)).toBe(false);
    expect(esTextoVacio(0)).toBe(false);
    expect(esTextoVacio(-1)).toBe(false);
    expect(esTextoVacio(36.5)).toBe(false);
  });

  it("NaN si esta vacio: es lo que da un input numerico sin llenar", () => {
    // Ojo con el ejemplo: Number("") es 0, no NaN. Lo que produce NaN es parseFloat("") o
    // Number(undefined), que es lo que devuelve un <input type="number"> vacio segun como se lea.
    expect(esTextoVacio(Number.NaN)).toBe(true);
    expect(esTextoVacio(parseFloat(""))).toBe(true);
    expect(esTextoVacio(Number(undefined))).toBe(true);
  });

  it('pero Number("") es cero, y el cero es un valor', () => {
    expect(esTextoVacio(Number(""))).toBe(false);
  });

  it("sigue tratando como vacio lo que ya trataba asi", () => {
    expect(esTextoVacio("")).toBe(true);
    expect(esTextoVacio("   ")).toBe(true);
    expect(esTextoVacio(null)).toBe(true);
    expect(esTextoVacio(undefined)).toBe(true);
    expect(esTextoVacio([])).toBe(true);
  });

  it("un booleano nunca esta vacio, aunque sea false", () => {
    expect(esTextoVacio(false)).toBe(false);
    expect(esTextoVacio(true)).toBe(false);
  });

  it("una lista con elementos no esta vacia", () => {
    expect(esTextoVacio(["algo"])).toBe(false);
  });
});

describe("validarConDescriptores", () => {
  const campos = [
    { id: "nombre", label: "Nombre", validacion: { requerido: true, maxLongitud: 5 } },
    { id: "cantidad", label: "Cantidad", validacion: { requerido: true } },
    { id: "nota", label: "Nota", validacion: { requerido: false } },
  ];

  it("acepta un numero en un campo obligatorio", () => {
    // La regresion que motivo el arreglo: sin esto, "Cantidad es obligatorio" con cantidad = 3.
    expect(validarConDescriptores(campos, { nombre: "Ana", cantidad: 3 })).toEqual({});
  });

  it("acepta el cero en un campo obligatorio", () => {
    expect(validarConDescriptores(campos, { nombre: "Ana", cantidad: 0 })).toEqual({});
  });

  it("reporta el obligatorio que falta", () => {
    const errores = validarConDescriptores(campos, { nombre: "Ana" });

    expect(errores).toHaveProperty("cantidad");
    expect(errores.cantidad).toMatch(/obligatorio/i);
  });

  it("un campo opcional vacio no reporta nada", () => {
    expect(validarConDescriptores(campos, { nombre: "Ana", cantidad: 1, nota: "" })).toEqual({});
  });

  it("aplica maxLongitud sobre texto", () => {
    const errores = validarConDescriptores(campos, { nombre: "Nombre largo", cantidad: 1 });

    expect(errores.nombre).toMatch(/5 caracteres/);
  });

  it("un descriptor sin reglas se ignora", () => {
    expect(validarConDescriptores([{ id: "libre", label: "Libre" }], {})).toEqual({});
  });

  it("tolera listas de campos o valores ausentes", () => {
    expect(validarConDescriptores(undefined, undefined)).toEqual({});
  });
});

describe("normalizarTexto", () => {
  it("recorta y trata lo que no es texto como cadena vacia", () => {
    expect(normalizarTexto("  hola  ")).toBe("hola");
    expect(normalizarTexto(120)).toBe("");
    expect(normalizarTexto(null)).toBe("");
  });
});

describe("hayErrores y combinarErrores", () => {
  it("hayErrores distingue el objeto vacio", () => {
    expect(hayErrores({})).toBe(false);
    expect(hayErrores({ campo: "mal" })).toBe(true);
  });

  it("combinarErrores conserva el primero que reporta cada campo", () => {
    // El orden importa: un "es obligatorio" no debe quedar tapado por un "formato invalido".
    expect(combinarErrores({ a: "primero" }, { a: "segundo", b: "otro" })).toEqual({
      a: "primero",
      b: "otro",
    });
  });
});
