// Reglas de negocio de donantes y donaciones (issue #189).
//
// Reemplaza a donaciones/validaciones.ts, que validaba contra unos valores y unas columnas que la
// base no tiene. Los tres desajustes que corrige:
//
// 1. Los enums. Declaraba TipoDonante = 'INDIVIDUAL' | 'INSTITUCIONAL' y TipoDonacion =
//    'MEDICAMENTOS' | 'DINERO' | 'EQUIPO' | 'OTROS'. Los enums de 00022_donantes_donaciones.sql
//    son tipo_donante ('persona', 'organizacion') y tipo_donacion ('medicamentos', 'insumos',
//    'dinero', 'servicios'): sobraban dos valores, faltaban dos, y todo iba en mayusculas contra
//    un enum en minusculas. Una donacion que pasaba la validacion la rechazaba Postgres con
//    `invalid input value for enum`.
//
// 2. El monto. Lo pedia como columna de la donacion; `donaciones` no tiene ni monto ni moneda. El
//    importe vive en donacion_detalle.monto, un renglon por concepto, y la moneda no se modela:
//    todo el sistema opera en quetzales (ver el formateo de packages/shared/formato).
//
// 3. El vencimiento. Lo pedia en el renglon de detalle; donacion_detalle no tiene esa columna. La
//    fecha de vencimiento vive en lotes (00020) y llega al detalle por lote_id. Se sigue validando
//    porque es criterio de aceptacion de #189, pero declarado como lo que es: el dato con el que
//    se dara de alta el lote de la donacion.
//
// Igual que el resto de validaciones.js del monorepo, devuelve un objeto de errores por campo (
// vacio cuando todo esta bien) y no lanza: quien consume es un formulario que tiene que pintar el
// error junto al campo.
//
// Los enums (TIPOS_DE_DONANTE, TIPOS_DE_DONACION, ESTADOS_DE_DONACION), sus catalogos de opciones
// y CAMPOS_DONANTE viven ahora en campos.js (issue #287): este archivo solo reimporta lo que
// necesita para sus chequeos de pertenencia al enum.

import { TIPOS_DE_DONACION } from "../enums.js";
import { TIPOS_DE_DONANTE } from "../enums.js";
import { aFechaLocal } from "../formato/fechas.js";

// Tipos que exigen al menos un renglon de detalle con cantidad: lo que se recibe se cuenta.
// 'servicios' queda fuera a proposito: una jornada de voluntariado medico no tiene unidades.
const TIPOS_QUE_EXIGEN_CANTIDAD = [TIPOS_DE_DONACION.MEDICAMENTOS, TIPOS_DE_DONACION.INSUMOS];

// Tipos cuyo renglon elige un articulo del catalogo (medicamento_id), con el nombre del articulo
// para el mensaje. Espejo de fn_registrar_donacion (00135, 00170).
const TIPOS_CON_ARTICULO_DEL_CATALOGO = {
  [TIPOS_DE_DONACION.MEDICAMENTOS]: "medicamento",
  [TIPOS_DE_DONACION.INSUMOS]: "insumo",
};

function estaVacio(valor) {
  return valor === undefined || valor === null || String(valor).trim() === "";
}

// issue #694: usaba new Date(valor), que interpreta una cadena AAAA-MM-DD (lo que manda un
// <input type="date">, y el tipo real de donaciones.fecha, 00022) como medianoche UTC. En
// Guatemala (UTC-6) eso corre la fecha un dia hacia atras -y por eso una donacion fechada
// manana pasaba el chequeo de "no puede ser futura" de mas abajo: la fecha corrida caia
// todavia dentro de hoy.
function esFechaValida(valor) {
  return aFechaLocal(valor) !== null;
}

/** Fin del dia de hoy: una donacion registrada hoy no puede contar como futura por la hora. */
function finDeHoy() {
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  return hoy;
}

/**
 * Valida un donante.
 *
 * Exige nombre y tipo (las dos columnas son NOT NULL en 00022) y al menos un dato de contacto,
 * que es el criterio de aceptacion de #189: un donante sin forma de contacto no sirve para
 * agradecer ni para pedir de nuevo. `donantes` tiene tres columnas de contacto -contacto,
 * telefono y email-, y basta con cualquiera de ellas.
 *
 * @param {{ nombre?: string, tipo?: string, contacto?: string, telefono?: string,
 *   email?: string, direccion?: string }} donante
 * @returns {Record<string, string>} Errores por campo; vacio si el donante es valido.
 */
export function validarDonante(donante = {}) {
  const errores = {};

  if (estaVacio(donante.nombre)) {
    errores.nombre = "El nombre del donante es obligatorio.";
  }

  if (estaVacio(donante.tipo)) {
    errores.tipo = "El tipo de donante es obligatorio.";
  } else if (!Object.values(TIPOS_DE_DONANTE).includes(donante.tipo)) {
    errores.tipo = "El tipo de donante seleccionado no es valido.";
  }

  const sinContacto =
    estaVacio(donante.contacto) && estaVacio(donante.telefono) && estaVacio(donante.email);

  if (sinContacto) {
    errores.contacto =
      "Debe proporcionar al menos un dato de contacto (persona, teléfono o correo).";
  }

  return errores;
}

/**
 * Valida un renglon de detalle de la donacion.
 *
 * `descripcion` es NOT NULL en donacion_detalle. `cantidad` y `monto` son nullable pero tienen
 * CHECK de positividad (chk_donacion_detalle_cantidad_positiva y
 * chk_donacion_detalle_monto_no_negativo, 00022): aqui se adelanta ese rechazo para dar un mensaje
 * junto al campo en vez de esperar al error de Postgres.
 *
 * @param {{ descripcion?: string, cantidad?: number, unidad?: string, monto?: number }} detalle
 * @param {number} indice Posicion del renglon, para nombrar el error.
 * @param {string} tipoDeDonacion Tipo de la donacion a la que pertenece el renglon.
 * @returns {Record<string, string>}
 */
