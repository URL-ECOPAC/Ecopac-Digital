import { useState, useMemo } from "react";

const ROLES_LECTURA = ["Administrador", "Junta Directiva", "Socio Fundador"];

export function useHistorialDonaciones({ usuarioRol, donacionesIniciales = [] }) {
  const tieneAccesoLectura = ROLES_LECTURA.includes(usuarioRol);

  const [donaciones, setDonaciones] = useState(donacionesIniciales);
  const [filtroDonante, setFiltroDonante] = useState("");
  const [filtroTipo, setFiltroTipo] = useState(""); // 'economica', 'medicamentos', 'insumos'
  const [filtroProyecto, setFiltroProyecto] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const [donacionSeleccionada, setDonacionSeleccionada] = useState(null);
  const [modalDetalleAbierto, setModalDetalleAbierto] = useState(false);

  // Filtrado de la lista
  const donacionesFiltradas = useMemo(() => {
    return donaciones.filter((item) => {
      if (filtroDonante && !item.donante_nombre?.toLowerCase().includes(filtroDonante.toLowerCase())) {
        return false;
      }
      if (filtroTipo && item.tipo !== filtroTipo) {
        return false;
      }
      if (filtroProyecto && item.proyecto_id !== filtroProyecto) {
        return false;
      }
      if (fechaInicio && new Date(item.fecha) < new Date(fechaInicio)) {
        return false;
      }
      if (fechaFin && new Date(item.fecha) > new Date(fechaFin)) {
        return false;
      }
      return true;
    });
  }, [donaciones, filtroDonante, filtroTipo, filtroProyecto, fechaInicio, fechaFin]);

  // Cálculo de totales por tipo del período filtrado (excluyendo anuladas si aplica o contabilizándolas aparte)
  const totalesPorTipo = useMemo(() => {
    const res = { economica: 0, medicamentos: 0, insumos: 0 };

    donacionesFiltradas.forEach((d) => {
      if (d.estado === "anulada") return;

      if (d.tipo === "economica") {
        res.economica += Number(d.monto_total || 0);
      } else if (d.tipo === "medicamentos") {
        res.medicamentos += Number(d.cantidad_total || 0);
      } else if (d.tipo === "insumos") {
        res.insumos += Number(d.cantidad_total || 0);
      }
    });

    return res;
  }, [donacionesFiltradas]);

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
    donaciones: donacionesFiltradas,
    totalesPorTipo,
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
    setDonaciones,
  };
}