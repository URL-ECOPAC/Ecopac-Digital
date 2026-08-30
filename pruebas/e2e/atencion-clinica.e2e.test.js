// Flujo critico 1: atencion clinica de punta a punta (issue #222).
//
//   jornada en curso -> registrar paciente -> abrir expediente -> atencion -> consulta con
//   diagnostico -> receta -> descuento de existencias
//
// Es el recorrido que el mapa de navegacion del Entregable Semana 6 dibuja completo, y el que no
// puede fallar el dia de una jornada.
//
// POR QUE CADA PASO ES UN `it` Y COMPARTEN ESTADO
//
// Porque es UN flujo, no siete pruebas sueltas: el paso 4 no tiene sentido sin el 3. Partirlo en
// `it` numerados hace que el reporte diga en que eslabon se rompio, en vez de dejar un unico
// bloque gigante en rojo. La contrapartida -- si un paso falla, los siguientes fallan detras -- es
// deseable aqui: significa exactamente lo que parece, que el flujo se corto ahi.
//
// CADA PASO VA CON EL ROL QUE LO HACE DE VERDAD
//
// El voluntario registra y hace la fila; el medico consulta y receta; la administradora aprueba.
// No se usa un administrador para todo: eso probaria que las tablas existen, no que el flujo
// funciona para quien lo va a ejecutar en campo. Las politicas RLS de la 00033 son parte de lo
// que se esta probando, no un obstaculo que rodear.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  aprobarMovimiento,
  generarReceta,
  iniciarAtencion,
  obtenerPaciente,
  registrarConsulta,
  registrarPaciente,
  registrarSalida,
} from "@ecopac/shared";

import {
  bodegaPrincipal,
  cerrarConexion,
  consultar,
  DEMO,
  existenciaDe,
  instantaneaDeExistencias,
  limpiar,
} from "./datos.js";
import { CUENTAS, entrarComo, salir } from "./sesiones.js";

/**
 * Diagnostico ficticio que siembra esta suite.
 *
 * El catalogo `diagnosticos` esta VACIO en una base recien reconstruida -- ninguna migracion ni
 * seed carga CIE-10 -- y ademas no tiene politica de INSERT, solo de SELECT, asi que ni siquiera
 * un administrador puede alimentarlo desde la aplicacion. Se siembra por conexion directa, que es
 * como tendria que cargarlo una migracion de catalogo el dia que exista. Anotado como hallazgo en
 * el PR de esta issue: sin filas aqui, el paso "diagnostico CIE-10" del flujo no existe en
 * produccion.
 */
const DIAGNOSTICO = {
  id: "e2e0000d-0000-0000-0000-000000000001",
  codigo: "J00",
  nombre: "Rinofaringitis aguda (prueba e2e)",
};

const CANTIDAD_RECETADA = 5;

/** Estado que va encadenando el flujo de un paso al siguiente. */
const flujo = {
  pacienteId: null,
  expedienteId: null,
  atencionId: null,
  consultaId: null,
  recetaId: null,
  movimientoId: null,
};

let bodega = null;
let existenciasIniciales = [];

