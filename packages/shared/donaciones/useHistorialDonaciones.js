// View model del historial de donaciones (pantalla de la issue #198).
//
// Hasta ahora este hook no consultaba nada: recibia `donacionesIniciales` por prop, y la
// pantalla se enrutaba sin pasarle ninguna, asi que abria siempre vacia. Ademas filtraba y
// sumaba sobre campos que la API nunca devolvio -`donante_nombre`, `monto_total`,
// `cantidad_total`- y sobre un tipo `'economica'` que no existe en el enum `tipo_donacion` de
// la migracion 00022, cuyos valores son medicamentos, insumos, dinero y servicios.
//
// Ahora llama a listarDonaciones(), que ya existia. El reparto del filtrado sigue el mismo
// criterio que useDonantesPage: lo que la consulta sabe hacer va al servidor (tipo, proyecto y
// rango de fechas) y la busqueda por nombre de donante se resuelve en memoria, porque
// listarDonaciones filtra por donanteId y la pantalla ofrece un campo de texto libre.
//
// Consecuencia de ese reparto, y es a proposito: `totalesPorTipo` viene del servidor y por
// tanto cubre el periodo consultado sin aplicar la busqueda por nombre. Es lo que pide el
// criterio de aceptacion -totales del periodo-, no totales de lo que quedo en pantalla.

import { useCallback, useEffect, useMemo, useState } from "react";

import { listarDonaciones } from "./historial.api.js";
import { puedeVerDonaciones } from "./permisos.js";

const TOTALES_VACIOS = Object.freeze({ dinero: 0, medicamentos: 0, insumos: 0, servicios: 0 });

export function useHistorialDonaciones({ usuarioRol } = {}) {
  const tieneAccesoLectura = puedeVerDonaciones(usuarioRol);

  const [donaciones, setDonaciones] = useState([]);
  const [totalesPorTipo, setTotalesPorTipo] = useState(TOTALES_VACIOS);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [filtroDonante, setFiltroDonante] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroProyecto, setFiltroProyecto] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const [donacionSeleccionada, setDonacionSeleccionada] = useState(null);
  const [modalDetalleAbierto, setModalDetalleAbierto] = useState(false);

  const cargarDonaciones = useCallback(async () => {
    if (!tieneAccesoLectura) {
      setDonaciones([]);
      setTotalesPorTipo(TOTALES_VACIOS);
      setCargando(false);
      return;
    }

    setCargando(true);
    const { datos, error: fallo } = await listarDonaciones(
      {
        tipo: filtroTipo || undefined,
        proyectoId: filtroProyecto || undefined,
        fechaInicio: fechaInicio || undefined,
        fechaFin: fechaFin || undefined,
      },
      { rolUsuario: usuarioRol },
    );

    if (fallo) {
      setError(fallo);
      setDonaciones([]);
      setTotalesPorTipo(TOTALES_VACIOS);
    } else {
      setDonaciones(datos?.donaciones ?? []);
      setTotalesPorTipo(datos?.totalesPorTipo ?? TOTALES_VACIOS);
      setError(null);
    }
    setCargando(false);
  }, [usuarioRol, tieneAccesoLectura, filtroTipo, filtroProyecto, fechaInicio, fechaFin]);

  useEffect(() => {
    cargarDonaciones();
  }, [cargarDonaciones]);

  // Unico filtro que queda en memoria: la busqueda por nombre de donante.
  const donacionesFiltradas = useMemo(() => {
    const busqueda = filtroDonante.trim().toLowerCase();
    if (!busqueda) return donaciones;
    return donaciones.filter((item) => item.donanteNombre?.toLowerCase().includes(busqueda));
  }, [donaciones, filtroDonante]);

  const abrirDetalle = (donacion) => {
    setDonacionSeleccionada(donacion);
    setModalDetalleAbierto(true);
  };

  const cerrarDetalle = () => {
    setDonacionSeleccionada(null);
    setModalDetalleAbierto(false);
  };

  const limpiarFiltros = () => {
    setFiltroDonante("");
    setFiltroTipo("");
    setFiltroProyecto("");
    setFechaInicio("");
    setFechaFin("");
  };

  return {
    tieneAccesoLectura,
    cargando,
    error,
    donaciones: donacionesFiltradas,
    totalesPorTipo,
    recargar: cargarDonaciones,
    filtros: {
      filtroDonante,
      setFiltroDonante,
      filtroTipo,
      setFiltroTipo,
      filtroProyecto,
      setFiltroProyecto,
      fechaInicio,
      setFechaInicio,
      fechaFin,
      setFechaFin,
      limpiarFiltros,
    },
    modalDetalle: {
      donacionSeleccionada,
      modalDetalleAbierto,
      abrirDetalle,
      cerrarDetalle,
    },
  };
}
