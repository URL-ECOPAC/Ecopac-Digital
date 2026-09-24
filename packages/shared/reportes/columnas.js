// Columnas de tabla y campos de tarjeta de las pantallas de reporte (issue #289).
//
// Un array por reporte -- no hay una sola fila que los cuatro compartan -- con los `id`
// exactamente iguales a las claves que cada funcion de reportes/*.api.js ya devuelve. Se
// verifico leyendo las cuatro funciones completas antes de declarar nada: ningun nombre aqui
// esta adivinado.
//
// ISSUE #862: el comentario que estaba aqui decia que no se declaraba COLUMNAS_VENCIMIENTO
// porque "su API (issue #204) todavia no existe". Si existe -vencimientos.api.js,
// obtenerReporteDeVencimientos- y llevaba tiempo existiendo, con 13 casos de prueba, sin que
// ningun hook la llamara. Mientras el comentario siguio ahi, la pestana de medicamentos por
// vencer pinto su tabla a mano, fuera de DataList y fuera de todo descriptor. Las columnas de
// abajo se declaran contra aRenglon() de esa funcion, leida entera: ningun nombre esta adivinado.
//
// `ordenable: true` (tambien #862) es lo que habilita el encabezado pulsable de DataList. Se
// marcan las columnas por las que tiene sentido ordenar -texto y numero- y no las de estado.

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";

/**
 * Indicadores de impacto (api.js, obtenerIndicadoresImpacto). Sirve tanto a los tiles del
 * dashboard (#209) como a la tabla del panel de analisis (#214): `indicadores.totales` tiene
 * las mismas cuatro claves que cada fila de `indicadores.agrupados`, mas `clave`/`etiqueta`
 * cuando hay agrupamiento.
 */
