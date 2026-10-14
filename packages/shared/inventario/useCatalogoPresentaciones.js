// View model de la pantalla de catalogo de presentaciones (PLAN.md punto 11, 00144). Mismo
// patron que useCatalogoPrincipiosActivos.js: la busqueda queda del lado del servidor
// (listarPresentaciones({ busqueda }) ya filtra con ILIKE sobre nombre).

import { useCallback, useEffect, useState } from "react";

import {
  actualizarPresentacion,
  eliminarPresentacion,
  listarMedicamentosDePresentacion,
  listarPresentaciones,
  registrarPresentacion,
} from "./presentaciones.api.js";
import { permisosDePresentaciones } from "./presentaciones.permisos.js";

/**
 * Catalogo administrable de presentaciones (tabla `presentaciones`, 00144): busqueda, alta, edicion
 * y borrado. Escribir es solo del administrador.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de la sesion; decide `permisos`.
 * @returns {object} `{ filas, total, filtros, setFiltro, limpiarFiltros, hayFiltros, cargando, error,
 *   recargar, guardar, eliminar, permisos }`.
 */
export function useCatalogoPresentaciones({ rol } = {}) {
  const [busqueda, setBusqueda] = useState("");
  const [presentaciones, setPresentaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const permisos = permisosDePresentaciones(rol);

  const cargar = useCallback(async () => {
    if (!permisos.puedeVer) {
      setPresentaciones([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const respuesta = await listarPresentaciones({ busqueda: busqueda || undefined });

    setPresentaciones(respuesta.presentaciones ?? []);
    setError(respuesta.error);
    setCargando(false);
  }, [permisos.puedeVer, busqueda]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFiltro = useCallback((id, valor) => {
    if (id === "busqueda") setBusqueda(valor ?? "");
  }, []);

  const limpiarFiltros = useCallback(() => setBusqueda(""), []);

  const guardar = useCallback(
    async (id, datos) => {
      const resultado = id
        ? await actualizarPresentacion(id, datos)
        : await registrarPresentacion(datos);

      if (resultado.error) return { ok: false, error: resultado.error };

      await cargar();
      return { ok: true, presentacion: resultado.presentacion };
    },
    [cargar],
  );

  /**
   * Intenta eliminar una presentacion. Si algun medicamento la usa, NO lo intenta -- mismo
   * criterio que eliminar() en useCatalogoPrincipiosActivos.js: el aviso tiene que llegar
   * siempre, con la lista en la mano.
   *
   * @returns {Promise<{ ok: boolean, medicamentosEnUso?: object[], error?: object|null }>}
   */
  const eliminar = useCallback(async (id) => {
    const { medicamentos, error: errorDeLookup } = await listarMedicamentosDePresentacion(id);
    if (errorDeLookup) return { ok: false, error: errorDeLookup };

    if (medicamentos.length > 0) {
      return { ok: false, medicamentosEnUso: medicamentos };
    }

    const resultado = await eliminarPresentacion(id);
    if (resultado.error) return { ok: false, error: resultado.error };

    setPresentaciones((anteriores) => anteriores.filter((presentacion) => presentacion.id !== id));
    return { ok: true };
  }, []);

  return {
    filas: presentaciones,
    total: presentaciones.length,
    filtros: { busqueda },
    setFiltro,
    limpiarFiltros,
    hayFiltros: Boolean(busqueda),
    cargando,
    error,
    recargar: cargar,
    guardar,
    eliminar,
    permisos,
  };
}
