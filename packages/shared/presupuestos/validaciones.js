// Reglas de negocio de presupuestos y gastos (issue #296).
//
// Correccion respecto a la primera version: leia `gasto.categoria_id` y `gasto.fecha_gasto`, dos
// claves que no existen. Las columnas de la tabla `gastos` (00025_presupuesto_gastos.sql) son
// `categoria` y `fecha`, que es lo que ya escribia y filtraba presupuestos/api.js, asi que las
// validaciones no llegaban a mirar los datos reales: daban por faltantes campos que si venian, y
// dejaban pasar los que no.
//
// La lista de categorias validas ya no se recibe por parametro: sale de CATEGORIAS_DE_GASTO en
// campos.js, que replica el enum categoria_gasto de la migracion. Pasarla desde fuera invitaba a
// que cada pantalla trajera su propia copia, que es el bug que esta misma rama corrige en
// donaciones.
import { CATEGORIAS_DE_GASTO, ORIGENES_DE_PRESUPUESTO } from "../enums.js";
import { aFechaLocal } from "../formato/fechas.js";
import { formatearMoneda } from "../formato/moneda.js";
const CATEGORIAS_VALIDAS = Object.values(CATEGORIAS_DE_GASTO);
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
 * Criterios de aceptacion de #296:
 * - El monto de un gasto debe ser mayor que cero.
 * - La fecha no puede ser posterior a hoy ni anterior al inicio de su jornada.
 * - El concepto y la categoria son obligatorios, y la categoria puede ser fija o nueva.
 * - Un gasto que dejaria la jornada por encima de su presupuesto asignado se marca como excedente
 *   (aviso, sin bloquear).
 *
 * @param {{ concepto?: string, categoria?: string, monto?: number|string, fecha?: string,
 *   jornada_id?: string }} gasto Datos del gasto, con las claves de las columnas de `gastos`.
 * @param {{ presupuesto_asignado?: number, fecha_inicio?: string, gasto_acumulado?: number }|null}
 *   [jornada] Datos de la jornada a la que se carga el gasto.
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

  // 2. Categoría obligatoria — ACEPTA CUALQUIER NOMBRE (fija o nueva)
  if (estaVacio(gasto.categoria)) {
    errores.push("La categoría de gasto es obligatoria.");
  }
  //  Ya no se valida contra lista fija: se permiten categorías creadas por el usuario

  // 3. Monto mayor que cero. Lo mismo exige CHECK (monto > 0) en la tabla; se adelanta aqui para
  //    dar el mensaje en el formulario en vez de esperar el rechazo de Postgres.
  const monto = Number(gasto.monto);
  const montoEsNumero = !estaVacio(gasto.monto) && !Number.isNaN(monto);
  if (!montoEsNumero || monto <= 0) {
    errores.push("El monto del gasto debe ser mayor que cero.");
  }

  // 4. Fecha: ni futura ni anterior al inicio de la jornada.
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
      if (fecha > finDeHoy) {
        errores.push("La fecha de un gasto no puede ser posterior a hoy.");
      }
      if (jornada?.fecha_inicio) {
        // Sin setHours(): aFechaLocal() ya devuelve la medianoche local de una columna DATE, y
        // mutarla alteraria el Date que haya pasado quien llama (#849).
        const inicioDeJornada = aFechaLocal(jornada.fecha_inicio);
        if (inicioDeJornada && fecha < inicioDeJornada) {
          errores.push("La fecha del gasto no puede ser anterior al inicio de su jornada.");
        }
      }
    }
  }

  // 5. Excedente de presupuesto: avisa, no bloquea. Una jornada en campo no se detiene porque el
  //    presupuesto se quede corto; lo que se necesita es que quede registrado.
  if (jornada && jornada.presupuesto_asignado !== undefined && montoEsNumero) {
    const acumulado = Number(jornada.gasto_acumulado ?? 0);
    const asignado = Number(jornada.presupuesto_asignado);
    const total = acumulado + monto;
    if (total > asignado) {
      esExcedente = true;
      const diferencia = total - asignado;
      mensajeExcedente =
        `Atencion: este gasto deja la jornada por encima de su presupuesto asignado por ` +
        `Q${diferencia.toFixed(2)}. El registro se permite igual.`;
    }
  }

  return {
    valido: errores.length === 0,
    errores,
    esExcedente,
    mensajeExcedente,
  };
}
