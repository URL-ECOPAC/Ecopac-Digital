// View model del reporte de pacientes atendidos (issues #202 / #211, reconectado por #693).
//
// QUE PASO AQUI. Este hook consultaba `vista_reporte_impacto` con obtenerSupabase(), que solo
// tiene `pacientes_atendidos`. El requerimiento pide ademas el desglose demografico -- nuevos,
// recurrentes, hombres, mujeres, menores, adultos y adultos mayores -- que lo calcula
// fn_reporte_pacientes_atendidos (00067) y que la 00095 corrigio con detalle: el desglose por
// sexo devolvia cero siempre, y un paciente recurrente contaba como nuevo en cada grupo.
//
// Nada de ese trabajo llegaba a la pantalla, porque la unica funcion que llama a esa RPC
// -- obtenerReportePacientesAtendidos(), en pacientes.api.js -- no la usaba nadie. Ahora si.
//
// LOS FILTROS SON LOS COMUNES. useFiltrosReportes() (issue #208) ya resuelve la barra que las
// cuatro pantallas comparten, con retardo, presets de rango y catalogos. Se usa en vez de tener
// aqui cuatro useState sueltos. La traduccion de nombres -- periodo:{min,max} del descriptor a
// desde/hasta que espera la RPC -- se hace aqui, que es donde se juntan los dos vocabularios,
// tal como anticipa el comentario de FILTROS_REPORTES en filtros.js.

import { useCallback, useEffect, useMemo, useState } from "react";

import { COLUMNAS_PACIENTES_ATENDIDOS } from "./columnas.js";
import { FILTROS_REPORTES } from "./filtros.js";
import { AGRUPACIONES_DE_PACIENTES, obtenerReportePacientesAtendidos } from "./pacientes.api.js";
import { puedeVerReporteDePacientes } from "./permisos.js";
import {
  OPCIONES_DE_PRESET,
  serializarFiltrosReportes,
  useFiltrosReportes,
} from "./useFiltrosReportes.js";
import { useOrdenYPagina } from "./useOrdenYPagina.js";

/**
 * Aplana un grupo para que DataList pueda leerlo.
 *
 * obtenerReportePacientesAtendidos() devuelve el desglose anidado (`porSexo.hombres`,
 * `porEdad.adultosMayores`) y COLUMNAS_PACIENTES_ATENDIDOS declara las columnas por su id plano,
 * porque `desde` no sabe leer una ruta anidada. Aplanarlo es trabajo del hook de la pantalla,
 * tal como dice el comentario de ese descriptor en columnas.js.
 */
function aplanarGrupo(grupo) {
  return {
    ...grupo,
    hombres: grupo.porSexo?.hombres ?? 0,
    mujeres: grupo.porSexo?.mujeres ?? 0,
    menores: grupo.porEdad?.menores ?? 0,
    adultos: grupo.porEdad?.adultos ?? 0,
    adultosMayores: grupo.porEdad?.adultosMayores ?? 0,
  };
}

/**
 * Pacientes atendidos, agregados por jornada, comunidad o periodo.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de quien consulta.
 * @param {{valores: object, presetActivo: string|null}} [opciones.valoresIniciales] Estado con el
 *   que arrancar, normalmente el que la pantalla resolvio desde la URL.
 */
export function useReportePacientes({ rol, valoresIniciales } = {}) {
  const tieneAcceso = puedeVerReporteDePacientes(rol);

  const {
    valores,
    filtrosAplicados,
    presetActivo,
    setFiltro,
    setPreset,
    limpiarFiltro,
    limpiarFiltros,
    aplicarFiltros,
    catalogos,
    cargandoCatalogos,
    errorDeCatalogos,
  } = useFiltrosReportes({ valoresIniciales });

  const [agruparPor, setAgruparPor] = useState(AGRUPACIONES_DE_PACIENTES.JORNADA);
  const [grupos, setGrupos] = useState([]);
  const [totales, setTotales] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!tieneAcceso) {
      setGrupos([]);
      setTotales(null);
      // ISSUE #862: faltaba limpiar el error. Uno viejo sobrevivia a perder el acceso, y la
      // pantalla mostraba a la vez el aviso de "sin permiso" y un fallo de red anterior.
      setError(null);
      setCargando(false);
      return;
    }

    setCargando(true);

    const {
      grupos: filas,
      totales: sumas,
      error: fallo,
    } = await obtenerReportePacientesAtendidos({
      rol,
      agruparPor,
      jornada: filtrosAplicados.jornada || undefined,
      comunidad: filtrosAplicados.comunidad || undefined,
      desde: filtrosAplicados.periodo?.min || undefined,
      hasta: filtrosAplicados.periodo?.max || undefined,
    });

    if (fallo) {
      setError(fallo);
      setGrupos([]);
      setTotales(null);
    } else {
      setError(null);
      setGrupos(filas);
      setTotales(sumas);
    }

    setCargando(false);
  }, [tieneAcceso, rol, agruparPor, filtrosAplicados]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filas = useMemo(() => grupos.map(aplanarGrupo), [grupos]);

  // El periodo es un rango: tiene valor incluso vacio ({min:null,max:null}), asi que se mira
  // dentro en vez de preguntar si existe, o "Limpiar filtros" quedaria activo siempre.
  const hayFiltros = useMemo(
    () =>
      Boolean(
        valores.comunidad ||
        valores.jornada ||
        valores.proyecto ||
        valores.periodo?.min ||
        valores.periodo?.max,
      ),
    [valores],
  );

  const { pagina, orden, alternarOrden, numeroDePagina, totalPaginas, irAPagina, total } =
    useOrdenYPagina(filas, { columnas: COLUMNAS_PACIENTES_ATENDIDOS });

  return {
    tieneAcceso,
    cargando: cargando || cargandoCatalogos,
    error,
    grupos: pagina,
    gruposCompletos: filas,
    total,
    totales,
    columnas: COLUMNAS_PACIENTES_ATENDIDOS,
    definicionDeFiltros: FILTROS_REPORTES,
    valores,
    presetActivo,
    presets: OPCIONES_DE_PRESET,
    // ISSUE #862: serializarFiltrosReportes estaba escrita y probada desde la #208 y ninguna
    // pantalla la llamaba, asi que un reporte filtrado no se podia enlazar ni compartir. El hook
    // la expone ya resuelta; escribirla en la barra de direcciones es de la app, porque toca
    // `window`.
    parametrosDeUrl: serializarFiltrosReportes(valores, presetActivo),
    setFiltro,
    setPreset,
    // ISSUE #862: limpiarFiltro (singular) y errorDeCatalogos los devuelve useFiltrosReportes y
    // este hook se los tragaba, asi que la pantalla no podia quitar un filtro suelto ni enterarse
    // de que los catalogos no habian cargado.
    limpiarFiltro,
    limpiarFiltros,
    hayFiltros,
    aplicarFiltros,
    catalogos,
    errorDeCatalogos,
    agruparPor,
    setAgruparPor,

    orden,
    alternarOrden,
    numeroDePagina,
    totalPaginas,
    irAPagina,

    recargar: cargar,
  };
}
