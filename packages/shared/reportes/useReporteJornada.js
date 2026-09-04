// View model del reporte de resultados de una jornada (issues #206 / #215, reconectado por #693).
//
// QUE PASO AQUI. Este hook devolvia datos escritos a mano -- "Jornada Comunidad Ejemplo",
// "Dr. Juan Pérez", cinco diagnosticos y cinco medicamentos inventados -- con un `TODO:
// Reemplazar por llamadas reales a API`. La pantalla lo montaba y presentaba todo eso como si
// fuera el resultado de la jornada. Mientras tanto obtenerReporteJornada() (jornada.api.js)
// existia, estaba probada (178 lineas de pruebas) y no la llamaba nadie.
//
// Ahora este hook solo orquesta: la consulta y la agregacion viven en jornada.api.js, que es la
// regla de docs/ARQUITECTURA-FRONTEND.md. La guarda de rol tambien sale de alli
// (puedeVerReporteJornada), y es el espejo de las politicas de la 00033: solo administrador y
// medico leen consultas, recetas y diagnosticos. La 00054 retiro a proposito el acceso de los
// roles consultivos a esas tablas.
//
// EL NOMBRE DEL PERSONAL. obtenerReporteJornada() devuelve `personal_participante` como
// [{ usuario_id, total_atenciones }]: solo el UUID, porque agrega sobre consultas.medico_id y
// ahi no hay nombre. Resolverlo es trabajo de este hook, tal como dice el comentario de
// COLUMNAS_PERSONAL_PARTICIPANTE en columnas.js. Se cruza contra obtenerPersonalDeJornada(), que
// ya trae el perfil embebido, en vez de pedir los perfiles uno por uno.

import { useCallback, useEffect, useMemo, useState } from "react";

import { obtenerPersonalDeJornada } from "../jornadas/api.js";
import {
  CAMPOS_FICHA_RESULTADOS_JORNADA,
  COLUMNAS_DIAGNOSTICOS_MAS_FRECUENTES,
  COLUMNAS_MEDICAMENTOS_MAS_ENTREGADOS,
  COLUMNAS_PERSONAL_PARTICIPANTE,
} from "./columnas.js";
import { obtenerReporteJornada, puedeVerReporteJornada } from "./jornada.api.js";

/** Indice de perfilId a nombre completo, para resolver los UUID del conteo de atenciones. */
function indexarNombres(personal = []) {
  const porId = new Map();
  for (const fila of personal) {
    const nombre = [fila.perfil?.nombres, fila.perfil?.apellidos].filter(Boolean).join(" ").trim();
    if (fila.perfilId && nombre) porId.set(fila.perfilId, nombre);
  }
  return porId;
}

/**
 * Reporte de resultados de una jornada.
 *
 * @param {string} jornadaId
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de quien consulta.
 */
export function useReporteJornada(jornadaId, { rol } = {}) {
  const tieneAcceso = puedeVerReporteJornada(rol);

  const [datos, setDatos] = useState(null);
  const [personal, setPersonal] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!jornadaId) {
      setDatos(null);
      setCargando(false);
      return;
    }

    if (!tieneAcceso) {
      setDatos(null);
      setError({
        codigo: "SIN_PERMISO",
        mensaje: "Solo administracion y medico consultan el reporte de resultados de la jornada.",
      });
      setCargando(false);
      return;
    }

    setCargando(true);

    // Las dos consultas son independientes: se lanzan juntas en vez de en cadena.
    const [reporte, roster] = await Promise.all([
      obtenerReporteJornada({ jornadaId, rol }),
      obtenerPersonalDeJornada(jornadaId),
    ]);

    if (reporte.error) {
      setError(reporte.error);
      setDatos(null);
    } else {
      setError(null);
      setDatos(reporte.datos);
      // Un fallo al traer el roster no invalida el reporte: se pierden los nombres, no las
      // cifras, y la fila cae al UUID.
      setPersonal(roster.error ? [] : roster.personal);
    }

    setCargando(false);
  }, [jornadaId, rol, tieneAcceso]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filasDePersonal = useMemo(() => {
    const nombres = indexarNombres(personal);
    return (datos?.personal_participante ?? []).map((fila) => ({
      ...fila,
      usuario_id: nombres.get(fila.usuario_id) ?? fila.usuario_id,
    }));
  }, [datos, personal]);

  const ficha = useMemo(() => {
    if (!datos?.jornada) return null;
    return {
      nombre: datos.jornada.nombre,
      fecha: datos.jornada.fecha,
      comunidad: datos.jornada.comunidad?.nombre ?? "",
      estado: datos.jornada.estado,
      total_consultas: datos.resumen?.total_consultas ?? 0,
      pacientes_atendidos: datos.resumen?.pacientes_atendidos ?? 0,
    };
  }, [datos]);

  return {
    tieneAcceso,
    cargando,
    error,
    ficha,
    camposDeFicha: CAMPOS_FICHA_RESULTADOS_JORNADA,
    diagnosticos: datos?.diagnosticos_mas_frecuentes ?? [],
    columnasDeDiagnosticos: COLUMNAS_DIAGNOSTICOS_MAS_FRECUENTES,
    medicamentos: datos?.medicamentos_mas_entregados ?? [],
    columnasDeMedicamentos: COLUMNAS_MEDICAMENTOS_MAS_ENTREGADOS,
    personal: filasDePersonal,
    columnasDePersonal: COLUMNAS_PERSONAL_PARTICIPANTE,
    recargar: cargar,
  };
}
