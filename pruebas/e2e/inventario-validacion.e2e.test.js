// Flujo critico 2: ingreso de inventario con validacion (issue #222).
//
//   registrar ingreso -> nace 'pendiente' -> bandeja de validacion -> aprobar o rechazar ->
//   actualizar existencias
//
// Es la historia de usuario HU02 y el control de integridad del inventario: nada entra ni sale
// del stock sin que la administradora lo haya visto.
//
// QUE PRUEBA ESTO QUE LAS PRUEBAS CON DOBLE NO PUEDEN
//
// Que las columnas que el cliente escribe existen y aguantan sus restricciones. El doble de
// Supabase de packages/shared se construye leyendo el codigo que se va a probar, asi que acepta
// cualquier INSERT que ese codigo quiera hacer -- incluido uno al que le faltan tres columnas
// NOT NULL. Es exactamente como paso inadvertido el defecto de `registrarGasto()` (issue #300) y
// como paso inadvertido el de `registrarIngreso()` que esta suite documenta abajo.

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  aprobarMovimiento,
  listarMovimientos,
  obtenerSupabase,
  rechazarMovimiento,
  registrarIngreso,
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

const CANTIDAD_APROBADA = 30;
const CANTIDAD_RECHAZADA = 12;
const CANTIDAD_LOTE_NUEVO = 45;

const creados = { movimientos: [], lotes: [] };

let bodega = null;
let existenciasIniciales = [];

beforeAll(async () => {
  bodega = await bodegaPrincipal();
  existenciasIniciales = await instantaneaDeExistencias([[DEMO.loteSano, bodega]]);
});

afterAll(async () => {
  await salir();
  await limpiar({
    movimientos: creados.movimientos,
    lotes: creados.lotes,
    existencias: existenciasIniciales,
  });
  await cerrarConexion();
});

