// Esquema declarativo de los formularios del modulo de inventario: catalogo
// (medicamentos, proveedores, bodegas), lotes, movimientos y atencion de alertas.
//
// Los campos y su validacion reflejan las columnas y los CHECK reales de las
// migraciones ya aplicadas (medicamentos/principios_activos en 00016, proveedores/
// bodegas en 00017, lotes en 00019+00020, alertas_caducidad en 00021,
// movimientos_inventario en 00023+00028+00047), no el diccionario de datos original
// del entregable: donde difieren, manda la migracion (ver AGENTS.md, "Fuente de
// verdad").
//
// Diferencia estructural importante, documentada tambien en el PR de este issue: el
// diccionario de datos original de MOVIMIENTO_INVENTARIO tiene bodega_origen_id,
// bodega_destino_id, jornada_id, receta_detalle_id, motivo_rechazo y
// movimiento_reversa_id. La tabla movimientos_inventario real (00023) no tiene
// ninguna de esas columnas: una sola bodega_id, motivo (no motivo_rechazo), sin
// vinculo a jornada ni a receta. CAMPOS_MOVIMIENTO refleja la tabla real.
//
// movimientos_inventario.lote_id referencia lotes (issue #369/00047: el esquema
// tenia dos tablas de stock paralelas, lotes/existencias y lotes_existencias; se
// unificaron en lotes/existencias, que trackea cantidad por bodega). Por eso
// CAMPOS_MOVIMIENTO exige tambien bodega: sin bodega no hay fila de existencias que
// ajustar.

import { TIPOS_DE_CAMPO } from "../descriptores.js";
import { camposDeEdicion } from "../formularios.js";
import {
  ACCIONES_DE_ALERTA,
  ESTADOS_MOVIMIENTO,
  ETIQUETAS_ACCION_ALERTA,
  ETIQUETAS_ESTADO_MOVIMIENTO,
  ETIQUETAS_ORIGEN_LOTE,
  ETIQUETAS_TIPO_ARTICULO,
  ETIQUETAS_TIPO_MOVIMIENTO,
  ETIQUETAS_TIPO_PROVEEDOR,
  ORIGENES_DE_LOTE,
  TIPOS_DE_ARTICULO,
  TIPOS_DE_MOVIMIENTO,
  TIPOS_DE_PROVEEDOR,
  opcionesDe,
} from "../enums.js";

export const OPCIONES_TIPO_ARTICULO = opcionesDe(TIPOS_DE_ARTICULO, ETIQUETAS_TIPO_ARTICULO);

export const OPCIONES_TIPO_PROVEEDOR = opcionesDe(TIPOS_DE_PROVEEDOR, ETIQUETAS_TIPO_PROVEEDOR);

export const OPCIONES_ORIGEN_LOTE = opcionesDe(ORIGENES_DE_LOTE, ETIQUETAS_ORIGEN_LOTE);

export const OPCIONES_TIPO_MOVIMIENTO = opcionesDe(TIPOS_DE_MOVIMIENTO, ETIQUETAS_TIPO_MOVIMIENTO);

// Para columnas.js (COLUMNAS_MIS_MOVIMIENTOS.estado): mismo patron que OPCIONES_TIPO_MOVIMIENTO,
// para que un chip de estado traduzca su etiqueta a Title Case en vez de mostrar el valor crudo
// del enum (issue de consistencia de presentacion, PLAN.md punto 8).
export const OPCIONES_ESTADO_MOVIMIENTO = opcionesDe(ESTADOS_MOVIMIENTO, ETIQUETAS_ESTADO_MOVIMIENTO);

export const OPCIONES_ACCION_ALERTA = opcionesDe(ACCIONES_DE_ALERTA, ETIQUETAS_ACCION_ALERTA);

/**
 * Alta y edicion de un principio activo del catalogo (principios_activos, 00016).
 * nombreNormalizado no es un campo del formulario: lo calcula la base de datos
 * (columna generada de 00046) para la unicidad y la busqueda sin acentos.
 */
export const CAMPOS_PRINCIPIO_ACTIVO = [
  {
    id: "nombre",
    label: "Nombre",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 100 },
  },
];