export const COLUMNAS_INDICADORES_IMPACTO = [
  {
    id: "etiqueta",
    label: "Período / grupo",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    principal: true,
    ordenable: true,
  },
  {
    id: "pacientes_atendidos",
    label: "Pacientes atendidos",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
    ordenable: true,
  },
  {
    id: "tratamientos_entregados",
    label: "Tratamientos entregados",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
    ordenable: true,
  },
  {
    id: "medicamentos_utilizados",
    label: "Medicamentos utilizados",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
    ordenable: true,
  },
  {
    id: "comunidades_beneficiadas",
    label: "Comunidades beneficiadas",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
    ordenable: true,
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
  {
    id: "nombre",
    label: "Grupo",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    principal: true,
    ordenable: true,
  },
  {
    id: "pacientes",
    label: "Pacientes atendidos",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
    ordenable: true,
  },
  { id: "nuevos", label: "Nuevos", tipo: TIPOS_DE_PRESENTACION.NUMERO, ordenable: true },
  { id: "recurrentes", label: "Recurrentes", tipo: TIPOS_DE_PRESENTACION.NUMERO, ordenable: true },
  { id: "hombres", label: "Hombres", tipo: TIPOS_DE_PRESENTACION.NUMERO, ordenable: true },
  { id: "mujeres", label: "Mujeres", tipo: TIPOS_DE_PRESENTACION.NUMERO, ordenable: true },
  { id: "menores", label: "Menores de edad", tipo: TIPOS_DE_PRESENTACION.NUMERO, ordenable: true },
  { id: "adultos", label: "Adultos", tipo: TIPOS_DE_PRESENTACION.NUMERO, ordenable: true },
  {
    id: "adultosMayores",
    label: "Adultos mayores",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
    ordenable: true,
  },
];

/**
 * Inventario actual (inventario.api.js, obtenerReporteDeInventario). Una fila por medicamento;
 * `vencido` es un total de unidades, no un estado de la fila -- el estado de vencimiento vive
 * por lote, en CAMPOS_FICHA_LOTE_INVENTARIO.
 */
export const COLUMNAS_INVENTARIO_REPORTE = [
  {
    id: "medicamento",
    label: "Medicamento",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    principal: true,
    ordenable: true,
  },
  {
    id: "concentracion",
    label: "Concentración",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    ordenable: true,
  },
  { id: "presentacion", label: "Presentación", tipo: TIPOS_DE_PRESENTACION.TEXTO, ordenable: true },
  { id: "disponible", label: "Disponible", tipo: TIPOS_DE_PRESENTACION.NUMERO, ordenable: true },
  { id: "vencido", label: "Vencido", tipo: TIPOS_DE_PRESENTACION.NUMERO, ordenable: true },
];

/**
 * Desglose por lote de un medicamento (reporte.medicamentos[].lotes[]).
 *
 * Ninguna columna es `ordenable`: son los pocos lotes de UN medicamento, dentro del modal de
 * detalle, y ya vienen en el orden en que la API los entrega. Un encabezado pulsable sobre tres
 * filas es ruido, no una funcion.
 */
export const CAMPOS_FICHA_LOTE_INVENTARIO = [
  { id: "numeroLote", label: "Lote", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "bodega", label: "Bodega", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "cantidad", label: "Cantidad", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  { id: "fechaVencimiento", label: "Fecha de vencimiento", tipo: TIPOS_DE_PRESENTACION.FECHA },
  {
    // "Estado", a secas, no decia de que estado hablaba (issue #838). Es el del vencimiento del
    // lote, y asi se titula.
    //
    // ISSUE #840: apuntaba a "estadosDeVencimientoReporte", que es el catalogo del FILTRO e
    // indexa por las cadenas "vigentes"/"vencidos". Esta celda guarda un booleano, asi que la
    // busqueda fallaba y la columna mostraba las palabras `true` y `false`. Ahora usa
    // VENCIMIENTO_DE_LOTE, indexado por el booleano de verdad.
    id: "vencido",
    label: "Vencimiento",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    etiquetasDesde: "vencimientoDeLote",
  },
];

/**
 * Desglose del valor del inventario disponible por origen (issue #752, valorizacion.api.js,
 * desglosarValorizacionPorOrigen). `origen` usa el mismo patron de etiquetas que `vencido` en
 * CAMPOS_FICHA_LOTE_INVENTARIO -tipo estado, catalogo aparte- en vez de traducir "compra"/
 * "donacion" a mano en la pantalla.
 */
export const COLUMNAS_VALORIZACION_POR_ORIGEN = [
  {
    id: "origen",
    label: "Origen",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    etiquetasDesde: "origenesDeLote",
    principal: true,
  },
  {
    id: "valorDisponible",
    label: "Valor disponible",
    tipo: TIPOS_DE_PRESENTACION.MONEDA,
    ordenable: true,
  },
  {
    id: "unidadesSinCosto",
    label: "Unidades sin costo conocido",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
    ordenable: true,
  },
  {
    id: "lotesSinCosto",
    label: "Lotes sin costo conocido",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
    ordenable: true,
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
  { id: "nombre", label: "Jornada", tipo: TIPOS_DE_PRESENTACION.TEXTO, ordenable: true },
  { id: "fecha", label: "Fecha", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "comunidad", label: "Comunidad", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    etiquetasDesde: "estadosJornadaReporte",
  },
  { id: "total_consultas", label: "Consultas realizadas", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  {
    id: "pacientes_atendidos",
    label: "Pacientes atendidos",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
    ordenable: true,
  },
];

export const COLUMNAS_DIAGNOSTICOS_MAS_FRECUENTES = [
  {
    id: "diagnostico",
    label: "Diagnóstico",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    principal: true,
    ordenable: true,
  },
  { id: "cantidad", label: "Casos", tipo: TIPOS_DE_PRESENTACION.NUMERO, ordenable: true },
];

export const COLUMNAS_MEDICAMENTOS_MAS_ENTREGADOS = [
  {
    id: "medicamento",
    label: "Medicamento",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    principal: true,
    ordenable: true,
  },
  {
    id: "cantidad",
    label: "Cantidad entregada",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
    ordenable: true,
  },
];

// obtenerReporteJornada() no embebe el nombre del perfil junto al conteo, solo el UUID
// (jornada.api.js, personal_participante: [{ usuario_id, total_atenciones }]) -- mostrar un
// nombre en vez del id es trabajo del hook de la pantalla (resolverlo contra la lista de
// jornada_personal que ya trae obtenerJornada(), o pedirlo aparte), no de este descriptor.
export const COLUMNAS_PERSONAL_PARTICIPANTE = [
  {
    id: "usuario_id",
    label: "Persona",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    principal: true,
    ordenable: true,
  },
  {
    id: "total_atenciones",
    label: "Atenciones registradas",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
    ordenable: true,
  },
];

/**
 * Medicamentos proximos a vencer (vencimientos.api.js, obtenerReporteDeVencimientos). Un renglon
 * por combinacion de lote y bodega -- el mismo grano que `existencias` --, no por medicamento:
 * dos lotes del mismo medicamento vencen en fechas distintas y se dan de baja por separado
 * (RF-19, RF-33).
 *
 * `alerta` no sale de la API: lo calcula calcularAlerta() en el hook, a partir de `diasRestantes`
 * y UMBRALES_ALERTA. Por eso su catalogo es NIVELES_DE_ALERTA_VENCIMIENTO y no el del filtro.
 *
 * `diasRestantes` es negativo cuando el lote ya vencio, y por eso se muestra junto a la fecha en
 * vez de sustituirla: "-12" solo se entiende si al lado esta el dia en que vencio.
 */
export const COLUMNAS_VENCIMIENTO = [
  {
    id: "medicamento",
    label: "Medicamento",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    principal: true,
    ordenable: true,
  },
  {
    id: "concentracion",
    label: "Concentración",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    ordenable: true,
  },
  { id: "numeroLote", label: "Lote", tipo: TIPOS_DE_PRESENTACION.TEXTO, ordenable: true },
  { id: "bodega", label: "Bodega", tipo: TIPOS_DE_PRESENTACION.TEXTO, ordenable: true },
  { id: "cantidad", label: "Cantidad", tipo: TIPOS_DE_PRESENTACION.NUMERO, ordenable: true },
  {
    id: "fechaVencimiento",
    label: "Vence",
    tipo: TIPOS_DE_PRESENTACION.FECHA,
    ordenable: true,
  },
  {
    id: "diasRestantes",
    label: "Días restantes",
    tipo: TIPOS_DE_PRESENTACION.NUMERO,
    ordenable: true,
  },
  {
    id: "alerta",
    label: "Alerta",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    etiquetasDesde: "nivelesDeAlerta",
  },
];
