// Flujo critico: quien atiende da de alta una condicion cronica que el catalogo no traia,
// y la administracion la mantiene (issue #850, migracion 00140).
//
// POR QUE ESTA PRUEBA EXISTE, HABIENDO YA UNA SUITE pgTAP
//
// Porque son capas distintas y ninguna cubre a la otra. pgTAP habla SQL directo contra la base:
// comprueba la politica, pero no que la consulta que manda packages/shared tenga la forma que
// PostgREST acepta, ni que el GRANT alcance por el camino real (PostgREST se conecta como
// `authenticated`, no como el dueno). Es exactamente el agujero por el que se colo la creacion
// de comunidades de la #662: politica escrita, GRANT ausente, todas las pruebas con doble en
// verde y `permission denied` para todo el mundo contra la base real.
//
// Y al reves: aqui no se prueban los cinco roles ni el indice normalizado, que es trabajo barato
// de escritura_catalogo_condiciones.sql. Aqui se recorre el camino, con las cuentas del seed
// demo y sesion emitida por GoTrue.
//
// NO SE BORRA NADA DESDE LA APLICACION
//
// La 00140 no concede DELETE a proposito. La limpieza va por conexion directa (limpiar()), igual
// que la de pacientes.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  actualizarCondicionCatalogo,
  asociarCondicion,
  crearCondicionCatalogo,
  obtenerCatalogoDeCondiciones,
} from "@ecopac/shared";

import { cerrarConexion, DEMO, limpiar } from "./datos.js";
import { CUENTAS, entrarComo, salir } from "./sesiones.js";

/**
 * Nombres inventados y reconocibles, para que la limpieza no toque el catalogo del seed.
 *
 * El primero es el que crea el medico y el que despues mantiene la administradora; el segundo
 * prueba que el indice de nombre normalizado de la 00140 tambien viaja por PostgREST.
 */
const CONDICION_NUEVA = "Condicion de prueba e2e 850";
const CONDICION_DEL_VOLUNTARIO = "Otra condicion de prueba e2e 850";

/** Una del catalogo que siembra la 00010, escrita de otra forma. */
const DUPLICADO_NORMALIZADO = "  hipertension  ";

let idCreado = null;
let idPadecimiento = null;

beforeAll(async () => {
  await limpiar({ condicionesDelCatalogo: [CONDICION_NUEVA, CONDICION_DEL_VOLUNTARIO] });
});

afterAll(async () => {
  await salir();
  await limpiar({
    padecimientos: [idPadecimiento].filter(Boolean),
    condicionesDelCatalogo: [CONDICION_NUEVA, CONDICION_DEL_VOLUNTARIO],
  });
  await cerrarConexion();
});

describe("catalogo de condiciones cronicas contra el stack local", () => {
  it("1. el medico da de alta la condicion que le falto en jornada", async () => {
    await entrarComo(CUENTAS.MEDICO);

    const { condicion, errores, error } = await crearCondicionCatalogo({ nombre: CONDICION_NUEVA });

    expect(error).toBeNull();
    expect(errores).toEqual({});
    expect(condicion).toMatchObject({ nombre: CONDICION_NUEVA, esVigente: true });

    idCreado = condicion.id;
  });

  it("2. y queda en el catalogo que lee la ficha del paciente", async () => {
    const { condiciones, error } = await obtenerCatalogoDeCondiciones({ soloVigentes: true });

    expect(error).toBeNull();
    expect(condiciones.map((fila) => fila.nombre)).toContain(CONDICION_NUEVA);
  });

  it("3. el mismo nombre en minusculas y con espacios no entra dos veces", async () => {
    const { condicion, errores, error } = await crearCondicionCatalogo({
      nombre: DUPLICADO_NORMALIZADO,
    });

    // El 23505 del indice de la 00140 viaja como error de campo, no como fallo de la pantalla.
    expect(condicion).toBeNull();
    expect(error).toBeNull();
    expect(errores).toHaveProperty("nombre");
  });

  // Este caso no es del catalogo, es del formulario que lo consume, y esta aqui porque es la
  // unica capa que lo detecta. El formulario de la ficha arranca con todos sus campos en cadena
  // vacia, y `estado` es opcional porque la columna tiene DEFAULT 'activa' (00010). Pero una
  // cadena vacia no es "no lo mando": PostgREST intentaba convertirla al enum y devolvia 400, asi
  // que agregar una condicion sin tocar el desplegable de estado fallaba SIEMPRE, con "Ocurrio un
  // error inesperado". Ninguna prueba con doble podia verlo -- un doble acepta cualquier payload
  // --, y el pgTAP tampoco, porque habla SQL y no pasa por PostgREST.
  it("4. agregar una condicion a un paciente sin elegir estado la deja activa, no falla", async () => {
    const { condicion, errores, error } = await asociarCondicion({
      pacienteId: DEMO.paciente,
      condicion: idCreado,
      fechaDiagnostico: "2026-01-15",
      estado: "",
      notas: "",
    });

    expect(error).toBeNull();
    expect(errores).toEqual({});
    expect(condicion.estado).toBe("activa");

    idPadecimiento = condicion.id;
  });

  it("5. el voluntario tambien atiende, y tambien da de alta", async () => {
    await entrarComo(CUENTAS.VOLUNTARIO);

    const { condicion, error } = await crearCondicionCatalogo({
      nombre: CONDICION_DEL_VOLUNTARIO,
    });

    expect(error).toBeNull();
    expect(condicion).toMatchObject({ nombre: CONDICION_DEL_VOLUNTARIO });
  });

  it("6. pero no mantiene el catalogo: retirar una condicion no le cambia nada", async () => {
    const { condicion, error } = await actualizarCondicionCatalogo(idCreado, { esVigente: false });

    // La politica de UPDATE de la 00140 filtra por USING, asi que la sentencia corre y afecta
    // cero filas. condiciones.api.js traduce ese "no devolvio nada" a permiso denegado, que es lo
    // que de verdad paso.
    expect(condicion).toBeNull();
    expect(error).not.toBeNull();

    const { condiciones } = await obtenerCatalogoDeCondiciones({ soloVigentes: true });
    expect(condiciones.map((fila) => fila.id)).toContain(idCreado);
  });

  it("7. la administradora si la renombra y la retira", async () => {
    await entrarComo(CUENTAS.ADMINISTRADORA);

    const renombrada = await actualizarCondicionCatalogo(idCreado, {
      nombre: CONDICION_NUEVA,
      esVigente: false,
    });

    expect(renombrada.error).toBeNull();
    expect(renombrada.condicion).toMatchObject({ nombre: CONDICION_NUEVA, esVigente: false });
  });

  it("8. y la retirada deja de ofrecerse, sin desaparecer del catalogo completo", async () => {
    const vigentes = await obtenerCatalogoDeCondiciones({ soloVigentes: true });
    expect(vigentes.condiciones.map((fila) => fila.id)).not.toContain(idCreado);

    const todas = await obtenerCatalogoDeCondiciones({ soloVigentes: false });
    expect(todas.condiciones.map((fila) => fila.id)).toContain(idCreado);
  });
});
