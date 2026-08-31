// View model puro de la ficha de una persona del equipo: sus dos pestañas y las filas que
// muestra la pestaña Historial. Sin JSX y sin llamadas a Supabase, para que se pueda probar sin
// montar un componente (mismo motivo que nombreCompletoDe()/armarFilas() en
// useUsuariosListado.js).
//
// A diferencia de pacientes/ficha.js, aca no hace falta filtrar pestañas por rol
// (pestaniasDeFicha(rol)): la pantalla entera ya es exclusiva de un solo rol (el guard de rutas
// de la app la protege), asi que las dos pestañas se muestran siempre.
//
// No hay un valoresDeFichaVoluntario() aca: desde que el listado y la ficha se fusionaron en una
// sola pantalla (VoluntariosPage.jsx), los valores de la pestaña Datos salen directo de la fila
// que ya arma armarFilas() en useUsuariosListado.js -- esa fila YA trae nombreCompleto calculado,
// asi que no hace falta una segunda funcion que repita lo mismo a partir de un perfil suelto.

export const PESTANIAS_FICHA_VOLUNTARIO = Object.freeze([
  { id: "datos", label: "Datos" },
  { id: "historial", label: "Historial" },
]);

// Nombre especifico del modulo, no PESTANIA_FICHA_POR_DEFECTO: pacientes/ficha.js ya exporta un
// nombre asi, y con export * encadenados hasta el barril raiz un nombre ambiguo desaparece del
// namespace sin avisar en tiempo de build (bug #365, ver el comentario de usuarios/index.js).
export const PESTANIA_FICHA_VOLUNTARIO_POR_DEFECTO = PESTANIAS_FICHA_VOLUNTARIO[0].id;

/** Texto para una celda sin dato, igual que el resto del repo (ej. DetalleJornadaPage.jsx). */
const SIN_DATO = "—";

/**
 * Filas para COLUMNAS_HISTORIAL_VOLUNTARIO, a partir del `historial` que devuelve
 * useHistorialDePersona() (la forma que ya arma obtenerJornadasDePersona(), jornadas/api.js).
 *
 * `responsabilidad` puede llegar `null` (la columna es TEXT nullable): se reemplaza por el
 * mismo caracter que ya usa el resto de la app para "no hay dato", en vez de dejar la celda en
 * blanco sin explicar si es un dato ausente o un fallo de carga.
 *
 * `pacientesAtendidos` sale de `atencionesPersona.pacientes`: un cero aca puede ser real o
 * puede venir de una politica RLS que le esconde consultas/triajes a quien pregunta (ver el
 * comentario de obtenerJornadasDePersona() en jornadas/api.js) — esta funcion no lo distingue,
 * simplemente traslada el numero que llego.
 *
 * @param {object[]} historial
 * @returns {object[]}
 */
export function filasDeHistorial(historial = []) {
  return historial.map((jornada) => ({
    id: jornada.id,
    nombre: jornada.nombre,
    fecha: jornada.fecha,
    estado: jornada.estado,
    responsabilidad: jornada.responsabilidad || SIN_DATO,
    pacientesAtendidos: jornada.atencionesPersona?.pacientes ?? 0,
  }));
}
