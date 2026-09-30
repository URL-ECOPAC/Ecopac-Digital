// Reglas de negocio de presupuestos y gastos (issue #296).
//
// Correccion respecto a la primera version: leia `gasto.categoria_id` y `gasto.fecha_gasto`, dos
// claves que no existen. Las columnas de la tabla `gastos` (00025_presupuesto_gastos.sql) son
// `categoria` y `fecha`, que es lo que ya escribia y filtraba presupuestos/api.js, asi que las
// validaciones no llegaban a mirar los datos reales: daban por faltantes campos que si venian, y
// dejaban pasar los que no.
//
// La categoria ya no se compara contra una lista: desde la 00158 es un catalogo que crece
// (categorias_de_gasto) y la llave foranea de gastos.categoria es quien la valida.
import { ESTADOS_JORNADA, ORIGENES_DE_PRESUPUESTO } from "../enums.js";
import { aFechaLocal, formatearFechaCorta } from "../formato/fechas.js";
import { formatearMoneda } from "../formato/moneda.js";
function estaVacio(valor) {
  return valor === undefined || valor === null || String(valor).trim() === "";
}
/**
 * Valida un aporte al presupuesto de una jornada (issue #840, 00135).
 *
 * Adelanta en el formulario lo que la base rechazaria: monto positivo, donacion obligatoria si y
 * solo si el origen es una donacion, y no asignar de una donacion mas de lo que le queda. Lo
 * ultimo solo se puede comprobar aqui si quien llama pasa el saldo de la donacion elegida; la
 * garantia real es fn_validar_origen_de_presupuesto, que ve lo que asignaron las demas jornadas.
 *
 * @param {{ origen?: string, donacionId?: string, monto?: number|string }} valores
 * @param {{ disponibleDeDonacion?: number|null }} [contexto]
 * @returns {Record<string, string>} Errores por campo; vacio si el aporte es valido.
 */
export function validarOrigenDePresupuesto(valores = {}, { disponibleDeDonacion = null } = {}) {
  const errores = {};
  if (estaVacio(valores.origen)) {
    errores.origen = "Indica de dónde viene el dinero.";
  } else if (valores.origen === ORIGENES_DE_PRESUPUESTO.SIN_CLASIFICAR) {
    // Solo lo pone el sistema: registrarlo a mano seria volver a no saber de donde vino.
    errores.origen = "Indica de dónde viene el dinero.";
  }
  const esDonacion = valores.origen === ORIGENES_DE_PRESUPUESTO.DONACION;
  if (esDonacion && estaVacio(valores.donacionId)) {
    errores.donacionId = "Elige la donación de la que sale el dinero.";
  }
  const monto = Number(valores.monto);
  if (estaVacio(valores.monto) || !Number.isFinite(monto) || monto <= 0) {
    errores.monto = "El monto tiene que ser mayor que cero.";
  } else if (esDonacion && disponibleDeDonacion !== null && monto > disponibleDeDonacion) {
    errores.monto = `A esa donación le quedan ${formatearMoneda(disponibleDeDonacion)} por asignar.`;
  }
  return errores;
}
/**
 * Valida los datos de un gasto segun las reglas de negocio del modulo de presupuestos.
 *
 * Adelanta lo que la base rechaza (00159, fn_validar_gasto_contra_presupuesto):
 * - El monto de un gasto debe ser mayor que cero.
 * - La fecha llega hasta el dia de su jornada aunque sea futuro -un gasto de preparacion se
 *   registra antes- y, pasada la jornada, hasta hoy. No hay limite hacia atras.
 * - El concepto, la categoria y la jornada son obligatorios.
 * - Una jornada finalizada no admite gastos nuevos: ya cerro.
 * - Un gasto no deja lo comprometido de la jornada (gastos pendientes y aprobados) por encima de
 *   su presupuesto asignado. Se marca `esExcedente` con su mensaje y el gasto no es valido.
 *
 * @param {{ concepto?: string, categoria?: string, monto?: number|string, fecha?: string,
 *   jornada_id?: string }} gasto Datos del gasto, con las claves de las columnas de `gastos`.
 * @param {{ fecha?: string, estado?: string, presupuesto_asignado?: number,
 *   comprometido?: number }|null} [jornada] La jornada del gasto: su fecha, su estado, su
 *   presupuesto y lo que ya tiene comprometido sin contar este gasto.
 * @param {Date} [hoy] Entra por parametro para poder probarlo sin depender del reloj.
 * @returns {{ valido: boolean, errores: string[], esExcedente: boolean,
 *   mensajeExcedente: string|null }}
 */
