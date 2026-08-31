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

import { ROLES, esAdministrador, esConsultivo } from "../usuarios/roles.js";

/** Rol que puede crear, editar y cambiar el estado de un proyecto: solo administrador (00039). */
export const ROLES_QUE_ADMINISTRAN_PROYECTOS = Object.freeze([ROLES.ADMINISTRADOR]);

/** Puede crear, editar, cambiar de estado y asociar jornadas. */
export function puedeAdministrarProyectos(rol) {
  return ROLES_QUE_ADMINISTRAN_PROYECTOS.includes(rol);
}

/**
 * Puede ver el listado y la ficha de un proyecto.
 *
 * Solo administrador y los dos roles consultivos (junta directiva, socio fundador): espejo
 * exacto del SELECT de la 00080. Medico y voluntario no tienen ninguna politica de lectura
 * sobre proyectos -su necesidad de saber a que proyecto pertenece una jornada se resuelve desde
 * la propia jornada, no leyendo la tabla proyectos directamente.
 */
export function puedeVerProyectos(rol) {
  return esAdministrador(rol) || esConsultivo(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las tres por separado ni
 * acordarse de cuales existen.
 */
export function permisosDeProyectos(rol) {
  const administra = puedeAdministrarProyectos(rol);
  return {
    puedeVer: puedeVerProyectos(rol),
    puedeCrear: administra,
    puedeEditar: administra,
    puedeCambiarEstado: administra,
    puedeAsociarJornadas: administra,
  };
}
