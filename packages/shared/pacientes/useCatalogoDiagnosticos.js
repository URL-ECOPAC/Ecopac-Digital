// View model de la pantalla de catalogo de diagnosticos (issue #639).
//
// El catalogo es chico -34 filas sembradas por la 00105, crece uno a uno desde la aplicacion- asi
// que se trae completo una sola vez con `soloActivos: false` (para poder ver y reactivar los
// retirados) y la busqueda por nombre/codigo filtra en el cliente, sin una consulta nueva por
// cada tecla. Mismo criterio que usePacientesCronicos.js, que tampoco pagina.

import { useCallback, useEffect, useMemo, useState } from "react";

import { ESTADOS_DIAGNOSTICO } from "./catalogoDiagnosticos.columnas.js";
import { FILTROS_CATALOGO_DIAGNOSTICOS_VACIOS } from "./catalogoDiagnosticos.filtros.js";
import { activarDiagnostico, desactivarDiagnostico, listarDiagnosticos } from "./consultas.api.js";
import { puedeAdministrarDiagnosticos, puedeVerCatalogoDiagnosticos } from "./permisos.js";

function quitarAcentos(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
}

export function hayFiltrosDeCatalogoDiagnosticos(filtros = {}) {
  return Boolean(filtros.busqueda?.trim());
}

export function useCatalogoDiagnosticos({ rol } = {}) {
  const [filtros, setFiltros] = useState(FILTROS_CATALOGO_DIAGNOSTICOS_VACIOS);
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [actualizandoId, setActualizandoId] = useState(null);

  const permitido = puedeVerCatalogoDiagnosticos(rol);
  const puedeAdministrar = puedeAdministrarDiagnosticos(rol);

  const cargar = useCallback(async () => {
    if (!permitido) {
      setDiagnosticos([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const respuesta = await listarDiagnosticos({ soloActivos: false });

    setDiagnosticos(respuesta.diagnosticos ?? []);
    setError(respuesta.error);
    setCargando(false);
  }, [permitido]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor ?? "" }));
  }, []);

  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_CATALOGO_DIAGNOSTICOS_VACIOS), []);

  const terminoDeBusqueda = quitarAcentos(filtros.busqueda);
  const filas = useMemo(() => {
    if (!terminoDeBusqueda) return diagnosticos;
    return diagnosticos.filter(
      (diagnostico) =>
        quitarAcentos(diagnostico.nombre).includes(terminoDeBusqueda) ||
        quitarAcentos(diagnostico.codigo).includes(terminoDeBusqueda),
    );
  }, [diagnosticos, terminoDeBusqueda]);

  /**
   * Retira o reactiva un diagnostico (issue #639, criterio 3). No borra: alterna `activo` con
   * desactivarDiagnostico()/activarDiagnostico() (consultas.api.js), que es la 00113.
   */
  const alternarActivo = useCallback(
    async (diagnostico) => {
      if (!puedeAdministrar || !diagnostico?.id) return { ok: false };

      setActualizandoId(diagnostico.id);
      const accion = diagnostico.activo ? desactivarDiagnostico : activarDiagnostico;
      const resultado = await accion(diagnostico.id);
      setActualizandoId(null);

      if (resultado.error) {
        setError(resultado.error);
        return { ok: false };
      }

      await cargar();
      return { ok: true };
    },
    [puedeAdministrar, cargar],
  );

  return {
    filas,
    total: filas.length,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros: hayFiltrosDeCatalogoDiagnosticos(filtros),
    cargando,
    error,
    recargar: cargar,
    permitido,
    puedeAdministrar,
    alternarActivo,
    actualizandoId,
    catalogos: { estadoDiagnostico: ESTADOS_DIAGNOSTICO },
  };
}
