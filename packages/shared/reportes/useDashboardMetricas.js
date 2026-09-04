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

import { listarComunidades } from "../territorio/api.js";
import { AGRUPACIONES_DE_IMPACTO, obtenerIndicadoresImpacto } from "./api.js";
import { OPCIONES_METRICA_IMPACTO } from "./campos.js";
import { puedeVerIndicadoresDeImpacto } from "./permisos.js";

const RANGOS = [
  { valor: "semana", etiqueta: "Ultima semana" },
  { valor: "mes", etiqueta: "Ultimo mes" },
  { valor: "3meses", etiqueta: "Ultimos 3 meses" },
  { valor: "anio", etiqueta: "Ultimo anio" },
  { valor: "personalizado", etiqueta: "Personalizado" },
];

const AGRUPAMIENTOS = [
  { valor: AGRUPACIONES_DE_IMPACTO.MES, etiqueta: "Por mes" },
  { valor: AGRUPACIONES_DE_IMPACTO.COMUNIDAD, etiqueta: "Por comunidad" },
  { valor: AGRUPACIONES_DE_IMPACTO.JORNADA, etiqueta: "Por jornada" },
  { valor: AGRUPACIONES_DE_IMPACTO.PROYECTO, etiqueta: "Por proyecto" },
];

// Centinelas de la interfaz: significan "sin filtro" y nunca viajan a la base.
const TODAS = "__todas__";
const NINGUNA = "__ninguna__";

/** "YYYY-MM-DD" a partir de los componentes locales, sin pasar por UTC (que desplaza un dia). */
function aCadenaFecha(fecha) {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Traduce el rango elegido en la interfaz al `{ fechaInicio, fechaFin }` que espera la API. */
export function resolverRangoDeDashboard(rango, { fechaInicio, fechaFin } = {}, hoy = new Date()) {
  if (rango === "personalizado") {
    return { fechaInicio: fechaInicio || undefined, fechaFin: fechaFin || undefined };
  }

  const desde = new Date(hoy);
  if (rango === "semana") desde.setDate(hoy.getDate() - 7);
  else if (rango === "mes") desde.setMonth(hoy.getMonth() - 1);
  else if (rango === "3meses") desde.setMonth(hoy.getMonth() - 3);
  else if (rango === "anio") desde.setFullYear(hoy.getFullYear() - 1);

  return { fechaInicio: aCadenaFecha(desde), fechaFin: aCadenaFecha(hoy) };
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

export function calcularVariacion(actual, anterior) {
  if (!anterior) return actual > 0 ? 100 : 0;
  return Number((((actual - anterior) / anterior) * 100).toFixed(2));
}

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
    setModoComparacion,
    comunidadCompararId,
    setComunidadCompararId,

    listaComunidades,

    // Resultados
    cargando,
    error,
    indicadores: aIndicadoresDePantalla(datos?.totales),
    seriePrincipal: aSerie(datos?.agrupados, metrica),
    serieComparacion: aSerie(datosComparacion?.agrupados, metrica),
    calcularVariacion,
    recargar: cargar,
  };
}
