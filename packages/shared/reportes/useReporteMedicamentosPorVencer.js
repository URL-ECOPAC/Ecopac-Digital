import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { listarBodegas } from "../inventario/bodegas.api.js";
import { listarMedicamentos } from "../inventario/medicamentos.api.js";
import { NIVELES_ALERTA_VENCIMIENTO } from "../enums.js";
import { COLUMNAS_VENCIMIENTO } from "./columnas.js";
import {
  ESTADOS_DE_VENCIMIENTO_REPORTE,
  NIVELES_DE_ALERTA_VENCIMIENTO,
  UMBRALES_ALERTA,
} from "./campos.js";
import { FILTROS_VENCIMIENTOS, FILTROS_VENCIMIENTOS_VACIOS } from "./filtros.js";
import { puedeVerReporteDeVencimientos } from "./permisos.js";
import { RETARDO_DE_FILTROS_MS } from "./useFiltrosReportes.js";
import { useOrdenYPagina } from "./useOrdenYPagina.js";
import { obtenerReporteDeVencimientos } from "./vencimientos.api.js";

// Reporte de medicamentos proximos a vencer (#213, RF-33).
//
// ISSUE #862, TRES CORRECCIONES DE FONDO:
//
// 1. LLAMABA A LA FUNCION EQUIVOCADA. Usaba listarLotesPorVencer() de api.js, que consulta
//    `lotes` con un `await` directo, SIN obtenerTodasLasFilas(). Pasadas las 1000 filas de
//    max_rows, PostgREST corta la respuesta sin error y totalUnidadesEnRiesgo -que se suma en
//    JavaScript sobre esas filas- empieza a mentir en silencio. Es el bug #773, que las otras
//    tres APIs del modulo ya habian corregido. Ahora llama a obtenerReporteDeVencimientos()
//    (vencimientos.api.js), que si pagina, filtra por estado y por medicamento, y tiene 13 casos
//    de prueba. Esa funcion existia y no la llamaba nadie.
//
// 2. LEIA CAMPOS QUE LA API NUNCA DEVOLVIA. aFilasPantalla() tomaba lote.bodega_id,
//    lote.comunidad_id y lote.comunidad. listarLotesPorVencer no devuelve ninguno de los tres, y
//    como las claves de sobre de este modulo no son uniformes, equivocarse no lanza nada: las
//    tres salian `undefined` en cada fila, calladas.
//
// 3. EL PERMISO ERA DE OTRO REPORTE. puedeVerIndicadoresDeImpacto es la regla de
//    vista_reporte_impacto, mas estrecha. Ahora usa puedeVerReporteDeVencimientos.
//
// NO HAY FILTRO POR COMUNIDAD, y no es un olvido: `bodegas` no tiene `comunidad_id` y
// `existencias` se agrupa por lote y bodega, asi que el stock no tiene dimension de comunidad. El
// hook anterior tenia `comunidadId` con su setter y cargaba listarComunidades() en cada montaje
// para alimentar una lista que nadie podia usar; el filtro ni siquiera entraba en las
// dependencias de cargar(). Se borra entero, y en su lugar se exponen los dos filtros que la API
// SI acepta y no se ofrecian: medicamento y estado de vencimiento.

/** Nivel de alerta segun los dias que le quedan al lote. Negativo = ya vencido. */
export function calcularAlerta(diasRestantes) {
  if (diasRestantes <= UMBRALES_ALERTA.CRITICO) return NIVELES_ALERTA_VENCIMIENTO.CRITICO;
  if (diasRestantes <= UMBRALES_ALERTA.ALTO) return NIVELES_ALERTA_VENCIMIENTO.ALTO;
  if (diasRestantes <= UMBRALES_ALERTA.MEDIO) return NIVELES_ALERTA_VENCIMIENTO.MEDIO;
  return NIVELES_ALERTA_VENCIMIENTO.NORMAL;
}

/**
 * Agrega a cada renglon el nivel de alerta.
 *
 * Es lo unico que hace falta traducir: los demas nombres que declara COLUMNAS_VENCIMIENTO ya
 * salen tal cual de aRenglon() en vencimientos.api.js.
 */
export function conNivelDeAlerta(renglones = []) {
  return renglones.map((renglon) => ({
    ...renglon,
    id: `${renglon.loteId}-${renglon.bodegaId}`,
    alerta: calcularAlerta(renglon.diasRestantes),
  }));
}

