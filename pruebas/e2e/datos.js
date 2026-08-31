// Datos de apoyo de los flujos criticos: fixtures del seed demo y limpieza (issue #222).
//
// QUE HACE ESTE ARCHIVO Y QUE NO
//
// No prueba nada. Solo prepara el terreno y lo deja como estaba. Todo lo que se prueba pasa por
// packages/shared con una sesion real (ver sesiones.js); aqui se usa una conexion directa a
// Postgres, con el superusuario local, para dos cosas que una sesion de aplicacion no puede ni
// debe hacer:
//
//   1. Borrar lo que la prueba creo. El borrado fisico de un paciente lo bloquea un trigger
//      (impedir_borrado_fisico_paciente, 00026) para TODOS los roles, a proposito. La salida es
//      la misma que ya usan los fixtures pgTAP y scripts/verificar-concurrencia-numero-ficha.mjs:
//      desactivar los triggers de usuario mientras se limpia.
//   2. Sembrar el unico caso que la aplicacion no deja construir: un movimiento de salida sobre
//      un lote vencido. registrarSalida() lo rechaza antes de enviarlo, y esa es justamente la
//      razon por la que hay que insertarlo por debajo para comprobar que la base tambien lo para.
//      Ver medicamento-vencido.e2e.test.js.
//
// La credencial del Postgres local es la que fija supabase/config.toml y no es un secreto: es la
// misma que ya lleva escrita scripts/verificar-concurrencia-numero-ficha.mjs desde la issue #114.

import pg from "pg";

import { configuracionDelStackLocal } from "./stack-local.js";

/**
 * Ids fijos que siembra supabase/seed-demo.sql.
 *
 * Se referencian por id y no se buscan por nombre porque el seed los fija a proposito (prefijo
 * "de00000X-" por tipo de entidad) para que sean estables entre corridas. La excepcion es la
 * bodega principal, que la siembra la migracion 00017 con un id generado: esa se resuelve por
 * nombre en bodegaPrincipal().
 */
export const DEMO = Object.freeze({
  /** Jornada 'en curso'. Es la unica donde se pueden registrar atenciones y consultas (00055). */
  jornadaEnCurso: "de00000a-0000-0000-0000-000000000002",
  /** Comunidad de esa jornada. */
  comunidad: "de000004-0000-0000-0000-000000000002",
  /** Bodega movil que viaja con la jornada en curso. */
  bodegaMovil: "de000002-0000-0000-0000-000000000001",
  /** Proveedor comercial, para los ingresos que registran las pruebas. */
  proveedorComercial: "de000003-0000-0000-0000-000000000001",

  /** Loratadina, lote LOTE-DEMO-SANO: vence dentro de 500 dias, 300 unidades aprobadas. */
  medicamentoSano: "de000007-0000-0000-0000-000000000004",
  loteSano: "de000009-0000-0000-0000-000000000004",

  /** Acetaminofen, lote LOTE-DEMO-VENCIDO: vencio hace 10 dias y AUN ASI tiene 200 unidades. */
  medicamentoVencido: "de000007-0000-0000-0000-000000000001",
  loteVencido: "de000009-0000-0000-0000-000000000001",
});

let pool = null;

function obtenerPool() {
  if (pool === null) {
    pool = new pg.Pool({ connectionString: configuracionDelStackLocal().dbUrl, max: 4 });
  }
  return pool;
}

/** Consulta directa contra el Postgres local. Devuelve las filas. */
export async function consultar(sql, parametros = []) {
  const { rows } = await obtenerPool().query(sql, parametros);
  return rows;
}

/** Cierra el pool. Sin esto vitest se queda esperando a que el proceso termine. */
export async function cerrarConexion() {
  if (pool !== null) {
    await pool.end();
    pool = null;
  }
}

/** Id de la bodega que siembra la migracion 00017, resuelto por nombre. */
export async function bodegaPrincipal() {
  const filas = await consultar("SELECT id FROM bodegas WHERE nombre = 'Bodega Principal'");
  if (filas.length === 0) {
    throw new Error(
      "No existe la 'Bodega Principal'. La siembra la migracion 00017: corre `supabase db reset`.",
    );
  }
  return filas[0].id;
}

/**
 * Existencia de un lote en una bodega, o 0 si no hay fila.
 *
 * Sin fila es lo mismo que cero, el mismo criterio que fn_aplicar_ajuste_existencias (00047).
 */
export async function existenciaDe(loteId, bodegaId) {
  const filas = await consultar(
    "SELECT cantidad_disponible FROM existencias WHERE lote_id = $1 AND bodega_id = $2",
    [loteId, bodegaId],
  );
  return filas[0]?.cantidad_disponible ?? 0;
}

