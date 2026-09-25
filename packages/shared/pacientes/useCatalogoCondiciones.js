// View model de la pantalla de mantenimiento del catalogo de condiciones cronicas.
//
// Nacio con la issue #641 y se quedo sin consumir: no lo montaba ninguna pantalla, y aunque lo
// hubiera hecho, condiciones_cronicas no tenia GRANT ni politica de escritura, asi que cada alta
// moria con 42501. La 00140 (issue #850) abre la escritura y esta es su pantalla.
//
// El catalogo es chico -cinco filas sembradas por la 00010, crece de una en una desde la
// aplicacion- asi que se trae completo una sola vez con `soloVigentes: false` (para poder ver y
// reactivar las retiradas) y la busqueda filtra en el cliente, sin una consulta nueva por cada
// tecla. Mismo criterio que useCatalogoDiagnosticos.js.
//
// DOS PERMISOS, NO UNO
//
// Hasta la #850 habia un solo `puedeGestionar`, que era "solo administrador". Ahora el alta y el
// mantenimiento no coinciden: los tres roles que atienden dan de alta (politica de INSERT de la
// 00140) y solo el administrador renombra y retira (politica de UPDATE). Un flag unico volveria a
// ofrecerle al medico un boton que el servidor le va a filtrar.

import { useCallback, useEffect, useMemo, useState } from "react";

import { textoComparable } from "../formato/opciones.js";
import {
  actualizarCondicionCatalogo,
  crearCondicionCatalogo,
  obtenerCatalogoDeCondiciones,
} from "./condiciones.api.js";
import { ESTADOS_CONDICION_CATALOGO } from "./condiciones.columnas.js";
import { FILTROS_CATALOGO_CONDICIONES_VACIOS } from "./condiciones.filtros.js";
import {
  puedeCrearCondicionDelCatalogo,
  puedeMantenerCatalogoCondiciones,
  puedeVerCatalogoDeCondiciones,
} from "./condiciones.permisos.js";

/**
 * @param {{ busqueda?: string }} [filtros]
 * @returns {boolean} Si hay texto de busqueda.
 */
export function hayFiltrosDeCatalogoCondiciones(filtros = {}) {
  return Boolean(filtros.busqueda?.trim());
}

/**
 * Catalogo de condiciones cronicas: busqueda, alta y edicion (00140).
 *
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de la sesion; decide `permitido` y `puedeCrear`.
 * @returns {object} `{ filas, total, filtros, setFiltro, limpiarFiltros, hayFiltros, cargando,
 *   error, enviando, erroresForm, recargar, permitido, puedeCrear, ... }`.
 */
export function useCatalogoCondiciones({ rol } = {}) {
  const [filtros, setFiltros] = useState(FILTROS_CATALOGO_CONDICIONES_VACIOS);
  const [condiciones, setCondiciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erroresForm, setErroresForm] = useState({});

  const permitido = puedeVerCatalogoDeCondiciones(rol);
  const puedeCrear = puedeCrearCondicionDelCatalogo(rol);
  const puedeMantener = puedeMantenerCatalogoCondiciones(rol);

  const cargar = useCallback(async () => {
    if (!permitido) {
      setCondiciones([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const respuesta = await obtenerCatalogoDeCondiciones({ soloVigentes: false });

    setCondiciones(respuesta.condiciones);
    setError(respuesta.error);
    setCargando(false);
  }, [permitido]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor ?? "" }));
  }, []);

  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_CATALOGO_CONDICIONES_VACIOS), []);

  const terminoDeBusqueda = textoComparable(filtros.busqueda);
  const filas = useMemo(() => {
    if (!terminoDeBusqueda) return condiciones;
    return condiciones.filter((condicion) =>
      textoComparable(condicion.nombre).includes(terminoDeBusqueda),
    );
  }, [condiciones, terminoDeBusqueda]);

  const crear = useCallback(
    async (nombre) => {
      if (!puedeCrear) return { ok: false };
      setEnviando(true);
      setErroresForm({});

      const res = await crearCondicionCatalogo({ nombre });
      setEnviando(false);

      if (res.error || Object.keys(res.errores ?? {}).length > 0) {
        setErroresForm(res.errores ?? {});
        setError(res.error);
        return { ok: false, errores: res.errores ?? {} };
      }

      await cargar();
      return { ok: true, condicion: res.condicion };
    },
    [puedeCrear, cargar],
  );

  const editar = useCallback(
    async (id, { nombre, esVigente } = {}) => {
      if (!puedeMantener) return { ok: false };
      setEnviando(true);
      setErroresForm({});

      const cambios = {};
      if (nombre !== undefined) cambios.nombre = nombre;
      if (esVigente !== undefined) cambios.esVigente = esVigente;

      const res = await actualizarCondicionCatalogo(id, cambios);
      setEnviando(false);

      if (res.error || Object.keys(res.errores ?? {}).length > 0) {
        setErroresForm(res.errores ?? {});
        setError(res.error);
        return { ok: false, errores: res.errores ?? {} };
      }

      await cargar();
      return { ok: true, condicion: res.condicion };
    },
    [puedeMantener, cargar],
  );

  /**
   * Retira o reactiva una condicion (issue #850). No borra: la 00140 no concede DELETE, y
   * padecimientos_cronicos la referencia ON DELETE RESTRICT (00010).
   */
  const alternarVigencia = useCallback(
    async (condicion) => {
      if (!condicion?.id) return { ok: false };
      return editar(condicion.id, { esVigente: !condicion.esVigente });
    },
    [editar],
  );

  return {
    filas,
    total: filas.length,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros: hayFiltrosDeCatalogoCondiciones(filtros),
    cargando,
    error,
    enviando,
    erroresForm,
    recargar: cargar,
    permitido,
    puedeCrear,
    puedeMantener,
    crear,
    editar,
    alternarVigencia,
    catalogos: { estadoCondicionCatalogo: ESTADOS_CONDICION_CATALOGO },
  };
}
