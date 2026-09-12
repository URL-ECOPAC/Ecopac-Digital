// Cobertura e2e del modulo IV: reportes, contra el stack local real (issue #759/#772).
//
// Ninguno de los cinco reportes tenia prueba contra una base real: sus unicas pruebas son
// mocks de packages/shared, que no pueden validar la FORMA de una consulta (un embebido con el
// nombre equivocado, una relacion que no existe). obtenerReporteJornada() es el caso mas expuesto
// del modulo -- tres consultas con embebidos anidados (expedientes, consulta_diagnostico ->
// diagnosticos, receta_detalle -> medicamentos) que nunca se habian ejercitado contra PostgREST
// real -- y es exactamente la clase de bug que ya aparecio dos veces en esta misma issue
// (PGRST108 en recetas, columnas inexistentes en la entrega de medicamentos).
//
// "Con datos" reutiliza el flujo clinico minimo de atencion-clinica.e2e.test.js (registrar
// paciente, consulta con diagnostico, receta) para tener al menos una fila real que agregar.
// "Con la base vacia" no vacia la base real -- seria destructivo y rompería las demas suites --
// sino que filtra a un universo que se sabe vacio (una jornada nueva sin actividad, un id que no
// existe): el criterio de aceptacion es que el reporte no reviente y devuelva ceros/listas
// vacias, y eso se prueba igual filtrando que truncando tablas.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  generarReceta,
  iniciarAtencion,
  listarDiagnosticos,
  obtenerIndicadoresImpacto,
  obtenerPaciente,
  obtenerReporteDeInventario,
  obtenerReporteDeVencimientos,
  obtenerReporteJornada,
  obtenerReportePacientesAtendidos,
  registrarConsulta,
  registrarPaciente,
} from "@ecopac/shared";

import {
  bodegaPrincipal,
  cerrarConexion,
  consultar,
  DEMO,
  instantaneaDeExistencias,
  limpiar,
} from "./datos.js";
import { CUENTAS, entrarComo, salir } from "./sesiones.js";

const CODIGO_DIAGNOSTICO = "J00";
const CANTIDAD_RECETADA = 3;

const flujo = { pacienteId: null, consultaId: null, movimientoId: null };
let bodega = null;
let existenciasIniciales = [];

/** Jornada nueva, sin ninguna consulta: el universo "vacio" para los reportes por jornada. */
const JORNADA_VACIA_ID = "40000772-0000-0000-0000-000000000001";

