import { useCallback, useEffect, useMemo, useState } from "react";

import { ESTADOS_JORNADA } from "../enums.js";
import { obtenerPresupuestoProyecto } from "../presupuestos/api.js";
import { listarJornadasDelProyecto, obtenerProyecto } from "./api.js";
import {
  actualizarAvance,
  actualizarHito,
  esPorcentajeDeAvanceValido,
  listarHitos,
  listarSeguimiento,
  marcarHitoCumplido,
  reabrirHito,
  registrarHito,
  registrarNota,
} from "./avance.api.js";
import { CAMPOS_HITO } from "./campos.js";

/**
 * View model de la ficha de seguimiento de un proyecto (pantalla de las issues #303/#304,
 * hitos y presupuesto ampliados por la auditoria #756).
 *
 * Hasta aqui el hook no consultaba nada: recibia `hitosIniciales`/`bitacoraInicial`/
 * `jornadasIniciales` por prop, y SeguimientoProyectoEnrutado (App.jsx) solo tenia el proyecto
 * que ya traia el listado en location.state -sin recargar la pagina no habia forma de perder ese
 * estado, pero los hitos, la bitacora y las jornadas asociadas estaban siempre vacios, porque
 * nada se los pasaba. Las lecturas (obtenerProyecto, listarHitos, listarSeguimiento,
 * listarJornadasDelProyecto) ya existian en el modulo sin que ningun hook las llamara. Ahora el
 * hook las llama el mismo con `proyectoId`, igual que useProyectosSociales hace con
 * listarProyectos().
 */
