import { useCallback, useEffect, useState } from "react";

import { ESTADOS_VIGENCIA } from "./campos.js";
import { validarComunidad } from "./comunidades.validaciones.js";
import { FILTROS_COMUNIDADES_VACIOS } from "./filtros.js";
import {
  actualizarComunidad,
  crearComunidad,
  listarComunidadesCatalogo,
  listarMunicipios,
} from "./api.js";
import {
  puedeCrearComunidad,
  puedeEditarComunidad,
  puedeVerCatalogoComunidades,
} from "./permisos.js";

/** `ubicacion` es derivada: DataList no necesita las coordenadas, solo si existen o no. */
function filaDe(comunidad) {
  return {
    ...comunidad,
    ubicacion: Boolean(comunidad.latitud && comunidad.longitud),
  };
}

/**
 * Hook de vista de la pantalla de catalogo de comunidades (issue #756). Espejo de
 * useCatalogoPrincipiosActivos.js (packages/shared/inventario/): lista, filtra, crea y edita,
 * mas el municipio de cada fila resuelto a nombre.
 */
export function useCatalogoComunidades({ rol } = {}) {
  const [comunidades, setComunidades] = useState([]);
  const [municipios, setMunicipios] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_COMUNIDADES_VACIOS);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erroresForm, setErroresForm] = useState({});

  const permisos = {
    puedeVer: puedeVerCatalogoComunidades(rol),
    puedeCrear: puedeCrearComunidad(rol),
    puedeEditar: puedeEditarComunidad(rol),
  };

  useEffect(() => {
    if (!permisos.puedeVer) return;
    listarMunicipios().then(({ municipios: filas }) => setMunicipios(filas ?? []));
  }, [permisos.puedeVer]);

  const cargar = useCallback(async () => {
    if (!permisos.puedeVer) {
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const respuesta = await listarComunidadesCatalogo(filtros);
    setComunidades((respuesta.comunidades ?? []).map(filaDe));
    setError(respuesta.error);
    setCargando(false);
  }, [filtros, permisos.puedeVer]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor }));
  }, []);

  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_COMUNIDADES_VACIOS), []);

  const hayFiltros = Object.entries(filtros).some(
    ([id, valor]) => valor !== FILTROS_COMUNIDADES_VACIOS[id],
  );

  /**
   * Alta o edicion completa (el formulario siempre manda el objeto entero, nunca un parche
   * parcial): `id` nulo crea, `id` presente actualiza. Valida antes de tocar la red.
   */
  const guardar = useCallback(
    async (id, datos) => {
      const puedeGuardar = id ? permisos.puedeEditar : permisos.puedeCrear;
      if (!puedeGuardar) return { ok: false };

      const errores = validarComunidad(datos);
      if (Object.keys(errores).length > 0) {
        setErroresForm(errores);
        return { ok: false, errores };
      }

      setEnviando(true);
      setErroresForm({});

      const resultado = id ? await actualizarComunidad(id, datos) : await crearComunidad(datos);

      setEnviando(false);

      if (resultado.error) {
        setError(resultado.error);
        return { ok: false, error: resultado.error };
      }

      await cargar();
      return { ok: true };
    },
    [permisos.puedeCrear, permisos.puedeEditar, cargar],
  );

  // No pasa por guardar()/validarComunidad(): es un parche de un solo campo booleano, y
  // exigirle nombre/municipio a un toggle de vigencia rechazaria una comunidad real por
  // datos que ni siquiera esta tocando.
  const alternarVigencia = useCallback(
    async (id, esVigenteActual) => {
      if (!permisos.puedeEditar) return { ok: false };

      setEnviando(true);
      setError(null);

      const resultado = await actualizarComunidad(id, { esVigente: !esVigenteActual });

      setEnviando(false);

      if (resultado.error) {
        setError(resultado.error);
        return { ok: false, error: resultado.error };
      }

      await cargar();
      return { ok: true };
    },
    [permisos.puedeEditar, cargar],
  );

  return {
    comunidades,
    total: comunidades.length,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    cargando,
    error,
    enviando,
    erroresForm,
    permisos,
    guardar,
    alternarVigencia,
    recargar: cargar,
    catalogos: {
      municipios: municipios.map((municipio) => ({ value: municipio.id, label: municipio.nombre })),
      estadosVigencia: ESTADOS_VIGENCIA,
    },
  };
}
