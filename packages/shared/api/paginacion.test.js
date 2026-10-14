// Pruebas de obtenerTodasLasFilas() (issue #773).

import { describe, expect, it } from "vitest";

import { obtenerTodasLasFilas } from "./paginacion.js";

/**
 * Doble de un query builder de supabase-js: solo entiende `.range(desde, hasta)` y expone las
 * filas de `todasLasFilas` que caen en ese rango, igual que haria PostgREST.
 */
function fabricaDeConsultaCon(todasLasFilas) {
  return () => ({
    range: async (desde, hasta) => ({
      data: todasLasFilas.slice(desde, hasta + 1),
      error: null,
    }),
  });
}

describe("obtenerTodasLasFilas", () => {
  it("trae todo en una sola pagina cuando hay menos filas que el tamano de pagina", async () => {
    const filas = Array.from({ length: 5 }, (_, i) => ({ id: i }));

    const { filas: resultado, error } = await obtenerTodasLasFilas(fabricaDeConsultaCon(filas), {
      tamanoDePagina: 1000,
    });

    expect(error).toBeNull();
    expect(resultado).toEqual(filas);
  });

  it("concatena varias paginas cuando el total supera el tamano de pagina", async () => {
    // 2500 filas con tamanoDePagina 1000: exactamente el caso que PostgREST no puede resolver
    // solo (max_rows corta en 1000), y que este helper si porque pide varias veces.
    const filas = Array.from({ length: 2500 }, (_, i) => ({ id: i }));

    const { filas: resultado, error } = await obtenerTodasLasFilas(fabricaDeConsultaCon(filas), {
      tamanoDePagina: 1000,
    });

    expect(error).toBeNull();
    expect(resultado).toHaveLength(2500);
    expect(resultado).toEqual(filas);
  });

  it("una ultima pagina exactamente llena no dispara una pagina extra vacia", async () => {
    // 2000 filas con paginas de 1000: la segunda pagina viene llena (1000), no corta el bucle
    // por si sola -- tiene que pedir una tercera pagina, que llega vacia, para saber que termino.
    const filas = Array.from({ length: 2000 }, (_, i) => ({ id: i }));
    let llamadas = 0;
    const fabrica = () => {
      llamadas += 1;
      return fabricaDeConsultaCon(filas)();
    };

    const { filas: resultado } = await obtenerTodasLasFilas(fabrica, { tamanoDePagina: 1000 });

    expect(resultado).toHaveLength(2000);
    expect(llamadas).toBe(3);
  });

  it("detiene la paginacion y propaga el error si una pagina falla", async () => {
    let llamadas = 0;
    const fabrica = () => {
      llamadas += 1;
      return {
        range: async () => {
          if (llamadas === 1) return { data: [{ id: 1 }], error: null };
          return { data: null, error: { code: "500", message: "fallo simulado" } };
        },
      };
    };

    const { filas, error } = await obtenerTodasLasFilas(fabrica, { tamanoDePagina: 1 });

    expect(filas).toBeNull();
    expect(error).toEqual({ code: "500", message: "fallo simulado" });
  });

  it("una consulta vacia devuelve una lista vacia, no null", async () => {
    const { filas, error } = await obtenerTodasLasFilas(fabricaDeConsultaCon([]));

    expect(error).toBeNull();
    expect(filas).toEqual([]);
  });
});
