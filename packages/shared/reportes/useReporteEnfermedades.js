// View model del reporte de enfermedades (issue #916).
//
// Cuatro vistas sobre la misma funcion de la base (fn_reporte_enfermedades, 00177): las mas
// frecuentes, la comparacion entre jornadas, la comparacion entre comunidades y la evolucion de una
// enfermedad. El hook solo orquesta: la consulta vive en enfermedades.api.js y la forma de cada
// vista en enfermedades.js.
//
// LOS SELECTORES. Jornadas, proyectos y diagnosticos salen de fn_opciones_reporte_enfermedades y
// no de listarJornadas()/listarProyectos(): los roles consultivos -los que mas usan Reportes- no
// leen esas tablas, y sus selectores saldrian vacios. El territorio si se lee directo
// (territorio/api.js), porque departamentos, municipios y comunidades estan abiertos a toda sesion.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { formatearFechaCorta } from "../formato/fechas.js";
import { useCambiosEnTiempoReal } from "../hooks/useCambiosEnTiempoReal.js";
import { listarComunidades, listarDepartamentos, listarMunicipios } from "../territorio/api.js";
import {
  CONTEO_DE_DIAGNOSTICOS,
  OPCIONES_DE_COMUNIDAD_DE,
  OPCIONES_DE_CONTEO_DE_DIAGNOSTICOS,
  OPCIONES_DE_VISTA_ENFERMEDADES,
} from "./campos.js";
import {
  COLUMNAS_EVOLUCION_ENFERMEDAD,
  COLUMNAS_RANKING_ENFERMEDADES,
  columnasDeComparacionDeEnfermedades,
} from "./columnas.js";
import {
  diagnosticoMasFrecuente,
  filasDeRankingDeEnfermedades,
  graficaDeRankingDeEnfermedades,
  pivotearComparacionDeEnfermedades,
  serieDeEvolucionDeEnfermedad,
} from "./enfermedades.js";
import {
  CIFRA_PROTEGIDA,
  COMUNIDAD_DE,
  obtenerOpcionesReporteEnfermedades,
  obtenerReporteEnfermedades,
  puedeVerReporteDeEnfermedades,
  UMBRAL_DE_CONTEO,
  VISTAS_DE_ENFERMEDADES,
} from "./enfermedades.api.js";
import { FILTROS_ENFERMEDADES, FILTROS_ENFERMEDADES_VACIOS } from "./filtros.js";
import {
  OPCIONES_DE_PRESET,
  PRESETS_DE_RANGO,
  RETARDO_DE_FILTROS_MS,
  resolverRangoDePreset,
} from "./useFiltrosReportes.js";
import { useOrdenYPagina } from "./useOrdenYPagina.js";

/** El rotulo de una opcion por su valor. */
function rotuloDe(opciones, valor) {
  const opcion = opciones.find((entrada) => entrada.value === valor);
  return opcion?.rotulo ?? opcion?.label ?? "";
}

/**
 * Los catalogos de los selectores, con la cascada del territorio ya resuelta: si hay departamento
 * elegido, solo sus municipios; si hay municipio, solo sus comunidades.
 *
 * Pura: se exporta para probarla sin montar el hook.
 *
 * @param {{ departamentos: object[], municipios: object[], comunidades: object[], jornadas: object[], proyectos: object[], diagnosticos: object[] }} fuentes
 * @param {{ departamento?: string|number|null, municipio?: string|number|null }} valores
 * @returns {Record<string, Array<{ value: string, label: string }>>}
 */
