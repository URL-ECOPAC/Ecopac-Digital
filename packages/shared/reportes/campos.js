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
import {
  ESTADOS_JORNADA,
  ETIQUETAS_ESTADO_JORNADA,
  ETIQUETAS_NIVEL_ALERTA_VENCIMIENTO,
  NIVELES_ALERTA_VENCIMIENTO,
  opcionesConClave,
} from "../enums.js";
import { AGRUPACIONES_DE_IMPACTO } from "./api.js";
import { ESTADOS_DE_VENCIMIENTO } from "./inventario.api.js";

/**
 * Catalogo de estado de vencimiento (inventario.api.js). VIGENTES/VENCIDOS son los unicos
 * valores con un estado propio -- TODOS es "sin filtrar", no un estado que una fila pueda
 * tener, y por eso no entra en este catalogo.
 *
 * ISSUE #838: las etiquetas eran "Disponible" y "Crítico", prestadas del catalogo de existencias.
 * En la columna del reporte eso no decia de que hablaba -- "Crítico" se lee como poco stock --, y
 * la pregunta que llego fue literalmente "el estado en reportes de inventario, de que es". Ahora
 * dicen "Vigente" y "Vencido", que es lo que la columna mide. El COLOR no cambia: la clave sigue
 * siendo disponible/critico, o sea el verde y el rojo de statusColors.
 */
export const ESTADOS_DE_VENCIMIENTO_REPORTE = [
  { value: ESTADOS_DE_VENCIMIENTO.VIGENTES, clave: "disponible", label: labels.loteVigente },
  { value: ESTADOS_DE_VENCIMIENTO.VENCIDOS, clave: "critico", label: labels.loteVencido },
];

/**
 * El mismo estado, pero indexado por el BOOLEANO que guarda la fila de un lote.
 *
 * POR QUE HACEN FALTA DOS CATALOGOS. El de arriba indexa por el valor del FILTRO, que son las
 * cadenas "vigentes" y "vencidos" de ESTADOS_DE_VENCIMIENTO. La fila de un lote no guarda esas
 * cadenas: guarda un booleano, `vencido`, que calcula obtenerReporteDeInventario()
 * (inventario.api.js) con `!esLoteEntregable(...)`. Apuntar la columna al catalogo del filtro
 * hacia que la busqueda no encontrara nada y que la celda cayera a pintar el valor crudo: la
 * columna "Vencimiento" mostraba las palabras `true` y `false` (issue #840).
 *
 * Es el mismo patron que ESTADOS_DIAGNOSTICO y ESTADOS_DONANTE, que ya resolvieron esto para
 * otras columnas booleanas: `value` es el booleano real, `clave` indexa el color de statusColors
 * y `label` sale de ui-tokens.
 *
 * `icono` es lo que la columna muestra. El usuario pidio un simbolo y no una palabra; el nombre
 * es generico -- cada app lo traduce a su libreria de iconos, igual que hace
 * formato/acciones.js --, y `label` se queda como el texto accesible, porque un simbolo a secas
 * no se puede leer en voz alta ni distinguir solo por color.
 */
export const VENCIMIENTO_DE_LOTE = [
  { value: false, clave: "disponible", label: labels.loteVigente, icono: "si" },
  { value: true, clave: "critico", label: labels.loteVencido, icono: "no" },
];

/**
 * Catalogo de estado_jornada (00001, redefinido por las migraciones de jornadas) para la
 * columna de estado del reporte de resultados de jornada (#215). Los cuatro valores y sus
 * etiquetas ya existen en ui-tokens; este catalogo solo los agrupa en la forma que
 * columnas.js/DataList esperan.
 */
export const ESTADOS_JORNADA_REPORTE = opcionesConClave(ESTADOS_JORNADA, ETIQUETAS_ESTADO_JORNADA);

/**
 * Las metricas de obtenerIndicadoresImpacto(), para el selector de #214.
 *
 * ISSUE #862: faltaba `consultas_realizadas`. api.js la calcula (es una de las columnas de
 * vista_reporte_impacto) y useDashboardMetricas la expone, pero al no estar en esta lista no
 * habia forma de elegirla desde la pantalla. Es ademas la unica que distingue "cuanta gente se
 * atendio" de "cuantas veces se atendio": un paciente con dos consultas cuenta una vez en
 * pacientes_atendidos y dos aqui.
 */
