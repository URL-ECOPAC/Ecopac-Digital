// View model de la pantalla de catalogo de principios activos (issue #640).
//
// api.js, permisos.js, campos.js, columnas.js y filtros.js del catalogo ya existian (issues
// #141/#285): esta issue solo pedia la pantalla que los consumiera. La busqueda queda del lado
// del servidor (listarPrincipiosActivos({ busqueda }) ya filtra con ILIKE sobre
// nombre_normalizado, 00046), a diferencia de useCatalogoDiagnosticos.js, que filtra en el
// cliente porque ese catalogo no tiene ese indice.

import { useCallback, useEffect, useState } from "react";

import {
  actualizarPrincipioActivo,
  eliminarPrincipioActivo,
  listarMedicamentosDePrincipio,
  listarPrincipiosActivos,
  registrarPrincipioActivo,
} from "./principios-activos.api.js";
import { permisosDePrincipiosActivos } from "./principios-activos.permisos.js";

export function useCatalogoPrincipiosActivos({ rol } = {}) {
  const [busqueda, setBusqueda] = useState("");
  const [principiosActivos, setPrincipiosActivos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const permisos = permisosDePrincipiosActivos(rol);

  const cargar = useCallback(async () => {
    if (!permisos.puedeVer) {
      setPrincipiosActivos([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const respuesta = await listarPrincipiosActivos({ busqueda: busqueda || undefined });

    setPrincipiosActivos(respuesta.principiosActivos ?? []);
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
        ? await actualizarPrincipioActivo(id, datos)
        : await registrarPrincipioActivo(datos);

      if (resultado.error) return { ok: false, error: resultado.error };

      await cargar();
      return { ok: true, principioActivo: resultado.principioActivo };
    },
    [cargar],
  );

  /**
   * Intenta eliminar un principio activo. Si algun medicamento lo usa, NO lo intenta -- el
   * criterio de aceptacion pide avisar cuales, y ese aviso tiene que llegar siempre, incluso si
   * en el momento entre listar y eliminar alguien mas ya lo desasocio (haria que el intento real
   * hubiera pasado, pero igual es correcto pedirle a la persona que confirme con la lista en
   * la mano).
   *
   * @returns {Promise<{ ok: boolean, medicamentosEnUso?: object[], error?: object|null }>}
   */
  const eliminar = useCallback(async (id) => {
    const { medicamentos, error: errorDeLookup } = await listarMedicamentosDePrincipio(id);
    if (errorDeLookup) return { ok: false, error: errorDeLookup };

    if (medicamentos.length > 0) {
      return { ok: false, medicamentosEnUso: medicamentos };
    }

    const resultado = await eliminarPrincipioActivo(id);
    if (resultado.error) return { ok: false, error: resultado.error };

    setPrincipiosActivos((anteriores) => anteriores.filter((principio) => principio.id !== id));
    return { ok: true };
  }, []);

  return {
    filas: principiosActivos,
    total: principiosActivos.length,
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
