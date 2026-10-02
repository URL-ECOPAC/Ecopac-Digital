// Que puede hacer cada rol con los proyectos sociales.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// La distincion importa: un boton escondido no es seguridad, solo es una pantalla que no
// ofrece lo que la persona no puede hacer. Quien de verdad impide leer o escribir es Row Level
// Security en la base de datos: las politicas de proyectos son la migracion 00039 (ya aplicada,
// espejo de puedeAdministrarProyectos) corregida por la 00080 (espejo de puedeVerProyectos,
// issue #404). INSERT y UPDATE de proyectos exigen unicamente es_administrador(); el SELECT lo
// exige, con es_administrador() OR es_consultivo() -- junta directiva y socio fundador leen,
// nadie mas.
//
// Por eso ninguna funcion de proyectos.api.js consulta este archivo antes de llamar: si lo
// hiciera, un fallo aqui se veria como "no tienes permiso" cuando en realidad el servidor
// habria dejado pasar la operacion, o al reves. El cliente pregunta para dibujar; el servidor
// decide.
//
// Version anterior (issue #423): ROLES_QUE_ADMINISTRAN_PROYECTOS incluia a JUNTA_DIRECTIVA
// (citando el criterio de aceptacion de la issue #194, ya cerrada, y superado por la 00039), y
// puedeVerProyectos() devolvia true para cualquier rol conocido, incluidos medico y voluntario
// general -- que la 00039/00080 nunca dejaron leer proyectos. Un miembro de junta directiva veia
// botones de crear/editar que el servidor rechazaba con 42501; un medico o voluntario veia el
// modulo como accesible y la consulta le devolvia cero filas, sin explicacion (mismo patron que
// la issue #426 encontro en pacientes).

import { accedeAModuloPorMatriz, tienePermisoFino } from "../usuarios/acceso.js";
import { ROLES, ROLES_DE_CAMPO, esAdministrador } from "../usuarios/roles.js";
import { proyectoAdmiteCambios } from "./validaciones.js";

/** Rol que administra proyectos por defecto: solo administrador (00039). */
export const ROLES_QUE_ADMINISTRAN_PROYECTOS = Object.freeze([ROLES.ADMINISTRADOR]);

/**
 * Puede crear, editar, cambiar de estado y asociar jornadas: la administradora o quien tenga
 * `proyectos.gestionar` delegado por persona (00086, conectado en el cliente por la 00148).
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeAdministrarProyectos(rol) {
  return tienePermisoFino(rol, "proyectos.gestionar");
}

/**
 * Quien ve el proyecto entero -hitos, bitacora, insumos, historial-: quien lo administra, y el rol
 * al que la matriz le abrio Proyectos (en solo lectura). El personal de campo no: su detalle es de
 * consulta (00148).
 */
function veElProyectoEntero(rol) {
  return puedeAdministrarProyectos(rol) || accedeAModuloPorMatriz(rol, "proyectos");
}

/**
 * Puede ver el listado y la ficha de un proyecto.
 *
 * Administrador, personal de campo (00148: tambien el colaborador), quien gestiona proyectos por
 * delegacion y el rol al que la matriz le abrio el modulo. El personal de campo **no ve todos**:
 * solo los proyectos a los que pertenece -por su equipo o por una de sus jornadas,
 * pertenece_a_proyecto()-. Esta funcion no puede expresar ese filtro y no le hace falta: decide si
 * se dibuja la pantalla, y las filas las elige la base.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeVerProyectos(rol) {
  return esAdministrador(rol) || ROLES_DE_CAMPO.includes(rol) || veElProyectoEntero(rol);
}

/**
 * Puede ver los insumos y los gastos de un proyecto, y su presupuesto en el resumen.
 *
 * El personal de campo no (issue #864, 00148): ve que es el proyecto, en que estado esta, su
 * equipo y sus jornadas, no lo que costo.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeVerInsumosYGastosDeProyecto(rol) {
  return veElProyectoEntero(rol);
}

/**
 * Puede ver el historial de cambios de estado del proyecto (proyecto_estado_historial, 00029).
 * Espejo de su politica de SELECT desde la 00148.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeVerHistorialProyecto(rol) {
  return veElProyectoEntero(rol);
}

/**
 * Puede abrir el seguimiento de un proyecto -hitos y bitacora de avance-. El personal de campo no
 * (00148): su detalle del proyecto es de consulta.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeVerSeguimientoProyecto(rol) {
  return veElProyectoEntero(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las tres por separado ni
 * acordarse de cuales existen.
 *
 * Con `proyecto`, son los permisos sobre ESE proyecto: si esta cancelado (00154) o finalizado
 * (00172), nada de lo que lo modifica queda abierto, sea cual sea el rol. Crear otro proyecto no
 * depende de cual este abierto, asi que `puedeCrear` no cambia.
 *
 * @param {string} rol
 * @param {{ estado?: string }|null} [proyecto]
 * @returns {object} Con: puedeVer, puedeCrear, puedeEditar, puedeCambiarEstado, puedeAsociarJornadas, puedeGestionarEquipo, puedeGestionarInsumos, puedeRegistrarSeguimiento, puedeVerInsumosYGastos, puedeVerHistorial, puedeVerSeguimiento.
 */
export function permisosDeProyectos(rol, proyecto = null) {
  const administra = puedeAdministrarProyectos(rol);
  const modifica = administra && proyectoAdmiteCambios(proyecto?.estado);
  return {
    puedeVer: puedeVerProyectos(rol),
    puedeCrear: administra,
    puedeEditar: modifica,
    puedeCambiarEstado: modifica,
    puedeAsociarJornadas: modifica,
    // Armar el equipo del proyecto (00146): la misma regla que editarlo. Leerlo lo decide
    // puedeVer, y las filas que se ven las elige la base.
    puedeGestionarEquipo: modifica,
    // Lista de insumos previstos (00147): planificacion con dinero. Verla es puedeVerInsumosYGastos;
    // agregar, editar y quitar, la misma regla que editar el proyecto.
    puedeGestionarInsumos: modifica,
    // Avance, notas de la bitacora e hitos (00053): la misma regla que editar el proyecto.
    puedeRegistrarSeguimiento: modifica,
    puedeVerInsumosYGastos: puedeVerInsumosYGastosDeProyecto(rol),
    puedeVerHistorial: puedeVerHistorialProyecto(rol),
    puedeVerSeguimiento: puedeVerSeguimientoProyecto(rol),
  };
}
