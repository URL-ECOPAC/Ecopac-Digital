// Esquema declarativo de los formularios de donantes y donaciones (issue #287).
//
// Los enums y los catalogos de opciones vivian en validaciones.js (issue #189, cuando este
// archivo todavia no existia). Se trasladan aqui para que campos.js sea el dueño de su
// vocabulario, igual que pacientes/campos.js es dueño de OPCIONES_IDIOMA: validaciones.js los
// reimporta de vuelta para sus chequeos de pertenencia al enum, en vez de mantener una segunda
// copia.

import { labels } from "@ecopac/ui-tokens";

import { TIPOS_DE_CAMPO } from "../descriptores.js";

/** Valores del enum tipo_donante (00022_donantes_donaciones.sql). */
export const TIPOS_DE_DONANTE = {
  PERSONA: "persona",
  ORGANIZACION: "organizacion",
};

/** Valores del enum tipo_donacion (00022). */
export const TIPOS_DE_DONACION = {
  MEDICAMENTOS: "medicamentos",
  INSUMOS: "insumos",
  DINERO: "dinero",
  SERVICIOS: "servicios",
};

/** Valores del enum estado_donacion (00022). */
export const ESTADOS_DE_DONACION = {
  REGISTRADA: "registrada",
  ANULADA: "anulada",
};

export const OPCIONES_TIPO_DONANTE = [
  { valor: TIPOS_DE_DONANTE.PERSONA, etiqueta: "Persona" },
  { valor: TIPOS_DE_DONANTE.ORGANIZACION, etiqueta: "Organizacion" },
];

export const OPCIONES_TIPO_DONACION = [
  { valor: TIPOS_DE_DONACION.MEDICAMENTOS, etiqueta: "Medicamentos" },
  { valor: TIPOS_DE_DONACION.INSUMOS, etiqueta: "Insumos" },
  { valor: TIPOS_DE_DONACION.DINERO, etiqueta: "Dinero" },
  { valor: TIPOS_DE_DONACION.SERVICIOS, etiqueta: "Servicios" },
];

/**
 * Catalogo de estado_donacion (00022) para filtros y ficha de detalle. La columna
 * `donaciones.estado` se muestra en tabla via CHIP (columnas.js), que pinta el valor crudo del
 * enum sin traducir a proposito (ver StatusChip.jsx: sin tabla de traduccion propia, para no
 * duplicar la lista de estados). Este catalogo es para donde SI hace falta una etiqueta legible
 * -filtro de estado, ficha de detalle-, y por eso la etiqueta sale de ui-tokens, no de un texto
 * suelto (criterio de aceptacion de la issue #287).
 */
export const OPCIONES_ESTADO_DONACION = [
  { valor: ESTADOS_DE_DONACION.REGISTRADA, clave: "registrada", etiqueta: labels.donacionRegistrada },
  { valor: ESTADOS_DE_DONACION.ANULADA, clave: "anulada", etiqueta: labels.donacionAnulada },
];

/**
 * Catalogo de donantes.activo (00022), mismo patron que ESTADOS_USUARIO en usuarios/campos.js:
 * `valor` es el booleano real de la columna, `clave` indexa statusColors (ya trae activo/inactivo
 * genericos) y `etiqueta` sale de ui-tokens.
 */
export const ESTADOS_DONANTE = [
  { valor: true, clave: "activo", etiqueta: labels.activo },
  { valor: false, clave: "inactivo", etiqueta: labels.inactivo },
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
    label: "Telefono",
    tipo: TIPOS_DE_CAMPO.TELEFONO,
    validacion: { maxLongitud: 20 },
  },
  { id: "email", label: "Correo", tipo: TIPOS_DE_CAMPO.EMAIL },
  {
    id: "direccion",
    label: "Direccion",
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
    label: "Tipo de donacion",
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
    label: "Detalle de la donacion",
    tipo: TIPOS_DE_CAMPO.LISTA_REPETIBLE,
    validacion: { requerido: true, minItems: 1 },
    // cantidad y fechaVencimiento van requerido:false aqui a proposito: si son obligatorios
    // depende del tipo de donacion del formulario padre (medicamentos/insumos exigen cantidad;
    // solo medicamentos exige vencimiento), una regla condicional que el descriptor de un campo
    // aislado no puede expresar. Esa regla ya vive en validarDetalle() (validaciones.js).
    campos: [
      {
        id: "descripcion",
        label: "Descripcion",
        tipo: TIPOS_DE_CAMPO.TEXTO,
        validacion: { requerido: true, maxLongitud: 200 },
      },
      { id: "cantidad", label: "Cantidad", tipo: TIPOS_DE_CAMPO.NUMERO, validacion: { requerido: false, min: 0 } },
      { id: "unidad", label: "Unidad", tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: false, maxLongitud: 30 } },
      { id: "monto", label: "Monto", tipo: TIPOS_DE_CAMPO.NUMERO, sufijo: "Q", validacion: { requerido: false, min: 0 } },
      {
        id: "fechaVencimiento",
        label: "Fecha de vencimiento",
        tipo: TIPOS_DE_CAMPO.FECHA,
        validacion: { requerido: false },
      },
    ],
  },
];

/** Formulario de anulacion de una donacion (validarAnulacionDeDonacion, validaciones.js). */
export const CAMPOS_ANULACION_DONACION = [
  {
    id: "motivo",
    label: "Motivo de anulacion",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: true },
  },
];
