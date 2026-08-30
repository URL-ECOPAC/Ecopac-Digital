// Columnas de tabla y campos de tarjeta del modulo de inventario. Mismo patron que
// packages/shared/pacientes/columnas.js: una sola definicion, DataList la vuelve
// <Table> en web y tarjetas en movil.

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";

export const COLUMNAS_PRINCIPIO_ACTIVO = [
  { id: "nombre", label: "Nombre", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
];

export const COLUMNAS_MEDICAMENTO = [
  { id: "nombre", label: "Nombre", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "concentracion", label: "Concentracion", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "presentacion", label: "Presentacion", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "marca", label: "Marca", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "esPediatrico", label: "Pediatrico", tipo: TIPOS_DE_PRESENTACION.BOOLEANO },
  { id: "activo", label: "Activo", tipo: TIPOS_DE_PRESENTACION.CHIP },
];

export const COLUMNAS_LOTE = [
  { id: "numeroLote", label: "Lote", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "medicamento", label: "Medicamento", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "proveedor", label: "Proveedor", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "origen", label: "Origen", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "fechaVencimiento", label: "Vence", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "cantidadIngresada", label: "Cantidad", tipo: TIPOS_DE_PRESENTACION.NUMERO },
];

// Mismas columnas para el listado general de movimientos y para la bandeja de
// validacion (que ademas expone las acciones de aprobar/rechazar sobre estas filas).
export const COLUMNAS_MOVIMIENTO = [
  { id: "tipo", label: "Tipo", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "medicamento", label: "Medicamento", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "cantidad", label: "Cantidad", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "estado", label: "Estado", tipo: TIPOS_DE_PRESENTACION.CHIP },
  { id: "registradoPor", label: "Registrado por", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "createdAt", label: "Fecha", tipo: TIPOS_DE_PRESENTACION.FECHA },
];

export const COLUMNAS_EXISTENCIA = [
  { id: "medicamento", label: "Medicamento", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "numeroLote", label: "Lote", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "bodega", label: "Bodega", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "cantidadDisponible", label: "Disponible", tipo: TIPOS_DE_PRESENTACION.NUMERO },
];

export const COLUMNAS_ALERTA = [
  { id: "medicamento", label: "Medicamento", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "numeroLote", label: "Lote", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "fechaVencimiento", label: "Vence", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "cantidadAfectada", label: "Cantidad afectada", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "estado", label: "Estado", tipo: TIPOS_DE_PRESENTACION.CHIP },
];
