import { useState, useEffect, useMemo, useCallback } from "react";
import { donantesApi } from "./donantes.api.js";
import { donantesColumnas, donantesFiltros, donantesCampos } from "./index.js";

const ROLES_LECTURA = ["Administrador", "Junta Directiva", "Socio Fundador"];

export function useDonantesPage({ client, usuarioRol }) {
  const [donantes, setDonantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const [donanteSeleccionado, setDonanteSeleccionado] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);

  const tieneAccesoLectura = ROLES_LECTURA.includes(usuarioRol);
  const puedeEscribir = usuarioRol === "Administrador";

  const cargarDonantes = useCallback(async () => {
    if (!tieneAccesoLectura || !client) {
      setCargando(false);
      return;
    }
    setCargando(true);
    const { data, error: err } = await donantesApi.obtenerDonantes(client);
    if (err) {
      setError(err.message || "Error al cargar los donantes");
    } else {
      setDonantes(data || []);
      setError(null);
    }
    setCargando(false);
  }, [client, tieneAccesoLectura]);

  useEffect(() => {
    cargarDonantes();
  }, [cargarDonantes]);

  const donantesFiltrados = useMemo(() => {
    return donantes.filter((donante) => {
      const coincideNombre = donante.nombre?.toLowerCase().includes(busqueda.toLowerCase());
      const coincideTipo = filtroTipo === "todos" || donante.tipo === filtroTipo;
      return coincideNombre && coincideTipo;
    });
  }, [donantes, busqueda, filtroTipo]);

  const abrirAlta = () => {
    if (!puedeEscribir) return;
    setDonanteSeleccionado(null);
    setModoEdicion(false);
    setModalAbierto(true);
  };

  const abrirEdicion = (donante) => {
    if (!puedeEscribir) return;
    setDonanteSeleccionado(donante);
    setModoEdicion(true);
    setModalAbierto(true);
  };

  const verFicha = async (donanteId) => {
    const { data } = await donantesApi.obtenerDonantePorId(donanteId, client);
    setDonanteSeleccionado(data);
  };

  return {
    permisos: { tieneAccesoLectura, puedeEscribir },
    cargando,
    error,
    columnas: donantesColumnas,
    filtrosSpec: donantesFiltros,
    camposSpec: donantesCampos,
    donantes: donantesFiltrados,
    busqueda,
    setBusqueda,
    filtroTipo,
    setFiltroTipo,
    modalAbierto,
    setModalAbierto,
    donanteSeleccionado,
    modoEdicion,
    abrirAlta,
    abrirEdicion,
    verFicha,
    recargar: cargarDonantes,
  };
}