export function catalogosDeEnfermedades(fuentes, valores = {}) {
  const departamento = valores.departamento ? String(valores.departamento) : null;
  const municipio = valores.municipio ? String(valores.municipio) : null;

  const municipios = fuentes.municipios.filter(
    (fila) => !departamento || String(fila.departamentoId) === departamento,
  );
  const idsDeMunicipios = new Set(municipios.map((fila) => String(fila.id)));
  const comunidades = fuentes.comunidades.filter((fila) => {
    if (municipio) return String(fila.municipioId) === municipio;
    if (departamento) return idsDeMunicipios.has(String(fila.municipioId));
    return true;
  });

  return {
    departamentos: fuentes.departamentos.map((fila) => ({
      value: String(fila.id),
      label: fila.nombre,
    })),
    municipios: municipios.map((fila) => ({ value: String(fila.id), label: fila.nombre })),
    comunidades: comunidades.map((fila) => ({ value: fila.id, label: fila.nombre })),
    jornadas: fuentes.jornadas.map((fila) => ({
      value: fila.id,
      label: `${fila.nombre} (${formatearFechaCorta(fila.fecha)})`,
    })),
    proyectos: fuentes.proyectos.map((fila) => ({ value: fila.id, label: fila.nombre })),
    diagnosticos: fuentes.diagnosticos.map((fila) => ({
      value: fila.id,
      label: fila.codigo ? `${fila.nombre} (${fila.codigo})` : fila.nombre,
    })),
  };
}

/**
 * Los parametros de obtenerReporteEnfermedades() para una vista y unos filtros. Pura.
 *
 * En las vistas de comparacion, lo elegido para comparar manda sobre el filtro de una sola
 * jornada o comunidad; sin nada elegido se comparan todas las del recorte.
 *
 * @param {object} estado
 * @returns {object}
 */
export function parametrosDeReporteEnfermedades({
  vista,
  filtros,
  comunidadDe,
  conteo,
  jornadasAComparar = [],
  comunidadesAComparar = [],
}) {
  const unaJornada = filtros.jornada ? [filtros.jornada] : [];
  const unaComunidad = filtros.comunidad ? [filtros.comunidad] : [];

  return {
    vista,
    desde: filtros.periodo?.min || undefined,
    hasta: filtros.periodo?.max || undefined,
    jornadas:
      vista === VISTAS_DE_ENFERMEDADES.JORNADAS && jornadasAComparar.length > 0
        ? jornadasAComparar
        : unaJornada,
    comunidades:
      vista === VISTAS_DE_ENFERMEDADES.COMUNIDADES && comunidadesAComparar.length > 0
        ? comunidadesAComparar
        : unaComunidad,
    municipio: filtros.municipio || undefined,
    departamento: filtros.departamento || undefined,
    proyecto: filtros.proyecto || undefined,
    soloPrincipales: conteo !== CONTEO_DE_DIAGNOSTICOS.TODOS,
    comunidadDe,
  };
}

/**
 * Reporte de enfermedades.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de quien consulta.
 * @param {number} [opciones.retardoMs] Espera antes de aplicar los filtros; se baja en pruebas.
 * @returns {object} Con: tieneAcceso, cargando, error, recargar, vista, setVista, opcionesDeVista, comunidadDe, setComunidadDe, opcionesDeComunidadDe, rotuloDeComunidad, conteo, setConteo, opcionesDeConteo, rotuloDeConteo, definicionDeFiltros, valores, setFiltro, limpiarFiltros, hayFiltros, presets, presetActivo, setPreset, catalogos, errorDeCatalogos, jornadasAComparar, setJornadasAComparar, comunidadesAComparar, setComunidadesAComparar, diagnosticoEvolucion, setDiagnosticoEvolucion, nombreDeEnfermedad, columnas, filas, filasCompletas, total, orden, alternarOrden, numeroDePagina, totalPaginas, irAPagina, grafica, gruposFueraDeGrafica, haySuprimidos, umbral, cifraProtegida.
 */