beforeAll(async () => {
  bodega = await bodegaPrincipal();
  existenciasIniciales = await instantaneaDeExistencias([[DEMO.loteSano, bodega]]);

  await consultar(
    `INSERT INTO jornadas (id, nombre, fecha, comunidad_id, responsable_id)
     VALUES ($1, 'Jornada vacia (prueba e2e #772)', CURRENT_DATE + 60, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [JORNADA_VACIA_ID, DEMO.comunidad, CUENTAS.ADMINISTRADORA.perfilId],
  );

  // Flujo minimo para que los reportes "con datos" tengan algo real que agregar.
  await entrarComo(CUENTAS.VOLUNTARIO);
  const { paciente } = await registrarPaciente({
    nombres: "Paciente",
    apellidos: "Reportes E2E",
    fechaNacimiento: "1992-07-01",
    sexo: "Masculino",
    comunidad: DEMO.comunidad,
    telefonoContacto: "5999-9003",
    idioma: "espanol",
  });
  flujo.pacienteId = paciente.id;

  const { atencion } = await iniciarAtencion(flujo.pacienteId, DEMO.jornadaEnCurso);

  await entrarComo(CUENTAS.MEDICO);
  const { diagnosticos } = await listarDiagnosticos();
  const diagnosticoId = diagnosticos.find((d) => d.codigo === CODIGO_DIAGNOSTICO).id;

  const { paciente: conExpediente } = await obtenerPaciente(flujo.pacienteId);
  const { consulta } = await registrarConsulta({
    expediente: conExpediente.expediente.id,
    atencion: atencion.id,
    medico: CUENTAS.MEDICO.perfilId,
    jornada: DEMO.jornadaEnCurso,
    motivoConsulta: "Control para el reporte de jornada (prueba e2e #772).",
    diagnosticos: [{ diagnosticoId, esPrincipal: true }],
  });
  flujo.consultaId = consulta.id;

  const { receta } = await generarReceta({
    consulta: flujo.consultaId,
    medico: CUENTAS.MEDICO.perfilId,
    detalle: [
      {
        medicamento: DEMO.medicamentoSano,
        loteId: DEMO.loteSano,
        bodegaId: bodega,
        dosis: "1 tableta",
        frecuencia: "cada 12 horas",
        duracion: "3 dias",
        cantidadEntregada: CANTIDAD_RECETADA,
      },
    ],
  });

  // fn_generar_receta (00112) crea la salida en la misma transaccion; un medico no la
  // autoaprueba (00028), asi que queda pendiente y no toca existencias, pero igual hay que
  // borrarla en la limpieza -- no la borra el CASCADE de la receta, que es lo que la afterAll
  // de atencion-clinica.e2e.test.js ya documenta para el mismo caso.
  const [movimiento] = await consultar(
    `SELECT id FROM movimientos_inventario WHERE lote_id = $1 AND motivo = $2`,
    [DEMO.loteSano, `Entrega por receta medica ${receta.folio}`],
  );
  flujo.movimientoId = movimiento?.id ?? null;
});

afterAll(async () => {
  await salir();
  await consultar("DELETE FROM jornadas WHERE id = $1", [JORNADA_VACIA_ID]);
  await limpiar({
    pacientes: flujo.pacienteId ? [flujo.pacienteId] : [],
    movimientos: flujo.movimientoId ? [flujo.movimientoId] : [],
    existencias: existenciasIniciales,
  });
  await cerrarConexion();
});

describe("obtenerReporteJornada: embebidos anidados (expedientes, diagnosticos, receta_detalle)", () => {
  it("con datos: agrega la consulta, el diagnostico y el medicamento recetados", async () => {
    await entrarComo(CUENTAS.ADMINISTRADORA);

    const { datos, error } = await obtenerReporteJornada({
      jornadaId: DEMO.jornadaEnCurso,
      rol: CUENTAS.ADMINISTRADORA.rol,
    });

    expect(error).toBeNull();
    expect(datos.jornada.id).toBe(DEMO.jornadaEnCurso);
    expect(datos.resumen.total_consultas).toBeGreaterThan(0);
    expect(datos.diagnosticos_mas_frecuentes.some((d) => d.diagnostico)).toBe(true);
    expect(datos.medicamentos_mas_entregados.some((m) => m.cantidad >= CANTIDAD_RECETADA)).toBe(
      true,
    );
  });

  it("con la base vacia: una jornada sin consultas no revienta y devuelve ceros", async () => {
    const { datos, error } = await obtenerReporteJornada({
      jornadaId: JORNADA_VACIA_ID,
      rol: CUENTAS.ADMINISTRADORA.rol,
    });

    expect(error).toBeNull();
    expect(datos.resumen).toEqual({ total_consultas: 0, pacientes_atendidos: 0 });
    expect(datos.diagnosticos_mas_frecuentes).toEqual([]);
    expect(datos.medicamentos_mas_entregados).toEqual([]);
    expect(datos.personal_participante).toEqual([]);
  });
});

describe("obtenerReporteDeInventario y obtenerReporteDeVencimientos: embebidos sobre existencias", () => {
  it("con datos: el inventario real de la bodega principal trae medicamentos y totales", async () => {
    const { reporte, error } = await obtenerReporteDeInventario({ bodega });

    expect(error).toBeNull();
    expect(reporte.medicamentos.length).toBeGreaterThan(0);
    expect(reporte.totales.unidadesDisponibles).toBeGreaterThanOrEqual(0);
  });

  it("con la base vacia: un medicamento que no existe da un reporte en ceros, sin reventar", async () => {
    const { reporte, error } = await obtenerReporteDeInventario({
      medicamento: "00000000-0000-0000-0000-000000000000",
    });

    expect(error).toBeNull();
    expect(reporte.medicamentos).toEqual([]);
    expect(reporte.totales).toEqual({
      unidadesDisponibles: 0,
      unidadesVencidas: 0,
      medicamentosDistintos: 0,
      renglonesDeInventario: 0,
    });
  });

  it("obtenerReporteDeVencimientos con datos: el lote sano entra vigente dentro de su horizonte", async () => {
    // LOTE-DEMO-SANO vence dentro de 500 dias (datos.js): el horizonte por defecto es de solo 30,
    // asi que hay que pedir uno mayor para que aparezca -- si no, esta prueba fallaria por una
    // razon de negocio (esta fuera del horizonte pedido) y no por un defecto de la consulta.
    const { reporte, error } = await obtenerReporteDeVencimientos({
      bodega,
      horizonteDias: 600,
    });

    expect(error).toBeNull();
    expect(reporte.renglones.some((r) => r.loteId === DEMO.loteSano)).toBe(true);
  });

  it("obtenerReporteDeVencimientos con la base vacia: sin coincidencias da cero en riesgo", async () => {
    const { reporte, error } = await obtenerReporteDeVencimientos({
      medicamento: "00000000-0000-0000-0000-000000000000",
    });

    expect(error).toBeNull();
    expect(reporte.renglones).toEqual([]);
    expect(reporte.totalUnidadesEnRiesgo).toBe(0);
  });
});

describe("obtenerIndicadoresImpacto: vista_reporte_impacto (00054)", () => {
  it("con datos: el periodo por defecto trae los indicadores del sistema", async () => {
    const { indicadores, error } = await obtenerIndicadoresImpacto({
      rol: CUENTAS.ADMINISTRADORA.rol,
    });

    expect(error).toBeNull();
    expect(indicadores.totales.pacientes_atendidos).toBeGreaterThanOrEqual(0);
  });

  it("con la base vacia: un periodo sin jornadas da los cuatro indicadores en cero", async () => {
    const { indicadores, error } = await obtenerIndicadoresImpacto({
      rol: CUENTAS.ADMINISTRADORA.rol,
      periodo: { fechaInicio: "1999-01-01", fechaFin: "1999-01-31" },
    });

    expect(error).toBeNull();
    expect(indicadores.totales).toEqual({
      pacientes_atendidos: 0,
      consultas_realizadas: 0,
      tratamientos_entregados: 0,
      medicamentos_utilizados: 0,
      comunidades_beneficiadas: 0,
    });
  });
});

describe("obtenerReportePacientesAtendidos: fn_reporte_pacientes_atendidos (00067)", () => {
  it("con datos: el paciente registrado en esta prueba entra en el agrupado por jornada", async () => {
    const { grupos, totales, error } = await obtenerReportePacientesAtendidos({
      rol: CUENTAS.ADMINISTRADORA.rol,
      jornada: DEMO.jornadaEnCurso,
    });

    expect(error).toBeNull();
    expect(totales.pacientes).toBeGreaterThan(0);
    expect(grupos.length).toBeGreaterThan(0);
  });

  it("con la base vacia: una jornada sin pacientes da totales en cero, no una lista vacia sin totales", async () => {
    const { grupos, totales, error } = await obtenerReportePacientesAtendidos({
      rol: CUENTAS.ADMINISTRADORA.rol,
      jornada: JORNADA_VACIA_ID,
    });

    expect(error).toBeNull();
    expect(grupos).toEqual([]);
    expect(totales.pacientes).toBe(0);
  });
});
