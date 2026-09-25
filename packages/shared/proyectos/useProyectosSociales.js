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
import { listarMedicamentos } from "../inventario/medicamentos.api.js";
import { listarJornadas } from "../jornadas/api.js";
import { listarGastos, obtenerPresupuestoProyecto } from "../presupuestos/api.js";
import { puedeRegistrarGasto } from "../presupuestos/permisos.js";
import { listarUsuarios } from "../usuarios/api.js";
import {
  actualizarProyecto,
  asociarJornadaAProyecto,
  cambiarEstadoProyecto,
  crearProyecto,
  listarJornadasDelProyecto,
  listarProyectos,
} from "./api.js";
import {
  COLUMNAS_GASTO_DE_PROYECTO,
  COLUMNAS_INSUMO_PROYECTO,
  COLUMNAS_PROYECTO,
} from "./columnas.js";
import {
  asignarPersonalAProyecto,
  desasignarPersonalDeProyecto,
  listarEquipoDelProyecto,
} from "./equipo.api.js";
import {
  FILTROS_PROYECTO,
  FILTROS_PROYECTO_PANTALLA_VACIOS,
  hayFiltrosDeProyecto,
  soloJornadasSinProyecto,
} from "./filtros.js";
import { CAMPOS_INSUMO_PROYECTO, CAMPOS_PROYECTO } from "./campos.js";
import {
  actualizarInsumoDeProyecto,
  agregarInsumoAProyecto,
  listarInsumosDelProyecto,
  quitarInsumoDeProyecto,
} from "./insumos.api.js";
import { validarInsumoDeProyecto, validarProyecto } from "./validaciones.js";
import { permisosDeProyectos, puedeVerProyectos } from "./permisos.js";

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

/**
 * Pantalla de proyectos: listado filtrable, detalle con sus jornadas, alta, edicion y cambio de
 * estado (el kanban de movil). Lo que ve cada rol lo decide RLS; `permisos` solo decide que se ofrece.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.usuarioRol] Rol de la sesion.
 * @returns {object} `{ columnas, filtros, campos, tieneAccesoLectura, cargando, error, proyectos,
 *   proyectoDetalle, jornadasProyecto, catalogos, puedeEditar, permisos, ... }`.
 */
