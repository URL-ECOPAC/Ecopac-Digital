// Pruebas de las funciones puras de useOrdenYPagina.js (issue #862).
//
// El hook en si no se monta con renderHook: vitest.config.js de packages/shared corre en
// environment "node", sin DOM, a proposito. Mismo criterio que
// presupuestos/useEjecucionPresupuestal.test.js y jornadas/useJornadasKanban.test.js. Por eso
// toda la logica de este archivo -comparar, ordenar, contar paginas, recortar, alternar- vive en
// funciones exportadas y el hook solo las cose con useState; lo que queda sin cubrir aqui se
// ejercita desde las pruebas de pantalla de apps/web, que si tienen jsdom.
//
// Se importa el modulo directo y no el barril: el barril arrastra @supabase/supabase-js y el
// modulo de entorno, y estas pruebas corren sin .env.

import { describe, expect, it } from "vitest";

import {
  compararValores,
  contarPaginas,
  DIRECCIONES,
  ordenarFilas,
  recortarAPagina,
  siguienteOrden,
  TAMANO_DE_PAGINA_POR_DEFECTO,
} from "./useOrdenYPagina.js";

const COLUMNAS = [
  { id: "medicamento", label: "Medicamento", ordenable: true },
  { id: "cantidad", label: "Cantidad", ordenable: true },
  { id: "vence", label: "Vence", desde: "fechaVencimiento", ordenable: true },
];

const FILAS = [
  { id: "1", medicamento: "Omeprazol", cantidad: 5, fechaVencimiento: "2026-03-01" },
  { id: "2", medicamento: "Acetaminofen", cantidad: 120, fechaVencimiento: "2026-01-15" },
  { id: "3", medicamento: "ibuprofeno", cantidad: 40, fechaVencimiento: null },
];

describe("compararValores", () => {
  it("compara numeros como numeros y no como texto", () => {
    // El caso que delata un orden hecho con localeCompare a secas: "120" < "40" en texto.
    expect(compararValores(120, 40)).toBeGreaterThan(0);
    expect(compararValores(5, 40)).toBeLessThan(0);
  });

  it("compara texto sin distinguir mayusculas ni tildes", () => {
    expect(compararValores("ibuprofeno", "Ibuprofeno")).toBe(0);
    expect(compararValores("Acetaminofen", "Acetaminofén")).toBe(0);
  });

  it("manda los vacios al final, ordene como ordene", () => {
    // Un lote sin fecha de vencimiento no es "el que vence primero": es un dato que falta.
    expect(compararValores(null, "algo")).toBeGreaterThan(0);
    expect(compararValores("algo", null)).toBeLessThan(0);
    expect(compararValores(undefined, "")).toBe(0);
    expect(compararValores(null, undefined)).toBe(0);
  });

  it("una fecha ISO ordena como fecha", () => {
    expect(compararValores("2026-01-15", "2026-03-01")).toBeLessThan(0);
    expect(compararValores("2026-12-01", "2026-03-01")).toBeGreaterThan(0);
  });

  it("el cero es un valor, no un vacio", () => {
    // Cero unidades disponibles es informacion; tratarlo como ausente lo mandaria al final.
    expect(compararValores(0, 5)).toBeLessThan(0);
  });

  it("compara booleanos poniendo primero el falso", () => {
    expect(compararValores(false, true)).toBeLessThan(0);
  });
});

describe("ordenarFilas", () => {
  it("sin orden devuelve el arreglo tal cual, sin copiarlo", () => {
    expect(ordenarFilas(FILAS, null, COLUMNAS)).toBe(FILAS);
  });

  it("no muta el arreglo recibido", () => {
    const copia = [...FILAS];
    ordenarFilas(FILAS, { id: "cantidad", direccion: DIRECCIONES.ASC }, COLUMNAS);
    expect(FILAS).toEqual(copia);
  });

  it("ordena por la clave `desde` de la columna, no por su id", () => {
    const ordenadas = ordenarFilas(FILAS, { id: "vence", direccion: DIRECCIONES.ASC }, COLUMNAS);
    // Si hubiera ordenado por el id "vence" -que ninguna fila tiene- no cambiaria nada.
    expect(ordenadas.map((f) => f.id)).toEqual(["2", "1", "3"]);
  });

  it("descendente invierte, pero los vacios siguen al final", () => {
    const ordenadas = ordenarFilas(FILAS, { id: "vence", direccion: DIRECCIONES.DESC }, COLUMNAS);
    expect(ordenadas.map((f) => f.id)).toEqual(["1", "2", "3"]);
  });

  it("ordena numeros de verdad", () => {
    const ordenadas = ordenarFilas(FILAS, { id: "cantidad", direccion: DIRECCIONES.ASC }, COLUMNAS);
    expect(ordenadas.map((f) => f.cantidad)).toEqual([5, 40, 120]);
  });

  it("una columna que no esta en el descriptor ordena por su propio id", () => {
    const ordenadas = ordenarFilas(FILAS, { id: "medicamento", direccion: DIRECCIONES.ASC }, []);
    expect(ordenadas.map((f) => f.medicamento)).toEqual([
      "Acetaminofen",
      "ibuprofeno",
      "Omeprazol",
    ]);
  });
});

describe("contarPaginas", () => {
  it("un conjunto vacio es UNA pagina vacia, no cero", () => {
    expect(contarPaginas(0, 25)).toBe(1);
  });

  it("redondea hacia arriba", () => {
    expect(contarPaginas(7, 3)).toBe(3);
    expect(contarPaginas(6, 3)).toBe(2);
  });

  it("usa el tamano por defecto documentado", () => {
    expect(contarPaginas(TAMANO_DE_PAGINA_POR_DEFECTO + 1)).toBe(2);
  });
});

describe("recortarAPagina", () => {
  const MUCHAS = Array.from({ length: 7 }, (_, i) => ({ id: String(i) }));

  it("entrega la rebanada de la pagina pedida, 1-indexada", () => {
    expect(recortarAPagina(MUCHAS, 1, 3).map((f) => f.id)).toEqual(["0", "1", "2"]);
    expect(recortarAPagina(MUCHAS, 3, 3).map((f) => f.id)).toEqual(["6"]);
  });

  it("una pagina fuera de rango sale vacia en vez de reventar", () => {
    expect(recortarAPagina(MUCHAS, 99, 3)).toEqual([]);
  });
});

describe("siguienteOrden", () => {
  it("una columna sin orden arranca ascendente", () => {
    expect(siguienteOrden(null, "cantidad")).toEqual({
      id: "cantidad",
      direccion: DIRECCIONES.ASC,
    });
  });

  it("el segundo clic la pone descendente", () => {
    expect(siguienteOrden({ id: "cantidad", direccion: DIRECCIONES.ASC }, "cantidad")).toEqual({
      id: "cantidad",
      direccion: DIRECCIONES.DESC,
    });
  });

  it("el tercer clic quita el orden y devuelve el natural de la API", () => {
    expect(siguienteOrden({ id: "cantidad", direccion: DIRECCIONES.DESC }, "cantidad")).toBeNull();
  });

  it("pulsar otra columna arranca ascendente, sin heredar la direccion anterior", () => {
    expect(siguienteOrden({ id: "cantidad", direccion: DIRECCIONES.DESC }, "medicamento")).toEqual({
      id: "medicamento",
      direccion: DIRECCIONES.ASC,
    });
  });
});