export function useReporteMedicamentosPorVencer({ rol } = {}) {
  const tieneAcceso = puedeVerReporteDeVencimientos(rol);

  const [filtros, setFiltros] = useState(FILTROS_VENCIMIENTOS_VACIOS);
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VENCIMIENTOS_VACIOS);
  const [renglones, setRenglones] = useState([]);
  const [totalUnidadesEnRiesgo, setTotalUnidadesEnRiesgo] = useState(0);
  const [catalogos, setCatalogos] = useState({ bodegas: [], medicamentos: [] });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Antes cada cambio de <select> disparaba una consulta inmediata. Mismo retardo que
  // useFiltrosReportes usa para el reporte de pacientes, importado de ahi y no repetido.
  useEffect(() => {
    const temporizador = setTimeout(() => setFiltrosAplicados(filtros), RETARDO_DE_FILTROS_MS);
    return () => clearTimeout(temporizador);
  }, [filtros]);

  // Cambiar de filtro rapido dispara varias consultas y no vuelven en orden. Sin esta guarda, una
  // respuesta lenta de un filtro viejo se escribe encima de la nueva y la tabla queda mostrando
  // algo que ya no corresponde a lo que dicen los controles.
  const peticion = useRef(0);

  const cargar = useCallback(async () => {
    if (!tieneAcceso) {
      setRenglones([]);
      setTotalUnidadesEnRiesgo(0);
      // El hook anterior no limpiaba el error aqui: uno viejo sobrevivia a perder el acceso y la
      // pantalla mostraba a la vez "sin acceso" y un fallo de red de hace dos filtros.
      setError(null);
      setCargando(false);
      return;
    }

    const miTurno = ++peticion.current;
    setCargando(true);

    const { reporte, error: fallo } = await obtenerReporteDeVencimientos({
      horizonteDias: filtrosAplicados.horizonteDias,
      bodega: filtrosAplicados.bodega ?? undefined,
      medicamento: filtrosAplicados.medicamento ?? undefined,
      // El filtro se llama `estadoVencimiento` y el parametro de la API `estadoDeVencimiento`.
      // La traduccion vive aqui, igual que en useReporteInventario: son dos vocabularios reales
      // y ninguno se "arregla" renombrando el otro.
      estadoDeVencimiento: filtrosAplicados.estadoVencimiento ?? undefined,
    });

    if (miTurno !== peticion.current) return;

    if (fallo) {
      setError(fallo);
      setRenglones([]);
      setTotalUnidadesEnRiesgo(0);
    } else {
      setError(null);
      setRenglones(conNivelDeAlerta(reporte.renglones));
      setTotalUnidadesEnRiesgo(reporte.totalUnidadesEnRiesgo);
    }
    setCargando(false);
  }, [tieneAcceso, filtrosAplicados]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!tieneAcceso) return undefined;
    let vigente = true;

    (async () => {
      const [respuestaBodegas, respuestaMedicamentos] = await Promise.all([
        listarBodegas(),
        listarMedicamentos(),
      ]);
      if (!vigente) return;
      setCatalogos({
        bodegas: (respuestaBodegas?.bodegas ?? []).map((b) => ({ value: b.id, label: b.nombre })),
        medicamentos: (respuestaMedicamentos?.medicamentos ?? []).map((m) => ({
          value: m.id,
          label: m.nombre,
        })),
      });
    })();

    return () => {
      vigente = false;
    };
  }, [tieneAcceso]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((actuales) => ({ ...actuales, [id]: valor }));
  }, []);

  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_VENCIMIENTOS_VACIOS), []);

  // El horizonte no cuenta como "filtro puesto": siempre tiene un valor, asi que incluirlo
  // dejaria "Limpiar filtros" activo desde que se abre la pantalla, sin nada que limpiar.
  const hayFiltros = useMemo(
    () => Boolean(filtros.bodega || filtros.medicamento || filtros.estadoVencimiento),
    [filtros],
  );

  const { pagina, orden, alternarOrden, numeroDePagina, totalPaginas, irAPagina, total } =
    useOrdenYPagina(renglones, { columnas: COLUMNAS_VENCIMIENTO });

  return {
    tieneAcceso,
    cargando,
    error,

    // Datos
    renglones: pagina,
    total,
    totalUnidadesEnRiesgo,

    // Descriptores
    columnas: COLUMNAS_VENCIMIENTO,
    definicionDeFiltros: FILTROS_VENCIMIENTOS,

    // Filtros
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    catalogos: {
      ...catalogos,
      nivelesDeAlerta: NIVELES_DE_ALERTA_VENCIMIENTO,
      estadosDeVencimientoReporte: ESTADOS_DE_VENCIMIENTO_REPORTE,
    },

    // Orden y paginacion
    orden,
    alternarOrden,
    numeroDePagina,
    totalPaginas,
    irAPagina,

    recargar: cargar,
  };
}