export function useSeguimientoProyecto({ proyectoId, proyectoInicial = null }) {
  const [proyecto, setProyecto] = useState(proyectoInicial);
  const [hitos, setHitos] = useState([]);
  const [bitacora, setBitacora] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [presupuesto, setPresupuesto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  const [nuevoPorcentaje, setNuevoPorcentaje] = useState(proyectoInicial?.porcentajeAvance ?? 0);
  const [nuevaNota, setNuevaNota] = useState("");
  const [errorAccion, setErrorAccion] = useState(null);
  const [erroresHito, setErroresHito] = useState({});
  const [enviando, setEnviando] = useState(false);

  const cargarHitos = useCallback(async () => {
    if (!proyectoId) return;
    const { hitos: datos } = await listarHitos(proyectoId);
    setHitos(datos ?? []);
  }, [proyectoId]);

  const cargar = useCallback(async () => {
    if (!proyectoId) {
      setCargando(false);
      return;
    }

    setCargando(true);
    const [resProyecto, resHitos, resBitacora, resJornadas, resPresupuesto] = await Promise.all([
      obtenerProyecto(proyectoId),
      listarHitos(proyectoId),
      listarSeguimiento(proyectoId),
      listarJornadasDelProyecto(proyectoId),
      obtenerPresupuestoProyecto(proyectoId),
    ]);

    setProyecto(resProyecto.proyecto);
    setErrorCarga(resProyecto.error);
    setHitos(resHitos.hitos ?? []);
    setBitacora(resBitacora.bitacora ?? []);
    setJornadas(resJornadas.jornadas ?? []);
    setPresupuesto(resPresupuesto.presupuesto);
    setNuevoPorcentaje(resProyecto.proyecto?.porcentajeAvance ?? 0);
    setCargando(false);
  }, [proyectoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const fechaHoy = new Date().toISOString().slice(0, 10);

  // Hitos procesados con estado de vencimiento
  const hitosProcesados = useMemo(() => {
    return hitos.map((hito) => {
      const esCumplido = Boolean(hito.fechaReal);
      const esVencido = !esCumplido && hito.fechaPrevista && hito.fechaPrevista < fechaHoy;
      return {
        ...hito,
        esCumplido,
        esVencido,
      };
    });
  }, [hitos, fechaHoy]);

  // Indicadores agregados de las jornadas vinculadas. El presupuesto sale de
  // obtenerPresupuestoProyecto() (presupuestos/api.js), que ya suma jornadas.presupuesto_asignado
  // en el servidor (decision #274: un proyecto no tiene columna de presupuesto propia).
  const indicadoresJornadas = useMemo(() => {
    const totalJornadas = jornadas.length;
    const completadas = jornadas.filter((j) => j.estado === ESTADOS_JORNADA.FINALIZADA).length;

    return {
      totalJornadas,
      completadas,
      presupuestoTotal: presupuesto?.asignado ?? 0,
    };
  }, [jornadas, presupuesto]);

  // Handler para actualizar avance y registrar la nota en la bitácora
  const guardarSeguimiento = async () => {
    if (!proyecto?.id) return false;

    setErrorAccion(null);
    const porcentajeNum = Number(nuevoPorcentaje);

    if (!esPorcentajeDeAvanceValido(porcentajeNum)) {
      setErrorAccion("El porcentaje de avance debe estar entre 0 y 100.");
      return false;
    }

    setEnviando(true);

    const resAvance = await actualizarAvance(proyecto.id, porcentajeNum);
    if (resAvance.error) {
      setErrorAccion(resAvance.error.mensaje || "Error al actualizar avance.");
      setEnviando(false);
      return false;
    }

    if (nuevaNota.trim() !== "") {
      const resNota = await registrarNota(proyecto.id, nuevaNota.trim());
      if (resNota.error) {
        setErrorAccion(resNota.error.mensaje || "Error al registrar nota.");
        setEnviando(false);
        return false;
      }
      if (resNota.entrada) {
        setBitacora((prev) => [resNota.entrada, ...prev]);
      }
    }

    setProyecto((prev) => ({ ...prev, porcentajeAvance: porcentajeNum }));
    setNuevaNota("");
    setEnviando(false);
    return true;
  };

  // Handler para cambiar cumplimiento del hito
  const cambiarEstadoHito = async (hitoId, completado) => {
    setEnviando(true);
    const fechaRealActualizada = completado ? fechaHoy : null;

    const res = completado
      ? await marcarHitoCumplido(hitoId, fechaRealActualizada)
      : await reabrirHito(hitoId);

    if (res.error) {
      setErrorAccion(res.error.mensaje || "Error al actualizar hito.");
      setEnviando(false);
      return;
    }

    setHitos((prev) =>
      prev.map((h) => (h.id === hitoId ? { ...h, fechaReal: fechaRealActualizada } : h)),
    );
    setEnviando(false);
  };

  /**
   * Crea o corrige un hito (issue #756: proyecto_hitos no tenia formulario de alta, y fechaReal
   * solo se podia poner en hoy/NULL desde el checkbox de cambiarEstadoHito). Valida solo lo que
   * CAMPOS_HITO declara requerido: no hay validarHito() propio, es la unica pantalla que escribe
   * esta tabla a mano.
   */
  const guardarHito = useCallback(
    async (hitoId, datosFormulario) => {
      const errores = {};
      if (!datosFormulario?.nombre?.trim()) errores.nombre = "El nombre del hito es obligatorio.";
      if (!datosFormulario?.fechaPrevista) {
        errores.fechaPrevista = "La fecha prevista es obligatoria.";
      }
      setErroresHito(errores);
      if (Object.keys(errores).length > 0) return { ok: false, errores };

      if (!proyecto?.id) return { ok: false };

      const resultado = hitoId
        ? await actualizarHito(hitoId, datosFormulario)
        : await registrarHito(proyecto.id, datosFormulario);

      if (resultado.error) return { ok: false, error: resultado.error };

      await cargarHitos();
      return { ok: true, hito: resultado.hito };
    },
    [proyecto, cargarHitos],
  );

  return {
    proyecto,
    hitos: hitosProcesados,
    bitacora,
    jornadas,
    indicadoresJornadas,
    campos: CAMPOS_HITO,
    cargando,
    errorCarga,
    nuevoPorcentaje,
    setNuevoPorcentaje,
    nuevaNota,
    setNuevaNota,
    errorAccion,
    erroresHito,
    cargandoAccion: enviando,
    guardarSeguimiento,
    cambiarEstadoHito,
    guardarHito,
    recargar: cargar,
  };
}
