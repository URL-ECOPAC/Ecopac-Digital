import { useState, useMemo } from "react";
import {
  actualizarAvance,
  registrarNota,
  marcarHitoCumplido,
  reabrirHito,
  esPorcentajeDeAvanceValido,
} from "./avance.api.js";

export function useSeguimientoProyecto({
  proyectoInicial = null,
  hitosIniciales = [],
  bitacoraInicial = [],
  jornadasIniciales = [],
  usuarioActual = "Usuario",
}) {
  const [proyecto, setProyecto] = useState(proyectoInicial);
  const [hitos, setHitos] = useState(hitosIniciales);
  const [bitacora, setBitacora] = useState(bitacoraInicial);
  const [jornadas] = useState(jornadasIniciales);

  const [nuevoPorcentaje, setNuevoPorcentaje] = useState(proyectoInicial?.porcentajeAvance ?? 0);
  const [nuevaNota, setNuevaNota] = useState("");
  const [errorAccion, setErrorAccion] = useState(null);
  const [cargando, setCargando] = useState(false);

  // Fecha de hoy en formato YYYY-MM-DD para detectar hitos vencidos
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

  // Indicadores agregados de las jornadas vinculadas
  const indicadoresJornadas = useMemo(() => {
    const totalJornadas = jornadas.length;
    const completadas = jornadas.filter((j) => j.estado === "Completada" || j.estado === "Finalizada").length;
    const presupuestoTotal = jornadas.reduce((sum, j) => sum + (Number(j.presupuesto) || 0), 0);
    const beneficiariosTotales = jornadas.reduce((sum, j) => sum + (Number(j.beneficiarios) || 0), 0);

    return {
      totalJornadas,
      completadas,
      presupuestoTotal,
      beneficiariosTotales,
    };
  }, [jornadas]);

  // Handler para actualizar avance y registrar la nota en la bitácora
  const guardarSeguimiento = async () => {
    setErrorAccion(null);
    const porcentajeNum = Number(nuevoPorcentaje);

    if (!esPorcentajeDeAvanceValido(porcentajeNum)) {
      setErrorAccion("El porcentaje de avance debe estar entre 0 y 100.");
      return false;
    }

    setCargando(true);

    if (proyecto?.id) {
      const resAvance = await actualizarAvance(proyecto.id, porcentajeNum);
      if (resAvance.error) {
        setErrorAccion(resAvance.error.mensaje || "Error al actualizar avance.");
        setCargando(false);
        return false;
      }

      if (nuevaNota.trim() !== "") {
        const resNota = await registrarNota(proyecto.id, nuevaNota.trim());
        if (resNota.error) {
          setErrorAccion(resNota.error.mensaje || "Error al registrar nota.");
          setCargando(false);
          return false;
        }
        if (resNota.entrada) {
          setBitacora((prev) => [resNota.entrada, ...prev]);
        }
      }
    } else {
      // Modo local/mock
      const notaLocal = nuevaNota.trim()
        ? {
            id: Date.now().toString(),
            nota: nuevaNota.trim(),
            porcentajeAnterior: proyecto?.porcentajeAvance ?? 0,
            porcentajeNuevo: porcentajeNum,
            registradoPor: usuarioActual,
            createdAt: new Date().toISOString(),
          }
        : null;

      if (notaLocal) {
        setBitacora((prev) => [notaLocal, ...prev]);
      }
    }

    setProyecto((prev) => ({ ...prev, porcentajeAvance: porcentajeNum }));
    setNuevaNota("");
    setCargando(false);
    return true;
  };

  // Handler para cambiar cumplimiento del hito
  const cambiarEstadoHito = async (hitoId, completado) => {
    setCargando(true);
    let fechaRealActualizada = completado ? fechaHoy : null;

    if (proyecto?.id) {
      const res = completado ? await marcarHitoCumplido(hitoId, fechaRealActualizada) : await reabrirHito(hitoId);
      if (res.error) {
        setErrorAccion(res.error.mensaje || "Error al actualizar hito.");
        setCargando(false);
        return;
      }
    }

    setHitos((prev) =>
      prev.map((h) => (h.id === hitoId ? { ...h, fechaReal: fechaRealActualizada } : h))
    );
    setCargando(false);
  };

  return {
    proyecto,
    hitos: hitosProcesados,
    bitacora,
    indicadoresJornadas,
    nuevoPorcentaje,
    setNuevoPorcentaje,
    nuevaNota,
    setNuevaNota,
    errorAccion,
    cargando,
    guardarSeguimiento,
    cambiarEstadoHito,
  };
}