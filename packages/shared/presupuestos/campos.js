// Esquema declarativo de los formularios del modulo de presupuestos (issue #288).
//
// Reescrito para que hable el contrato que consumen las dos apps. La version anterior declaraba un
// objeto con claves `key`, `requerido` suelto y cadenas crudas como tipo ('text', 'number',
// 'file', 'textarea'), ninguna de las cuales esta en TIPOS_DE_CAMPO. Los componentes de formulario
// recorren una LISTA y comparan el tipo contra el vocabulario de descriptores.js, asi que aquello
// no se dibujaba.
//
// Los ids son los de las columnas de gastos en 00025_presupuesto_gastos.sql:
//
//   gastos (id, jornada_id, concepto, categoria, monto, fecha, responsable_id, estado,
//           registrado_por, aprobado_por, aprobado_en, created_at, updated_at)
//
// La version anterior declaraba `categoria_id`, `fecha_gasto`, `proyecto_id`, `comprobante_url` y
// `observaciones`. Las tres ultimas no existen en la tabla, y las dos primeras se llaman
// `categoria` y `fecha`, que es lo que ya usa presupuestos/api.js: el modulo se contradecia a si
// mismo.
//
// Ver packages/shared/pacientes/campos.js, que es el ejemplar de referencia.

import { TIPOS_DE_CAMPO } from "../descriptores.js";
import {
  CATEGORIAS_DE_GASTO,
  ESTADOS_DE_GASTO,
  ETIQUETAS_CATEGORIA_GASTO,
  ETIQUETAS_ESTADO_GASTO,
  ETIQUETAS_ORIGEN_PRESUPUESTO,
  ORIGENES_DE_PRESUPUESTO,
  opcionesDe,
} from "../enums.js";

/**
 * Los origenes que se pueden ELEGIR al registrar un aporte (issue #840). "sin_clasificar" no esta:
 * solo lo pone el sistema, para el presupuesto que existia antes de la 00135 o el que llego ya
 * puesto al crear una jornada. Registrarlo a mano seria volver a no saber de donde vino el dinero.
 */
export const OPCIONES_ORIGEN_PRESUPUESTO = opcionesDe(
  ORIGENES_DE_PRESUPUESTO,
  ETIQUETAS_ORIGEN_PRESUPUESTO,
).filter((opcion) => opcion.value !== ORIGENES_DE_PRESUPUESTO.SIN_CLASIFICAR);

/**
 * Registro de un aporte al presupuesto de una jornada (jornada_presupuesto_origen, 00135).
 *
 * `donacionId` solo aplica cuando el origen es una donacion: lo decide
 * camposDeOrigenDePresupuesto(), no la pantalla. Su catalogo son las donaciones de dinero
 * registradas que todavia tienen saldo sin asignar.
 */
export const CAMPOS_ORIGEN_PRESUPUESTO = [
  {
    id: "origen",
    label: "De dónde viene",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_ORIGEN_PRESUPUESTO,
    validacion: { requerido: true },
  },
  {
    id: "donacionId",
    label: "Donación",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "donacionesDisponibles",
    validacion: { requerido: true },
  },
  {
    id: "monto",
    label: "Monto (Q)",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    paso: 0.01,
    // CHECK (monto > 0) en la 00135.
    validacion: { requerido: true, min: 0.01 },
  },
  {
    id: "descripcion",
    label: "Detalle",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    placeholder: "Ej. Aporte de la municipalidad",
    validacion: { requerido: false, maxLongitud: 200 },
  },
];

/**
 * Los campos que aplican segun el origen elegido: la donacion solo se pide si el origen es una
 * donacion (chk_presupuesto_origen_donacion_coherente, 00135).
 *
 * @param {string} origen
 * @returns {object[]}
 */
export function camposDeOrigenDePresupuesto(origen) {
  return CAMPOS_ORIGEN_PRESUPUESTO.filter(
    (campo) => campo.id !== "donacionId" || origen === ORIGENES_DE_PRESUPUESTO.DONACION,
  );
}

export const OPCIONES_CATEGORIA_GASTO = opcionesDe(CATEGORIAS_DE_GASTO, ETIQUETAS_CATEGORIA_GASTO);

export const OPCIONES_ESTADO_GASTO = opcionesDe(ESTADOS_DE_GASTO, ETIQUETAS_ESTADO_GASTO);

/**
 * Formulario de registro y edicion de un gasto.
 *
 * `estado`, `registrado_por`, `aprobado_por` y `aprobado_en` no estan aqui a proposito: no
 * los escribe quien registra el gasto. `estado` nace en 'pendiente' por DEFAULT de la tabla y solo
 * cambia por la bandeja de aprobacion (issue #299).
 */
export const CAMPOS_GASTO = [
  {
    id: "concepto",
    label: "Concepto del gasto",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    placeholder: "Ej. Compra de insumos médicos",
    validacion: { requerido: true },
  },
  {
    id: "categoria",
    label: "Categoría",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_CATEGORIA_GASTO,
    validacion: { requerido: true },
  },
  {
    id: "monto",
    label: "Monto (Q)",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    // CHECK (monto > 0) en 00025: el minimo no es una preferencia de la pantalla.
    validacion: { requerido: true, minimo: 0.01 },
  },
  {
    id: "fecha",
    label: "Fecha del gasto",
    tipo: TIPOS_DE_CAMPO.FECHA,
    validacion: { requerido: true },
  },
  {
    id: "jornada_id",
    label: "Jornada",
    tipo: TIPOS_DE_CAMPO.SELECT,
    // NOT NULL en 00025: todo gasto cuelga de una jornada. El proyecto no se elige aqui, se
    // deduce de la jornada (jornadas.proyecto_id).
    opcionesDesde: "jornadas",
    validacion: { requerido: true },
  },
  {
    id: "responsable_id",
    label: "Responsable",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "perfiles",
  },
];
