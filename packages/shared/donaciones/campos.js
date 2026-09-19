// Esquema declarativo de los formularios de donantes y donaciones (issue #287).
//
// Los enums y los catalogos de opciones vivian en validaciones.js (issue #189, cuando este
// archivo todavia no existia). Se trasladan aqui para que campos.js sea el dueño de su
// vocabulario, igual que pacientes/campos.js es dueño de OPCIONES_IDIOMA: validaciones.js los
// reimporta de vuelta para sus chequeos de pertenencia al enum, en vez de mantener una segunda
// copia.

import { labels } from "@ecopac/ui-tokens";

import { TIPOS_DE_CAMPO } from "../descriptores.js";
import {
  ESTADOS_DE_DONACION,
  ETIQUETAS_ESTADO_DONACION,
  ETIQUETAS_TIPO_DONACION,
  ETIQUETAS_TIPO_DONANTE,
  TIPOS_DE_DONACION,
  TIPOS_DE_DONANTE,
  opcionesConClave,
  opcionesDe,
} from "../enums.js";

export const OPCIONES_TIPO_DONANTE = opcionesDe(TIPOS_DE_DONANTE, ETIQUETAS_TIPO_DONANTE);

export const OPCIONES_TIPO_DONACION = opcionesDe(TIPOS_DE_DONACION, ETIQUETAS_TIPO_DONACION);

/**
 * Catalogo de estado_donacion (00022) para filtros y ficha de detalle. La columna
 * `donaciones.estado` se muestra en tabla via CHIP (columnas.js), que pinta el valor crudo del
 * enum sin traducir a proposito (ver StatusChip.jsx: sin tabla de traduccion propia, para no
 * duplicar la lista de estados). Este catalogo es para donde SI hace falta una etiqueta legible
 * -filtro de estado, ficha de detalle-, y por eso la etiqueta sale de ui-tokens, no de un texto
 * suelto (criterio de aceptacion de la issue #287).
 */
export const OPCIONES_ESTADO_DONACION = opcionesConClave(
  ESTADOS_DE_DONACION,
  ETIQUETAS_ESTADO_DONACION,
);

/**
 * Catalogo de donantes.activo (00022), mismo patron que ESTADOS_USUARIO en usuarios/campos.js:
 * `value` es el booleano real de la columna, `clave` indexa statusColors (ya trae activo/inactivo
 * genericos) y `label` sale de ui-tokens.
 */
export const ESTADOS_DONANTE = [
  { value: true, clave: "activo", label: labels.activo },
  { value: false, clave: "inactivo", label: labels.inactivo },
];

/** Formulario de alta/edicion de un donante (donantes, 00022). */
export const CAMPOS_DONANTE = [
  {
    id: "nombre",
    label: "Nombre",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 150 },
  },
  {
    id: "tipo",
    label: "Tipo de donante",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_TIPO_DONANTE,
    validacion: { requerido: true },
  },
  {
    id: "contacto",
    label: "Persona de contacto",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { maxLongitud: 150 },
  },
  {
    id: "telefono",
    label: "Teléfono",
    tipo: TIPOS_DE_CAMPO.TELEFONO,
    validacion: { maxLongitud: 20 },
  },
  { id: "email", label: "Correo", tipo: TIPOS_DE_CAMPO.EMAIL },
  {
    id: "direccion",
    label: "Dirección",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { maxLongitud: 200 },
  },
  // La regla "al menos un dato de contacto" (contacto/telefono/email) es transversal a tres
  // campos: se queda en validarDonante() (validaciones.js), no aqui.
];

/**
 * Formulario de alta de una donacion (donaciones + donacion_detalle, 00022). No existia ningun
 * descriptor: se diseña desde cero contra validarDonacion()/validarDetalle() (validaciones.js).
 *
 * `donaciones` no tiene columna de monto ni de moneda -el importe vive por renglon en
 * donacion_detalle.monto- por eso no hay un campo "monto" a nivel de la donacion en si.
 */