/**
 * Inserta un movimiento saltandose la capa de aplicacion.
 *
 * Solo para construir el caso que registrarSalida() se niega a enviar. `estado` queda en el
 * DEFAULT 'pendiente' (00023): esta conexion no tiene auth.uid(), asi que el trigger de
 * autoaprobacion (00028) no se dispara, igual que en el seed demo.
 *
 * @returns {Promise<string>} El id del movimiento.
 */
export async function sembrarMovimientoPendiente({
  tipo,
  loteId,
  bodegaId,
  cantidad,
  motivo,
  registradoPor,
}) {
  const filas = await consultar(
    `INSERT INTO movimientos_inventario (tipo, lote_id, bodega_id, cantidad, motivo, registrado_por)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [tipo, loteId, bodegaId, cantidad, motivo, registradoPor],
  );
  return filas[0].id;
}

/**
 * Anota cuanta existencia hay ahora, para poder devolverla al final.
 *
 * Aprobar un movimiento mueve existencias de verdad -- es lo que la prueba quiere comprobar -- y
 * ese efecto no se deshace borrando la fila del movimiento. Se guarda el numero de antes y se
 * restaura en la limpieza, para que la base quede como estaba.
 *
 * @param {Array<[string, string]>} pares Pares [loteId, bodegaId].
 */
export async function instantaneaDeExistencias(pares) {
  const instantanea = [];
  for (const [loteId, bodegaId] of pares) {
    instantanea.push({ loteId, bodegaId, cantidad: await existenciaDe(loteId, bodegaId) });
  }
  return instantanea;
}

async function restaurarExistencias(instantanea) {
  for (const { loteId, bodegaId, cantidad } of instantanea) {
    await consultar(
      `INSERT INTO existencias (lote_id, bodega_id, cantidad_disponible)
       VALUES ($1, $2, $3)
       ON CONFLICT (lote_id, bodega_id) DO UPDATE SET cantidad_disponible = EXCLUDED.cantidad_disponible`,
      [loteId, bodegaId, cantidad],
    );
  }
}

/**
 * Borra lo que la prueba creo y devuelve las existencias a su valor original.
 *
 * El orden respeta las llaves foraneas: consultas antes que atenciones (RESTRICT), expedientes
 * antes que pacientes (RESTRICT). Las recetas, su detalle, los diagnosticos de la consulta y los
 * triajes se van solos por CASCADE al borrar la consulta o la atencion.
 *
 * Los triggers de usuario se desactivan porque impedir_borrado_fisico_paciente (00026) bloquea el
 * DELETE sobre pacientes para cualquier rol, y tr_bloquear_movimiento_finalizado (00023) protege
 * los movimientos que ya quedaron aprobados o rechazados.
 */
export async function limpiar({
  pacientes = [],
  movimientos = [],
  lotes = [],
  existencias = [],
} = {}) {
  if (movimientos.length > 0) {
    await consultar("ALTER TABLE movimientos_inventario DISABLE TRIGGER USER");
    try {
      await consultar("DELETE FROM movimientos_inventario WHERE id = ANY($1::uuid[])", [
        movimientos,
      ]);
    } finally {
      await consultar("ALTER TABLE movimientos_inventario ENABLE TRIGGER USER");
    }
  }

  if (pacientes.length > 0) {
    await consultar(
      `DELETE FROM consultas WHERE atencion_id IN
         (SELECT id FROM atenciones WHERE paciente_id = ANY($1::uuid[]))`,
      [pacientes],
    );
    await consultar("DELETE FROM atenciones WHERE paciente_id = ANY($1::uuid[])", [pacientes]);
    await consultar("DELETE FROM expedientes WHERE paciente_id = ANY($1::uuid[])", [pacientes]);

    await consultar("ALTER TABLE pacientes DISABLE TRIGGER USER");
    try {
      await consultar("DELETE FROM pacientes WHERE id = ANY($1::uuid[])", [pacientes]);
    } finally {
      await consultar("ALTER TABLE pacientes ENABLE TRIGGER USER");
    }
  }

  // Despues de los movimientos: movimientos_inventario.lote_id es RESTRICT, asi que un lote con
  // movimientos no se puede borrar. Sus existencias se van solas por CASCADE.
  if (lotes.length > 0) {
    await consultar("DELETE FROM lotes WHERE id = ANY($1::uuid[])", [lotes]);
  }

  if (existencias.length > 0) {
    await restaurarExistencias(existencias);
  }
}
