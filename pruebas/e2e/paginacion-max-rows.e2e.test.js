// Prueba de que max_rows corta en silencio, y de que obtenerTodasLasFilas() lo resuelve
// (issue #773).
//
// supabase/config.toml fija `max_rows = 1000`. Es una configuracion de PostgREST, no de
// Postgres: ninguna prueba pgTAP (que habla con la base por SQL directo) la puede ejercitar,
// solo una que hable con la API REST real -- exactamente lo que hace este archivo.
//
// Se siembran 1001 medicamentos sinteticos por SQL directo (rapido, un solo INSERT) y se leen por
// la API REST real con el cliente de packages/shared, la misma ruta que usa cualquier pantalla:
//
//   1. Sin `.range()`: PostgREST corta en 1000 sin devolver ningun error. Es la prueba de que el
//      riesgo que describe la issue es real en este entorno, no solo teorico.
//   2. Con obtenerTodasLasFilas() (api/paginacion.js): trae las 1001, paginando.
//
// La tabla medicamentos se eligio por ser la mas barata de sembrar en volumen (pocas columnas
// obligatorias, sin cadena de FK). No es una de las tablas que se corrigieron en esta issue
// (reportes/api.js, reportes/inventario.api.js, reportes/vencimientos.api.js,
// donaciones/historial.api.js, inventario/bodegas.api.js): esas se prueban con sus propios mocks
// en packages/shared, que no pueden reproducir el corte de PostgREST. Esta prueba demuestra el
// mecanismo una sola vez, contra una tabla neutral, y evita sembrar 1001 filas en cada una.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { obtenerSupabase, obtenerTodasLasFilas } from "@ecopac/shared";

import { cerrarConexion, consultar } from "./datos.js";
import { CUENTAS, entrarComo, salir } from "./sesiones.js";

const PREFIJO = "MAXROWS_E2E_";
const TOTAL_SEMBRADO = 1001;

beforeAll(async () => {
  // INSERT ... SELECT generate_series: un solo viaje a la base, nada de 1001 llamadas.
  await consultar(
    `INSERT INTO medicamentos (nombre, concentracion, presentacion, marca)
     SELECT $1 || gs, '1mg', 'tableta', 'Generica'
     FROM generate_series(1, $2) AS gs`,
    [PREFIJO, TOTAL_SEMBRADO],
  );

  await entrarComo(CUENTAS.ADMINISTRADORA);
});

afterAll(async () => {
  await salir();
  await consultar("DELETE FROM medicamentos WHERE nombre LIKE $1", [`${PREFIJO}%`]);
  await cerrarConexion();
});

describe("max_rows = 1000 corta en silencio, y obtenerTodasLasFilas() lo resuelve", () => {
  it("sin .range(), PostgREST devuelve exactamente 1000 filas de las 1001 sembradas, sin error", async () => {
    const { data, error } = await obtenerSupabase()
      .from("medicamentos")
      .select("id")
      .ilike("nombre", `${PREFIJO}%`);

    expect(error).toBeNull();
    // El corte real: si esto fuera un total (unidades, dinero, pacientes) en vez de un conteo de
    // filas, quien sumara `data` estaria reportando 1000 de 1001 sin que nada avisara del error.
    expect(data).toHaveLength(1000);
  });

  it("obtenerTodasLasFilas() trae las 1001, paginando hasta agotar la ultima pagina incompleta", async () => {
    const { filas, error } = await obtenerTodasLasFilas(() =>
      obtenerSupabase().from("medicamentos").select("id").ilike("nombre", `${PREFIJO}%`),
    );

    expect(error).toBeNull();
    expect(filas).toHaveLength(TOTAL_SEMBRADO);
  });
});
