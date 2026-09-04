// View model del reporte de inventario actual (issue #212, reconectado por #693).
//
// QUE PASO AQUI. Este hook consultaba `existencias` directamente con obtenerSupabase(), armaba
// su propia nocion de "vencido" (una tercera, distinta de la de inventario/lotes.validaciones.js)
// y desestructuraba `{ data, err }` de una respuesta de Supabase, que devuelve `error`: `err`
// era siempre undefined, asi que un fallo de consulta se mostraba como inventario vacio en vez
// de como error (issue #696). Mientras tanto obtenerReporteDeInventario() (inventario.api.js)
// existia, probada, y no la llamaba nadie.
//
// Ahora el hook no consulta Supabase: llama a la API de su modulo, que es la regla de
// docs/ARQUITECTURA-FRONTEND.md. Con eso desaparecen de golpe las tres cosas: la consulta
// duplicada, la definicion propia de "vencido" y el bug del `err`.
//
// El catalogo de bodegas sale de inventario/bodegas.api.js -- listarBodegas() -- y no de un
// select suelto a la tabla, por el mismo motivo.

import { useCallback, useEffect, useMemo, useState } from "react";

import { listarBodegas } from "../inventario/bodegas.api.js";
import { ESTADOS_DE_VENCIMIENTO_REPORTE } from "./campos.js";
import {
  CAMPOS_FICHA_LOTE_INVENTARIO,
  CAMPOS_TOTALES_INVENTARIO_REPORTE,
  COLUMNAS_INVENTARIO_REPORTE,
} from "./columnas.js";
import { FILTROS_INVENTARIO_REPORTE_VACIOS } from "./filtros.js";
import { ESTADOS_DE_VENCIMIENTO, obtenerReporteDeInventario } from "./inventario.api.js";
import { puedeVerReporteDeInventario } from "./permisos.js";

const TOTALES_VACIOS = {
  unidadesDisponibles: 0,
  unidadesVencidas: 0,
  medicamentosDistintos: 0,
  renglonesDeInventario: 0,
};

/**
 * Estado actual del inventario, agrupado por medicamento y con el desglose por lote.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de quien consulta.
 */
export function useReporteInventario({ rol } = {}) {
  const tieneAcceso = puedeVerReporteDeInventario(rol);

  const [filtros, setFiltros] = useState(FILTROS_INVENTARIO_REPORTE_VACIOS);
  const [bodegas, setBodegas] = useState([]);
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!tieneAcceso) {
      setReporte(null);
      setCargando(false);
      return;
    }

    setCargando(true);

    // El descriptor llama al filtro `estadoVencimiento` y la API espera `estadoDeVencimiento`:
    // la traduccion se hace aqui, que es donde se juntan los dos vocabularios.
    const { reporte: datos, error: fallo } = await obtenerReporteDeInventario({
      bodega: filtros.bodega || undefined,
      estadoDeVencimiento: filtros.estadoVencimiento || ESTADOS_DE_VENCIMIENTO.TODOS,
    });

    if (fallo) {
      setError(fallo);
      setReporte(null);
    } else {
      setError(null);
      setReporte(datos);
    }

    setCargando(false);
  }, [tieneAcceso, filtros.bodega, filtros.estadoVencimiento]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El catalogo de bodegas no depende de los filtros: se pide una vez.
  useEffect(() => {
    if (!tieneAcceso) return;

    let vigente = true;
    listarBodegas().then(({ bodegas: datos }) => {
      if (vigente) setBodegas(datos ?? []);
    });

    return () => {
      vigente = false;
    };
  }, [tieneAcceso]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((previos) => ({ ...previos, [id]: valor }));
  }, []);

  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_INVENTARIO_REPORTE_VACIOS), []);

  const hayFiltros = useMemo(
    () =>
      Object.entries(FILTROS_INVENTARIO_REPORTE_VACIOS).some(
        ([id, vacio]) => filtros[id] !== vacio,
      ),
    [filtros],
  );

  // Los catalogos que DataList y FilterBar necesitan para resolver `etiquetasDesde` y las
  // opciones del selector de bodega.
  const catalogos = useMemo(
    () => ({
      estadosDeVencimientoReporte: ESTADOS_DE_VENCIMIENTO_REPORTE,
      bodegas: bodegas.map((bodega) => ({ value: bodega.id, label: bodega.nombre })),
    }),
    [bodegas],
  );

  return {
    tieneAcceso,
    cargando,
    error,
    medicamentos: reporte?.medicamentos ?? [],
    totales: reporte?.totales ?? TOTALES_VACIOS,
    columnas: COLUMNAS_INVENTARIO_REPORTE,
    camposDeLote: CAMPOS_FICHA_LOTE_INVENTARIO,
    camposDeTotales: CAMPOS_TOTALES_INVENTARIO_REPORTE,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros,
    catalogos,
    recargar: cargar,
  };
}
