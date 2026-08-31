// View model del listado de proyectos sociales (pantalla de la issue #200).
//
// Igual que useHistorialDonaciones, este hook no consultaba nada: recibia `proyectosIniciales`
// y `jornadasIniciales` por prop, y la pantalla se enrutaba sin pasarle ninguna, asi que abria
// siempre vacia. Ahora llama a listarProyectos() y a listarJornadasDelProyecto(), que ya
// existian en proyectos/api.js.
//
// Dos desajustes de nombres que venian de ahi y se corrigen aqui:
//
// - El filtro de responsable comparaba contra `p.responsable`, un campo que la consulta nunca
//   devolvio. La columna es `responsable_id` y la API la expone como `responsableId`; el nombre
//   para pintar viene ahora en `responsableNombre` (join con perfiles, igual que jornadas).
// - Las jornadas del proyecto se filtraban en memoria por `j.proyecto_id` sobre una lista que
//   nadie cargaba. listarJornadasDelProyecto(id) ya consulta solo las de ese proyecto, asi que
//   se piden al seleccionar y no se filtra nada.

import { useCallback, useEffect, useMemo, useState } from "react";

import { listarJornadasDelProyecto, listarProyectos } from "./api.js";
import { COLUMNAS_PROYECTO } from "./columnas.js";
import { FILTROS_PROYECTO } from "./filtros.js";
import { CAMPOS_PROYECTO } from "./campos.js";
import { validarProyecto } from "./validaciones.js";
import { puedeAdministrarProyectos, puedeVerProyectos } from "./permisos.js";

export function useProyectosSociales({ usuarioRol } = {}) {
  const tieneAccesoLectura = puedeVerProyectos(usuarioRol);

  const [proyectos, setProyectos] = useState([]);
  const [jornadasProyecto, setJornadasProyecto] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [filtrosState, setFiltrosState] = useState({ estado: "", responsable: "" });
  const [proyectoSeleccionadoId, setProyectoSeleccionadoId] = useState(null);
  const [tabActivo, setTabActivo] = useState("resumen");
  const [erroresFormulario, setErroresFormulario] = useState({});

  const puedeEditar = useMemo(() => puedeAdministrarProyectos(usuarioRol), [usuarioRol]);

  const cargarProyectos = useCallback(async () => {
    if (!tieneAccesoLectura) {
      setProyectos([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    const { proyectos: datos, error: fallo } = await listarProyectos({
      estado: filtrosState.estado || undefined,
    });

    if (fallo) {
      setError(fallo);
      setProyectos([]);
    } else {
      setProyectos(datos);
      setError(null);
    }
    setCargando(false);
  }, [tieneAccesoLectura, filtrosState.estado]);

  useEffect(() => {
    cargarProyectos();
  }, [cargarProyectos]);

  // Las jornadas se piden solo del proyecto abierto en el detalle: son el contenido de una
  // pestania, no de la tabla, y traerlas todas por adelantado no le sirve a nadie.
  useEffect(() => {
    let vigente = true;

    if (!proyectoSeleccionadoId) {
      setJornadasProyecto([]);
      return () => {
        vigente = false;
      };
    }

    listarJornadasDelProyecto(proyectoSeleccionadoId).then(({ jornadas }) => {
      // Si mientras tanto se selecciono otro proyecto, esta respuesta ya no vale.
      if (vigente) setJornadasProyecto(jornadas ?? []);
    });

    return () => {
      vigente = false;
    };
  }, [proyectoSeleccionadoId]);

  // El estado ya lo filtro la consulta; aqui queda la busqueda por responsable, que la pantalla
  // ofrece como texto libre y listarProyectos solo acepta como UUID.
  const proyectosFiltrados = useMemo(() => {
    const busqueda = filtrosState.responsable.trim().toLowerCase();
    if (!busqueda) return proyectos;
    return proyectos.filter((p) => p.responsableNombre?.toLowerCase().includes(busqueda));
  }, [proyectos, filtrosState.responsable]);

  const proyectoDetalle = useMemo(() => {
    return proyectos.find((p) => p.id === proyectoSeleccionadoId) || null;
  }, [proyectos, proyectoSeleccionadoId]);

  const manejarValidacion = (datosFormulario) => {
    const resultado = validarProyecto(datosFormulario);
    setErroresFormulario(resultado.errores || {});
    return resultado.esValido;
  };

  return {
    columnas: COLUMNAS_PROYECTO,
    filtros: FILTROS_PROYECTO,
    campos: CAMPOS_PROYECTO,
    tieneAccesoLectura,
    cargando,
    error,
    proyectos: proyectosFiltrados,
    proyectoDetalle,
    jornadasProyecto,
    puedeEditar,
    recargar: cargarProyectos,
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
