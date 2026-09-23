// Que puede consultar cada rol en los reportes.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Quien de verdad decide es el WHERE de cada vista o funcion agregada: vista_reporte_impacto
// (00086) y fn_reporte_pacientes_atendidos (00132). Por la misma razon, ninguna
// funcion de api.js/pacientes.api.js consulta este archivo antes de llamar: el cliente
// pregunta para dibujar; el servidor decide.
//
// puedeVerIndicadoresDeImpacto (antes en api.js) y puedeVerReporteDePacientes (antes en
// pacientes.api.js) vivian sueltas fuera de un permisos.js -- divergencia #13 de
// docs/PERMISOS.md. Se mudan aqui sin cambiar su logica; esos archivos las siguen exportando
// via reexport nombrado para no romper lo que ya los importa.
//
// SOBRE SOCIO FUNDADOR Y EL REPORTE DE PACIENTES (issue #862). El comentario que estuvo aqui
// hasta ahora justificaba excluirlo citando la guarda de la 00067,
// `es_administrador() OR rol_actual() = 'junta directiva'`, y afirmaba que era "una de las pocas
// excepciones reales" a tratar juntos a los dos roles consultivos. Esa guarda dejo de existir en
// la 00080. La vigente -00086, conservada por 00095 y 00132- es
//
//   es_administrador() OR es_consultivo() OR tiene_permiso('reportes.exportar')
//
// es decir, socio fundador SI puede. El cliente llevaba desde entonces ocultandole una pestana
// que el servidor le concede: entraba al modulo, veia la pestana y recibia un error que decia
// "Solo administracion y junta directiva", que era falso. Ahora es esConsultivo(), el espejo real.
//
// LO QUE ESTE ARCHIVO NO DECIDE. Que roles alcanzan la RUTA /reportes lo fija
// navegacion.js (administrador, junta directiva y socio fundador), y es una decision deliberada
// de la issue #426 que navegacion.test.js afirma: un medico o un voluntario no llegan hasta aqui,
// y ven los vencimientos en Inventario > Alertas. Estas funciones solo deciden que pestana se
// dibuja para quien YA entro.
//
// EL PERMISO FINO `reportes.exportar` NO SE CONTEMPLA TODAVIA. Las tres guardas del servidor lo
// aceptan, pero ninguna funcion de aqui lo mira: hacerlo exige que la sesion cargue los permisos
// efectivos (usuarios/permisos.api.js, obtenerPermisosEfectivos) y eso es un cambio transversal
// al contexto de autenticacion. Queda como issue aparte; mientras tanto, conceder ese permiso a
// un rol que no alcanza el modulo no tiene efecto en la interfaz.
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
 * Puede consultar el reporte de pacientes atendidos: administrador y los dos roles consultivos.
 *
 * Espejo de la guarda vigente de fn_reporte_pacientes_atendidos (00132, conservada desde la
 * 00086): `es_administrador() OR es_consultivo() OR tiene_permiso('reportes.exportar')`. Ver el
 * comentario de cabecera sobre por que socio fundador estaba excluido y por que ya no lo esta.
 *
 * Ninguna columna del reporte identifica a un paciente -la RPC nunca devuelve una fila por
 * persona-, asi que dejarlo entrar no contradice la regla de la issue #426 de que los roles
 * consultivos solo ven agregados.
 */
export function puedeVerReporteDePacientes(rol) {
  return esAdministrador(rol) || esConsultivo(rol);
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
 * Puede consultar el reporte de medicamentos proximos a vencer: cualquier rol conocido.
 *
 * Misma regla que el reporte de inventario, y por la misma razon: los dos leen `existencias`
 * ("Sesion activa lee existencias", 00079) cruzada con `lotes` y `medicamentos` (00034).
 *
 * Existe porque useReporteMedicamentosPorVencer usaba puedeVerIndicadoresDeImpacto, que es la
 * regla de OTRO reporte -la de la vista agregada, restringida a administrador y consultivos- y
 * no describia lo que el servidor hace con este. Hoy no cambia quien entra, porque los tres roles
 * que alcanzan el modulo pasan las dos guardas; cambia que la funcion dice la verdad, y que el
 * dia que la ruta se abra a mas roles no herede una restriccion que nadie escribio a proposito.
 */
export function puedeVerReporteDeVencimientos(rol) {
  return puedeVerReporteDeInventario(rol);
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
    puedeVerReporteDeVencimientos: puedeVerReporteDeVencimientos(rol),
  };
}
