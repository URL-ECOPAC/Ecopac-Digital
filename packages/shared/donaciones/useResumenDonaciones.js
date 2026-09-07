import { useCallback, useEffect, useState } from "react";
import { listarDonaciones } from "./historial.api.js";

/**
 * Hook para gestionar el resumen y KPIs del módulo de donaciones en web.
 *
 * @param {object} params
 * @param {string} [params.rolUsuario] Rol del usuario logueado.
 * @returns Object con KPIs, donaciones recientes, donantes frecuentes y manejadores de fechas.
 */
export function useResumenDonaciones({ rolUsuario } = {}) {
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [datos, setDatos] = useState({
    totalesPorTipo: { dinero: 0, medicamentos: 0, insumos: 0, servicios: 0 },
    donacionesRecientes: [],
    donantesFrecuentes: [],
  });

  const cargarResumen = useCallback(async () => {
    setCargando(true);
    setError(null);

    const respuesta = await listarDonaciones(
      {
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
        limite: 10,
      },
      { rolUsuario },
    );

    if (respuesta.error) {
      setError(respuesta.error.mensaje || "Error al cargar el resumen de donaciones.");
      setCargando(false);
      return;
    }

    const donaciones = respuesta.datos?.donaciones ?? [];
    const totalesPorTipo = respuesta.datos?.totalesPorTipo ?? {
      dinero: 0,
      medicamentos: 0,
      insumos: 0,
      servicios: 0,
    };

    // Agrupar donantes más frecuentes en el período consultado
    const mapaDonantes = {};
    for (const d of donaciones) {
      if (!d.donanteId) continue;
      if (!mapaDonantes[d.donanteId]) {
        mapaDonantes[d.donanteId] = {
          id: d.donanteId,
          nombre: d.donanteNombre || "Donante Anónimo",
          totalDonaciones: 0,
        };
      }
      mapaDonantes[d.donanteId].totalDonaciones += 1;
    }

    const donantesFrecuentes = Object.values(mapaDonantes)
      .sort((a, b) => b.totalDonaciones - a.totalDonaciones)
      .slice(0, 5);

    setDatos({
      totalesPorTipo,
      donacionesRecientes: donaciones,
      donantesFrecuentes,
    });
    setCargando(false);
  }, [fechaInicio, fechaFin, rolUsuario]);

  useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  return {
    fechaInicio,
    setFechaInicio,
    fechaFin,
    setFechaFin,
    cargando,
    error,
    datos,
    recargar: cargarResumen,
  };
}
