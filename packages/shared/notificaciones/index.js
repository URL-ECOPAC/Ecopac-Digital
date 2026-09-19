// Modulo de notificaciones al administrador (issue #755): el buzon interno de cada perfil.
//
// Estructura estandar de un modulo (ver docs/ARQUITECTURA-FRONTEND.md):
//   api.js                         llamadas a Supabase
//   avisos.js                      que avisar con la notificacion del sistema del telefono
//   categorias.js                  descriptores: etiqueta, tono y destino de cada categoria
//   eventos.js                     aviso entre el buzon y el contador de la cabecera
//   filtros.js                     filtros de la ventana de notificaciones
//   filtros.js                     filtros de la ventana de notificaciones
//   useBuzonNotificaciones.js      view model de la ventana de notificaciones y de la emergente
//   useContadorNotificaciones.js   contador de no leidas de la cabecera

export * from "./api.js";
export * from "./avisos.js";
export * from "./categorias.js";
export * from "./eventos.js";
export * from "./filtros.js";
export * from "./useBuzonNotificaciones.js";
export * from "./useContadorNotificaciones.js";
