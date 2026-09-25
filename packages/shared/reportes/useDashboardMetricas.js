// View model del panel de indicadores de impacto (issues #205 / #214, reconectado por #693).
//
// QUE PASO AQUI. Este hook consultaba `vista_reporte_impacto` por su cuenta con
// obtenerSupabase() y agregaba las filas a mano, en paralelo a obtenerIndicadoresImpacto()
// (api.js), que hace lo mismo, esta probada y no la llamaba nadie. Las dos versiones no
// calculaban igual: la de api.js ignora los `comunidad_id` nulos al contar comunidades
// beneficiadas y esta no, y api.js comprueba el rol antes de consultar y esta tampoco.
//
// Ahora el hook solo orquesta y adapta: la consulta, la agregacion, la comparacion entre
// periodos y la guarda de rol viven en obtenerIndicadoresImpacto(). Es la regla de
// docs/ARQUITECTURA-FRONTEND.md.
//
// SE CONSERVA EL CONTRATO DE SALIDA. DashboardMetricasPage lee `indicadores.pacientesAtendidos`
// en camelCase y `seriePrincipal[].valor`, mientras que la API devuelve las claves de la vista en
// snake_case (`totales.pacientes_atendidos`) y `agrupados[]`. La traduccion se hace aqui, en el
// hook, y no cambiando la pantalla ni la API: cada lado conserva el vocabulario que le toca.
//
// LA COMPARACION SIGUE SIENDO ENTRE COMUNIDADES, no entre periodos. Es lo que ofrecia la
// pantalla y lo que la #214 pedia; obtenerIndicadoresImpacto acepta `comunidad`, asi que la
// segunda serie es una segunda llamada con esa comunidad fijada.

import { useCallback, useEffect, useMemo, useState } from "react";

import { aCadenaFechaLocal } from "../formato/fechas.js";
import { listarComunidades } from "../territorio/api.js";
import { AGRUPACIONES_DE_IMPACTO, obtenerIndicadoresImpacto } from "./api.js";
import { OPCIONES_METRICA_IMPACTO } from "./campos.js";
import { puedeVerIndicadoresDeImpacto } from "./permisos.js";

// ISSUE #862: los dos usaban { valor, etiqueta }, distinto del { value, label } que hablan
// Selector, FilterBar y el resto de catalogos del sistema. Mientras la pantalla los recorria a
// mano para pintar <option> daba igual; en cuanto pasan por un componente del catalogo, tienen
// que hablar su idioma.
const RANGOS = [
  { value: "semana", label: "Última semana" },
  { value: "mes", label: "Último mes" },
  { value: "3meses", label: "Últimos 3 meses" },
  { value: "anio", label: "Último año" },
  { value: "personalizado", label: "Personalizado" },
];

const AGRUPAMIENTOS = [
  { value: AGRUPACIONES_DE_IMPACTO.MES, label: "Por mes" },
  { value: AGRUPACIONES_DE_IMPACTO.COMUNIDAD, label: "Por comunidad" },
  { value: AGRUPACIONES_DE_IMPACTO.JORNADA, label: "Por jornada" },
  { value: AGRUPACIONES_DE_IMPACTO.PROYECTO, label: "Por proyecto" },
];

// Centinelas de la interfaz: significan "sin filtro" y nunca viajan a la base.
const TODAS = "__todas__";
const NINGUNA = "__ninguna__";

/** Traduce el rango elegido en la interfaz al `{ fechaInicio, fechaFin }` que espera la API. */
export function resolverRangoDeDashboard(rango, { fechaInicio, fechaFin } = {}, hoy = new Date()) {
  if (rango === "personalizado") {
    return { fechaInicio: fechaInicio || undefined, fechaFin: fechaFin || undefined };
  }

  // Clona hoy en vez de aFechaLocal(hoy) -que devolveria la MISMA referencia para un Date de
  // entrada- porque a continuacion se muta con setDate/setMonth/setFullYear: mutar hoy
  // directamente correria la fecha de quien llama.
  // eslint-disable-next-line no-restricted-syntax -- clona para mutar sin afectar el parametro
  const desde = new Date(hoy);
  if (rango === "semana") desde.setDate(hoy.getDate() - 7);
  else if (rango === "mes") desde.setMonth(hoy.getMonth() - 1);
  else if (rango === "3meses") desde.setMonth(hoy.getMonth() - 3);
  else if (rango === "anio") desde.setFullYear(hoy.getFullYear() - 1);

  return { fechaInicio: aCadenaFechaLocal(desde), fechaFin: aCadenaFechaLocal(hoy) };
}

/** Las claves de la vista van en snake_case; la pantalla las lee en camelCase. */
function aIndicadoresDePantalla(totales) {
  return {
    pacientesAtendidos: totales?.pacientes_atendidos ?? 0,
    consultasRealizadas: totales?.consultas_realizadas ?? 0,
    tratamientosEntregados: totales?.tratamientos_entregados ?? 0,
    medicamentosUtilizados: totales?.medicamentos_utilizados ?? 0,
    comunidadesBeneficiadas: totales?.comunidades_beneficiadas ?? 0,
  };
}

