// Que puede hacer cada rol con los proyectos sociales.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// La distincion importa: un boton escondido no es seguridad, solo es una pantalla que no
// ofrece lo que la persona no puede hacer. Quien de verdad impide escribir es Row Level
// Security en la base de datos, y las politicas de proyectos son la issue #90. Hasta que esa
// aterrice, la tabla niega todo por la denegacion por defecto de la migracion 00030.
//
// Por eso ninguna funcion de proyectos.api.js consulta este archivo antes de llamar: si lo
// hiciera, un fallo aqui se veria como "no tienes permiso" cuando en realidad el servidor
// habria dejado pasar la operacion, o al reves. El cliente pregunta para dibujar; el servidor
// decide.
//
// Criterio de aceptacion de la issue #194: solo Administrador y Junta Directiva administran
// los proyectos.

import { ROLES } from "../usuarios/roles.js";

/** Roles que pueden crear, editar y cambiar el estado de un proyecto. */
export const ROLES_QUE_ADMINISTRAN_PROYECTOS = Object.freeze([
  ROLES.ADMINISTRADOR,
  ROLES.JUNTA_DIRECTIVA,
]);

/** Puede crear, editar, cambiar de estado y asociar jornadas. */
export function puedeAdministrarProyectos(rol) {
  return ROLES_QUE_ADMINISTRAN_PROYECTOS.includes(rol);
}

/**
 * Puede ver el listado y la ficha de un proyecto.
 *
 * Cualquier rol conocido puede leerlos: un medico o un voluntario necesita saber a que proyecto
 * pertenece la jornada en la que trabaja. Lo que ve de cada fila lo acota RLS, no esta funcion.
 */
export function puedeVerProyectos(rol) {
  return Object.values(ROLES).includes(rol);
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