export const OPCIONES_METRICA_IMPACTO = [
  { value: "pacientes_atendidos", label: "Pacientes atendidos" },
  { value: "consultas_realizadas", label: "Consultas realizadas" },
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
    label: "Comparar con otro período",
    tipo: TIPOS_DE_CAMPO.BOOLEANO,
    validacion: { requerido: false },
  },
];

/**
 * Reporte de medicamentos proximos a vencer (#213). Solo el horizonte de dias: es un numero
 * que la persona escribe, no depende de ninguna forma de respuesta de una API.
 *
 * (El comentario anterior decia que la API de este reporte "todavia no existe en este modulo".
 * Existe: vencimientos.api.js, obtenerReporteDeVencimientos. Se corrige en la issue #862, junto
 * con el gemelo de columnas.js, que por lo mismo no declaraba columnas para esta pantalla.)
 */
export const CAMPOS_REPORTE_VENCIMIENTO = [
  {
    id: "horizonteDias",
    label: "Horizonte (días)",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    validacion: { requerido: true, min: 1, max: 365 },
  },
];

/**
 * Metas anuales de la organizacion contra las que el dashboard dibuja su barra de avance.
 *
 * ISSUE #862: estaban escritas como literales sueltos en el JSX de DashboardMetricasPage
 * (meta="3000", meta="50", meta="1500", meta="5000"), sin nombre, sin explicacion y sin forma de
 * cambiarlas salvo editando la pantalla. Son datos de negocio, asi que viven en shared con el
 * resto del vocabulario del dominio.
 *
 * SON VALORES FIJOS, NO CONFIGURACION. Lo correcto seria una tabla de metas por periodo en la
 * base, para que la junta directiva pudiera ajustarlas sin un despliegue; eso pide una migracion
 * y queda anotado como issue aparte. Mientras tanto, al menos se leen en un solo sitio.
 *
 * `consultasRealizadas` no lleva meta a proposito: es una consecuencia de cuantos pacientes se
 * atienden, no un objetivo que la organizacion se fije por separado.
 */
export const METAS_DE_IMPACTO = Object.freeze({
  pacientesAtendidos: 3000,
  comunidadesBeneficiadas: 50,
  tratamientosEntregados: 1500,
  medicamentosUtilizados: 5000,
});

/** Umbrales de alerta, en dias restantes. Los consume calcularAlerta(). */
export const UMBRALES_ALERTA = {
  CRITICO: 7,
  ALTO: 15,
  MEDIO: 30,
};

/**
 * Horizontes que ofrece el filtro.
 *
 * ISSUE #862: usaban `{ valor, etiqueta }`, los dos unicos descriptores del modulo que no seguian
 * el `{ value, label }` del resto. Mientras la pantalla los recorria a mano para pintar <option>
 * daba igual; en cuanto el horizonte pasa a ser un filtro de FilterBar, tiene que hablar el mismo
 * idioma que Selector y que los demas catalogos.
 */
export const HORIZONTES_DISPONIBLES = [
  { value: 7, label: "Próximos 7 días" },
  { value: 15, label: "Próximos 15 días" },
  { value: 30, label: "Próximos 30 días" },
  { value: 60, label: "Próximos 60 días" },
  { value: 90, label: "Próximos 90 días" },
];

/**
 * Catalogo del nivel de alerta de un renglon por vencer, para la columna ESTADO.
 *
 * `value` es lo que calcularAlerta() devuelve, `clave` indexa el color de statusColors y `label`
 * sale de ui-tokens via ETIQUETAS_NIVEL_ALERTA_VENCIMIENTO. Mismo patron que
 * ESTADOS_DE_VENCIMIENTO_REPORTE: la pantalla no vuelve a traducir "critico" a un color ni a una
 * palabra, que es como se habian colado antes dos vocabularios distintos para lo mismo (#700).
 */
export const NIVELES_DE_ALERTA_VENCIMIENTO = opcionesConClave(
  NIVELES_ALERTA_VENCIMIENTO,
  ETIQUETAS_NIVEL_ALERTA_VENCIMIENTO,
);
