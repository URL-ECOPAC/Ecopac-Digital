import { useState, useEffect, useMemo, useCallback } from "react";
import { donantesApi } from "./donantes.api.js";
// Los descriptores se importan de su propio archivo y no del barril: hacerlo desde ./index.js
// creaba un ciclo, porque el barril tambien exporta este hook. Los nombres anteriores
// -donantesColumnas, donantesFiltros y donantesCampos- no los exportaba nadie y llegaban como
// undefined; los reales son estos tres (issue #598).
import { CAMPOS_DONANTE } from "./campos.js";
import { COLUMNAS_DONANTE } from "./columnas.js";
import { FILTROS_DONANTE } from "./filtros.js";
import { puedeRegistrarDonaciones, puedeVerDonaciones } from "./permisos.js";

export function useDonantesPage({ client, usuarioRol }) {
  const [donantes, setDonantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const [donanteSeleccionado, setDonanteSeleccionado] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);

  const tieneAccesoLectura = puedeVerDonaciones(usuarioRol);
  const puedeEscribir = puedeRegistrarDonaciones(usuarioRol);

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
    columnas: COLUMNAS_DONANTE,
    filtrosSpec: FILTROS_DONANTE,
    camposSpec: CAMPOS_DONANTE,
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