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

import { ROLES, esAdministrador } from "../usuarios/roles.js";

/** Rol que puede crear, editar y cambiar el estado de un proyecto: solo administrador (00039). */
export const ROLES_QUE_ADMINISTRAN_PROYECTOS = Object.freeze([ROLES.ADMINISTRADOR]);

/** Puede crear, editar, cambiar de estado y asociar jornadas. */
export function puedeAdministrarProyectos(rol) {
  return ROLES_QUE_ADMINISTRAN_PROYECTOS.includes(rol);
}

/**
 * Puede ver el listado y la ficha de un proyecto.
 *
 * ISSUE #864, y es el reves exacto de lo que decia antes. Ahora son **administrador y medico**:
 *
 * - Los dos roles consultivos salen. Su unica pantalla es Reportes, y la 00141 les retira de
 *   paso la politica de SELECT sobre `proyectos` que les habia dado la 00080.
 * - Entra medico, pero **no ve todos los proyectos**: la 00141 amplia la politica de SELECT con
 *   los proyectos de las jornadas en las que participa. Esta funcion no puede expresar ese
 *   filtro -no sabe de que jornadas se trata-, y no le hace falta: decide si se dibuja la
 *   pantalla, y las filas las elige la base.
 *
 * El voluntario general se queda fuera: la issue solo nombra al medico.
 */
export function puedeVerProyectos(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}

/**
 * Puede ver los insumos y los gastos de un proyecto.
 *
 * Solo administrador (issue #864). El medico ve el proyecto de su jornada -que es, en que
 * estado esta, sus hitos- pero no lo que costo: `gastos` sigue sin politica de lectura para el
 * fuera de las jornadas en las que participa (00052), y los insumos son informacion de
 * planificacion que no le corresponde.
 */
export function puedeVerInsumosYGastosDeProyecto(rol) {
  return esAdministrador(rol);
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
    // Armar el equipo del proyecto (00146): la misma regla que editarlo. Leerlo lo decide
    // puedeVer, y las filas que se ven las elige la base.
    puedeGestionarEquipo: administra,
    // Lista de insumos previstos (00147): planificacion con dinero. Verla es puedeVerInsumosYGastos;
    // agregar, editar y quitar, la misma regla que editar el proyecto.
    puedeGestionarInsumos: administra,
    puedeVerInsumosYGastos: puedeVerInsumosYGastosDeProyecto(rol),
  };
}
