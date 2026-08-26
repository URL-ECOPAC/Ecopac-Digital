

export const CAMPOS_GASTO = {
  concepto: {
    key: 'concepto',
    label: 'Concepto del Gasto',
    tipo: 'text',
    requerido: true,
    placeholder: 'Ej. Compra de insumos médicos',
  },
  monto: {
    key: 'monto',
    label: 'Monto (Q)',
    tipo: 'number',
    requerido: true,
    min: 0.01,
  },
  categoria_id: {
    key: 'categoria_id',
    label: 'Categoría de Gasto',
    tipo: 'select',
    requerido: true,
  },
  jornada_id: {
    key: 'jornada_id',
    label: 'Jornada',
    tipo: 'select',
    requerido: false,
  },
  proyecto_id: {
    key: 'proyecto_id',
    label: 'Proyecto',
    tipo: 'select',
    requerido: false,
  },
  fecha_gasto: {
    key: 'fecha_gasto',
    label: 'Fecha del Gasto',
    tipo: 'date',
    requerido: true,
  },
  comprobante_url: {
    key: 'comprobante_url',
    label: 'Comprobante',
    tipo: 'file',
    requerido: false,
  },
  observaciones: {
    key: 'observaciones',
    label: 'Observaciones',
    tipo: 'textarea',
    requerido: false,
  },
};