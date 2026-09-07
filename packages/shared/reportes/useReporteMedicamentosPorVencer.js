import { useCallback, useEffect, useMemo, useState } from "react";
import { listarLotesPorVencer } from "./api.js";
import { UMBRALES_ALERTA, HORIZONTES_DISPONIBLES } from "./campos.js";
import { puedeVerIndicadoresDeImpacto } from "./permisos.js";
import { listarComunidades } from "../territorio/api.js";
import { listarBodegas } from "../inventario/bodegas.api.js";

// Centinelas
const TODAS = "__todas__";

/** Calcula color de alerta según días restantes */
export function calcularAlerta(diasRestantes) {
  if (diasRestantes <= UMBRALES_ALERTA.CRITICO) return "critico";
  if (diasRestantes <= UMBRALES_ALERTA.ALTO) return "alto";
  if (diasRestantes <= UMBRALES_ALERTA.MEDIO) return "medio";
  return "normal";
}

/** Traduce filas de la BD al formato que espera la pantalla */
function aFilasPantalla(lotes = []) {
  return lotes.map((lote) => {
    const diasRestantes = lote.dias_restantes ?? 0;
    return {
      id: lote.id,
      medicamento: lote.medicamento,
      lote: lote.numero_lote ?? lote.lote,
      cantidad: lote.cantidad_actual ?? lote.cantidad ?? 0,
      fechaVencimiento: lote.fecha_vencimiento,
      diasRestantes,
      alerta: calcularAlerta(diasRestantes),
      bodega: lote.bodega,
      bodegaId: lote.bodega_id,
      comunidadId: lote.comunidad_id,
      comunidad: lote.comunidad,
    };
  });
}

/** Total de unidades en riesgo */
function calcularTotalEnRiesgo(filas = []) {
  return filas.reduce((suma, f) => suma + Number(f.cantidad), 0);
}

export function useReporteMedicamentosPorVencer({ rol } = {}) {
  const tieneAcceso = puedeVerIndicadoresDeImpacto(rol);

  // Filtros
  const [horizonteDias, setHorizonteDias] = useState(30);
  const [comunidadId, setComunidadId] = useState(TODAS);
  const [bodegaId, setBodegaId] = useState(TODAS);

  // Datos
  const [filas, setFilas] = useState([]);
  const [listaComunidades, setListaComunidades] = useState([]);
  const [listaBodegas, setListaBodegas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Total calculado
  const totalUnidadesEnRiesgo = useMemo(() => calcularTotalEnRiesgo(filas), [filas]);

  // Cargar datos del reporte
  const cargar = useCallback(async () => {
    if (!tieneAcceso) {
      setFilas([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const comunidad = comunidadId === TODAS ? undefined : comunidadId;
    const bodega = bodegaId === TODAS ? undefined : bodegaId;

    const { lotes, error: err } = await listarLotesPorVencer({
      horizonteDias,
      comunidad,
      bodega,
    });

    if (err) {
      setError(err);
      setFilas([]);
    } else {
      setError(null);
      setFilas(aFilasPantalla(lotes));
    }
    setCargando(false);
  }, [tieneAcceso, horizonteDias, comunidadId, bodegaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Cargar catálogos: comunidades y bodegas
  useEffect(() => {
    if (!tieneAcceso) return;
    let vigente = true;

    const cargarCatalogos = async () => {
      const [resComunidades, resBodegas] = await Promise.all([
        listarComunidades(),
        listarBodegas(),
      ]);
      if (vigente) {
        setListaComunidades(resComunidades?.comunidades ?? []);
        setListaBodegas(resBodegas?.bodegas ?? []);
      }
    };

    cargarCatalogos();
    return () => {
      vigente = false;
    };
  }, [tieneAcceso]);

  return {
    tieneAcceso,
    // Opciones
    horizontesDisponibles: HORIZONTES_DISPONIBLES,
    umbralesAlerta: UMBRALES_ALERTA,
    valoresEspeciales: { TODAS: TODAS },
    // Filtros
    horizonteDias,
    setHorizonteDias,
    comunidadId,
    setComunidadId,
    bodegaId,
    setBodegaId,
    // Catálogos
    listaComunidades,
    listaBodegas,
    // Resultados
    cargando,
    error,
    filas,
    totalUnidadesEnRiesgo,
    recargar: cargar,
  };
}
