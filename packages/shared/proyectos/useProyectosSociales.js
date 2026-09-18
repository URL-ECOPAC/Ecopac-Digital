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

import { hayErrores } from "../validations/index.js";
import { listarUsuarios } from "../usuarios/api.js";
import {
  actualizarProyecto,
  cambiarEstadoProyecto,
  crearProyecto,
  listarJornadasDelProyecto,
  listarProyectos,
} from "./api.js";
import { COLUMNAS_PROYECTO } from "./columnas.js";
import { FILTROS_PROYECTO } from "./filtros.js";
import { CAMPOS_PROYECTO } from "./campos.js";
import { validarProyecto } from "./validaciones.js";
import { puedeAdministrarProyectos, puedeVerProyectos } from "./permisos.js";

/** Mismo criterio que jornadas/useFormularioJornada.js: nombre completo para un <select>. */
function nombreDePerfil(perfil) {
  return [perfil.nombres, perfil.apellidos].filter(Boolean).join(" ");
}

/**
 * Decide si el formulario de un proyecto se puede guardar, y con que errores.
 *
 * SE EXPORTA APARTE PARA PODER PROBARLA. packages/shared corre vitest en entorno "node" y sus
 * hooks no se montan (ver la cabecera de useRegistroDonacion.test.js), asi que una decision que
 * vive solo dentro del cuerpo del hook es una decision sin prueba. Esta lo era, y por eso el
 * defecto de abajo sobrevivio a lint, build y a las pruebas del modulo.
 *
 * QUE ESTABA MAL. El hook leia `resultado.esValido` y `resultado.errores` de validarProyecto(),
 * que no devuelve ninguna de las dos cosas: devuelve el objeto plano `{ campo: mensaje }` que es
 * la forma unica de los validadores del monorepo (packages/shared/validations/index.js lo
 * documenta en su cabecera, y validations/contrato.test.js ahora lo comprueba). Las dos lecturas
 * daban `undefined`, asi que `esValido` era siempre falsy: guardarProyecto() cortaba antes de
 * llamar a crearProyecto() y "Crear proyecto" no creaba nada. Y como los errores tambien salian
 * vacios, el formulario tampoco decia por que (issue #840). Leer una propiedad que no existe no
 * lanza -- devuelve undefined --, que es justo lo que AGENTS.md pide que deje de pasar.
 *
 * @param {object} valores Valores del formulario, indexados por el id de CAMPOS_PROYECTO.
 * @returns {{ ok: boolean, errores: Record<string, string> }}
 */
export function validacionDeProyecto(valores) {
  const errores = validarProyecto(valores);
  return { ok: !hayErrores(errores), errores };
}

export function useProyectosSociales({ usuarioRol } = {}) {
  const tieneAccesoLectura = puedeVerProyectos(usuarioRol);

  const [proyectos, setProyectos] = useState([]);
  const [jornadasProyecto, setJornadasProyecto] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
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

  // Catalogo del <select> de responsable en el formulario de alta/edicion; no depende de los
  // filtros de la lista, se carga una sola vez.
  useEffect(() => {
    if (!tieneAccesoLectura) return;

    let vigente = true;
    listarUsuarios({ estado: true }).then(({ usuarios }) => {
      if (vigente) {
        setPerfiles(
          (usuarios ?? []).map((usuario) => ({
            value: usuario.id,
            label: nombreDePerfil(usuario),
          })),
        );
      }
    });

    return () => {
      vigente = false;
    };
  }, [tieneAccesoLectura]);

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
    const resultado = validacionDeProyecto(datosFormulario);
    setErroresFormulario(resultado.errores);
    return resultado;
  };

  /**
   * Crea o edita un proyecto (issue #756: "+ Nuevo Proyecto" no tenia onClick pese a que
   * crearProyecto()/actualizarProyecto() ya existian en api.js). Sin id crea; con id edita.
   */
  const guardarProyecto = useCallback(
    async (id, datosFormulario) => {
      const validacion = manejarValidacion(datosFormulario);
      if (!validacion.ok) return { ok: false, errores: validacion.errores };

      const resultado = id
        ? await actualizarProyecto(id, datosFormulario)
        : await crearProyecto(datosFormulario);

      if (resultado.error) return { ok: false, error: resultado.error };

      await cargarProyectos();
      return { ok: true, proyecto: resultado.proyecto };
    },
    [cargarProyectos],
  );

  /**
   * Mueve un proyecto a otro estado (tablero kanban de la app movil, issue #688). Delega en
   * cambiarEstadoProyecto() (api.js), que ya valida la transicion y espeja al trigger
   * tr_validar_transicion_estado_proyecto (00029); aqui solo se filtra por permiso antes de
   * intentarlo y se recarga la lista despues, para que el resto de la pantalla (metricas,
   * columnas del kanban) vea el estado nuevo sin esperar a un recargar() manual.
   */
  const cambiarEtapaProyecto = useCallback(
    async (id, nuevoEstado) => {
      if (!puedeEditar) {
        return {
          proyecto: null,
          error: { mensaje: "No tienes permiso para cambiar el estado de un proyecto." },
        };
      }

      const resultado = await cambiarEstadoProyecto(id, nuevoEstado);
      if (!resultado.error) await cargarProyectos();
      return resultado;
    },
    [puedeEditar, cargarProyectos],
  );

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
    catalogos: { perfiles },
    puedeEditar,
    cambiarEtapaProyecto,
    guardarProyecto,
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
