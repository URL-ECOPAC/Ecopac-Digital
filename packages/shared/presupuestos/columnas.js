// Columnas de tabla y campos de tarjeta del modulo de presupuestos (issue #288, extendido en
// #302).
//
// Una sola definicion de que datos se muestran de un gasto: en web se vuelve una <Table> con estas
// columnas, en movil una tarjeta con estos mismos campos apilados.
//
// Los ids son los que devuelve listarGastos() de presupuestos/api.js, que entrega las filas de
// `gastos` tal cual (snake_case). La version anterior declaraba `fecha_gasto` y `usuario_registro`,
// que no existen: las columnas son `fecha` y `registrado_por` (00025_presupuesto_gastos.sql).
//
// `estado` va como CHIP y no como ESTADO: gastos.estado guarda directamente el valor del enum
// ('pendiente', 'aprobado', 'rechazado'), que es lo que StatusChip sabe indexar. ESTADO es para
// las columnas que guardan otra cosa -un booleano, por ejemplo- y necesitan un catalogo que las
// traduzca (ver COLUMNAS_USUARIO, que lee `activo`).
//
// Las 8 columnas del criterio 1 de #302 (concepto, categoria, proyecto, jornada, fecha, monto,
// encargado, estado) obligan a tres columnas mas de las 6 que dejo #288: `proyecto`, `jornada` y
// `responsable_id` (Encargado). `registrado_por` sale de la tabla -no esta en la lista del
// criterio- y se queda unicamente en CAMPOS_FICHA_GASTO, mas abajo.
//
// `proyecto`, `jornada` y `responsable_id` guardan un id, no un texto: se dibujan con TEXTO y
// `etiquetasDesde` (mismo mecanismo que COLUMNAS_USUARIO usa para `rol`), que resuelve el id
// contra un catalogo y muestra su etiqueta como texto plano -- ESTADO es para una columna que
// tiene que verse como chip de color, y ninguna de estas tres lo es. `proyecto_id` no es una
// columna de `gastos` -vive en `jornadas`-, asi que listarGastos() (api.js) la aplana a la fila
// con conProyectoId() antes de que llegue aca.
//
// Ver packages/shared/pacientes/columnas.js, que es el ejemplar de referencia.

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";

export const COLUMNAS_GASTO = [
  { id: "concepto", label: "Concepto", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "categoria", label: "Categoria", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "proyecto_id", label: "Proyecto", tipo: TIPOS_DE_PRESENTACION.TEXTO, etiquetasDesde: "proyectos" },
  { id: "jornada_id", label: "Jornada", tipo: TIPOS_DE_PRESENTACION.TEXTO, etiquetasDesde: "jornadas" },
  { id: "fecha", label: "Fecha", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "monto", label: "Monto", tipo: TIPOS_DE_PRESENTACION.MONEDA },
  {
    id: "responsable_id",
    label: "Encargado",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    etiquetasDesde: "perfiles",
  },
  { id: "estado", label: "Estado", tipo: TIPOS_DE_PRESENTACION.CHIP },
];

/** Datos de la ficha de un gasto, en el orden en que el diseno los presenta. */
export const CAMPOS_FICHA_GASTO = [
  { id: "concepto", label: "Concepto", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "categoria", label: "Categoria", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "monto", label: "Monto", tipo: TIPOS_DE_PRESENTACION.MONEDA },
  { id: "fecha", label: "Fecha", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "estado", label: "Estado", tipo: TIPOS_DE_PRESENTACION.CHIP },
  { id: "responsable_id", label: "Responsable", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "registrado_por", label: "Registrado por", tipo: TIPOS_DE_PRESENTACION.TEXTO },
];
