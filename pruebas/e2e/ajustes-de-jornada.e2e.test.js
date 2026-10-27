// Los ajustes de la issue #964 recorridos contra el stack local, por packages/shared:
//
//   - la salida de inventario a un paciente que no pasa a consulta (00191) queda en su ficha y en
//     el kardex;
//   - los pacientes atendidos de una jornada traen ficha, telefono y comunidad;
//   - el peso de un triaje vuelve en libras, la unidad del formulario.
//
// POR QUE E2E Y NO SOLO LAS PRUEBAS DE SHARED
//
// Las de shared usan un doble de Supabase que acepta cualquier columna y cualquier embed. Pedir
// `pacientes.numero_ficha` -que no existe: la ficha vive en expedientes- pasaba esas pruebas y
// dejaba la pestaña de pacientes atendidos vacia en la aplicacion. Aqui las consultas viajan por
// PostgREST de verdad.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  listarEntregasSinConsultaDePaciente,
  listarMovimientos,
  listarPacientesAtendidosDeJornada,
  obtenerTriajes,
  registrarSalida,
} from "@ecopac/shared";

import { cerrarConexion, consultar, DEMO, instantaneaDeExistencias, limpiar } from "./datos.js";
import { CUENTAS, entrarComo, salir } from "./sesiones.js";

const CANTIDAD = 2;

let bodega = null;
let existenciasIniciales = [];
let movimientoId = null;

beforeAll(async () => {
  bodega = DEMO.bodegaMovil;
  existenciasIniciales = await instantaneaDeExistencias([[DEMO.loteSano, bodega]]);
  await consultar(
    `INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible)
     VALUES ($1, $2, 20)
     ON CONFLICT (lote_id, bodega_id) DO UPDATE SET cantidad_disponible = EXCLUDED.cantidad_disponible`,
    [DEMO.loteSano, bodega],
  );
});

afterAll(async () => {
  await salir();
  await limpiar({
    movimientos: movimientoId ? [movimientoId] : [],
    existencias: existenciasIniciales,
  });
  await cerrarConexion();
});

describe("Salida de inventario a un paciente sin consulta (issue #964)", () => {
  it("sin paciente no se registra", async () => {
    await entrarComo(CUENTAS.ADMINISTRADORA);

    const { datos, error } = await registrarSalida({
      bodega_id: bodega,
      lote_id: DEMO.loteSano,
      cantidad: CANTIDAD,
      motivo: "entrega",
      usuarioId: CUENTAS.ADMINISTRADORA.perfilId,
    });

    expect(datos).toBeNull();
    expect(error.mensaje).toContain("paciente");
  });

  it("con paciente se registra y guarda a quien se le entrego", async () => {
    const { datos, error } = await registrarSalida({
      bodega_id: bodega,
      lote_id: DEMO.loteSano,
      cantidad: CANTIDAD,
      motivo: "entrega",
      usuarioId: CUENTAS.ADMINISTRADORA.perfilId,
      paciente_id: DEMO.paciente,
    });

    expect(error).toBeNull();
    expect(datos.paciente_id).toBe(DEMO.paciente);
    movimientoId = datos.id;
  });

  it("aparece en la ficha del paciente", async () => {
    const { entregas, error } = await listarEntregasSinConsultaDePaciente(DEMO.paciente);

    expect(error).toBeNull();
    const entrega = entregas.find((una) => una.id === movimientoId);
    expect(entrega).toBeDefined();
    expect(entrega.cantidad).toBe(CANTIDAD);
    expect(entrega.articulo).toBeTruthy();
  });

  it("el kardex trae al paciente", async () => {
    const { datos, error } = await listarMovimientos({ lote_id: DEMO.loteSano });

    expect(error).toBeNull();
    const fila = datos.find((una) => una.id === movimientoId);
    expect(fila.paciente?.nombres).toBeTruthy();
  });
});

describe("Pacientes atendidos de la jornada (issue #964)", () => {
  it("trae ficha y telefono de los pacientes, sin que la consulta falle", async () => {
    await entrarComo(CUENTAS.ADMINISTRADORA);

    const { pacientes, error } = await listarPacientesAtendidosDeJornada(DEMO.jornadaEnCurso, {
      rol: CUENTAS.ADMINISTRADORA.rol,
    });

    expect(error).toBeNull();
    expect(pacientes.length).toBeGreaterThan(0);
    expect(pacientes.every((paciente) => paciente.numeroFicha)).toBe(true);
    expect(pacientes.some((paciente) => paciente.telefono)).toBe(true);
  });
});

describe("El peso del triaje vuelve en libras (issue #964)", () => {
  it("obtenerTriajes convierte los kilos de la tabla", async () => {
    await entrarComo(CUENTAS.ADMINISTRADORA);

    const [fila] = await consultar(
      `SELECT t.id, a.paciente_id, t.peso::float AS kilos
       FROM triajes t JOIN atenciones a ON a.id = t.atencion_id
       WHERE t.peso IS NOT NULL
       LIMIT 1`,
    );
    expect(fila).toBeDefined();

    const { triajes, error } = await obtenerTriajes(fila.paciente_id);

    expect(error).toBeNull();
    const triaje = triajes.find((uno) => uno.id === fila.id);
    expect(triaje.peso).toBe(Math.round(fila.kilos * 2.20462 * 10) / 10);
  });
});
