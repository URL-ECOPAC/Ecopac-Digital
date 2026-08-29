import { useState, useMemo } from "react";
import { COLUMNAS_PROYECTO } from "./columnas.js";
import { FILTROS_PROYECTO } from "./filtros.js";
import { CAMPOS_PROYECTO } from "./campos.js";
import { validarProyecto } from "./validaciones.js";
import { puedeAdministrarProyectos } from "./permisos.js";

export function useProyectosSociales({ usuarioRol, proyectosIniciales = [], jornadasIniciales = [] }) {
  const [proyectos] = useState(proyectosIniciales);
  const [jornadas] = useState(jornadasIniciales);
  const [filtrosState, setFiltrosState] = useState({ estado: "", responsable: "" });
  const [proyectoSeleccionadoId, setProyectoSeleccionadoId] = useState(null);
  const [tabActivo, setTabActivo] = useState("resumen");
  const [erroresFormulario, setErroresFormulario] = useState({});

  // Permisos: Administrador administra/edita
  const puedeEditar = useMemo(() => puedeAdministrarProyectos(usuarioRol), [usuarioRol]);

  // Filtrado de la tabla de proyectos
  const proyectosFiltrados = useMemo(() => {
    return proyectos.filter((p) => {
      const coincideEstado = !filtrosState.estado || p.estado === filtrosState.estado;
      const coincideResponsable = !filtrosState.responsable || p.responsable === filtrosState.responsable;
      return coincideEstado && coincideResponsable;
    });
  }, [proyectos, filtrosState]);

  // Proyecto activo seleccionado para el detalle
  const proyectoDetalle = useMemo(() => {
    return proyectos.find((p) => p.id === proyectoSeleccionadoId) || null;
  }, [proyectos, proyectoSeleccionadoId]);

  // Jornadas vinculadas al proyecto seleccionado
  const jornadasProyecto = useMemo(() => {
    if (!proyectoSeleccionadoId) return [];
    return jornadas.filter((j) => j.proyecto_id === proyectoSeleccionadoId);
  }, [jornadas, proyectoSeleccionadoId]);

  const manejarValidacion = (datosFormulario) => {
    const resultado = validarProyecto(datosFormulario);
    setErroresFormulario(resultado.errores || {});
    return resultado.esValido;
  };

  return {
    columnas: COLUMNAS_PROYECTO,
    filtros: FILTROS_PROYECTO,
    campos: CAMPOS_PROYECTO,
    proyectos: proyectosFiltrados,
    proyectoDetalle,
    jornadasProyecto,
    puedeEditar,
    filtrosState,
    setFiltrosState,
    proyectoSeleccionadoId,
    setProyectoSeleccionadoId,
    tabActivo,
    setTabActivo,
    erroresFormulario,
    manejarValidacion,
  };
}