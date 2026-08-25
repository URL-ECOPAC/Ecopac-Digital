// Esquema declarativo de los formularios del modulo de inventario: catalogo
// (medicamentos, proveedores, bodegas), lotes, movimientos y atencion de alertas.
//
// Los campos y su validacion reflejan las columnas y los CHECK reales de las
// migraciones ya aplicadas (medicamentos/principios_activos en 00016, proveedores/
// bodegas en 00017, lotes en 00019+00020, alertas_caducidad en 00021,
// movimientos_inventario en 00023+00028), no el diccionario de datos original del
// entregable: donde difieren, manda la migracion (ver AGENTS.md, "Fuente de verdad").
//
// Diferencia estructural importante, documentada tambien en el PR de este issue: el
// diccionario de datos original de MOVIMIENTO_INVENTARIO tiene bodega_origen_id,
// bodega_destino_id, jornada_id, receta_detalle_id, motivo_rechazo y
// movimiento_reversa_id. La tabla movimientos_inventario real (00023) no tiene
// ninguna de esas columnas: una sola bodega_id, motivo (no motivo_rechazo), sin
// vinculo a jornada ni a receta. CAMPOS_MOVIMIENTO refleja la tabla real.
//
// Ademas, movimientos_inventario.lote_id referencia lotes_existencias (00023), una
// tabla de stock paralela a lotes/existencias (00019/00020) que usan
// receta_detalle/alertas_caducidad/donaciones. CAMPOS_LOTE es el formulario de la
// tabla lotes; el selector de lote en CAMPOS_MOVIMIENTO resuelve sus opciones de
// lotes_existencias, no de lotes. Es un problema estructural preexistente, no de
// este issue.

import { TIPOS_DE_CAMPO } from '../descriptores.js';

/** Valores de presentacion_medicamento (supabase/migrations/00001_initial_schema.sql). */
export const OPCIONES_PRESENTACION = [
  { valor: 'tableta', etiqueta: 'Tableta' },
  { valor: 'jarabe', etiqueta: 'Jarabe' },
  { valor: 'capsula', etiqueta: 'Capsula' },
  { valor: 'inyectable', etiqueta: 'Inyectable' },
  { valor: 'pomada', etiqueta: 'Pomada' },
  { valor: 'gotas ophthalmic', etiqueta: 'Gotas oftalmicas' },
  { valor: 'gotas otic', etiqueta: 'Gotas oticas' },
];

/** Valores de tipo_proveedor (00017_proveedores_bodegas.sql). */
export const OPCIONES_TIPO_PROVEEDOR = [
  { valor: 'comercial', etiqueta: 'Comercial' },
  { valor: 'donante', etiqueta: 'Donante' },
];

/** Valores de origen_lote (00020_lotes_existencias.sql). */
export const OPCIONES_ORIGEN_LOTE = [
  { valor: 'compra', etiqueta: 'Compra' },
  { valor: 'donacion', etiqueta: 'Donacion' },
];

/** Valores de tipo_movimiento vigente (00023_movimientos_inventario.sql redefine el de 00001). */
export const OPCIONES_TIPO_MOVIMIENTO = [
  { valor: 'ingreso', etiqueta: 'Ingreso' },
  { valor: 'salida', etiqueta: 'Salida' },
];

/** Valores de accion_alerta (00021_alertas_caducidad.sql). */
export const OPCIONES_ACCION_ALERTA = [
  { valor: 'donado', etiqueta: 'Donado' },
  { valor: 'reubicado', etiqueta: 'Reubicado' },
  { valor: 'descartado', etiqueta: 'Descartado' },
];

/**
 * Alta y edicion de un principio activo del catalogo (principios_activos, 00016).
 * nombreNormalizado no es un campo del formulario: lo calcula la base de datos
 * (columna generada de 00046) para la unicidad y la busqueda sin acentos.
 */
export const CAMPOS_PRINCIPIO_ACTIVO = [
  { id: 'nombre', label: 'Nombre', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 100 } },
];

/** Alta de medicamento en el catalogo (medicamentos, 00016). */
export const CAMPOS_MEDICAMENTO = [
  { id: 'nombre', label: 'Nombre', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 150 } },
  { id: 'concentracion', label: 'Concentracion', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 100 } },
  { id: 'presentacion', label: 'Presentacion', tipo: TIPOS_DE_CAMPO.SELECT, opciones: OPCIONES_PRESENTACION, validacion: { requerido: true } },
  { id: 'marca', label: 'Marca', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 100 } },
  { id: 'formaFarmaceutica', label: 'Forma farmaceutica', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: false, maxLongitud: 100 } },
  { id: 'esPediatrico', label: 'Es pediatrico', tipo: TIPOS_DE_CAMPO.BOOLEANO, validacion: { requerido: false } },
];

