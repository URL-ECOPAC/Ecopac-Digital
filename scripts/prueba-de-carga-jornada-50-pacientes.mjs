// Prueba de carga: una jornada de 50 pacientes de punta a punta (issue #774).
//
// Mide cuanto tarda registrar un paciente, tomarle el triaje y emitirle una receta, repetido 50
// veces -- el volumen de una jornada real -- por el mismo camino que usa la aplicacion:
// packages/shared hablando con PostgREST real (login por contrasena, RLS incluido), no SQL
// directo. Un script que midiera contra una conexion cruda de Postgres estaria midiendo Postgres,
// no lo que un voluntario o un medico esperan en pantalla.
//
// NO es una prueba de correccion -- eso ya lo cubren pruebas/e2e/*.e2e.test.js -- ni corre en CI:
// es una herramienta manual, mismo criterio que scripts/verificar-concurrencia-numero-ficha.mjs.
// Reusa el login y los datos del seed demo de pruebas/e2e/ (sesiones.js, datos.js) en vez de
// reimplementarlos: son funciones planas, no atadas a vitest.
//
// CORRE CON VITEST, NO CON `node` A SECAS: ver scripts/vitest.carga.config.mjs para el porque
// (@ecopac/shared resuelve un import sin extension que solo Vite/vitest saben seguir). Por eso
// esto envuelve el flujo en un it() -- vitest necesita al menos una prueba en el archivo -- pero
// sigue sin ser una prueba de correccion: no hay ningun expect(), solo medicion e impresion.
//
// Requiere `supabase start` corriendo con el seed demo aplicado (`supabase db reset`).
//
// Uso: npm run prueba:carga-jornada

import { performance } from "node:perf_hooks";

import { it } from "vitest";

import {
  generarReceta,
  iniciarAtencion,
  listarDiagnosticos,
  obtenerPaciente,
  registrarConsulta,
  registrarPaciente,
  registrarTriaje,
} from "@ecopac/shared";

import { bodegaPrincipal, cerrarConexion, consultar, DEMO, limpiar } from "../pruebas/e2e/datos.js";
import { CUENTAS, entrarComo, salir } from "../pruebas/e2e/sesiones.js";

const CANTIDAD_DE_PACIENTES = 50;
const CODIGO_DIAGNOSTICO = "J00";
const CANTIDAD_RECETADA = 1;

const creados = { pacientes: [], atenciones: [], movimientos: [] };
const tiempos = { registro: [], triaje: [], consulta: [], receta: [] };

function datosDelPaciente(indice) {
  return {
    nombres: `CargaE2E${indice}`,
    apellidos: "Prueba de carga #774",
    fechaNacimiento: "1988-05-12",
    sexo: indice % 2 === 0 ? "Femenino" : "Masculino",
    comunidad: DEMO.comunidad,
    telefonoContacto: `5900-${String(1000 + indice).slice(-4)}`,
    idioma: "espanol",
  };
}

async function medir(paso, fn) {
  const inicio = performance.now();
  const resultado = await fn();
  tiempos[paso].push(performance.now() - inicio);
  return resultado;
}

function estadisticas(muestras) {
  const total = muestras.reduce((suma, valor) => suma + valor, 0);
  return {
    n: muestras.length,
    totalMs: total,
    promedioMs: total / muestras.length,
    minMs: Math.min(...muestras),
    maxMs: Math.max(...muestras),
  };
}

async function fase1RegistroYTriaje() {
  await entrarComo(CUENTAS.VOLUNTARIO);

  for (let i = 0; i < CANTIDAD_DE_PACIENTES; i++) {
    const { paciente, error: errorRegistro } = await medir("registro", () =>
      registrarPaciente(datosDelPaciente(i)),
    );
    if (errorRegistro)
      throw new Error(`Fallo el registro del paciente ${i}: ${errorRegistro.mensaje}`);
    creados.pacientes.push(paciente.id);

    const { atencion, error: errorAtencion } = await iniciarAtencion(
      paciente.id,
      DEMO.jornadaEnCurso,
    );
    if (errorAtencion)
      throw new Error(`Fallo iniciarAtencion del paciente ${i}: ${errorAtencion.mensaje}`);
    creados.atenciones.push(atencion.id);

    const { error: errorTriaje } = await medir("triaje", () =>
      registrarTriaje(
        atencion.id,
        {
          peso: 65 + (i % 20),
          talla: 160 + (i % 15),
          presionSistolica: 110 + (i % 10),
          presionDiastolica: 70 + (i % 8),
          frecuenciaCardiaca: 70 + (i % 15),
          temperatura: 36.5,
        },
        { tomadoPor: CUENTAS.VOLUNTARIO.perfilId },
      ),
    );
    if (errorTriaje) throw new Error(`Fallo el triaje del paciente ${i}: ${errorTriaje.mensaje}`);
  }
}

