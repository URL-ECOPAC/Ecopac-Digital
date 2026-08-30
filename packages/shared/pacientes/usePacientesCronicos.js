import { useCallback, useEffect, useState } from "react";

import { listarComunidades } from "../territorio/api.js";
import { obtenerCatalogoDeCondiciones, obtenerPacientesConCondicion } from "./condiciones.api.js";
import { OPCIONES_ESTADO_CONDICION } from "./condiciones.campos.js";
import { FILTROS_PACIENTE_CRONICO_VACIOS } from "./condiciones.filtros.js";
import { puedeVerCondiciones } from "./condiciones.permisos.js";

export function hayFiltrosDeCronicos(filtros = {}) {
  return Object.keys(FILTROS_PACIENTE_CRONICO_VACIOS).some((clave) => Boolean(filtros[clave]));
}

export function usePacientesCronicos({ rol } = {}) {
  const [filtros, setFiltros] = useState(FILTROS_PACIENTE_CRONICO_VACIOS);
  const [pacientes, setPacientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [comunidades, setComunidades] = useState([]);
  const [condicionesCronicas, setCondicionesCronicas] = useState([]);

  const permitido = puedeVerCondiciones(rol);
  const { comunidad, condicion, estado } = filtros;

  const cargar = useCallback(async () => {
    if (!permitido) {
      setPacientes([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const respuesta = await obtenerPacientesConCondicion({
      comunidadId: comunidad || undefined,
      condicionId: condicion || undefined,
      estado: estado || undefined,
    });

    setPacientes(respuesta.pacientes ?? []);
    setError(respuesta.error);
    setCargando(false);
  }, [permitido, comunidad, condicion, estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    let vigente = true;

    listarComunidades().then((respuesta) => {
      if (!vigente) return;
      setComunidades(
        (respuesta.comunidades ?? []).map((fila) => ({ value: fila.id, label: fila.nombre })),
      );
    });

    obtenerCatalogoDeCondiciones().then((respuesta) => {
      if (!vigente) return;
      const filas = respuesta.condiciones ?? respuesta.catalogo ?? [];
      setCondicionesCronicas(filas.map((fila) => ({ value: fila.id, label: fila.nombre })));
    });

    return () => {
      vigente = false;
    };
  }, []);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor || null }));
  }, []);

  const limpiarFiltros = useCallback(() => setFiltros(FILTROS_PACIENTE_CRONICO_VACIOS), []);

  return {
    filas: pacientes,
    total: pacientes.length,
    filtros,
    setFiltro,
    limpiarFiltros,
    hayFiltros: hayFiltrosDeCronicos(filtros),
    cargando,
    error,
    recargar: cargar,
    catalogos: {
      comunidades,
      condicionesCronicas,
      estadosCondicionCronica: OPCIONES_ESTADO_CONDICION,
    },
  };
}