/** Alta de proveedor (proveedores, 00017). */
export const CAMPOS_PROVEEDOR = [
  { id: 'nombre', label: 'Nombre', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 150 } },
  { id: 'contacto', label: 'Contacto', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: false, maxLongitud: 150 } },
  { id: 'tipo', label: 'Tipo', tipo: TIPOS_DE_CAMPO.SELECT, opciones: OPCIONES_TIPO_PROVEEDOR, validacion: { requerido: true } },
];

/** Alta de bodega (bodegas, 00017). */
export const CAMPOS_BODEGA = [
  { id: 'nombre', label: 'Nombre', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 100 } },
  { id: 'ubicacion', label: 'Ubicacion', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: false, maxLongitud: 200 } },
  { id: 'esMovil', label: 'Es movil', tipo: TIPOS_DE_CAMPO.BOOLEANO, validacion: { requerido: false } },
];

/**
 * Registro de un lote nuevo (lotes, 00019+00020). El CHECK
 * chk_lotes_vencimiento_posterior exige fecha_vencimiento > fecha_ingreso: se declara
 * en minFechaDesdeCampo para que el formulario lo valide contra el otro campo, no
 * solo contra hoy.
 */
export const CAMPOS_LOTE = [
  { id: 'medicamento', label: 'Medicamento', tipo: TIPOS_DE_CAMPO.SELECT, opcionesDesde: 'medicamentos', validacion: { requerido: true } },
  { id: 'numeroLote', label: 'Numero de lote', tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 50 } },
  { id: 'proveedor', label: 'Proveedor', tipo: TIPOS_DE_CAMPO.SELECT, opcionesDesde: 'proveedores', validacion: { requerido: true } },
  { id: 'origen', label: 'Origen', tipo: TIPOS_DE_CAMPO.SELECT, opciones: OPCIONES_ORIGEN_LOTE, validacion: { requerido: true } },
  { id: 'cantidadIngresada', label: 'Cantidad ingresada', tipo: TIPOS_DE_CAMPO.NUMERO, validacion: { requerido: true, min: 1 } },
  { id: 'fechaIngreso', label: 'Fecha de ingreso', tipo: TIPOS_DE_CAMPO.FECHA, validacion: { requerido: false } },
  { id: 'fechaVencimiento', label: 'Fecha de vencimiento', tipo: TIPOS_DE_CAMPO.FECHA, validacion: { requerido: true, minFechaDesdeCampo: 'fechaIngreso' } },
];

/**
 * Registro de un movimiento de inventario (movimientos_inventario, 00023+00028).
 * estado, registradoPor, aprobadoPor y fechaAprobacion no son campos del formulario:
 * los fija la base de datos (columna DEFAULT y el trigger de auto-aprobacion de la
 * 00028), nunca el cliente.
 */
export const CAMPOS_MOVIMIENTO = [
  { id: 'tipo', label: 'Tipo', tipo: TIPOS_DE_CAMPO.SELECT, opciones: OPCIONES_TIPO_MOVIMIENTO, validacion: { requerido: true } },
  // Ver el comentario de arriba: las opciones salen de lotes_existencias, no de lotes.
  { id: 'lote', label: 'Lote', tipo: TIPOS_DE_CAMPO.SELECT, opcionesDesde: 'lotesExistencias', validacion: { requerido: true } },
  { id: 'bodega', label: 'Bodega', tipo: TIPOS_DE_CAMPO.SELECT, opcionesDesde: 'bodegas', validacion: { requerido: false } },
  { id: 'cantidad', label: 'Cantidad', tipo: TIPOS_DE_CAMPO.NUMERO, validacion: { requerido: true, min: 1 } },
  { id: 'motivo', label: 'Motivo', tipo: TIPOS_DE_CAMPO.TEXTO_LARGO, validacion: { requerido: true } },
];

/**
 * Atender una alerta de caducidad (alertas_caducidad, 00021). El CHECK
 * chk_alertas_caducidad_cierre_coherente exige accion cuando el estado pasa a
 * 'atendida': por eso accion es requerido aqui, aunque la columna en si sea nullable.
 */
export const CAMPOS_ATENDER_ALERTA = [
  { id: 'accion', label: 'Accion tomada', tipo: TIPOS_DE_CAMPO.SELECT, opciones: OPCIONES_ACCION_ALERTA, validacion: { requerido: true } },
];