/**
 * Alta y edicion de una presentacion del catalogo (presentaciones, 00144). Mismo patron que
 * CAMPOS_PRINCIPIO_ACTIVO: un solo campo de texto libre, sin codigo ni slug.
 */
export const CAMPOS_PRESENTACION = [
  {
    id: "nombre",
    label: "Nombre",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 100 },
  },
];

/**
 * Alta de medicamento en el catalogo (medicamentos, 00016; activo agregado en 00050).
 * principiosActivos es obligatorio (issue #142, criterio de aceptacion): registrarMedicamento()
 * lo envia como principiosActivosIds a fn_registrar_medicamento (00050), que inserta el
 * medicamento y sus principios activos en una sola transaccion.
 */
export const CAMPOS_MEDICAMENTO = [
  {
    id: "nombre",
    label: "Nombre",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 150 },
  },
  // tipo_articulo (00142): default 'medicamento' en la base, pero el formulario si lo pide
  // explicito -- una persona registrando un insumo (gasas, jeringas...) no deberia depender de
  // acordarse de cambiarlo despues de creado.
  {
    id: "tipoArticulo",
    label: "Tipo de artículo",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_TIPO_ARTICULO,
    validacion: { requerido: true },
  },
  {
    id: "concentracion",
    label: "Concentración",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 100 },
  },
  // presentacion_id (00144): ya no es un enum fijo -- opcionesDesde carga el catalogo real,
  // mismo patron que principiosActivos.
  {
    id: "presentacionId",
    label: "Presentación",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "presentaciones",
    validacion: { requerido: true },
  },
  {
    id: "marca",
    label: "Marca",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 100 },
  },
  {
    id: "principiosActivos",
    label: "Principios activos",
    tipo: TIPOS_DE_CAMPO.MULTI_SELECT,
    opcionesDesde: "principiosActivos",
    validacion: { requerido: true },
  },
  {
    id: "formaFarmaceutica",
    label: "Forma farmacéutica",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: false, maxLongitud: 100 },
  },
  {
    id: "esPediatrico",
    label: "Es pediatrico",
    tipo: TIPOS_DE_CAMPO.BOOLEANO,
    validacion: { requerido: false },
  },
];

/** Alta de proveedor (proveedores, 00017). */
export const CAMPOS_PROVEEDOR = [
  {
    id: "nombre",
    label: "Nombre",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 150 },
  },
  {
    id: "contacto",
    label: "Contacto",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: false, maxLongitud: 150 },
  },
  {
    id: "tipo",
    label: "Tipo",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_TIPO_PROVEEDOR,
    validacion: { requerido: true },
  },
];

/** Alta de bodega (bodegas, 00017). */
export const CAMPOS_BODEGA = [
  {
    id: "nombre",
    label: "Nombre",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 100 },
  },
  {
    id: "ubicacion",
    label: "Ubicación",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: false, maxLongitud: 200 },
  },
  {
    id: "esMovil",
    label: "Es móvil",
    tipo: TIPOS_DE_CAMPO.BOOLEANO,
    validacion: { requerido: false },
  },
];

/**
 * Registro de un lote nuevo (lotes, 00019+00020). El CHECK
 * chk_lotes_vencimiento_posterior exige fecha_vencimiento >= fecha_ingreso (>= desde la 00096):
 * se declara en minFechaDesdeCampo como documentacion, pero validarConDescriptores() no lee esa
 * regla; quien la aplica es validarDatosDeLote() (useGestionLotes.js).
 */