async function fase2ConsultaYReceta(bodega) {
  await entrarComo(CUENTAS.MEDICO);

  const { diagnosticos } = await listarDiagnosticos();
  const diagnosticoId = diagnosticos.find((d) => d.codigo === CODIGO_DIAGNOSTICO)?.id;
  if (!diagnosticoId)
    throw new Error(`No se encontro el diagnostico ${CODIGO_DIAGNOSTICO} en el catalogo.`);

  for (let i = 0; i < creados.pacientes.length; i++) {
    const pacienteId = creados.pacientes[i];
    const atencionId = creados.atenciones[i];
    const { paciente } = await obtenerPaciente(pacienteId);

    const { consulta, error: errorConsulta } = await medir("consulta", () =>
      registrarConsulta({
        expediente: paciente.expediente.id,
        atencion: atencionId,
        medico: CUENTAS.MEDICO.perfilId,
        jornada: DEMO.jornadaEnCurso,
        motivoConsulta: "Control de rutina (prueba de carga #774).",
        diagnosticos: [{ diagnosticoId, esPrincipal: true }],
      }),
    );
    if (errorConsulta)
      throw new Error(`Fallo la consulta de ${pacienteId}: ${errorConsulta.mensaje}`);

    const { receta, error: errorReceta } = await medir("receta", () =>
      generarReceta({
        consulta: consulta.id,
        medico: CUENTAS.MEDICO.perfilId,
        detalle: [
          {
            medicamento: DEMO.medicamentoSano,
            loteId: DEMO.loteSano,
            bodegaId: bodega,
            dosis: "1 tableta",
            frecuencia: "cada 8 horas",
            duracion: "3 dias",
            cantidadEntregada: CANTIDAD_RECETADA,
          },
        ],
      }),
    );
    if (errorReceta) throw new Error(`Fallo la receta de ${pacienteId}: ${errorReceta.mensaje}`);

    // fn_generar_receta (00112) crea la salida en la misma transaccion que la receta, con el
    // motivo 'Entrega por receta medica ' + folio (mismo patron que verifica
    // atencion-clinica.e2e.test.js). Esa salida NO cae en el CASCADE de borrar la receta -no hay
    // FK de movimientos_inventario hacia recetas-, asi que hay que apuntarla aparte o queda
    // huerfana en la bandeja de validacion despues de la limpieza.
    const [movimiento] = await consultar(
      `SELECT id FROM movimientos_inventario WHERE lote_id = $1 AND motivo = $2`,
      [DEMO.loteSano, `Entrega por receta medica ${receta.folio}`],
    );
    if (movimiento) creados.movimientos.push(movimiento.id);
  }
}

function imprimirResultados() {
  console.log(`\nPrueba de carga: jornada de ${CANTIDAD_DE_PACIENTES} pacientes (issue #774)\n`);
  console.log(
    "Paso".padEnd(12) +
      "n".padStart(5) +
      "total (s)".padStart(12) +
      "promedio (ms)".padStart(16) +
      "min (ms)".padStart(12) +
      "max (ms)".padStart(12),
  );

  for (const [paso, muestras] of Object.entries(tiempos)) {
    if (muestras.length === 0) continue;
    const s = estadisticas(muestras);
    console.log(
      paso.padEnd(12) +
        String(s.n).padStart(5) +
        (s.totalMs / 1000).toFixed(2).padStart(12) +
        s.promedioMs.toFixed(1).padStart(16) +
        s.minMs.toFixed(1).padStart(12) +
        s.maxMs.toFixed(1).padStart(12),
    );
  }
  console.log("");
}

async function limpiarTodo() {
  await salir();
  // Los movimientos pendientes nunca se aprobaron (esta prueba no llama a aprobarMovimiento()),
  // asi que no tocaron existencias y no hace falta restaurar ninguna cantidad -- limpiar() solo
  // necesita borrar las filas.
  await limpiar({ pacientes: creados.pacientes, movimientos: creados.movimientos });
  await cerrarConexion();
}

it(`registra, hace triaje y receta a ${CANTIDAD_DE_PACIENTES} pacientes, midiendo el tiempo de cada paso`, async () => {
  const bodega = await bodegaPrincipal();

  try {
    await fase1RegistroYTriaje();
    await fase2ConsultaYReceta(bodega);
    imprimirResultados();
  } finally {
    await limpiarTodo();
  }
});
