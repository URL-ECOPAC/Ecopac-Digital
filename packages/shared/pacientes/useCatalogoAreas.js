// View model de la pantalla del catalogo de areas de atencion (issue #927, 00182).
//
// Mismo patron que useCatalogoCondiciones.js: el catalogo es chico, se trae completo una vez
// -tambien las retiradas, para poder reactivarlas- y la busqueda filtra en el cliente. A diferencia
// de las condiciones, aqui hay un solo permiso de escritura: crear, editar, retirar y reactivar son
// de la administradora (politicas de 00182).

import { useCallback, useEffect, useMemo, useState } from "react";

import { textoComparable } from "../formato/opciones.js";
import { actualizarAreaCatalogo, crearAreaCatalogo, obtenerCatalogoDeAreas } from "./areas.api.js";
import { CAMPOS_AREA_CATALOGO } from "./areas.campos.js";
import { ESTADOS_AREA_CATALOGO } from "./areas.columnas.js";
import { FILTROS_CATALOGO_AREAS_VACIOS } from "./areas.filtros.js";
import { puedeGestionarCatalogoDeAreas, puedeVerCatalogoDeAreas } from "./areas.permisos.js";

/**
 * @param {{ busqueda?: string }} [filtros]
 * @returns {boolean} Si hay texto de busqueda.
 */
export function hayFiltrosDeCatalogoAreas(filtros = {}) {
  return Boolean(filtros.busqueda?.trim());
}

/**
 * Las areas que coinciden con la busqueda, por nombre o descripcion, sin distinguir mayusculas ni
 * acentos. Pura: se exporta para probarla sin montar el hook.
 *
 * @param {object[]} areas
 * @param {string} [busqueda]
 * @returns {object[]}
 */
export function filtrarAreas(areas = [], busqueda = "") {
  const termino = textoComparable(busqueda);
  if (!termino) return areas;
  return areas.filter(
    (area) =>
      textoComparable(area.nombre).includes(termino) ||
      textoComparable(area.descripcion ?? "").includes(termino),
  );
}

/**
 * Catalogo de areas de atencion: busqueda, alta, edicion y retiro.
 *
 * @param {{ rol?: string }} [opciones]
 * @returns {object} Con: filas, total, filtros, setFiltro, limpiarFiltros, hayFiltros, cargando, error, enviando, erroresForm, recargar, permitido, puedeGestionar, campos, crear, editar, alternarVigencia, catalogos.
 */
export function useCatalogoAreas({ rol } = {}) {
  const [filtros, setFiltros] = useState(FILTROS_CATALOGO_AREAS_VACIOS);
  const [areas, setAreas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erroresForm, setErroresForm] = useState({});

  const permitido = puedeVerCatalogoDeAreas(rol);
  const puedeGestionar = puedeGestionarCatalogoDeAreas(rol);

  const cargar = useCallback(async () => {
    if (!permitido) {
      setAreas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    setError(null);
    const respuesta = await obtenerCatalogoDeAreas();
    setAreas(respuesta.areas);
    setError(respuesta.error);
    setCargando(false);
  }, [permitido]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor ?? "" }));
  }, []);

  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_CATALOGO_AREAS_VACIOS), []);

  const filas = useMemo(() => filtrarAreas(areas, filtros.busqueda), [areas, filtros.busqueda]);

  /** Corre una escritura y recarga si salio bien; los errores del campo van a `erroresForm`. */
  const escribir = useCallback(
    async (operacion) => {
      if (!puedeGestionar) return { ok: false };
      setEnviando(true);
      setErroresForm({});
      const res = await operacion();
      setEnviando(false);

      if (res.error || Object.keys(res.errores ?? {}).length > 0) {
        setErroresForm(res.errores ?? {});
        // Un error del servidor se muestra en el formulario, no tumba la pantalla entera.
        if (res.error) setErroresForm({ general: res.error.mensaje });
        return { ok: false, errores: res.errores ?? {} };
      }

      await cargar();
      return { ok: true, area: res.area };
    },
    [puedeGestionar, cargar],
  );

  const crear = useCallback(
    (datos) =>
      escribir(() =>
        crearAreaCatalogo({ nombre: datos?.nombre, descripcion: datos?.descripcion ?? "" }),
      ),
    [escribir],
  );

  const editar = useCallback(
    (id, datos = {}) => escribir(() => actualizarAreaCatalogo(id, datos)),
    [escribir],
  );

  /** Retira o reactiva un area. No se borra: paciente_area la referencia ON DELETE RESTRICT. */
  const alternarVigencia = useCallback(
    (area) => {
      if (!area?.id) return Promise.resolve({ ok: false });
      return editar(area.id, { esVigente: !area.esVigente });
    },
    [editar],
  );

  return {
    filas,
    total: filas.length,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros: hayFiltrosDeCatalogoAreas(filtros),
    cargando,
    error,
    enviando,
    erroresForm,
    recargar: cargar,
    permitido,
    puedeGestionar,
    campos: CAMPOS_AREA_CATALOGO,
    crear,
    editar,
    alternarVigencia,
    catalogos: { estadoAreaCatalogo: ESTADOS_AREA_CATALOGO },
  };
}
