// Que puede consultar cada rol en los reportes.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Quien de verdad decide es el WHERE de cada vista o funcion agregada: vista_reporte_impacto
// (00054, issue #407) y fn_reporte_pacientes_atendidos (00067). Por la misma razon, ninguna
// funcion de api.js/pacientes.api.js consulta este archivo antes de llamar: el cliente
// pregunta para dibujar; el servidor decide.
//
// puedeVerIndicadoresDeImpacto (antes en api.js) y puedeVerReporteDePacientes (antes en
// pacientes.api.js) vivian sueltas fuera de un permisos.js -- divergencia #13 de
// docs/PERMISOS.md. Se mudan aqui sin cambiar su logica; esos archivos las siguen exportando
// via reexport nombrado para no romper lo que ya los importa.
//
// puedeVerReporteDePacientes excluye a socio fundador A PROPOSITO: fn_reporte_pacientes_atendidos
// (00067, linea 25) tiene la guarda `es_administrador() OR rol_actual() = 'junta directiva'`
// escrita en su propio cuerpo, sin socio fundador. Es una de las pocas excepciones reales a la
// regla de que los dos roles consultivos se tratan siempre juntos -- no se "corrige" a
// esConsultivo() porque el servidor de verdad hace esa distincion.
//
// LOS CUATRO REPORTES, NO DOS (issue #693). Este archivo cubria solo impacto y pacientes: el
// comentario anterior decia que jornada se corregia en su propia issue (#489, ya cerrada) y que
// inventario no tenia guard porque "las politicas de la 00034 filtran solas". Al conectar los
// cuatro reportes a su API, la #693 pide que los cuatro tengan guard aqui, asi que se completan
// los dos que faltaban. Ninguno de los dos es una barrera: los dos siguen siendo el espejo de la
// politica que de verdad decide, para que la pantalla no dispare una consulta que ya sabe que
// volvera vacia.
//
// puedeVerReporteJornada se declara aqui y jornada.api.js la reexporta, igual que se hizo con
// las otras dos: asi el modulo tiene un solo sitio donde mirar quien puede que.

import { esAdministrador, esConsultivo, ROLES } from "../usuarios/roles.js";

/** Puede consultar los indicadores de impacto: administrador y los dos roles consultivos. */
export function puedeVerIndicadoresDeImpacto(rol) {
  return esAdministrador(rol) || esConsultivo(rol);
}

/**
 * Puede consultar el reporte de pacientes atendidos.
 *
 * Espejo de la guarda de fn_reporte_pacientes_atendidos (00067): administrador o junta
 * directiva. Socio fundador queda fuera a proposito (ver comentario de cabecera).
 */
export function puedeVerReporteDePacientes(rol) {
  return esAdministrador(rol) || rol === ROLES.JUNTA_DIRECTIVA;
}

/**
 * Puede consultar el reporte de resultados de una jornada: administrador o medico.
 *
 * Espejo exacto de las politicas de SELECT de la 00033 sobre consultas, consulta_diagnostico,
 * diagnosticos, recetas y receta_detalle, que son las tablas que agrega obtenerReporteJornada().
 * Los roles consultivos quedan fuera a proposito: la 00054 les retiro el acceso a esas tablas
 * (issue #407) porque el reporte agrega filas clinicas crudas antes de resumirlas, aunque lo que
 * se muestre al final sean solo totales.
 */
export function puedeVerReporteJornada(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}

/**
 * Puede consultar el reporte de inventario actual: cualquier rol conocido.
 *
 * La politica de SELECT de existencias es "Sesion activa lee existencias" (00079), y las de
 * lotes, medicamentos y bodegas son igual de abiertas (00034): quien tiene un perfil activo ve
 * el inventario. Un perfil desactivado no llega hasta aqui, porque rol_actual() le devuelve NULL
 * al servidor y este hook no recibe rol.
 */
export function puedeVerReporteDeInventario(rol) {
  return Object.values(ROLES).includes(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las funciones sueltas ni acordarse
 * de cuales existen.
 */
export function permisosDeReportes(rol) {
  return {
    puedeVerIndicadoresDeImpacto: puedeVerIndicadoresDeImpacto(rol),
    puedeVerReporteDePacientes: puedeVerReporteDePacientes(rol),
    puedeVerReporteJornada: puedeVerReporteJornada(rol),
    puedeVerReporteDeInventario: puedeVerReporteDeInventario(rol),
  };
}