// Como se llama la descripcion en el renglon de cada tipo (CAMPOS_RENGLON_POR_TIPO_DE_DONACION):
// el error decia "necesita una descripcion" junto a un campo rotulado "Concepto" (issue #925).
const NOMBRE_DE_LA_DESCRIPCION = {
  [TIPOS_DE_DONACION.DINERO]: "el concepto",
  [TIPOS_DE_DONACION.SERVICIOS]: "el servicio prestado",
};

function validarDetalle(detalle = {}, indice, tipoDeDonacion) {
  const errores = {};
  const prefijo = `detalles_${indice}`;
  const renglon = indice + 1;

  if (TIPOS_CON_ARTICULO_DEL_CATALOGO[tipoDeDonacion]) {
    // Desde la #840 el medicamento se elige del catalogo y la descripcion la arma
    // fn_registrar_donacion con el (00135): pedir texto aqui volveria a la adivinanza. Los
    // insumos, igual desde la 00170.
    if (estaVacio(detalle.medicamentoId)) {
      errores[`${prefijo}_medicamentoId`] =
        `El renglón ${renglon} tiene que elegir un ${TIPOS_CON_ARTICULO_DEL_CATALOGO[tipoDeDonacion]} del catálogo.`;
    }
  } else if (estaVacio(detalle.descripcion)) {
    errores[`${prefijo}_descripcion`] =
      `El renglón ${renglon} necesita ${NOMBRE_DE_LA_DESCRIPCION[tipoDeDonacion] ?? "una descripción"}.`;
  }

  if (TIPOS_QUE_EXIGEN_CANTIDAD.includes(tipoDeDonacion)) {
    if (estaVacio(detalle.cantidad) || Number(detalle.cantidad) <= 0) {
      errores[`${prefijo}_cantidad`] =
        `El renglón ${renglon} debe incluir una cantidad mayor a cero.`;
    }
  } else if (!estaVacio(detalle.cantidad) && Number(detalle.cantidad) <= 0) {
    // Fuera de medicamentos e insumos la cantidad es opcional, pero si viene tiene que ser
    // positiva: es lo que exige el CHECK de la tabla.
    errores[`${prefijo}_cantidad`] = `La cantidad del renglón ${renglon} debe ser mayor a cero.`;
  }

  if (!estaVacio(detalle.monto) && Number(detalle.monto) < 0) {
    errores[`${prefijo}_monto`] = `El monto del renglón ${renglon} no puede ser negativo.`;
  } else if (
    tipoDeDonacion === TIPOS_DE_DONACION.DINERO &&
    (estaVacio(detalle.monto) || !(Number(detalle.monto) > 0))
  ) {
    // El monto de cada renglon en dinero esta marcado como obligatorio (campos.js), y solo se
    // exigia que la suma fuera mayor a cero: un renglon sin monto pasaba (issue #925).
    errores[`${prefijo}_monto`] = `El renglón ${renglon} necesita un monto mayor a cero.`;
  }

  return errores;
}

/**
 * Valida una donacion y sus renglones de detalle.
 *
 * Criterios de aceptacion de #189:
 * - La fecha no puede ser futura.
 * - El detalle tiene que ser coherente con el tipo: una donacion en dinero necesita importe, una
 *   de medicamentos necesita al menos un renglon con cantidad y vencimiento.
 *
 * @param {{ donanteId?: string, tipo?: string, fecha?: string, observaciones?: string,
 *   detalles?: object[] }} donacion
 * @returns {Record<string, string>} Errores por campo; vacio si la donacion es valida.
 */
export function validarDonacion(donacion = {}) {
  const errores = {};
  const detalles = Array.isArray(donacion.detalles) ? donacion.detalles : [];

  if (estaVacio(donacion.donanteId)) {
    errores.donanteId = "Debe seleccionar un donante.";
  }

  if (estaVacio(donacion.tipo)) {
    errores.tipo = "El tipo de donación es obligatorio.";
  } else if (!Object.values(TIPOS_DE_DONACION).includes(donacion.tipo)) {
    errores.tipo = "El tipo de donación seleccionado no es válido.";
  }

  if (estaVacio(donacion.fecha)) {
    errores.fecha = "La fecha de la donación es obligatoria.";
  } else if (!esFechaValida(donacion.fecha)) {
    errores.fecha = "La fecha proporcionada no es válida.";
  } else if (aFechaLocal(donacion.fecha) > finDeHoy()) {
    errores.fecha = "La fecha de la donación no puede ser futura.";
  }

  // Toda donacion necesita al menos un renglon: es lo unico que registra que se recibio.
  if (detalles.length === 0) {
    errores.detalles = "La donación necesita al menos un renglón de detalle.";
  }

  // Una donacion en dinero se reconoce por tener importe en algun renglon, ya que `donaciones` no
  // tiene columna de monto.
  if (donacion.tipo === TIPOS_DE_DONACION.DINERO && detalles.length > 0) {
    const total = detalles.reduce((suma, detalle) => suma + Number(detalle?.monto ?? 0), 0);
    if (!(total > 0)) {
      errores.monto = "Una donación en dinero exige un monto mayor a cero.";
    }
  }

  for (const [indice, detalle] of detalles.entries()) {
    Object.assign(errores, validarDetalle(detalle, indice, donacion.tipo));
  }

  return errores;
}
