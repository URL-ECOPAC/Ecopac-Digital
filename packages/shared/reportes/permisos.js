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
// No se agrega un guard para reportes/jornada.api.js ni reportes/inventario.api.js: el primero
// se corrige en su propia issue (#489), y el segundo hoy no tiene ningun guard de rol (su
// comentario dice que las politicas de la 00034 filtran solas) -- agregarle uno seria una
// funcion nueva que esta issue no pidio, no una consolidacion.

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
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las funciones sueltas ni acordarse
 * de cuales existen.
 */
export function permisosDeReportes(rol) {
  return {
    puedeVerIndicadoresDeImpacto: puedeVerIndicadoresDeImpacto(rol),
    puedeVerReporteDePacientes: puedeVerReporteDePacientes(rol),
  };
}
