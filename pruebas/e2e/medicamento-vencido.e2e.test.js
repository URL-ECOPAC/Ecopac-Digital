// Flujo critico 3: un medicamento vencido no se entrega (issue #222).
//
// Es la regla que protege al paciente, y por eso se comprueba en las TRES capas donde puede
// romperse, no solo en la primera:
//
//   1. El cliente:  registrarSalida() se niega a enviar la salida (esLoteEntregable).
//   2. La receta:   fn_generar_receta (00066) se niega a recetar de un lote vencido.
//   3. La base:     fn_aplicar_ajuste_existencias (00047) se niega a aplicar la salida al
//                   aprobarla, aunque el movimiento haya llegado a 'pendiente' por otro camino.
//
// La tercera es la que importa de verdad. Las dos primeras son comodidad: explican el problema
// antes de gastar un viaje. Si algun dia alguien conecta una pantalla nueva que no llame a
// registrarSalida(), la unica barrera que queda en pie es la de la base -- asi que hay que
// probarla saltandose las otras dos a proposito.
//
// El lote vencido del seed demo tiene existencia POSITIVA (200 unidades, ingreso aprobado). Es
// deliberado: si tuviera cero, cualquier bloqueo se podria explicar por falta de stock y la
// prueba no distinguiria una cosa de la otra.
//
// Lo que NO se prueba aqui son las alertas de caducidad: fn_generar_alertas_caducidad ya tiene su
// suite en supabase/tests/database/generar_alertas_caducidad.sql, y repetirla desde aqui seria
// mantener dos veces la misma verdad.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  aprobarMovimiento,
  generarReceta,
  iniciarAtencion,
  obtenerPaciente,
  obtenerSupabase,
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
  sembrarMovimientoPendiente,
} from "./datos.js";
import { CUENTAS, entrarComo, salir } from "./sesiones.js";

const CANTIDAD = 10;

const creados = { pacientes: [], movimientos: [] };

let bodega = null;
let existenciasIniciales = [];
let consultaId = null;

beforeAll(async () => {
  bodega = await bodegaPrincipal();
  existenciasIniciales = await instantaneaDeExistencias([[DEMO.loteVencido, bodega]]);

  // El lote vencido tiene que tener existencia, o el bloqueo no probaria nada.
  const disponible = await existenciaDe(DEMO.loteVencido, bodega);
  if (disponible < CANTIDAD) {
    throw new Error(
      `El lote vencido del seed deberia tener existencia positiva y tiene ${disponible}. ` +
        "Corre `supabase db reset`.",
    );
  }

  // Una consulta real a la que colgar la receta del caso 2.
  await entrarComo(CUENTAS.VOLUNTARIO);
  const { paciente } = await registrarPaciente({
    nombres: "Paciente",
    apellidos: "Vencido E2E",
    fechaNacimiento: "1985-02-20",
    sexo: "Masculino",
    comunidad: DEMO.comunidad,
    telefonoContacto: "5999-9002",
    idioma: "espanol",
  });
  creados.pacientes.push(paciente.id);

  const { atencion } = await iniciarAtencion(paciente.id, DEMO.jornadaEnCurso);

  await entrarComo(CUENTAS.MEDICO);
  const { paciente: conExpediente } = await obtenerPaciente(paciente.id);
  const { consulta } = await registrarConsulta({
    expediente: conExpediente.expediente.id,
    atencion: atencion.id,
    medico: CUENTAS.MEDICO.perfilId,
    jornada: DEMO.jornadaEnCurso,
    motivoConsulta: "Fiebre (prueba e2e de lote vencido).",
  });
  consultaId = consulta.id;
});

afterAll(async () => {
  await salir();
  await limpiar({
    pacientes: creados.pacientes,
    movimientos: creados.movimientos,
    existencias: existenciasIniciales,
  });
  await cerrarConexion();
});

