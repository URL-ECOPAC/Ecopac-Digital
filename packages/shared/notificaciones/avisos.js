// Que avisar con la notificacion del sistema del telefono (issue #755). Logica pura: la app movil
// la usa con expo-notifications, pero decidir QUE es nuevo y COMO se resume no depende de la
// plataforma, y asi se prueba sin telefono.

// Por encima de este numero no se manda una notificacion del sistema por cada una: se manda un
// resumen, para no llenar la bandeja del telefono de golpe (por ejemplo al volver de una jornada
// sin senal con varias incidencias acumuladas).
export const MAXIMO_DE_AVISOS_INDIVIDUALES = 3;

/** La fecha de la notificacion mas reciente de la lista, o null si esta vacia. */
export function marcaMasReciente(notificaciones) {
  return notificaciones.reduce(
    (marca, n) => (marca === null || n.createdAt > marca ? n.createdAt : marca),
    null,
  );
}

/**
 * Las notificaciones sin leer que llegaron despues de `marca` (la mas reciente que ya se vio).
 * Sin marca no hay nada "nuevo": es la primera carga, y lo que ya estaba no se avisa otra vez.
 *
 * @param {object[]} notificaciones
 * @param {string|null} marca createdAt ISO de la ultima notificacion conocida
 */
export function notificacionesNuevasDesde(notificaciones, marca) {
  if (!marca) return [];
  return notificaciones.filter((n) => !n.leida && n.createdAt > marca);
}

/**
 * Los avisos del sistema a mostrar: uno por notificacion nueva, o un resumen si son demasiadas.
 *
 * @param {object[]} nuevas
 * @returns {{ titulo: string, cuerpo: string }[]}
 */
export function avisosDelSistema(nuevas) {
  if (nuevas.length === 0) return [];
  if (nuevas.length > MAXIMO_DE_AVISOS_INDIVIDUALES) {
    return [
      {
        titulo: `${nuevas.length} notificaciones nuevas`,
        cuerpo: "Toca para verlas en Ecopac Digital.",
      },
    ];
  }
  return nuevas.map((n) => ({ titulo: n.titulo, cuerpo: n.cuerpo }));
}