export function validarGasto(gasto = {}, jornada = null, hoy = new Date()) {
  const errores = [];
  let esExcedente = false;
  let mensajeExcedente = null;

  // 1. Concepto obligatorio (columna NOT NULL).
  if (estaVacio(gasto.concepto)) {
    errores.push("El concepto del gasto es obligatorio.");
  }

  // 2. Categoria obligatoria. Que exista en el catalogo lo decide la llave foranea (00158).
  if (estaVacio(gasto.categoria)) {
    errores.push("La categoría de gasto es obligatoria.");
  }

  // 2a. Jornada obligatoria: gastos.jornada_id es NOT NULL (00025) y sin ella no hay presupuesto
  //     contra el que comparar.
  if (estaVacio(gasto.jornada_id)) {
    errores.push("La jornada del gasto es obligatoria.");
  }

  // 2b. Una jornada que ya cerro no admite gastos nuevos (00159).
  if (jornada?.estado === ESTADOS_JORNADA.FINALIZADA) {
    errores.push("La jornada ya cerró: no admite gastos nuevos.");
  }

  // 3. Monto mayor que cero. Lo mismo exige CHECK (monto > 0) en la tabla; se adelanta aqui para
  //    dar el mensaje en el formulario en vez de esperar el rechazo de Postgres.
  const monto = Number(gasto.monto);
  const montoEsNumero = !estaVacio(gasto.monto) && !Number.isNaN(monto);
  if (!montoEsNumero || monto <= 0) {
    errores.push("El monto del gasto debe ser mayor que cero.");
  }

  // 4. Fecha: hasta el dia de la jornada, o hasta hoy si la jornada ya paso.
  if (estaVacio(gasto.fecha)) {
    errores.push("La fecha del gasto es obligatoria.");
  } else {
    // aFechaLocal() y no new Date(): la columna es DATE, llega como "AAAA-MM-DD", y new Date()
    // la lee como medianoche UTC -en Guatemala, las 18:00 del dia anterior- (issue #840).
    const fecha = aFechaLocal(gasto.fecha);
    if (fecha === null) {
      errores.push("La fecha proporcionada no es valida.");
    } else {
      // Fin del dia de hoy: un gasto registrado hoy no puede contar como futuro por la hora. No
      // se muta `hoy` directo -aFechaLocal() devuelve la misma referencia si ya es un Date- para
      // no alterar el parametro de quien llama.
      const referencia = aFechaLocal(hoy);
      const finDeHoy = new Date(
        referencia.getFullYear(),
        referencia.getMonth(),
        referencia.getDate(),
        23,
        59,
        59,
        999,
      );
      const diaDeJornada = jornada?.fecha ? aFechaLocal(jornada.fecha) : null;
      const limite = diaDeJornada && diaDeJornada > finDeHoy ? diaDeJornada : finDeHoy;
      if (fecha > limite) {
        errores.push(
          diaDeJornada
            ? `La fecha de un gasto llega hasta el día de su jornada (${formatearFechaCorta(jornada.fecha)}) o hasta hoy si ya pasó.`
            : "La fecha de un gasto no puede ser posterior a hoy.",
        );
      }
    }
  }

  // 5. Presupuesto: lo comprometido mas este gasto no pasa lo asignado.
  if (jornada && jornada.presupuesto_asignado !== undefined && montoEsNumero) {
    const comprometido = Number(jornada.comprometido ?? 0);
    const asignado = Number(jornada.presupuesto_asignado);
    const disponible = Math.max(asignado - comprometido, 0);
    if (comprometido + monto > asignado) {
      esExcedente = true;
      mensajeExcedente =
        `Este gasto pasa el presupuesto de la jornada por ` +
        `${formatearMoneda(comprometido + monto - asignado)}: le quedan ` +
        `${formatearMoneda(disponible)} contando los gastos pendientes de aprobar.`;
      errores.push("El gasto pasa el presupuesto disponible de la jornada.");
    }
  }

  return {
    valido: errores.length === 0,
    errores,
    esExcedente,
    mensajeExcedente,
  };
}
