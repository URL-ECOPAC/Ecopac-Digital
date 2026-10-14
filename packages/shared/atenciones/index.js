// Modulo de atenciones de la logica compartida.
//
// La atencion es la fila que vincula a un paciente con una jornada y lo pone en la cola de
// trabajo del dia: registro, triaje, consulta y entrega (issue #173, RF-24).
//
// Estructura estandar de un modulo (ver docs/ARQUITECTURA-FRONTEND.md):
//   api.js       llamadas a Supabase y normalizacion de errores
//   etapas.js    las etapas de la cola, espejo de vista_cola_jornada (00060)
//   permisos.js  que puede hacer cada rol
//
// Todavia no hay campos.js ni columnas.js: la cola no es un formulario ni una tabla de listado,
// y el panel que la consume (#187) es un diseno propio. El hook de pantalla que consume esta
// cola es useJornadaActiva() (issue #177), en jornadas/useJornadaActiva.js: la jornada es el
// eje de esa pantalla, la cola es uno de sus datos.

export * from "./api.js";
export * from "./etapas.js";
export * from "./permisos.js";
