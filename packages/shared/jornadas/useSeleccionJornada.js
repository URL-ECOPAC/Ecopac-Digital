// Pieza pura de la pantalla de seleccion de jornada activa (issue #186).
//
// No vuelve a llamar useJornadaActiva(): la pantalla ya la recibe de un contexto compartido
// (apps/mobile/src/contexto/JornadaActivaProvider.js), mismo motivo por el que
// RegistroPacienteScreen/TriajeScreen/ConsultaScreen reciben jornadaId/jornada por parametro en
// vez de resolverlo cada una. Este archivo solo agrega lo que useJornadaActiva() no calcula:
// el mensaje del criterio 3 (por que no se puede registrar, cuando no hay ninguna jornada en
// curso).

/**
 * Explica por que no hay una jornada activa para elegir (issue #186, criterio 3).
 *
 * useJornadaActiva() deja `motivoBloqueo` en null cuando jornadaId es null (ver
 * useJornadaActiva.js:117-130): no distingue "no estas asignada a ninguna jornada" de "tus
 * jornadas asignadas no estan en curso ahora mismo" (planificadas o ya finalizadas). Esta
 * funcion si distingue, comparando el total de jornadas asignadas contra las que estan en curso.
 *
 * @param {object[]} jornadasAsignadas Todas las jornadas donde la persona esta asignada.
 * @param {object[]} jornadasEnCurso Subconjunto en curso ahora mismo.
 * @returns {string|null} El mensaje para la pantalla, o null si SI hay jornadas en curso.
 */
export function mensajeSinJornada(jornadasAsignadas = [], jornadasEnCurso = []) {
  if (jornadasEnCurso.length > 0) return null;

  if (jornadasAsignadas.length === 0) {
    return (
      "No estas asignada a ninguna jornada todavia. Sin una jornada asignada no se pueden " +
      "registrar consultas."
    );
  }

  return (
    "Tenes jornadas asignadas, pero ninguna esta en curso en este momento. Sin una jornada " +
    "en curso no se pueden registrar consultas."
  );
}