export function useProyectosSociales({ usuarioRol } = {}) {
  const tieneAccesoLectura = puedeVerProyectos(usuarioRol);

  const [proyectos, setProyectos] = useState([]);
  const [jornadasProyecto, setJornadasProyecto] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [filtrosState, setFiltrosState] = useState(FILTROS_PROYECTO_PANTALLA_VACIOS);
  const [proyectoSeleccionadoId, setProyectoSeleccionadoId] = useState(null);
  const [tabActivo, setTabActivo] = useState("resumen");
  const [erroresFormulario, setErroresFormulario] = useState({});

  // Lo que puede hacer el rol lo decide permisos.js; la pantalla solo lee estas banderas.
  const permisos = useMemo(() => permisosDeProyectos(usuarioRol), [usuarioRol]);
  const puedeEditar = permisos.puedeEditar;
  const puedeRegistrarGastos = permisos.puedeVerInsumosYGastos && puedeRegistrarGasto(usuarioRol);

  const [presupuestoProyecto, setPresupuestoProyecto] = useState(null);
  const [gastosProyecto, setGastosProyecto] = useState([]);
  const [cargandoGastos, setCargandoGastos] = useState(false);
  const [errorGastos, setErrorGastos] = useState(null);
  const [jornadasDisponibles, setJornadasDisponibles] = useState([]);
  const [errorJornadas, setErrorJornadas] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [cargandoInsumos, setCargandoInsumos] = useState(false);
  const [errorInsumos, setErrorInsumos] = useState(null);
  const [erroresInsumo, setErroresInsumo] = useState({});
  const [articulos, setArticulos] = useState([]);
  const [equipo, setEquipo] = useState([]);
  const [cargandoEquipo, setCargandoEquipo] = useState(false);
  const [errorEquipo, setErrorEquipo] = useState(null);

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
  const cargarJornadasDelProyecto = useCallback(async () => {
    if (!proyectoSeleccionadoId) {
      setJornadasProyecto([]);
      return;
    }
    const { jornadas } = await listarJornadasDelProyecto(proyectoSeleccionadoId);
    setJornadasProyecto(jornadas ?? []);
  }, [proyectoSeleccionadoId]);

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

  // Presupuesto del proyecto abierto para el Resumen. Solo se pide a quien puede ver dinero
  // (#864): al medico ni se le consulta, no basta con esconder el numero. `proyectos` no trae
  // presupuesto (COLUMNAS_DEL_PROYECTO), por eso el Resumen mostraba siempre 0.00.
  useEffect(() => {
    let vigente = true;
    setPresupuestoProyecto(null);

    if (!proyectoSeleccionadoId || !permisos.puedeVerInsumosYGastos) {
      return () => {
        vigente = false;
      };
    }

    obtenerPresupuestoProyecto(proyectoSeleccionadoId).then(({ presupuesto }) => {
      if (vigente) setPresupuestoProyecto(presupuesto ?? null);
    });

    return () => {
      vigente = false;
    };
  }, [proyectoSeleccionadoId, permisos.puedeVerInsumosYGastos]);

  const cargarGastosDelProyecto = useCallback(async () => {
    if (!proyectoSeleccionadoId || !permisos.puedeVerInsumosYGastos) {
      setGastosProyecto([]);
      return;
    }
    setCargandoGastos(true);
    const { gastos, error: fallo } = await listarGastos({ proyecto_id: proyectoSeleccionadoId });
    setGastosProyecto(gastos);
    setErrorGastos(fallo);
    setCargandoGastos(false);
  }, [proyectoSeleccionadoId, permisos.puedeVerInsumosYGastos]);

  // Los gastos y las jornadas candidatas se piden al abrir su pestana, no al abrir el proyecto.
  useEffect(() => {
    if (tabActivo === "gastos") cargarGastosDelProyecto();
  }, [tabActivo, cargarGastosDelProyecto]);

  const cargarJornadasDisponibles = useCallback(async () => {
    if (!permisos.puedeAsociarJornadas) {
      setJornadasDisponibles([]);
      return;
    }
    const { jornadas, error: fallo } = await listarJornadas();
    setJornadasDisponibles(soloJornadasSinProyecto(jornadas));
    if (fallo) setErrorJornadas(fallo);
  }, [permisos.puedeAsociarJornadas]);

  useEffect(() => {
    if (tabActivo === "jornadas" && proyectoSeleccionadoId) cargarJornadasDisponibles();
  }, [tabActivo, proyectoSeleccionadoId, cargarJornadasDisponibles]);

  // Insumos previstos: planificacion con dinero, solo para quien ve insumos y gastos (#864).
  const cargarInsumos = useCallback(async () => {
    if (!proyectoSeleccionadoId || !permisos.puedeVerInsumosYGastos) {
      setInsumos([]);
      return;
    }
    setCargandoInsumos(true);
    const { insumos: filas, error: fallo } = await listarInsumosDelProyecto(proyectoSeleccionadoId);
    setInsumos(filas);
    setErrorInsumos(fallo);
    setCargandoInsumos(false);
  }, [proyectoSeleccionadoId, permisos.puedeVerInsumosYGastos]);

  useEffect(() => {
    if (tabActivo === "insumos") cargarInsumos();
  }, [tabActivo, cargarInsumos]);

  // Catalogo de articulos que se pueden prever: el MISMO que ofrece "Producto / Insumo" en
  // "Registrar ingreso al inventario" (InventarioPage lo arma con listarMedicamentos(), sin filtrar
  // por tipo), con la misma etiqueta "nombre (concentracion)". Asi lo previsto sale del catalogo
  // donde despues se registra su ingreso.
  useEffect(() => {
    if (tabActivo !== "insumos" || !permisos.puedeGestionarInsumos) return undefined;

    let vigente = true;
    listarMedicamentos().then(({ medicamentos }) => {
      if (!vigente) return;
      setArticulos(
        (medicamentos ?? []).map((articulo) => ({
          value: articulo.id,
          label: articulo.concentracion
            ? `${articulo.nombre} (${articulo.concentracion})`
            : articulo.nombre,
        })),
      );
    });
    return () => {
      vigente = false;
    };
  }, [tabActivo, permisos.puedeGestionarInsumos]);

  // A quien todavia no se le previo nada: un articulo figura una sola vez por proyecto.
  const articulosDisponibles = useMemo(() => {
    const yaPrevistos = new Set(insumos.map((insumo) => insumo.medicamentoId));
    return articulos.filter((articulo) => !yaPrevistos.has(articulo.value));
  }, [articulos, insumos]);

  // Suma de lo que si tiene costo; los que no lo tienen se cuentan aparte para no fingir un total.
  const resumenDeInsumos = useMemo(
    () => ({
      totalEstimado:
        Math.round(
          insumos.reduce((suma, insumo) => suma + (insumo.costoTotalEstimado ?? 0), 0) * 100,
        ) / 100,
      sinCosto: insumos.filter((insumo) => insumo.costoTotalEstimado === null).length,
    }),
    [insumos],
  );

  /** Agrega (`insumoId` null) o edita un insumo previsto del proyecto abierto. */
  const guardarInsumo = useCallback(
    async (insumoId, datosFormulario) => {
      if (!permisos.puedeGestionarInsumos || !proyectoSeleccionadoId) return { ok: false };

      const errores = validarInsumoDeProyecto(datosFormulario, { esAlta: !insumoId });
      setErroresInsumo(errores);
      if (hayErrores(errores)) return { ok: false, errores };

      const resultado = insumoId
        ? await actualizarInsumoDeProyecto(insumoId, datosFormulario)
        : await agregarInsumoAProyecto(proyectoSeleccionadoId, datosFormulario);
      if (resultado.error) return { ok: false, error: resultado.error };

      await cargarInsumos();
      return { ok: true, insumo: resultado.insumo };
    },
    [permisos.puedeGestionarInsumos, proyectoSeleccionadoId, cargarInsumos],
  );

  /** Quita un insumo de la lista. `ok: false` sin error significa que la base no lo dejo. */
  const quitarInsumo = useCallback(
    async (insumoId) => {
      if (!permisos.puedeGestionarInsumos) return { ok: false, error: null };

      const { quitado, error: fallo } = await quitarInsumoDeProyecto(insumoId);
      setErrorInsumos(fallo);
      if (fallo) return { ok: false, error: fallo };
      if (!quitado) return { ok: false, error: null };

      await cargarInsumos();
      return { ok: true, error: null };
    },
    [permisos.puedeGestionarInsumos, cargarInsumos],
  );

  const cargarEquipo = useCallback(async () => {
    if (!proyectoSeleccionadoId) {
      setEquipo([]);
      return;
    }
    setCargandoEquipo(true);
    const { equipo: miembros, error: fallo } =
      await listarEquipoDelProyecto(proyectoSeleccionadoId);
    setEquipo(miembros);
    setErrorEquipo(fallo);
    setCargandoEquipo(false);
  }, [proyectoSeleccionadoId]);

  useEffect(() => {
    if (tabActivo === "equipo") cargarEquipo();
  }, [tabActivo, cargarEquipo]);

  // A quien todavia se puede agregar: el catalogo de personas activas menos quien ya esta.
  const personalDisponible = useMemo(() => {
    const yaEnElEquipo = new Set(equipo.map((miembro) => miembro.perfilId));
    return perfiles.filter((perfil) => !yaEnElEquipo.has(perfil.value));
  }, [perfiles, equipo]);

  /** Agrega a `perfilId` al equipo del proyecto abierto. `rolEnProyecto` es opcional. */
  const agregarAlEquipo = useCallback(
    async (perfilId, rolEnProyecto) => {
      if (!permisos.puedeGestionarEquipo || !proyectoSeleccionadoId) {
        return { ok: false, error: null };
      }
      const { error: fallo } = await asignarPersonalAProyecto(proyectoSeleccionadoId, {
        perfilId,
        rolEnProyecto,
      });
      setErrorEquipo(fallo);
      if (fallo) return { ok: false, error: fallo };

      await cargarEquipo();
      return { ok: true, error: null };
    },
    [permisos.puedeGestionarEquipo, proyectoSeleccionadoId, cargarEquipo],
  );

  /** Quita a `perfilId` del equipo del proyecto abierto. */
  const quitarDelEquipo = useCallback(
    async (perfilId) => {
      if (!permisos.puedeGestionarEquipo || !proyectoSeleccionadoId) {
        return { ok: false, error: null };
      }
      const { desasignado, error: fallo } = await desasignarPersonalDeProyecto(
        proyectoSeleccionadoId,
        perfilId,
      );
      setErrorEquipo(fallo);
      if (fallo) return { ok: false, error: fallo };
      // RLS no avisa cuando no deja borrar: cero filas. Se dice, no se finge que se quito.
      if (!desasignado) return { ok: false, error: null };

      await cargarEquipo();
      return { ok: true, error: null };
    },
    [permisos.puedeGestionarEquipo, proyectoSeleccionadoId, cargarEquipo],
  );

  /**
   * Asocia una jornada al proyecto abierto, o la quita si `asociar` es false. Delega en
   * asociarJornadaAProyecto() (api.js); aqui solo se filtra por permiso y se recargan las dos
   * listas para que la jornada cambie de lado sin recargar la pantalla.
   */
  const cambiarAsociacionDeJornada = useCallback(
    async (jornadaId, asociar) => {
      if (!permisos.puedeAsociarJornadas || !proyectoSeleccionadoId) {
        return { ok: false, error: null };
      }
      const { error: fallo } = await asociarJornadaAProyecto(
        jornadaId,
        asociar ? proyectoSeleccionadoId : null,
      );
      setErrorJornadas(fallo);
      if (fallo) return { ok: false, error: fallo };

      await Promise.all([cargarJornadasDelProyecto(), cargarJornadasDisponibles()]);
      return { ok: true, error: null };
    },
    [
      permisos.puedeAsociarJornadas,
      proyectoSeleccionadoId,
      cargarJornadasDelProyecto,
      cargarJornadasDisponibles,
    ],
  );

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

  const limpiarFiltros = useCallback(() => setFiltrosState(FILTROS_PROYECTO_PANTALLA_VACIOS), []);

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
    permisos,
    puedeRegistrarGastos,
    presupuestoProyecto,
    columnasGastos: COLUMNAS_GASTO_DE_PROYECTO,
    gastosProyecto,
    cargandoGastos,
    errorGastos,
    recargarGastos: cargarGastosDelProyecto,
    jornadasDisponibles,
    errorJornadas,
    insumos,
    cargandoInsumos,
    errorInsumos,
    erroresInsumo,
    columnasInsumos: COLUMNAS_INSUMO_PROYECTO,
    camposInsumo: CAMPOS_INSUMO_PROYECTO,
    catalogosInsumo: { articulos: articulosDisponibles },
    resumenDeInsumos,
    guardarInsumo,
    quitarInsumo,
    equipo,
    cargandoEquipo,
    errorEquipo,
    personalDisponible,
    agregarAlEquipo,
    quitarDelEquipo,
    asociarJornada: (jornadaId) => cambiarAsociacionDeJornada(jornadaId, true),
    quitarJornada: (jornadaId) => cambiarAsociacionDeJornada(jornadaId, false),
    cambiarEtapaProyecto,
    guardarProyecto,
    recargar: cargarProyectos,
    filtrosState,
    setFiltrosState,
    limpiarFiltros,
    hayFiltros: hayFiltrosDeProyecto(filtrosState),
    proyectoSeleccionadoId,
    setProyectoSeleccionadoId,
    tabActivo,
    setTabActivo,
    erroresFormulario,
    manejarValidacion,
  };
}
