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
// puedeVerReporteDePacientes excluia a socio fundador citando la guarda de
// fn_reporte_pacientes_atendidos, y **esa cita dejo de ser cierta hace tiempo**. Era verdad en
// la 00067 (`es_administrador() OR rol_actual() = 'junta directiva'`), pero la 00086 reescribio
// la funcion entera con `es_administrador() OR es_consultivo() OR tiene_permiso(...)` al
// conectar los permisos finos, y este archivo se quedo con el texto viejo.
//
// O sea que era una divergencia de las que docs/PERMISOS.md llama defecto, y de las silenciosas:
// el cliente era MAS estricto que el servidor, asi que a un socio fundador la pantalla le
// escondia un reporte que la base le habria servido. No fallaba nada; simplemente no estaba.
// ISSUE #864: se corrige el cliente, que es el lado equivocado, sin tocar la base. La #862 llego
// a la misma conclusion por su cuenta y en paralelo; al mezclar se conserva esta redaccion.
//
// LO QUE ESTE ARCHIVO NO DECIDE (issue #862). Que roles alcanzan la RUTA /reportes lo fija
// navegacion.js (administrador, junta directiva y socio fundador), y es una decision deliberada
// de la issue #426 que navegacion.test.js afirma: un medico o un voluntario no llegan hasta aqui,
// y ven los vencimientos en Inventario > Alertas. Estas funciones solo deciden que pestana se
// dibuja para quien YA entro.
//
// EL PERMISO FINO `reportes.exportar`. Hasta la 00148 ninguna funcion de aqui lo miraba, porque el
// cliente no conocia los permisos efectivos. Desde la 00148 la sesion los carga (mis_accesos(),
// usuarios/acceso.js), y quien lo tiene delegado llega a Reportes y ve lo mismo que un rol
// consultivo.
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

import { accedeAModuloPorMatriz, tienePermisoFino } from "../usuarios/acceso.js";
import { esAdministrador, esConsultivo, ROLES } from "../usuarios/roles.js";

/**
 * Quien consulta reportes: espejo de puede_consultar_reportes() (00148), la guarda de todas las
 * vistas y funciones de reportes. Administradora, roles consultivos, quien tiene
 * reportes.exportar delegado y el rol al que la matriz le abrio Reportes. Desde la 00148 el
 * permiso fino SI se mira aqui: la sesion carga sus permisos efectivos (usuarios/acceso.js).
 */
function consultaReportes(rol) {
  return (
    esAdministrador(rol) ||
    esConsultivo(rol) ||
    tienePermisoFino(rol, "reportes.exportar") ||
    accedeAModuloPorMatriz(rol, "reportes")
  );
}

/** Puede consultar los indicadores de impacto. */
export function puedeVerIndicadoresDeImpacto(rol) {
  return consultaReportes(rol);
}

/**
 * Puede consultar el reporte de pacientes atendidos: administrador y los dos roles consultivos.
 *
 * Espejo de la guarda de fn_reporte_pacientes_atendidos **tal como esta desde la 00086**:
 * administrador, cualquiera de los dos roles consultivos, o quien tenga reportes.exportar.
 *
 * ISSUE #864: decia administrador o junta directiva, copiado de la 00067, que la 00086 ya habia
 * reescrito. El cliente le escondia a socio fundador un reporte que la base si le entrega. Con
 * los dos roles consultivos reducidos a Reportes como unica pantalla, ese descuadre le quitaba
 * uno de los cuatro reportes que le quedan.
 *
 * El permiso fino no se resuelve desde el rol, asi que aqui solo se cubre la parte por rol y el
 * resto lo decide el servidor -- mismo criterio que puedeAprobarGasto().
 *
 * Ninguna columna del reporte identifica a un paciente -la RPC nunca devuelve una fila por
 * persona-, asi que dejarlo entrar no contradice la regla de la issue #426 de que los roles
 * consultivos solo ven agregados.
 */
export function puedeVerReporteDePacientes(rol) {
  return consultaReportes(rol);
}

/**
 * Puede consultar el reporte de resultados de una jornada.
 *
 * Espejo de la guarda de fn_reporte_jornada() (00148): quien consulta reportes, mas el medico (lo
 * monta el resumen de jornada de la app movil). Hasta la 00148 los roles consultivos no lo tenian:
 * el cliente agregaba filas clinicas crudas (consultas, diagnosticos, recetas) que la 00054 les
 * retiro. Ahora la base lo entrega ya agregado, sin ninguna fila de paciente.
 */
export function puedeVerReporteJornada(rol) {
  return consultaReportes(rol) || rol === ROLES.MEDICO;
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
