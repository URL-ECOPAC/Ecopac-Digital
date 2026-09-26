// View model del reporte de resultados de una jornada (issues #206 / #215, reconectado por #693).
//
// QUE PASO AQUI. Este hook devolvia datos escritos a mano -- "Jornada Comunidad Ejemplo",
// "Dr. Juan Pérez", cinco diagnosticos y cinco medicamentos inventados -- con un `TODO:
// Reemplazar por llamadas reales a API`. La pantalla lo montaba y presentaba todo eso como si
// fuera el resultado de la jornada. Mientras tanto obtenerReporteJornada() (jornada.api.js)
// existia, estaba probada y no la llamaba nadie.
//
// Ahora este hook solo orquesta: la consulta vive en jornada.api.js, que es la regla de
// docs/ARQUITECTURA-FRONTEND.md, y desde la 00148 el agregado lo hace la base (fn_reporte_jornada).
//
// EL NOMBRE DEL PERSONAL. Hasta la 00148 el reporte traia solo el UUID de quien atendio, y este
// hook lo resolvia cruzando el roster de la jornada y, si faltaba alguno, el directorio de
// perfiles: dos consultas mas, que a un rol consultivo le volvian vacias. Ahora la base devuelve
// el nombre junto con el conteo, y aqui solo se pinta.

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CAMPOS_FICHA_RESULTADOS_JORNADA,
  COLUMNAS_DIAGNOSTICOS_MAS_FRECUENTES,
  COLUMNAS_MEDICAMENTOS_MAS_ENTREGADOS,
  COLUMNAS_PERSONAL_PARTICIPANTE,
} from "./columnas.js";
import { obtenerReporteJornada, puedeVerReporteJornada } from "./jornada.api.js";

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
        mensaje: "No tienes acceso al reporte de resultados de la jornada.",
      });
      setCargando(false);
      return;
    }

    setCargando(true);
    const reporte = await obtenerReporteJornada({ jornadaId, rol });

    if (reporte.error) {
      setError(reporte.error);
      setDatos(null);
    } else {
      setError(null);
      setDatos(reporte.datos);
    }

    setCargando(false);
  }, [jornadaId, rol, tieneAcceso]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // ISSUE #862: cuando el nombre no se resuelve, la celda mostraba el UUID crudo. En un reporte
  // impreso eso es ruido, asi que se dice lo que de verdad se sabe: que hubo atenciones de alguien
  // cuyo nombre no se pudo leer (un perfil borrado, por ejemplo).
  const filasDePersonal = useMemo(
    () =>
      (datos?.personal_participante ?? []).map((fila) => ({
        ...fila,
        usuario_id: fila.nombre ?? "Persona no identificada",
      })),
    [datos],
  );

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
