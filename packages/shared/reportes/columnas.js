// Columnas de tabla y campos de tarjeta de las pantallas de reporte (issue #289).
//
// Un array por reporte -- no hay una sola fila que los cuatro compartan -- con los `id`
// exactamente iguales a las claves que cada funcion de reportes/*.api.js ya devuelve. Se
// verifico leyendo las cuatro funciones completas antes de declarar nada: ningun nombre aqui
// esta adivinado.
//
// No se declara COLUMNAS_VENCIMIENTO para el reporte de medicamentos proximos a vencer (#213,
// RF-33): su API (issue #204) todavia no existe en packages/shared/reportes/. Adivinar los
// nombres de campo contra una API que no existe es exactamente el error que otras issues de
// esta misma sesion tuvieron que corregir (columnas contra un esquema que nunca existio) --
// no se repite aqui a proposito. Cuando #204 aterrice, sus columnas se agregan contra la forma
// real que esa funcion devuelva.

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";

/**
 * Indicadores de impacto (api.js, obtenerIndicadoresImpacto). Sirve tanto a los tiles del
 * dashboard (#209) como a la tabla del panel de analisis (#214): `indicadores.totales` tiene
 * las mismas cuatro claves que cada fila de `indicadores.agrupados`, mas `clave`/`etiqueta`
 * cuando hay agrupamiento.
 */
export const COLUMNAS_INDICADORES_IMPACTO = [
  { id: "etiqueta", label: "Periodo / grupo", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "pacientes_atendidos", label: "Pacientes atendidos", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  {
    id: "tratamientos_entregados",
    label: "Tratamientos entregados",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
  },
  {
    id: "medicamentos_utilizados",
    label: "Medicamentos utilizados",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
  },
  {
    id: "comunidades_beneficiadas",
    label: "Comunidades beneficiadas",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
  },
];

/**
 * Pacientes atendidos, por grupo (pacientes.api.js, aGrupo()/totalizar()). Ninguna columna
 * identifica a un paciente: `nombre` es la etiqueta del grupo (una jornada, una comunidad o un
 * mes), no una persona -- la RPC que alimenta esto nunca devuelve una fila por paciente
 * (criterio explicito de #211).
 *
 * `desde` en DataList es una sola clave plana (`fila[columna.desde ?? columna.id]`, ver
 * apps/web/src/components/DataList.jsx), no una ruta con puntos: no puede leer
 * `fila.porSexo.hombres` directo. `aGrupo()` anida sexo y edad; el hook de la pantalla (no
 * esta issue) tiene que aplanar cada grupo a `{ ...grupo, hombres: grupo.porSexo.hombres,
 * mujeres: grupo.porSexo.mujeres, menores: grupo.porEdad.menores, ... }` antes de pasarlo a
 * DataList. Por eso estas columnas no llevan `desde`: el `id` ya es la clave plana que el hook
 * tiene que producir.
 */
export const COLUMNAS_PACIENTES_ATENDIDOS = [
  { id: "nombre", label: "Grupo", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "pacientes", label: "Pacientes atendidos", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "nuevos", label: "Nuevos", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "recurrentes", label: "Recurrentes", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "hombres", label: "Hombres", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "mujeres", label: "Mujeres", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "menores", label: "Menores de edad", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "adultos", label: "Adultos", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "adultosMayores", label: "Adultos mayores", tipo: TIPOS_DE_PRESENTACION.NUMERO },
];

/**
 * Inventario actual (inventario.api.js, obtenerReporteDeInventario). Una fila por medicamento;
 * `vencido` es un total de unidades, no un estado de la fila -- el estado de vencimiento vive
 * por lote, en CAMPOS_FICHA_LOTE_INVENTARIO.
 */
export const COLUMNAS_INVENTARIO_REPORTE = [
  { id: "medicamento", label: "Medicamento", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "concentracion", label: "Concentracion", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "presentacion", label: "Presentacion", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "disponible", label: "Disponible", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "vencido", label: "Vencido", tipo: TIPOS_DE_PRESENTACION.NUMERO },
];

/** Desglose por lote de un medicamento (reporte.medicamentos[].lotes[]). */
export const CAMPOS_FICHA_LOTE_INVENTARIO = [
  { id: "numeroLote", label: "Lote", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "bodega", label: "Bodega", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "cantidad", label: "Cantidad", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "fechaVencimiento", label: "Fecha de vencimiento", tipo: TIPOS_DE_PRESENTACION.FECHA },
  {
    id: "vencido",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    etiquetasDesde: "estadosDeVencimientoReporte",
  },
];

/** Totales del reporte de inventario (reporte.totales). */
export const CAMPOS_TOTALES_INVENTARIO_REPORTE = [
  { id: "unidadesDisponibles", label: "Unidades disponibles", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "unidadesVencidas", label: "Unidades vencidas", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  {
    id: "medicamentosDistintos",
    label: "Medicamentos distintos",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
  },
  {
    id: "renglonesDeInventario",
    label: "Renglones de inventario",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
  },
];

/**
 * Resultados de una jornada (jornada.api.js, obtenerReporteJornada). `datos.jornada` es la
 * cabecera anidada y `datos.resumen` sus dos totales; igual que en COLUMNAS_PACIENTES_ATENDIDOS,
 * `desde` no puede leer una ruta anidada, asi que el hook de la pantalla aplana `datos` a un
 * solo objeto (`{ nombre: datos.jornada.nombre, fecha: datos.jornada.fecha, comunidad:
 * datos.jornada.comunidad.nombre, estado: datos.jornada.estado, ...datos.resumen }`) antes de
 * pasarlo a la ficha. Estas columnas declaran los `id` de ese objeto ya aplanado.
 */
export const CAMPOS_FICHA_RESULTADOS_JORNADA = [
  { id: "nombre", label: "Jornada", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "fecha", label: "Fecha", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "comunidad", label: "Comunidad", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    etiquetasDesde: "estadosJornadaReporte",
  },
  { id: "total_consultas", label: "Consultas realizadas", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "pacientes_atendidos", label: "Pacientes atendidos", tipo: TIPOS_DE_PRESENTACION.NUMERO },
];

export const COLUMNAS_DIAGNOSTICOS_MAS_FRECUENTES = [
  { id: "diagnostico", label: "Diagnostico", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "cantidad", label: "Casos", tipo: TIPOS_DE_PRESENTACION.NUMERO },
];

export const COLUMNAS_MEDICAMENTOS_MAS_ENTREGADOS = [
  { id: "medicamento", label: "Medicamento", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "cantidad", label: "Cantidad entregada", tipo: TIPOS_DE_PRESENTACION.NUMERO },
];

// obtenerReporteJornada() no embebe el nombre del perfil junto al conteo, solo el UUID
// (jornada.api.js, personal_participante: [{ usuario_id, total_atenciones }]) -- mostrar un
// nombre en vez del id es trabajo del hook de la pantalla (resolverlo contra la lista de
// jornada_personal que ya trae obtenerJornada(), o pedirlo aparte), no de este descriptor.
export const COLUMNAS_PERSONAL_PARTICIPANTE = [
  { id: "usuario_id", label: "Persona", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "total_atenciones", label: "Atenciones registradas", tipo: TIPOS_DE_PRESENTACION.NUMERO },
];
