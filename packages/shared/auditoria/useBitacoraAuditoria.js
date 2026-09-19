import { useCallback, useEffect, useMemo, useState } from "react";

import { listarEventosAuditoria, listarPerfilesParaFiltro } from "./api.js";
import { OPCIONES_OPERACION_AUDITORIA } from "./columnas.js";
import { FILTROS_BITACORA_AUDITORIA_VACIOS } from "./filtros.js";

export const EVENTOS_POR_PAGINA = 20;

/**
 * Resuelve `realizadoPor` (UUID sin FK, ver 00026) contra el catalogo de perfiles.
 *
 * Funcion aparte y exportada -no codigo dentro del hook- para probarla sin montar un componente,
 * mismo motivo que nombreCompletoDe()/armarFilasDeAuditoria() en usuarios/useUsuariosListado.js.
 *
 * @param {object[]} eventos Eventos tal como llegan de listarEventosAuditoria().
 * @param {Map<string,string>} nombresPorId De listarPerfilesParaFiltro(), indexado por id.
 * @returns {object[]}
 */
export function armarFilasDeAuditoria(eventos = [], nombresPorId = new Map()) {
  return eventos.map((evento) => ({
    ...evento,
    realizadoPorNombre:
      evento.realizadoPor === null
        ? "Sistema"
        : (nombresPorId.get(evento.realizadoPor) ?? "Usuario eliminado"),
  }));
}

/**
 * Cuantas paginas hacen falta para `total` filas. Nunca menos de una.
 *
 * @param {number} total Filas que cumplen los filtros, sin paginar.
 * @param {number} porPagina
 * @returns {number}
 */
export function calcularPaginasDeAuditoria(total, porPagina) {
  const tamano = Math.max(1, Number(porPagina) || EVENTOS_POR_PAGINA);
  return Math.max(1, Math.ceil((Number(total) || 0) / tamano));
}

/**
 * View model de la bitacora de auditoria (issue #643): estado de filtros, paginacion, carga y
 * los catalogos que alimentan FilterBar/DataList. La pantalla solo dibuja lo que este hook le
 * entrega.
 *
 * El catalogo de perfiles se relee con cada pagina/filtro (mismo criterio que el catalogo de
 * especialidades en useUsuariosListado.js: un perfil nuevo tiene que aparecer ya en el filtro de
 * usuario, no al recargar la pantalla), y de paso sirve para resolver `realizadoPorNombre` de
 * cada fila sin repetir la consulta a perfiles.
 *
 * Cambiar un filtro vuelve a la pagina 1: quedarse en la pagina 5 tras filtrar deja la lista
 * vacia sin explicacion.
 *
 * @param {{ porPagina?: number }} [opciones]
 */
export function useBitacoraAuditoria({ porPagina = EVENTOS_POR_PAGINA } = {}) {
  const [filtros, setFiltros] = useState(FILTROS_BITACORA_AUDITORIA_VACIOS);
  const [pagina, setPagina] = useState(1);
  const [eventos, setEventos] = useState([]);
  const [total, setTotal] = useState(0);
  const [perfiles, setPerfiles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const [
      { eventos: filas, total: cuantos, error: errorDeLista },
      { opciones: catalogoDePerfiles, error: errorDePerfiles },
    ] = await Promise.all([
      listarEventosAuditoria({
        usuarioId: filtros.usuarioId,
        tablaAfectada: filtros.tablaAfectada,
        desde: filtros.fecha?.min,
        hasta: filtros.fecha?.max,
        limite: porPagina,
        pagina,
      }),
      listarPerfilesParaFiltro(),
    ]);

    setPerfiles(catalogoDePerfiles ?? []);

    const errorDeCarga = errorDeLista ?? errorDePerfiles;
    if (errorDeCarga) {
      setEventos([]);
      setTotal(0);
      setError(errorDeCarga);
      setCargando(false);
      return;
    }

    setEventos(filas);
    setTotal(cuantos);
    setCargando(false);
  }, [filtros, pagina, porPagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFiltro = useCallback((id, valor) => {
    setPagina(1);
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor }));
  }, []);

  const limpiarFiltros = useCallback(() => {
    setPagina(1);
    setFiltros(FILTROS_BITACORA_AUDITORIA_VACIOS);
  }, []);

  const nombresPorId = useMemo(
    () => new Map(perfiles.map((perfil) => [perfil.value, perfil.label])),
    [perfiles],
  );

  const filas = useMemo(
    () => armarFilasDeAuditoria(eventos, nombresPorId),
    [eventos, nombresPorId],
  );

  const paginas = calcularPaginasDeAuditoria(total, porPagina);

  return {
    filas,
    filtros,
    setFiltro,
    limpiarFiltros,
    cargando,
    error,
    recargar: cargar,
    pagina,
    paginas,
    total,
    hayPaginaAnterior: pagina > 1,
    hayPaginaSiguiente: pagina < paginas,
    irAPaginaAnterior: () => setPagina((actual) => Math.max(1, actual - 1)),
    irAPaginaSiguiente: () => setPagina((actual) => Math.min(paginas, actual + 1)),
    catalogos: {
      perfiles,
      operaciones: OPCIONES_OPERACION_AUDITORIA,
    },
  };
}