describe("Flujo critico: no se entrega un medicamento vencido", () => {
  it("1. el cliente se niega a registrar la salida de un lote vencido", async () => {
    await entrarComo(CUENTAS.VOLUNTARIO);

    const { datos, error } = await registrarSalida({
      bodega_id: bodega,
      lote_id: DEMO.loteVencido,
      cantidad: CANTIDAD,
      motivo: "Dispensacion de lote vencido (prueba e2e)",
      usuarioId: CUENTAS.VOLUNTARIO.perfilId,
    });

    expect(datos).toBeNull();
    expect(error.mensaje).toMatch(/lote vencido/i);

    const movimientos = await consultar(
      "SELECT id FROM movimientos_inventario WHERE lote_id = $1 AND tipo = 'salida'",
      [DEMO.loteVencido],
    );
    expect(movimientos).toEqual([]);
  });

  it("2. el medico no puede recetar de un lote vencido", async () => {
    await entrarComo(CUENTAS.MEDICO);

    const { receta, error } = await generarReceta({
      consulta: consultaId,
      medico: CUENTAS.MEDICO.perfilId,
      detalle: [
        {
          medicamento: DEMO.medicamentoVencido,
          loteId: DEMO.loteVencido,
          dosis: "1 tableta",
          frecuencia: "cada 8 horas",
          duracion: "3 dias",
          cantidadEntregada: CANTIDAD,
        },
      ],
    });

    expect(receta).toBeNull();
    expect(error).not.toBeNull();

    // fn_generar_receta inserta la receta ANTES de validar cada renglon y confia en la
    // transaccion para deshacerla. Si la funcion dejara de ser atomica, quedaria una receta
    // vacia colgando de la consulta: esto lo detectaria.
    const recetas = await consultar("SELECT id FROM recetas WHERE consulta_id = $1", [consultaId]);
    expect(recetas).toEqual([]);
  });

  it("3. la base bloquea la aprobacion aunque la salida haya llegado a pendiente", async () => {
    // El caso que de verdad importa: un movimiento que se salto el cliente. Se siembra por
    // conexion directa porque registrarSalida() no lo deja pasar -- que es justo el punto.
    const idMovimiento = await sembrarMovimientoPendiente({
      tipo: "salida",
      loteId: DEMO.loteVencido,
      bodegaId: bodega,
      cantidad: CANTIDAD,
      motivo: "Salida sembrada saltandose el cliente (prueba e2e)",
      registradoPor: CUENTAS.VOLUNTARIO.perfilId,
    });
    creados.movimientos.push(idMovimiento);

    await entrarComo(CUENTAS.ADMINISTRADORA);

    const { datos, error } = await aprobarMovimiento(idMovimiento, {
      usuarioId: CUENTAS.ADMINISTRADORA.perfilId,
      rolUsuario: CUENTAS.ADMINISTRADORA.rol,
    });

    expect(datos).toBeNull();
    expect(error).not.toBeNull();

    const despues = await consultar("SELECT estado FROM movimientos_inventario WHERE id = $1", [
      idMovimiento,
    ]);
    expect(despues[0].estado).toBe("pendiente");
    expect(await existenciaDe(DEMO.loteVencido, bodega)).toBe(existenciasIniciales[0].cantidad);
  });

  it("4. ni la autoaprobacion de la administradora se salta el vencimiento", async () => {
    // Un administrador no pasa por la bandeja: tr_autoaprobar_movimiento_inventario (00028/00047)
    // hace nacer aprobado lo que inserta y aplica el ajuste en el acto. Se inserta con el cliente
    // crudo para saltarse la guarda de registrarSalida() y llegar al trigger, que es lo que se
    // quiere probar. El INSERT entero tiene que fallar: sin esto, la ruta del administrador seria
    // un agujero por el que si sale un medicamento vencido.
    await entrarComo(CUENTAS.ADMINISTRADORA);

    const { data, error } = await obtenerSupabase()
      .from("movimientos_inventario")
      .insert({
        tipo: "salida",
        lote_id: DEMO.loteVencido,
        bodega_id: bodega,
        cantidad: CANTIDAD,
        motivo: "Salida directa de administradora sobre lote vencido (prueba e2e)",
        registrado_por: CUENTAS.ADMINISTRADORA.perfilId,
      })
      .select()
      .maybeSingle();

    expect(data).toBeNull();
    expect(error?.message).toMatch(/vencido/i);

    expect(await existenciaDe(DEMO.loteVencido, bodega)).toBe(existenciasIniciales[0].cantidad);
  });
});