export const CAMPOS_LOTE = [
  {
    id: "medicamento",
    label: "Medicamento",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "medicamentos",
    validacion: { requerido: true },
  },
  {
    id: "numeroLote",
    label: "Número de lote",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 50 },
  },
  {
    id: "proveedor",
    label: "Proveedor",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "proveedores",
    validacion: { requerido: true },
  },
  {
    id: "origen",
    label: "Origen",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_ORIGEN_LOTE,
    validacion: { requerido: true },
  },
  {
    id: "cantidadIngresada",
    label: "Cantidad ingresada",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    validacion: { requerido: true, min: 1 },
  },
  {
    id: "fechaIngreso",
    label: "Fecha de ingreso",
    tipo: TIPOS_DE_CAMPO.FECHA,
    validacion: { requerido: false },
  },
  {
    id: "fechaVencimiento",
    label: "Fecha de vencimiento",
    tipo: TIPOS_DE_CAMPO.FECHA,
    validacion: { requerido: true, minFechaDesdeCampo: "fechaIngreso" },
  },
  {
    id: "costoUnitario",
    label: "Costo unitario (Q)",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    // Opcional a proposito (issue #752): un lote donado, o uno de compra cuyo precio todavia no
    // se conoce, se registra igual. NULL en la base significa "no se sabe cuanto cuesta", nunca
    // "cero" -- forzar un valor aqui mentiria en los reportes financieros tanto como forzarlo
    // en la migracion (00121).
    validacion: { requerido: false, min: 0 },
  },
];

/**
 * Correccion de un lote ya registrado (issue #752): "un precio mal escrito no puede quedar
 * congelado, igual que el telefono de un paciente (#699)". Solo costoUnitario -medicamento,
 * numeroLote, origen y las fechas son el lote tal como entro; cambiarlos despues no es una
 * correccion, es otro lote distinto, mismo criterio que consulta_diagnostico.condicion_id o
 * padecimientos_cronicos.condicion_id en la auditoria de la issue #756.
 *
 * Hoy se corrige en linea, en la fila del desglose de InventarioPage.jsx, donde el resto del lote
 * ya se ve. Se declara igual que las demas correcciones (issue #840, B1): el mismo juego de campos
 * que el alta, con lo que no se corrige de solo lectura.
 */
export const CAMPOS_CORRECCION_LOTE = camposDeEdicion(CAMPOS_LOTE, ["costoUnitario"]);

/**
 * Registro de un movimiento de inventario (movimientos_inventario, 00023+00028+00047).
 * estado, registradoPor, aprobadoPor y aprobadoEn no son campos del formulario:
 * los fija la base de datos (columna DEFAULT y el trigger de auto-aprobacion de la
 * 00028), nunca el cliente.
 */
export const CAMPOS_MOVIMIENTO = [
  {
    id: "tipo",
    label: "Tipo",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_TIPO_MOVIMIENTO,
    validacion: { requerido: true },
  },
  // Opciones desde vista_lotes_disponibles: solo lotes con stock vigente (00047).
  {
    id: "lote",
    label: "Lote",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "lotesDisponibles",
    validacion: { requerido: true },
  },
  // bodega_id es NOT NULL en movimientos_inventario desde la 00047: sin bodega no hay
  // fila de existencias que ajustar.
  {
    id: "bodega",
    label: "Bodega",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "bodegas",
    validacion: { requerido: true },
  },
  {
    id: "cantidad",
    label: "Cantidad",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    validacion: { requerido: true, min: 1 },
  },
  {
    id: "motivo",
    label: "Motivo",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: true },
  },
];

/**
 * Correccion de un movimiento propio y pendiente ("Mis movimientos", issue #756). Solo se
 * cambian cantidad y motivo: tipo/lote/bodega definen que ES el movimiento, y cambiarlos despues
 * de registrado es cancelar y volver a registrar, no corregir un dato mal escrito.
 *
 * Es el mismo juego de campos que el alta, con esos tres de solo lectura (issue #840, B1): hasta
 * entonces la correccion solo tenia cantidad y motivo, y quien corregia no veia en el formulario
 * que movimiento estaba corrigiendo.
 */
export const CAMPOS_CORRECCION_MOVIMIENTO = camposDeEdicion(CAMPOS_MOVIMIENTO, [
  "cantidad",
  "motivo",
]);

/**
 * Atender una alerta de caducidad (alertas_caducidad, 00021). El CHECK
 * chk_alertas_caducidad_cierre_coherente exige accion cuando el estado pasa a
 * 'atendida': por eso accion es requerido aqui, aunque la columna en si sea nullable.
 */
export const CAMPOS_ATENDER_ALERTA = [
  {
    id: "accion",
    label: "Acción tomada",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_ACCION_ALERTA,
    validacion: { requerido: true },
  },
];
