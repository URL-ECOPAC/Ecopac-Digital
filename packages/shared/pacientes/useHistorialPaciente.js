import { useCallback, useEffect, useMemo, useState } from "react";

import { obtenerHistorialMedico } from "./historial.api.js";
import { FILTROS_HISTORIAL_VACIOS } from "./historial.filtros.js";
import { puedeVerHistorial } from "./permisos.js";

export function agruparPorJornada(eventos = []) {
  const grupos = [];
  const porClave = new Map();

  for (const evento of eventos) {
    const clave = evento.jornadaId ?? evento.atencionId ?? "sin-jornada";
    let grupo = porClave.get(clave);

    if (!grupo) {
      grupo = {
        clave,
        jornadaId: evento.jornadaId ?? null,
        jornada: evento.jornada ?? null,
        comunidad: evento.comunidad ?? null,
        fecha: evento.fechaDeJornada ?? evento.fecha ?? null,
        eventos: [],
      };
      porClave.set(clave, grupo);
      grupos.push(grupo);
    }

    grupo.eventos.push(evento);
  }

  return grupos;
}

export function filtrarPorTipo(eventos = [], tipo) {
  if (!tipo) return eventos;
  return eventos.filter((evento) => evento.tipo === tipo);
}

export function hayFiltrosDeHistorial(filtros = {}) {
  return Object.entries(FILTROS_HISTORIAL_VACIOS).some(
    ([clave, vacio]) => (filtros[clave] ?? vacio) !== vacio,
  );
}

export function useHistorialPaciente(pacienteId, { rol, limiteInicial = null } = {}) {
  const [filtros, setFiltros] = useState(FILTROS_HISTORIAL_VACIOS);
  const [limite, setLimite] = useState(limiteInicial);
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const permitido = puedeVerHistorial(rol);
  const { desde, hasta, tipo } = filtros;

  const cargar = useCallback(async () => {
    if (!pacienteId || !permitido) {
      setEventos([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const respuesta = await obtenerHistorialMedico(pacienteId, {
      rol,
      desde: desde || undefined,
      hasta: hasta || undefined,
      limite: limite ? limite + 1 : undefined,
    });

    setEventos(respuesta.eventos ?? []);
    setError(respuesta.error);
    setCargando(false);
  }, [pacienteId, rol, permitido, desde, hasta, limite]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor ?? "" }));
  }, []);

  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_HISTORIAL_VACIOS), []);

  const visibles = useMemo(() => filtrarPorTipo(eventos, tipo), [eventos, tipo]);
  const todosLosGrupos = useMemo(() => agruparPorJornada(visibles), [visibles]);

  const hayMas = Boolean(limite) && todosLosGrupos.length > limite;
  const grupos = hayMas ? todosLosGrupos.slice(0, limite) : todosLosGrupos;
  const eventosVisibles = hayMas ? grupos.flatMap((grupo) => grupo.eventos) : visibles;

  const verMas = useCallback(() => setLimite(null), []);

  return {
    grupos,
    eventos: eventosVisibles,
    total: eventosVisibles.length,
    hayMas,
    verMas,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros: hayFiltrosDeHistorial(filtros),
    cargando,
    error,
    recargar: cargar,
  };
}
