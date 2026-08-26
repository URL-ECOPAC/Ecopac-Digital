// Columnas de tabla y campos de tarjeta del modulo de presupuestos (issue #288).
//
// Una sola definicion de que datos se muestran de un gasto: en web se vuelve una <Table> con estas
// columnas, en movil una tarjeta con estos mismos campos apilados.
//
// Los ids son los que devuelve listarGastos() de presupuestos/api.js, que entrega las filas de
// `gastos` tal cual (snake_case). La version anterior declaraba `fecha_gasto` y `usuario_registro`,
// que no existen: las columnas son `fecha` y `registrado_por` (00025_presupuesto_gastos.sql).
//
// Ver packages/shared/pacientes/columnas.js, que es el ejemplar de referencia.

export const COLUMNAS_GASTO = [
  { id: "fecha", label: "Fecha", tipo: "fecha" },
  { id: "concepto", label: "Concepto", tipo: "texto", principal: true },
  { id: "categoria", label: "Categoria", tipo: "texto" },
  { id: "monto", label: "Monto", tipo: "moneda" },
  { id: "estado", label: "Estado", tipo: "estado" },
  { id: "registrado_por", label: "Registrado por", tipo: "texto" },
];

/** Datos de la ficha de un gasto, en el orden en que el diseno los presenta. */
export const CAMPOS_FICHA_GASTO = [
  { id: "concepto", label: "Concepto", tipo: "texto", principal: true },
  { id: "categoria", label: "Categoria", tipo: "texto" },
  { id: "monto", label: "Monto", tipo: "moneda" },
  { id: "fecha", label: "Fecha", tipo: "fecha" },
  { id: "estado", label: "Estado", tipo: "estado" },
  { id: "encargado_id", label: "Encargado", tipo: "texto" },
  { id: "registrado_por", label: "Registrado por", tipo: "texto" },
];
