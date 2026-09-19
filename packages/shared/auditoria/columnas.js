// Columnas de la bitacora de auditoria (issue #643). Mismo patron que
// packages/shared/pacientes/columnas.js: una sola definicion, DataList la vuelve <Table> en web.
//
// No hay columna para valoresAnteriores/valoresNuevos: DataList no tiene un tipo de presentacion
// para JSON (no hace falta agregarlo al contrato compartido por un solo modulo). La pantalla
// resuelve el detalle con un boton "Ver detalle" por fila, mismo patron que el modal de
// HistorialDonacionesPage.jsx.

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";
import {
  ETIQUETAS_OPERACION_AUDITORIA,
  OPERACIONES_DE_AUDITORIA,
  opcionesConClave,
} from "../enums.js";

/** Catalogo para la columna "operacion" (tipo ESTADO, etiquetasDesde: "operaciones"). */
export const OPCIONES_OPERACION_AUDITORIA = opcionesConClave(
  OPERACIONES_DE_AUDITORIA,
  ETIQUETAS_OPERACION_AUDITORIA,
);

export const COLUMNAS_BITACORA_AUDITORIA = [
  {
    id: "realizadoEn",
    label: "Fecha y hora",
    // Un instante, no un dia de calendario: dos cambios de la misma tarde se leerian iguales
    // con TIPOS_DE_PRESENTACION.FECHA.
    tipo: TIPOS_DE_PRESENTACION.FECHA_HORA,
  },
  { id: "realizadoPorNombre", label: "Usuario", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "tablaAfectada", label: "Tabla", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  {
    id: "operacion",
    label: "Operación",
    // ESTADO y no CHIP: el valor guardado es el enum crudo ("insercion", "actualizacion", ...),
    // pero se quiere mostrar la etiqueta en español (ETIQUETAS_OPERACION_AUDITORIA, enums.js).
    // El catalogo "operaciones" lo arma el hook con opcionesConClave().
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    etiquetasDesde: "operaciones",
  },
];