export const CAMPOS_DONACION = [
  {
    id: "donanteId",
    label: "Donante",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "donantes",
    validacion: { requerido: true },
  },
  {
    id: "tipo",
    label: "Tipo de donación",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_TIPO_DONACION,
    validacion: { requerido: true },
  },
  { id: "fecha", label: "Fecha", tipo: TIPOS_DE_CAMPO.FECHA, validacion: { requerido: true } },
  {
    id: "observaciones",
    label: "Observaciones",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
  {
    id: "detalles",
    label: "Detalle de la donación",
    tipo: TIPOS_DE_CAMPO.LISTA_REPETIBLE,
    validacion: { requerido: true, minItems: 1 },
    // cantidad va requerido:false aqui a proposito: si es obligatoria depende del tipo de
    // donacion del formulario padre (medicamentos/insumos la exigen, el resto no), una regla
    // condicional que el descriptor de un campo aislado no puede expresar. Esa regla vive en
    // validarDetalle() (validaciones.js).
    //
    // No hay campo de fechaVencimiento aqui a proposito (issue #756): no es una columna de
    // donacion_detalle (00022), y el vencimiento real -el que si importa, lotes.fecha_vencimiento
    // NOT NULL- se captura al generar el ingreso de inventario (ModalRegistroIngreso.jsx via
    // useRegistroIngreso.js), no al registrar la donacion. Pedirlo dos veces era confuso y el
    // valor de aqui nunca se guardaba en ningun lado.
    campos: [
      {
        id: "medicamentoId",
        label: "Medicamento",
        tipo: TIPOS_DE_CAMPO.SELECT,
        opcionesDesde: "medicamentos",
        validacion: { requerido: false },
      },
      {
        id: "descripcion",
        label: "Descripción",
        tipo: TIPOS_DE_CAMPO.TEXTO,
        validacion: { requerido: true, maxLongitud: 200 },
      },
      {
        id: "cantidad",
        label: "Cantidad",
        tipo: TIPOS_DE_CAMPO.NUMERO,
        validacion: { requerido: false, min: 0 },
      },
      {
        id: "unidad",
        label: "Unidad",
        tipo: TIPOS_DE_CAMPO.TEXTO,
        validacion: { requerido: false, maxLongitud: 30 },
      },
      {
        id: "monto",
        label: "Monto",
        tipo: TIPOS_DE_CAMPO.NUMERO,
        sufijo: "Q",
        validacion: { requerido: false, min: 0 },
      },
    ],
  },
];

function campoDeRenglon(id, cambios = {}) {
  const base = CAMPOS_DONACION.find((campo) => campo.id === "detalles").campos.find(
    (campo) => campo.id === id,
  );
  return { ...base, ...cambios, validacion: { ...base.validacion, ...cambios.validacion } };
}

/**
 * Los campos de un renglon segun el tipo de donacion (issue #840).
 *
 * Hasta esta issue la pantalla decidia que dibujar con un `if` por tipo escrito en el JSX, y
 * "servicios" no tenia ninguno: un renglon de servicios no se podia llenar. Ahora cada tipo
 * declara sus campos aqui, y las dos apps los recorren igual.
 *
 * - medicamentos: se ELIGE un medicamento del catalogo (con alta en linea si falta) y se dice
 *   cuantas unidades. No hay descripcion ni unidad: las pone fn_registrar_donacion desde el
 *   catalogo (00134) -la unidad es la presentacion-, que es lo que la persona pidio: "ya se sabe
 *   que son, se pone la cantidad".
 * - insumos: texto libre, cantidad y unidad. No hay catalogo de insumos contra el que validar.
 * - dinero: concepto y monto.
 * - servicios: que se presto y, si se conoce, cuanto vale.
 */
export const CAMPOS_RENGLON_POR_TIPO_DE_DONACION = {
  [TIPOS_DE_DONACION.MEDICAMENTOS]: [
    campoDeRenglon("medicamentoId", { validacion: { requerido: true } }),
    campoDeRenglon("cantidad", { label: "Cantidad (unidades)", validacion: { requerido: true } }),
  ],
  [TIPOS_DE_DONACION.INSUMOS]: [
    campoDeRenglon("descripcion", { label: "Insumo" }),
    campoDeRenglon("cantidad", { validacion: { requerido: true } }),
    campoDeRenglon("unidad"),
  ],
  [TIPOS_DE_DONACION.DINERO]: [
    campoDeRenglon("descripcion", { label: "Concepto" }),
    campoDeRenglon("monto", { validacion: { requerido: true } }),
  ],
  [TIPOS_DE_DONACION.SERVICIOS]: [
    campoDeRenglon("descripcion", { label: "Servicio prestado" }),
    campoDeRenglon("monto", { label: "Valor estimado" }),
  ],
};

/**
 * @param {string} tipo Uno de TIPOS_DE_DONACION.
 * @returns {object[]} Los descriptores del renglon para ese tipo.
 */
export function camposDeRenglonDeDonacion(tipo) {
  const campos = CAMPOS_RENGLON_POR_TIPO_DE_DONACION[tipo];
  // Un tipo que no esta en la tabla es un tipo nuevo del enum que nadie declaro aqui: tiene que
  // reventar, no dibujar un renglon vacio como pasaba con "servicios".
  if (!campos) throw new Error(`Tipo de donacion sin campos de renglon: ${tipo}`);
  return campos;
}

/** Formulario de anulacion de una donacion (validarAnulacionDeDonacion, validaciones.js). */
export const CAMPOS_ANULACION_DONACION = [
  {
    id: "motivo",
    label: "Motivo de anulación",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: true },
  },
];