/** Una serie de barras `{ etiqueta, valor }` a partir de los grupos y la metrica elegida. */
function aSerie(agrupados = [], metrica) {
  return agrupados.map((grupo) => ({
    etiqueta: grupo.etiqueta ?? grupo.clave,
    valor: Number(grupo[metrica] ?? 0),
  }));
}

/**
 * Variacion porcentual entre dos periodos, con dos decimales.
 *
 * @param {number} actual
 * @param {number} anterior
 * @returns {number} `100` si antes era cero y ahora no, `0` si los dos son cero.
 */
export function calcularVariacion(actual, anterior) {
  if (!anterior) return actual > 0 ? 100 : 0;
  return Number((((actual - anterior) / anterior) * 100).toFixed(2));
}

/**
 * Panel de indicadores de impacto: rango de fechas, agrupamiento y metricas elegidas.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de la sesion; sin acceso no se consulta nada.
 * @returns {object} `{ tieneAcceso, rangosDisponibles, agrupamientosDisponibles,
 *   metricasDisponibles, rangoSeleccionado, fechaInicio, ... }`, cada filtro con su setter.
 */
export function useDashboardMetricas({ rol } = {}) {
  const tieneAcceso = puedeVerIndicadoresDeImpacto(rol);

  const [rangoSeleccionado, setRangoSeleccionado] = useState("mes");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [agruparPor, setAgruparPor] = useState(AGRUPACIONES_DE_IMPACTO.MES);
  const [metrica, setMetrica] = useState(OPCIONES_METRICA_IMPACTO[0].value);
  const [comunidadId, setComunidadId] = useState(TODAS);

  const [modoComparacion, setModoComparacion] = useState(false);
  const [comunidadCompararId, setComunidadCompararId] = useState(NINGUNA);

  const [listaComunidades, setListaComunidades] = useState([]);
  const [datos, setDatos] = useState(null);
  const [datosComparacion, setDatosComparacion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const periodo = useMemo(
    () => resolverRangoDeDashboard(rangoSeleccionado, { fechaInicio, fechaFin }),
    [rangoSeleccionado, fechaInicio, fechaFin],
  );

  const cargar = useCallback(async () => {
    if (!tieneAcceso) {
      setDatos(null);
      setDatosComparacion(null);
      setCargando(false);
      return;
    }

    setCargando(true);

    const comunidad = comunidadId === TODAS ? undefined : comunidadId;
    const comparar =
      modoComparacion && comunidadCompararId !== NINGUNA ? comunidadCompararId : null;

    const [principal, comparacion] = await Promise.all([
      obtenerIndicadoresImpacto({ rol, periodo, agruparPor, comunidad }),
      comparar
        ? obtenerIndicadoresImpacto({ rol, periodo, agruparPor, comunidad: comparar })
        : Promise.resolve({ indicadores: null, error: null }),
    ]);

    if (principal.error) {
      setError(principal.error);
      setDatos(null);
      setDatosComparacion(null);
    } else {
      setError(null);
      setDatos(principal.indicadores);
      setDatosComparacion(comparacion.error ? null : comparacion.indicadores);
    }

    setCargando(false);
  }, [tieneAcceso, rol, periodo, agruparPor, comunidadId, modoComparacion, comunidadCompararId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!tieneAcceso) return;

    let vigente = true;
    listarComunidades().then(({ comunidades }) => {
      if (vigente) setListaComunidades(comunidades ?? []);
    });

    return () => {
      vigente = false;
    };
  }, [tieneAcceso]);

  return {
    tieneAcceso,

    // Opciones
    rangosDisponibles: RANGOS,
    agrupamientosDisponibles: AGRUPAMIENTOS,
    metricasDisponibles: OPCIONES_METRICA_IMPACTO,
    valoresEspeciales: { TODAS, NINGUNA },

    // Filtros
    rangoSeleccionado,
    setRangoSeleccionado,
    fechaInicio,
    setFechaInicio,
    fechaFin,
    setFechaFin,
    agruparPor,
    setAgruparPor,
    metrica,
    setMetrica,
    comunidadId,
    setComunidadId,

    // Comparacion
    modoComparacion,
    // ISSUE #862: apagar la comparacion deja tambien el selector sin eleccion. Antes solo se
    // apagaba el modo y la comunidad elegida seguia ahi: al volver a activarlo reaparecia una
    // seleccion que nadie habia vuelto a hacer, y mientras estaba apagado el combo mostraba un
    // nombre que no se estaba comparando con nada.
    setModoComparacion: (activo) => {
      setModoComparacion(activo);
      if (!activo) setComunidadCompararId(NINGUNA);
    },
    comunidadCompararId,
    setComunidadCompararId,

    listaComunidades,

    // Resultados
    cargando,
    error,
    indicadores: aIndicadoresDePantalla(datos?.totales),
    seriePrincipal: aSerie(datos?.agrupados, metrica),
    serieComparacion: aSerie(datosComparacion?.agrupados, metrica) || [], // Asegura arreglo
    calcularVariacion,
    recargar: cargar,
  };
}