beforeAll(async () => {
  bodega = await bodegaPrincipal();
  existenciasIniciales = await instantaneaDeExistencias([[DEMO.loteSano, bodega]]);

  await consultar(
    `INSERT INTO diagnosticos (id, codigo, nombre) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [DIAGNOSTICO.id, DIAGNOSTICO.codigo, DIAGNOSTICO.nombre],
  );
});

afterAll(async () => {
  await salir();
  await limpiar({
    pacientes: flujo.pacienteId ? [flujo.pacienteId] : [],
    movimientos: flujo.movimientoId ? [flujo.movimientoId] : [],
    existencias: existenciasIniciales,
  });
  await consultar("DELETE FROM diagnosticos WHERE id = $1", [DIAGNOSTICO.id]);
  await cerrarConexion();
});

describe("Flujo critico: atencion clinica completa", () => {
  it("1. el voluntario registra al paciente y la base le asigna numero de ficha", async () => {
    await entrarComo(CUENTAS.VOLUNTARIO);

    const { paciente, errores, error } = await registrarPaciente({
      nombres: "Paciente",
      apellidos: "Prueba E2E",
      fechaNacimiento: "1990-04-15",
      sexo: "Femenino",
      comunidad: DEMO.comunidad,
      telefonoContacto: "5999-9001",
      idioma: "espanol",
    });

    expect(errores).toEqual({});
    expect(error).toBeNull();
    expect(paciente?.id).toBeTruthy();

    // numero_ficha lo genera la base (DEFAULT de expedientes, 00081), no el formulario: que
    // llegue de vuelta es la prueba de que el expediente se creo en la misma transaccion.
    expect(paciente.expediente.numeroFicha).toBeTruthy();

    flujo.pacienteId = paciente.id;
  });

  it("2. el voluntario lo pone en la cola de la jornada en curso", async () => {
    const { atencion, error } = await iniciarAtencion(flujo.pacienteId, DEMO.jornadaEnCurso);

    expect(error).toBeNull();
    expect(atencion?.id).toBeTruthy();
    expect(atencion.jornadaId).toBe(DEMO.jornadaEnCurso);

    flujo.atencionId = atencion.id;
  });

  it("3. el mismo paciente no puede entrar dos veces a la misma jornada", async () => {
    const { atencion, error } = await iniciarAtencion(flujo.pacienteId, DEMO.jornadaEnCurso);

    // Lo impide el UNIQUE (paciente_id, jornada_id) de la 00013, no el cliente.
    expect(atencion).toBeNull();
    expect(error?.mensaje).toMatch(/ya esta registrado en la jornada/i);
  });

  it("4. el medico abre el expediente y registra la consulta con su diagnostico", async () => {
    await entrarComo(CUENTAS.MEDICO);

    const { paciente, error: errorPaciente } = await obtenerPaciente(flujo.pacienteId);
    expect(errorPaciente).toBeNull();
    expect(paciente?.expediente?.id).toBeTruthy();
    flujo.expedienteId = paciente.expediente.id;

    const { consulta, error } = await registrarConsulta({
      expediente: flujo.expedienteId,
      atencion: flujo.atencionId,
      medico: CUENTAS.MEDICO.perfilId,
      jornada: DEMO.jornadaEnCurso,
      motivoConsulta: "Tos y dolor de garganta desde hace tres dias.",
      diagnosticos: [{ diagnosticoId: DIAGNOSTICO.id, esPrincipal: true }],
    });

    expect(error).toBeNull();
    expect(consulta?.id).toBeTruthy();

    flujo.consultaId = consulta.id;

    const diagnosticos = await consultar(
      "SELECT diagnostico_id, es_principal FROM consulta_diagnostico WHERE consulta_id = $1",
      [flujo.consultaId],
    );
    expect(diagnosticos).toEqual([{ diagnostico_id: DIAGNOSTICO.id, es_principal: true }]);
  });

  it("5. el medico genera la receta con el medicamento del lote vigente", async () => {
    const { receta, error } = await generarReceta({
      consulta: flujo.consultaId,
      medico: CUENTAS.MEDICO.perfilId,
      indicacionesGenerales: "Tomar con alimentos.",
      detalle: [
        {
          medicamento: DEMO.medicamentoSano,
          loteId: DEMO.loteSano,
          dosis: "1 tableta",
          frecuencia: "cada 8 horas",
          duracion: "5 dias",
          cantidadEntregada: CANTIDAD_RECETADA,
        },
      ],
    });

    expect(error).toBeNull();
    expect(receta?.id).toBeTruthy();

    flujo.recetaId = receta.id;
  });

  it("6. emitir la receta todavia no toca las existencias", async () => {
    // fn_generar_receta (00066) comprueba que el lote alcance, pero no descuenta: el descuento
    // ocurre al despachar, y despachar es un movimiento de salida aprobado. Si esto cambiara sin
    // querer, el stock se descontaria dos veces.
    const disponible = await existenciaDe(DEMO.loteSano, bodega);

    expect(disponible).toBe(existenciasIniciales[0].cantidad);
  });

  it("7. el voluntario registra la salida y nace pendiente de validacion", async () => {
    await entrarComo(CUENTAS.VOLUNTARIO);

    const { datos, error } = await registrarSalida({
      bodega_id: bodega,
      lote_id: DEMO.loteSano,
      cantidad: CANTIDAD_RECETADA,
      motivo: "Dispensacion de receta (prueba e2e)",
      usuarioId: CUENTAS.VOLUNTARIO.perfilId,
    });

    expect(error).toBeNull();
    expect(datos?.id).toBeTruthy();
    // El estado no lo manda el cliente: es el DEFAULT de la columna (00023). Un voluntario no
    // dispara la autoaprobacion, que solo mira a es_administrador() (00028).
    expect(datos.estado).toBe("pendiente");

    flujo.movimientoId = datos.id;
  });

  it("8. la administradora aprueba y ahi si baja el stock", async () => {
    await entrarComo(CUENTAS.ADMINISTRADORA);

    const { datos, error } = await aprobarMovimiento(flujo.movimientoId, {
      usuarioId: CUENTAS.ADMINISTRADORA.perfilId,
      rolUsuario: CUENTAS.ADMINISTRADORA.rol,
    });

    expect(error).toBeNull();
    expect(datos.estado).toBe("aprobado");

    const disponible = await existenciaDe(DEMO.loteSano, bodega);
    expect(disponible).toBe(existenciasIniciales[0].cantidad - CANTIDAD_RECETADA);
  });
});
