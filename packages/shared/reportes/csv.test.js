// Pruebas de la generacion de CSV de reportes (issue #207).
//
// Se importa csv.js directamente y no el barril de packages/shared: el barril arrastra
// @supabase/supabase-js via api.js, y estas pruebas no necesitan ni deben depender de
// Supabase.

import { describe, expect, it } from "vitest";

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";
import { formatearMoneda } from "../formato/moneda.js";
import { escaparCampoCSV, exportarFilasACSV } from "./csv.js";
import { COLUMNAS_INVENTARIO_REPORTE } from "./columnas.js";

const BOM = String.fromCharCode(0xfeff);

describe("escaparCampoCSV", () => {
  it("devuelve el valor tal cual cuando no tiene caracteres especiales", () => {
    expect(escaparCampoCSV("Paracetamol")).toBe("Paracetamol");
  });

  it("envuelve en comillas un valor que contiene una coma", () => {
    expect(escaparCampoCSV("Guatemala, zona 1")).toBe('"Guatemala, zona 1"');
  });

  it("envuelve en comillas y duplica las comillas internas", () => {
    expect(escaparCampoCSV('Dice "hola"')).toBe('"Dice ""hola"""');
  });

  it("envuelve en comillas un valor con salto de linea", () => {
    expect(escaparCampoCSV("linea 1\nlinea 2")).toBe('"linea 1\nlinea 2"');
  });

  it("envuelve en comillas un valor con retorno de carro", () => {
    expect(escaparCampoCSV("a\r\nb")).toBe('"a\r\nb"');
  });

  it("devuelve cadena vacia para null y undefined", () => {
    expect(escaparCampoCSV(null)).toBe("");
    expect(escaparCampoCSV(undefined)).toBe("");
  });

  it("convierte numeros y booleanos a texto sin comillas de mas", () => {
    expect(escaparCampoCSV(1250)).toBe("1250");
    expect(escaparCampoCSV(true)).toBe("true");
  });
});

describe("exportarFilasACSV", () => {
  const columnas = [
    { id: "nombre", label: "Nombre", tipo: TIPOS_DE_PRESENTACION.TEXTO },
    { id: "fechaNacimiento", label: "Fecha de nacimiento", tipo: TIPOS_DE_PRESENTACION.FECHA },
    { id: "saldo", label: "Saldo", tipo: TIPOS_DE_PRESENTACION.MONEDA },
  ];

  it("antepone el BOM UTF-8 al contenido", () => {
    const csv = exportarFilasACSV([], columnas);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("usa las etiquetas en espanol, con acentos, como encabezado", () => {
    const csv = exportarFilasACSV([], columnas);
    expect(csv).toBe(`${BOM}Nombre,Fecha de nacimiento,Saldo`);
  });

  it("con un arreglo de filas vacio devuelve solo el encabezado, sin lineas de mas", () => {
    const csv = exportarFilasACSV([], columnas);
    expect(csv.split("\r\n")).toHaveLength(1);
  });

  it("separa encabezado y filas, y las filas entre si, con CRLF", () => {
    const csv = exportarFilasACSV(
      [{ nombre: "Ana", fechaNacimiento: "2020-01-15", saldo: 100 }],
      columnas
    );
    expect(csv).toBe(
      `${BOM}Nombre,Fecha de nacimiento,Saldo\r\nAna,15/01/2020,${formatearMoneda(100)}`
    );
  });

  it("formatea una columna FECHA con formatearFechaCorta", () => {
    const csv = exportarFilasACSV(
      [{ nombre: "Ana", fechaNacimiento: "2026-08-18", saldo: null }],
      columnas
    );
    expect(csv).toContain("18/08/2026");
  });

  it("deja vacia la celda de una columna FECHA con valor invalido", () => {
    const csv = exportarFilasACSV(
      [{ nombre: "Ana", fechaNacimiento: "no es una fecha", saldo: null }],
      columnas
    );
    expect(csv).toBe(`${BOM}Nombre,Fecha de nacimiento,Saldo\r\nAna,,`);
  });

  it("formatea MONEDA y escapa la coma de miles resultante", () => {
    const csv = exportarFilasACSV(
      [{ nombre: "Ana", fechaNacimiento: null, saldo: 1250 }],
      columnas
    );
    expect(csv).toContain(`"${formatearMoneda(1250)}"`);
  });

  it("deja vacia la celda de una columna MONEDA sin valor", () => {
    const csv = exportarFilasACSV(
      [{ nombre: "Ana", fechaNacimiento: null, saldo: null }],
      columnas
    );
    expect(csv.endsWith("Ana,,")).toBe(true);
  });

  it("deja vacia la celda cuando la fila no trae la clave de una columna", () => {
    const csv = exportarFilasACSV([{ nombre: "Ana" }], columnas);
    expect(csv).toBe(`${BOM}Nombre,Fecha de nacimiento,Saldo\r\nAna,,`);
  });

  it("escapa un valor de texto que trae coma, comillas o salto de linea", () => {
    const csv = exportarFilasACSV(
      [{ nombre: 'Comunidad "El Progreso", zona 3', fechaNacimiento: null, saldo: null }],
      columnas
    );
    expect(csv).toContain('"Comunidad ""El Progreso"", zona 3"');
  });

  it("con columnas invalidas o ausentes no lanza y devuelve una linea vacia por fila", () => {
    expect(exportarFilasACSV([{ a: 1 }], undefined)).toBe(`${BOM}\r\n`);
    expect(exportarFilasACSV([{ a: 1 }], null)).toBe(`${BOM}\r\n`);
    expect(exportarFilasACSV([], undefined)).toBe(BOM);
  });

  it("no lanza si filas no es un arreglo", () => {
    expect(() => exportarFilasACSV(undefined, columnas)).not.toThrow();
    expect(exportarFilasACSV(undefined, columnas)).toBe(
      `${BOM}Nombre,Fecha de nacimiento,Saldo`
    );
  });

  it("es compatible con un descriptor real (COLUMNAS_INVENTARIO_REPORTE)", () => {
    const csv = exportarFilasACSV(
      [
        {
          medicamento: "Ibuprofeno",
          concentracion: "400mg",
          presentacion: "Tableta",
          disponible: 120,
          vencido: 0,
        },
      ],
      COLUMNAS_INVENTARIO_REPORTE
    );
    expect(csv).toContain("Medicamento,Concentracion,Presentacion,Disponible,Vencido");
    expect(csv).toContain("Ibuprofeno,400mg,Tableta,120,0");
  });
});
