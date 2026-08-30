// Campos de configuracion de las pantallas de reporte (issue #289).
//
// reportes/ no tiene una entidad que "registrar" como pacientes o gastos: son cuatro reportes
// agregados (indicadores de impacto, pacientes atendidos, inventario, resultados de jornada),
// cada uno con su propia forma de dato. Lo que va aqui son los controles reales de
// configuracion/analisis que las pantallas exponen, no un formulario de alta.
//
// Los catalogos de estado siguen el patron de usuarios/campos.js (ESTADOS_USUARIO): un `value`
// que coincide con lo que la API devuelve, una `clave` para indexar statusColors, y un `label`
// que sale de @ecopac/ui-tokens -- nunca un texto suelto -- para que la columna ESTADO
// correspondiente en columnas.js resuelva ambas cosas por el mismo catalogo.

import { labels } from "@ecopac/ui-tokens";
import { TIPOS_DE_CAMPO } from "../descriptores.js";
import { ESTADOS_JORNADA, ETIQUETAS_ESTADO_JORNADA, opcionesConClave } from "../enums.js";
import { AGRUPACIONES_DE_IMPACTO } from "./api.js";
import { ESTADOS_DE_VENCIMIENTO } from "./inventario.api.js";

/**
 * Catalogo de estado de vencimiento (inventario.api.js). VIGENTES/VENCIDOS son los unicos
 * valores con un estado propio -- TODOS es "sin filtrar", no un estado que una fila pueda
 * tener, y por eso no entra en este catalogo. Reutiliza las etiquetas de disponible/critico
 * que ya existen en ui-tokens: son las mismas dos ideas (una unidad se puede usar o no).
 */
export const ESTADOS_DE_VENCIMIENTO_REPORTE = [
  { value: ESTADOS_DE_VENCIMIENTO.VIGENTES, clave: "disponible", label: labels.disponible },
  { value: ESTADOS_DE_VENCIMIENTO.VENCIDOS, clave: "critico", label: labels.critico },
];

/**
 * Catalogo de estado_jornada (00001, redefinido por las migraciones de jornadas) para la
 * columna de estado del reporte de resultados de jornada (#215). Los cuatro valores y sus
 * etiquetas ya existen en ui-tokens; este catalogo solo los agrupa en la forma que
 * columnas.js/DataList esperan.
 */
export const ESTADOS_JORNADA_REPORTE = opcionesConClave(
  ESTADOS_JORNADA,
  ETIQUETAS_ESTADO_JORNADA,
);

/** Las cuatro metricas de obtenerIndicadoresImpacto(), para el selector de #214. */
export const OPCIONES_METRICA_IMPACTO = [
  { value: "pacientes_atendidos", label: "Pacientes atendidos" },
  { value: "tratamientos_entregados", label: "Tratamientos entregados" },
  { value: "medicamentos_utilizados", label: "Medicamentos utilizados" },
  { value: "comunidades_beneficiadas", label: "Comunidades beneficiadas" },
];

/** Deriva de AGRUPACIONES_DE_IMPACTO (api.js) en vez de repetir los valores del enum. */
export const OPCIONES_AGRUPACION_IMPACTO = [
  { value: AGRUPACIONES_DE_IMPACTO.MES, label: "Mes" },
  { value: AGRUPACIONES_DE_IMPACTO.COMUNIDAD, label: "Comunidad" },
  { value: AGRUPACIONES_DE_IMPACTO.JORNADA, label: "Jornada" },
  { value: AGRUPACIONES_DE_IMPACTO.PROYECTO, label: "Proyecto" },
];

/**
 * Panel de analisis de impacto (#214): elegir metrica, agrupamiento, y si se compara contra
 * otro periodo. El periodo mismo no es un campo de este formulario: es el filtro `periodo` de
 * filtros.js, compartido con el resto de reportes.
 */
export const CAMPOS_ANALISIS_IMPACTO = [
  {
    id: "metrica",
    label: "Metrica",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_METRICA_IMPACTO,
    validacion: { requerido: true },
  },
  {
    id: "agruparPor",
    label: "Agrupar por",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_AGRUPACION_IMPACTO,
    validacion: { requerido: false },
  },
  {
    id: "comparar",
    label: "Comparar con otro periodo",
    tipo: TIPOS_DE_CAMPO.BOOLEANO,
    validacion: { requerido: false },
  },
];

/**
 * Reporte de medicamentos proximos a vencer (#213). Solo el horizonte de dias: es un numero
 * que la persona escribe, no depende de ninguna forma de respuesta de una API. La API de ese
 * reporte (issue #204, RF-33) todavia no existe en este modulo -- ver columnas.js para el
 * detalle de por que no se declaran columnas para esa pantalla todavia.
 */
export const CAMPOS_REPORTE_VENCIMIENTO = [
  {
    id: "horizonteDias",
    label: "Horizonte (dias)",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    validacion: { requerido: true, min: 1, max: 365 },
  },
];
