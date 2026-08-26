export const COLUMNAS_GASTOS_TABLA = [
  { key: 'fecha_gasto', label: 'Fecha', tipo: 'date' },
  { key: 'concepto', label: 'Concepto', tipo: 'text' },
  { key: 'categoria', label: 'Categoría', tipo: 'text' },
  { key: 'monto', label: 'Monto', tipo: 'currency' },
  { key: 'estado', label: 'Estado', tipo: 'status_badge' },
  { key: 'usuario_registro', label: 'Registrado por', tipo: 'text' },
];

export const CAMPOS_GASTO_TARJETA = [
  { key: 'concepto', label: 'Concepto', principal: true },
  { key: 'monto', label: 'Monto', tipo: 'currency' },
  { key: 'estado', label: 'Estado', tipo: 'status_badge' },
  { key: 'fecha_gasto', label: 'Fecha', tipo: 'date' },
];