describe("Flujo critico: ingreso de inventario con aprobacion", () => {
  it("1. el voluntario registra un ingreso y queda pendiente, no aprobado", async () => {
    await entrarComo(CUENTAS.VOLUNTARIO);

    const { datos, error } = await registrarIngreso({
      origen: "compra",
      bodega_id: bodega,
      lote_id: DEMO.loteSano,
      cantidad: CANTIDAD_APROBADA,
      motivo: "Reposicion de existencias (prueba e2e)",
      usuarioId: CUENTAS.VOLUNTARIO.perfilId,
    });

    expect(error).toBeNull();
    expect(datos.estado).toBe("pendiente");
    expect(datos.registrado_por).toBe(CUENTAS.VOLUNTARIO.perfilId);
    expect(datos.aprobacion_automatica).toBe(false);

    creados.movimientos.push(datos.id);
  });

  it("2. el ingreso pendiente todavia no movio existencias", async () => {
    const disponible = await existenciaDe(DEMO.loteSano, bodega);

    expect(disponible).toBe(existenciasIniciales[0].cantidad);
  });

  it("3. aparece en la bandeja de validacion", async () => {
    const { datos, error } = await listarMovimientos({ estado: "pendiente" });

    expect(error).toBeNull();
    expect(datos.map((movimiento) => movimiento.id)).toContain(creados.movimientos[0]);
  });

  it("4. el medico no puede aprobarlo aunque lo vea en la bandeja", async () => {
    await entrarComo(CUENTAS.MEDICO);

    const { datos, error } = await aprobarMovimiento(creados.movimientos[0], {
      usuarioId: CUENTAS.MEDICO.perfilId,
      rolUsuario: CUENTAS.MEDICO.rol,
    });

    expect(datos).toBeNull();
    expect(error.mensaje).toMatch(/exclusiva para el rol Administrador/i);

    // Y si el cliente no lo hubiera parado, la politica de UPDATE (00086) tampoco lo deja: solo
    // admite es_administrador() o tiene_permiso('inventario.aprobar').
    //
    // Este es el unico sitio de estas pruebas donde se usa el cliente crudo en vez de una funcion
    // de shared, y es a proposito: lo que se comprueba es justo lo que pasa cuando alguien SE
    // SALTA la guarda de rol del cliente. Con la sesion del medico, esa es la unica forma de
    // llegar al UPDATE que RLS tiene que frenar.
    const { error: errorDirecto } = await obtenerSupabase()
      .from("movimientos_inventario")
      .update({ estado: "aprobado" })
      .eq("id", creados.movimientos[0])
      .select()
      .maybeSingle();

    const despues = await consultar("SELECT estado FROM movimientos_inventario WHERE id = $1", [
      creados.movimientos[0],
    ]);

    // RLS no devuelve error en un UPDATE que no alcanza ninguna fila: simplemente no cambia nada.
    expect(errorDirecto).toBeNull();
    expect(despues[0].estado).toBe("pendiente");
  });

  it("5. la administradora aprueba y las existencias suben", async () => {
    await entrarComo(CUENTAS.ADMINISTRADORA);

    const { datos, error } = await aprobarMovimiento(creados.movimientos[0], {
      usuarioId: CUENTAS.ADMINISTRADORA.perfilId,
      rolUsuario: CUENTAS.ADMINISTRADORA.rol,
    });

    expect(error).toBeNull();
    expect(datos.estado).toBe("aprobado");
    expect(datos.aprobado_por).toBe(CUENTAS.ADMINISTRADORA.perfilId);

    const disponible = await existenciaDe(DEMO.loteSano, bodega);
    expect(disponible).toBe(existenciasIniciales[0].cantidad + CANTIDAD_APROBADA);
  });

  it("6. un movimiento ya aprobado no se vuelve a tocar", async () => {
    // tr_bloquear_movimiento_finalizado (00023). Sin esto, aprobar dos veces sumaria dos veces.
    const { datos, error } = await aprobarMovimiento(creados.movimientos[0], {
      usuarioId: CUENTAS.ADMINISTRADORA.perfilId,
      rolUsuario: CUENTAS.ADMINISTRADORA.rol,
    });

    expect(datos).toBeNull();
    expect(error.mensaje).toMatch(/no está pendiente/i);
  });

  it("7. el rechazo exige motivo y no mueve existencias", async () => {
    await entrarComo(CUENTAS.VOLUNTARIO);

    const { datos: aRechazar } = await registrarIngreso({
      origen: "compra",
      bodega_id: bodega,
      lote_id: DEMO.loteSano,
      cantidad: CANTIDAD_RECHAZADA,
      motivo: "Ingreso con datos por confirmar (prueba e2e)",
      usuarioId: CUENTAS.VOLUNTARIO.perfilId,
    });
    creados.movimientos.push(aRechazar.id);

    await entrarComo(CUENTAS.ADMINISTRADORA);

    const sinMotivo = await rechazarMovimiento(aRechazar.id, {
      motivo: "   ",
      usuarioId: CUENTAS.ADMINISTRADORA.perfilId,
      rolUsuario: CUENTAS.ADMINISTRADORA.rol,
    });
    expect(sinMotivo.datos).toBeNull();
    expect(sinMotivo.error.mensaje).toMatch(/motivo/i);

    const { datos, error } = await rechazarMovimiento(aRechazar.id, {
      motivo: "La cantidad no coincide con el conteo fisico.",
      usuarioId: CUENTAS.ADMINISTRADORA.perfilId,
      rolUsuario: CUENTAS.ADMINISTRADORA.rol,
    });

    expect(error).toBeNull();
    expect(datos.estado).toBe("rechazado");
    expect(datos.motivo_rechazo).toBe("La cantidad no coincide con el conteo fisico.");

    const disponible = await existenciaDe(DEMO.loteSano, bodega);
    expect(disponible).toBe(existenciasIniciales[0].cantidad + CANTIDAD_APROBADA);
  });

  it("8. la administradora registra un ingreso creando el lote, y nace ya aprobado", async () => {
    // REGRESION DE LA ISSUE #222.
    //
    // Este es el caso que estaba roto: registrarIngreso() insertaba el lote con medicamento,
    // numero y vencimiento, y `lotes` exige ademas proveedor_id, origen y cantidad_ingresada,
    // los tres NOT NULL sin DEFAULT (00020). El INSERT reventaba con 23502 siempre, para
    // cualquier rol. Como es el unico camino que crea un lote, se llevaba por delante el ingreso
    // de donaciones entero (donaciones/ingreso.api.js), que nunca pasa lote_id.
    //
    // Va con la administradora porque la politica de INSERT de `lotes` (00034) es
    // es_administrador(): un voluntario no puede crear lotes, solo movimientos sobre lotes que
    // ya existen. Ver el paso 9.
    await entrarComo(CUENTAS.ADMINISTRADORA);

    const { datos, error } = await registrarIngreso({
      origen: "donacion",
      bodega_id: bodega,
      medicamento_id: DEMO.medicamentoSano,
      numero_lote: "LOTE-E2E-222",
      fecha_vencimiento: "2030-12-31",
      proveedor_id: DEMO.proveedorComercial,
      cantidad: CANTIDAD_LOTE_NUEVO,
      motivo: "Ingreso con lote nuevo (prueba e2e)",
      usuarioId: CUENTAS.ADMINISTRADORA.perfilId,
    });

    expect(error).toBeNull();
    expect(datos?.lote_id).toBeTruthy();

    creados.movimientos.push(datos.id);
    creados.lotes.push(datos.lote_id);

    const lote = await consultar(
      "SELECT origen, cantidad_ingresada, proveedor_id FROM lotes WHERE id = $1",
      [datos.lote_id],
    );
    expect(lote[0]).toEqual({
      origen: "donacion",
      cantidad_ingresada: CANTIDAD_LOTE_NUEVO,
      proveedor_id: DEMO.proveedorComercial,
    });

    // Lo registro un administrador, asi que tr_autoaprobar_movimiento_inventario (00028/00047)
    // lo hace nacer aprobado y aplica el ajuste en el mismo INSERT.
    expect(datos.estado).toBe("aprobado");
    expect(datos.aprobacion_automatica).toBe(true);
    expect(await existenciaDe(datos.lote_id, bodega)).toBe(CANTIDAD_LOTE_NUEVO);
  });

  it("9. un voluntario no puede crear un lote nuevo, solo mover los que existen", async () => {
    // No es un fallo: es la politica de INSERT de `lotes` (00034), que reserva el alta del
    // catalogo a la administradora. Se deja escrito para que quede claro que el ingreso "en
    // campo" de un voluntario es siempre sobre un lote ya dado de alta.
    await entrarComo(CUENTAS.VOLUNTARIO);

    const { datos, error } = await registrarIngreso({
      origen: "compra",
      bodega_id: bodega,
      medicamento_id: DEMO.medicamentoSano,
      numero_lote: "LOTE-E2E-DENEGADO",
      fecha_vencimiento: "2030-12-31",
      proveedor_id: DEMO.proveedorComercial,
      cantidad: 10,
      motivo: "Intento de alta de lote por un voluntario (prueba e2e)",
      usuarioId: CUENTAS.VOLUNTARIO.perfilId,
    });

    expect(datos).toBeNull();
    expect(error).not.toBeNull();

    const huerfanos = await consultar("SELECT id FROM lotes WHERE numero_lote = $1", [
      "LOTE-E2E-DENEGADO",
    ]);
    expect(huerfanos).toEqual([]);
  });
});
