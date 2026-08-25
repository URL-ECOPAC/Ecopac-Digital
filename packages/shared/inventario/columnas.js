// Columnas de tabla y campos de tarjeta del modulo de inventario. Mismo patron que
// packages/shared/pacientes/columnas.js: una sola definicion, DataList la vuelve
// <Table> en web y tarjetas en movil.

export const COLUMNAS_PRINCIPIO_ACTIVO = [
  { id: 'nombre', label: 'Nombre', tipo: 'texto', principal: true },
];

export const COLUMNAS_MEDICAMENTO = [
  { id: 'nombre', label: 'Nombre', tipo: 'texto', principal: true },
  { id: 'concentracion', label: 'Concentracion', tipo: 'texto' },
  { id: 'presentacion', label: 'Presentacion', tipo: 'texto' },
  { id: 'marca', label: 'Marca', tipo: 'texto' },
  { id: 'esPediatrico', label: 'Pediatrico', tipo: 'booleano' },
];

export const COLUMNAS_LOTE = [
  { id: 'numeroLote', label: 'Lote', tipo: 'texto', principal: true },
  { id: 'medicamento', label: 'Medicamento', tipo: 'texto' },
  { id: 'proveedor', label: 'Proveedor', tipo: 'texto' },
  { id: 'origen', label: 'Origen', tipo: 'texto' },
  { id: 'fechaVencimiento', label: 'Vence', tipo: 'fecha' },
  { id: 'cantidadIngresada', label: 'Cantidad', tipo: 'numero' },
];

// Mismas columnas para el listado general de movimientos y para la bandeja de
// validacion (que ademas expone las acciones de aprobar/rechazar sobre estas filas).
export const COLUMNAS_MOVIMIENTO = [
  { id: 'tipo', label: 'Tipo', tipo: 'texto' },
  { id: 'medicamento', label: 'Medicamento', tipo: 'texto', principal: true },
  { id: 'cantidad', label: 'Cantidad', tipo: 'numero' },
  { id: 'estado', label: 'Estado', tipo: 'chip' },
  { id: 'registradoPor', label: 'Registrado por', tipo: 'texto' },
  { id: 'createdAt', label: 'Fecha', tipo: 'fecha' },
];

export const COLUMNAS_EXISTENCIA = [
  { id: 'medicamento', label: 'Medicamento', tipo: 'texto', principal: true },
  { id: 'numeroLote', label: 'Lote', tipo: 'texto' },
  { id: 'bodega', label: 'Bodega', tipo: 'texto' },
  { id: 'cantidadDisponible', label: 'Disponible', tipo: 'numero' },
];

export const COLUMNAS_ALERTA = [
  { id: 'medicamento', label: 'Medicamento', tipo: 'texto', principal: true },
  { id: 'numeroLote', label: 'Lote', tipo: 'texto' },
  { id: 'fechaVencimiento', label: 'Vence', tipo: 'fecha' },
  { id: 'cantidadAfectada', label: 'Cantidad afectada', tipo: 'numero' },
  { id: 'estado', label: 'Estado', tipo: 'chip' },
];
