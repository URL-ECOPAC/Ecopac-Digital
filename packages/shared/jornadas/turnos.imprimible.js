// Datos del cuadro de turnos para imprimir (issue #185, criterio 4): solo lo aprobado para un
// papel que puede quedar pegado en la pared del lugar de la jornada -- nombre, rol en la
// jornada, horario y responsabilidad. Nada de contacto (telefono, correo, que ademas
// jornada.personal ni siquiera trae) ni de datos clinicos de la jornada (los contadores de
// vista_reporte_impacto): esto es una tabla de "quien, que rol, que horario, que
// responsabilidad" y nada mas.
//
// Mismo patron que pacientes/recetas.imprimible.js (#131): una funcion pura que arma los datos
// en shared: el componente de apps/web (CuadroTurnosImprimible.jsx) solo los dibuja y llama a
// window.print(), que es API de plataforma y no puede vivir aca.

import { etiquetaDeRol } from "../usuarios/roles.js";
import { nombreCompletoDe } from "../usuarios/useUsuariosListado.js";

export const ENCABEZADO_CUADRO_TURNOS = Object.freeze({
  organizacion: "Ecopac Guatemala",
  documento: "Cuadro de turnos",
});

/**
 * @param {object} [args]
 * @param {object} [args.jornada] Jornada con `personal` embebido (obtenerJornada(),
 *   jornadas/api.js).
 * @returns {object|null} `null` si no hay jornada. `filas` viene ordenada por hora de inicio.
 */
export function datosDeCuadroTurnosImprimible({ jornada } = {}) {
  if (!jornada) return null;

  const filas = (jornada.personal ?? [])
    .slice()
    .sort((a, b) => (a.horaInicio ?? "").localeCompare(b.horaInicio ?? ""))
    .map((fila) => ({
      id: fila.id,
      nombre: nombreCompletoDe(fila.perfil) || null,
      rol: etiquetaDeRol(fila.rolEnJornada),
      horaInicio: fila.horaInicio ?? null,
      horaFin: fila.horaFin ?? null,
      responsabilidad: fila.responsabilidad ?? null,
    }));

  return {
    ...ENCABEZADO_CUADRO_TURNOS,
    jornada: jornada.nombre ?? null,
    fecha: jornada.fecha ?? null,
    comunidad: jornada.comunidad?.nombre ?? null,
    filas,
  };
}