export function useReporteEnfermedades({ rol, retardoMs = RETARDO_DE_FILTROS_MS } = {}) {
  const tieneAcceso = puedeVerReporteDeEnfermedades(rol);

  const [vista, setVista] = useState(VISTAS_DE_ENFERMEDADES.RANKING);
  const [comunidadDe, setComunidadDe] = useState(COMUNIDAD_DE.JORNADA);
  const [conteo, setConteo] = useState(CONTEO_DE_DIAGNOSTICOS.PRINCIPALES);
  const [jornadasAComparar, setJornadasAComparar] = useState([]);
  const [comunidadesAComparar, setComunidadesAComparar] = useState([]);
  const [diagnosticoElegido, setDiagnosticoEvolucion] = useState(null);

  // Borrador que ata FilterBar y copia aplicada tras el retardo, como useFiltrosReportes.
  const [valores, setValores] = useState(FILTROS_ENFERMEDADES_VACIOS);
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_ENFERMEDADES_VACIOS);
  const [presetActivo, setPresetActivo] = useState(null);
  const temporizador = useRef(null);

  const [fuentes, setFuentes] = useState({
    departamentos: [],
    municipios: [],
    comunidades: [],
    jornadas: [],
    proyectos: [],
    diagnosticos: [],
  });
  const [errorDeCatalogos, setErrorDeCatalogos] = useState(null);

  const [casos, setCasos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // La cascada del territorio: cambiar el nivel de arriba vacia los de abajo, que podrian ya no
  // pertenecerle.
  const setFiltro = useCallback((id, valor) => {
    setValores((actuales) => {
      const siguientes = { ...actuales, [id]: valor };
      if (id === "departamento") {
        siguientes.municipio = null;
        siguientes.comunidad = null;
      }
      if (id === "municipio") siguientes.comunidad = null;
      return siguientes;
    });
    if (id === "periodo") setPresetActivo(PRESETS_DE_RANGO.PERSONALIZADO);
  }, []);

  const setPreset = useCallback((preset, hoy = new Date()) => {
    setValores((actuales) => ({ ...actuales, periodo: resolverRangoDePreset(preset, hoy) }));
    setPresetActivo(preset);
  }, []);

  const limpiarFiltros = useCallback(() => {
    setValores(FILTROS_ENFERMEDADES_VACIOS);
    setPresetActivo(null);
  }, []);

  const claveDeValores = JSON.stringify(valores);
  useEffect(() => {
    temporizador.current = setTimeout(() => setFiltrosAplicados(valores), retardoMs);
    return () => clearTimeout(temporizador.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveDeValores, retardoMs]);

  useEffect(() => {
    if (!tieneAcceso) return undefined;
    let cancelado = false;

    async function cargarCatalogos() {
      const [
        { departamentos, error: errorDeDepartamentos },
        { municipios, error: errorDeMunicipios },
        { comunidades, error: errorDeComunidades },
        { opciones, error: errorDeOpciones },
      ] = await Promise.all([
        listarDepartamentos(),
        listarMunicipios(),
        listarComunidades(),
        obtenerOpcionesReporteEnfermedades({ rol }),
      ]);

      if (cancelado) return;

      setErrorDeCatalogos(
        errorDeDepartamentos ?? errorDeMunicipios ?? errorDeComunidades ?? errorDeOpciones,
      );
      setFuentes({
        departamentos,
        municipios,
        comunidades,
        jornadas: opciones.jornadas,
        proyectos: opciones.proyectos,
        diagnosticos: opciones.diagnosticos,
      });
    }

    cargarCatalogos();
    return () => {
      cancelado = true;
    };
  }, [tieneAcceso, rol]);

  const parametros = useMemo(
    () =>
      parametrosDeReporteEnfermedades({
        vista,
        filtros: filtrosAplicados,
        comunidadDe,
        conteo,
        jornadasAComparar,
        comunidadesAComparar,
      }),
    [vista, filtrosAplicados, comunidadDe, conteo, jornadasAComparar, comunidadesAComparar],
  );

  const cargar = useCallback(async () => {
    if (!tieneAcceso) {
      setCasos([]);
      setError(null);
      setCargando(false);
      return;
    }

    setCargando(true);
    const { casos: filas, error: fallo } = await obtenerReporteEnfermedades({ rol, ...parametros });

    if (fallo) {
      setError(fallo);
      setCasos([]);
    } else {
      setError(null);
      setCasos(filas);
    }
    setCargando(false);
  }, [tieneAcceso, rol, parametros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Solo `consultas` esta en la publicacion de tiempo real (00163); un diagnostico nuevo llega
  // siempre con la consulta que lo acompana.
  useCambiosEnTiempoReal(["consultas"], cargar);

  // En la evolucion, sin enfermedad elegida se muestra la mas frecuente del recorte.
  const diagnosticoEvolucion = diagnosticoElegido ?? diagnosticoMasFrecuente(casos);

  const forma = useMemo(() => {
    switch (vista) {
      case VISTAS_DE_ENFERMEDADES.JORNADAS:
      case VISTAS_DE_ENFERMEDADES.COMUNIDADES: {
        const pivote = pivotearComparacionDeEnfermedades(casos);
        return {
          columnas: columnasDeComparacionDeEnfermedades(pivote.grupos),
          filas: pivote.filas,
          grafica: { tipo: "barras", ...pivote.grafica },
          gruposFueraDeGrafica: pivote.gruposFueraDeGrafica,
        };
      }
      case VISTAS_DE_ENFERMEDADES.EVOLUCION: {
        const serie = serieDeEvolucionDeEnfermedad(casos, diagnosticoEvolucion, {
          desde: filtrosAplicados.periodo?.min,
          hasta: filtrosAplicados.periodo?.max,
        });
        return {
          columnas: COLUMNAS_EVOLUCION_ENFERMEDAD,
          filas: serie.filas,
          grafica: { tipo: "lineas", ...serie.grafica },
          gruposFueraDeGrafica: 0,
        };
      }
      default:
        return {
          columnas: COLUMNAS_RANKING_ENFERMEDADES,
          filas: filasDeRankingDeEnfermedades(casos),
          grafica: { tipo: "barras", ...graficaDeRankingDeEnfermedades(casos) },
          gruposFueraDeGrafica: 0,
        };
    }
  }, [vista, casos, diagnosticoEvolucion, filtrosAplicados]);

  const { pagina, orden, alternarOrden, numeroDePagina, totalPaginas, irAPagina, total } =
    useOrdenYPagina(forma.filas, { columnas: forma.columnas });

  const catalogos = useMemo(() => catalogosDeEnfermedades(fuentes, valores), [fuentes, valores]);

  const hayFiltros = useMemo(
    () =>
      Boolean(
        valores.periodo?.min ||
        valores.periodo?.max ||
        valores.departamento ||
        valores.municipio ||
        valores.comunidad ||
        valores.proyecto ||
        valores.jornada,
      ),
    [valores],
  );

  const nombreDeEnfermedad =
    fuentes.diagnosticos.find((fila) => fila.id === diagnosticoEvolucion)?.nombre ??
    casos.find((caso) => caso.diagnosticoId === diagnosticoEvolucion)?.diagnostico ??
    null;

  return {
    tieneAcceso,
    cargando,
    error,
    recargar: cargar,

    vista,
    setVista,
    opcionesDeVista: OPCIONES_DE_VISTA_ENFERMEDADES,
    comunidadDe,
    setComunidadDe,
    opcionesDeComunidadDe: OPCIONES_DE_COMUNIDAD_DE,
    rotuloDeComunidad: rotuloDe(OPCIONES_DE_COMUNIDAD_DE, comunidadDe),
    conteo,
    setConteo,
    opcionesDeConteo: OPCIONES_DE_CONTEO_DE_DIAGNOSTICOS,
    rotuloDeConteo: rotuloDe(OPCIONES_DE_CONTEO_DE_DIAGNOSTICOS, conteo),

    definicionDeFiltros: FILTROS_ENFERMEDADES,
    valores,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    presets: OPCIONES_DE_PRESET,
    presetActivo,
    setPreset,
    catalogos,
    errorDeCatalogos,

    jornadasAComparar,
    setJornadasAComparar,
    comunidadesAComparar,
    setComunidadesAComparar,
    diagnosticoEvolucion,
    setDiagnosticoEvolucion,
    nombreDeEnfermedad,

    columnas: forma.columnas,
    filas: pagina,
    filasCompletas: forma.filas,
    total,
    orden,
    alternarOrden,
    numeroDePagina,
    totalPaginas,
    irAPagina,
    grafica: forma.grafica,
    gruposFueraDeGrafica: forma.gruposFueraDeGrafica,
    haySuprimidos: forma.filas.some((fila) => Object.values(fila).includes(CIFRA_PROTEGIDA)),
    umbral: UMBRAL_DE_CONTEO,
    cifraProtegida: CIFRA_PROTEGIDA,
  };
}
