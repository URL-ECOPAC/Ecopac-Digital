// La entrega de una receta en la bandeja de Validacion (00186, issue #925).
//
// fn_generar_receta registra una salida por lote y bodega: una receta con tres medicamentos son
// tres movimientos pendientes. La base los valida como un conjunto -aprobar uno aprueba los demas,
// rechazar uno anula la receta- y la bandeja los muestra como una sola fila, para que nadie apruebe
// la mitad de una receta. Los ajustes de entrega y los demas movimientos siguen uno por uno.

import { TIPOS_DE_MOVIMIENTO } from "../enums.js";

const PREFIJO_DE_ENTREGA = "Entrega por receta medica";

/**
 * Si el movimiento es la salida que entrega una receta. Misma condicion que los triggers de la
 * 00186 (trg_movimientos_aprobar_entrega_completa_de_receta y ..._anular_receta_al_rechazar_...).
 *
 * @param {{ tipo?: string, receta_id?: string|null, motivo?: string|null }} movimiento Fila de
 *   listarMovimientos(), con las columnas de la tabla.
 * @returns {boolean}
 */
export function esEntregaDeReceta(movimiento) {
  return (
    movimiento?.tipo === TIPOS_DE_MOVIMIENTO.SALIDA &&
    Boolean(movimiento?.receta_id) &&
    String(movimiento?.motivo ?? "").startsWith(PREFIJO_DE_ENTREGA)
  );
}

/**
 * El folio de la receta que entrega el movimiento ("REC-..."), o null.
 *
 * @param {{ motivo?: string|null }} movimiento
 * @returns {string|null}
 */
export function folioDeEntregaDeReceta(movimiento) {
  const motivo = String(movimiento?.motivo ?? "");
  if (!motivo.startsWith(PREFIJO_DE_ENTREGA)) return null;
  return motivo.slice(PREFIJO_DE_ENTREGA.length).trim() || null;
}

/**
 * El aviso del dialogo de rechazo cuando lo que se rechaza es la entrega de una receta, o null.
 *
 * @param {object} movimiento
 * @returns {string|null}
 */
export function avisoDeRechazoDeEntregaDeReceta(movimiento) {
  if (!esEntregaDeReceta(movimiento)) return null;
  const folio = folioDeEntregaDeReceta(movimiento);
  return (
    `Esta salida entrega la receta ${folio || "del médico"}. Rechazarla anula la receta completa ` +
    "(todos sus medicamentos), y en la ficha del paciente se verá como anulada por la " +
    "administración, con este motivo."
  );
}

/**
 * Las filas de la bandeja de Validacion: cada entrega de receta junta todas sus salidas en una
 * sola fila; cualquier otro movimiento va solo. Conserva el orden de llegada (la primera aparicion
 * de cada receta). Pura y exportada para probarla sin montar la pantalla.
 *
 * `movimiento` es el que representa la fila: sobre el se aprueba o se rechaza, y la base hace lo
 * mismo con los demas de la receta.
 *
 * @param {object[]} pendientes Filas de listarMovimientos({ estado: "pendiente" }).
 * @returns {Array<{ clave: string, esEntregaDeReceta: boolean, folio: string|null,
 *   movimiento: object, movimientos: object[] }>}
 */
export function agruparPendientesDeValidacion(pendientes = []) {
  const filas = [];
  const porReceta = new Map();

  for (const movimiento of pendientes) {
    if (!esEntregaDeReceta(movimiento)) {
      filas.push({
        clave: movimiento.id,
        esEntregaDeReceta: false,
        folio: null,
        movimiento,
        movimientos: [movimiento],
      });
      continue;
    }

    const existente = porReceta.get(movimiento.receta_id);
    if (existente) {
      existente.movimientos.push(movimiento);
      continue;
    }

    const fila = {
      clave: `receta:${movimiento.receta_id}`,
      esEntregaDeReceta: true,
      folio: folioDeEntregaDeReceta(movimiento),
      movimiento,
      movimientos: [movimiento],
    };
    porReceta.set(movimiento.receta_id, fila);
    filas.push(fila);
  }

  return filas;
}
