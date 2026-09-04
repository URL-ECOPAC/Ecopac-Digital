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
  listarDiagnosticos,
  obtenerPaciente,
  registrarConsulta,
  registrarPaciente,
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
 * Codigo del catalogo real con el que se diagnostica en esta prueba.
 *
 * Hasta la issue #625 esta suite tenia que SEMBRAR su propio diagnostico por conexion directa: la
 * tabla estaba vacia -ninguna migracion la cargaba- y no tenia politica de INSERT, asi que ni un
 * administrador podia llenarla. La 00105 siembra el catalogo inicial, de modo que el paso
 * "diagnostico CIE-10" del flujo ya se recorre con datos reales del sistema y no con un fixture
 * inventado para la ocasion. Que este codigo exista es, ademas, parte de lo que se prueba.
 */
const CODIGO_DIAGNOSTICO = "J00";

const CANTIDAD_RECETADA = 5;

/** Estado que va encadenando el flujo de un paso al siguiente. */
const flujo = {
  pacienteId: null,
  expedienteId: null,
  atencionId: null,
  consultaId: null,
  recetaId: null,
  recetaFolio: null,
  movimientoId: null,
};

let bodega = null;
let existenciasIniciales = [];
let diagnosticoId = null;

beforeAll(async () => {
  bodega = await bodegaPrincipal();
  existenciasIniciales = await instantaneaDeExistencias([[DEMO.loteSano, bodega]]);
});

afterAll(async () => {
  await salir();
  await limpiar({
    pacientes: flujo.pacienteId ? [flujo.pacienteId] : [],
    movimientos: flujo.movimientoId ? [flujo.movimientoId] : [],
    existencias: existenciasIniciales,
  });
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

  it("4. el medico encuentra el diagnostico en el catalogo del sistema", async () => {
    await entrarComo(CUENTAS.MEDICO);

    // El catalogo lo siembra la 00105 y esta es la prueba de que llega usable a una base recien
    // reconstruida. Antes de la issue #625 esta consulta devolvia una lista vacia.
    const { diagnosticos, error } = await listarDiagnosticos();

    expect(error).toBeNull();
    expect(diagnosticos.length).toBeGreaterThan(0);

    const elegido = diagnosticos.find((d) => d.codigo === CODIGO_DIAGNOSTICO);
    expect(elegido).toBeDefined();

    diagnosticoId = elegido.id;
  });

  it("5. abre el expediente y registra la consulta con ese diagnostico", async () => {
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
      diagnosticos: [{ diagnosticoId, esPrincipal: true }],
    });

    expect(error).toBeNull();
    expect(consulta?.id).toBeTruthy();

    flujo.consultaId = consulta.id;

    const diagnosticos = await consultar(
      "SELECT diagnostico_id, es_principal FROM consulta_diagnostico WHERE consulta_id = $1",
      [flujo.consultaId],
    );
    expect(diagnosticos).toEqual([{ diagnostico_id: diagnosticoId, es_principal: true }]);
  });

  it("6. el medico genera la receta, y con ella nace la salida de inventario", async () => {
    const { receta, error } = await generarReceta({
      consulta: flujo.consultaId,
      medico: CUENTAS.MEDICO.perfilId,
      indicacionesGenerales: "Tomar con alimentos.",
      detalle: [
        {
          medicamento: DEMO.medicamentoSano,
          loteId: DEMO.loteSano,
          // La bodega es obligatoria desde la 00112: fn_generar_receta registra la salida en su
          // misma transaccion y `existencias` esta particionada por (lote, bodega) (issue #711).
          bodegaId: bodega,
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
    flujo.recetaFolio = receta.folio;
  });

  it("7. emitir la receta todavia no toca las existencias", async () => {
    // Sigue siendo cierto, y por el mismo motivo de siempre: el movimiento que crea la receta
    // nace 'pendiente' cuando lo registra un medico, y el stock solo se mueve al aprobar
    // (00023/00028). Lo que cambio con la 00112 no es cuando baja el stock, sino que el
    // movimiento exista desde el primer momento en vez de depender de una segunda llamada.
    const disponible = await existenciaDe(DEMO.loteSano, bodega);

    expect(disponible).toBe(existenciasIniciales[0].cantidad);
  });

  it("8. la salida la creo la propia receta, pendiente y sin segunda llamada", async () => {
    // Antes de la 00112 este paso registraba la salida a mano con registrarSalida(), despues de
    // emitir. Ese era justamente el agujero de la issue #711: si esa segunda llamada fallaba, la
    // receta quedaba emitida y el medicamento seguia contado como disponible. Ahora la salida es
    // parte de la misma transaccion, asi que aqui ya no se registra nada: se comprueba que este.
    // Se filtra por el motivo, que la 00112 arma como 'Entrega por receta medica ' + folio: el
    // lote de demostracion ya trae movimientos de la semilla, asi que contar todos los del lote
    // mediria otra cosa. De paso, que el folio viaje en el motivo es la trazabilidad que la
    // migracion agrego: desde el kardex se puede llegar a la receta que lo origino.
    const movimientos = await consultar(
      `SELECT id, tipo, estado, cantidad, bodega_id, registrado_por
         FROM movimientos_inventario
        WHERE lote_id = $1 AND motivo = $2
        ORDER BY created_at`,
      [DEMO.loteSano, `Entrega por receta medica ${flujo.recetaFolio}`],
    );

    // UNO, no dos: la receta no duplica el movimiento por renglon ni deja que el cliente agregue
    // otro por su cuenta.
    expect(movimientos).toHaveLength(1);

    const [movimiento] = movimientos;
    expect(movimiento.tipo).toBe("salida");
    expect(movimiento.cantidad).toBe(CANTIDAD_RECETADA);
    expect(movimiento.bodega_id).toBe(bodega);
    // El estado no lo manda el cliente: es el DEFAULT de la columna (00023). Un medico no dispara
    // la autoaprobacion, que solo mira a es_administrador() (00028).
    expect(movimiento.estado).toBe("pendiente");
    // registrado_por sale de auth.uid() dentro de la funcion, no de un campo del cliente.
    expect(movimiento.registrado_por).toBe(CUENTAS.MEDICO.perfilId);

    flujo.movimientoId = movimiento.id;
  });

  it("9. la administradora aprueba y ahi si baja el stock", async () => {
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
