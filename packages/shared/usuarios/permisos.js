// Que puede hacer cada rol con los perfiles de usuario y sus permisos finos.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Quien de verdad impide leer o escribir es Row Level Security: las politicas de perfiles,
// permisos, rol_permiso y usuario_permiso en 00038_politicas_rls_perfiles_permisos.sql. Por la
// misma razon, ninguna funcion de api.js ni de permisos.api.js consulta este archivo antes de
// llamar: el cliente pregunta para dibujar; el servidor decide.
//
// No hay una funcion "puedeEditarPerfilPropio": la politica de UPDATE de perfiles es
// `es_administrador() OR id = auth.uid()`, y editar el propio perfil no depende del rol sino de
// la identidad -- cualquiera edita el suyo. Lo unico que depende del rol es editar el de otra
// persona, o cambiarle el rol a alguien (bloqueado ademas por el trigger
// impedir_cambio_de_rol_propio para el propio usuario, sin importar su rol).
//
// El permiso fino usuarios.gestionar_permisos no se refleja aqui: existe en el catalogo pero no
// gobierna ninguna politica (docs/PERMISOS.md), igual que jornadas.gestionar en
// jornadas/permisos.js -- el cliente solo conoce el rol, y aqui la politica real exige
// es_administrador() a secas.

import { rolesDelModulo } from "../navegacion.js";
import { esAdministrador } from "./roles.js";

/** Puede crear un perfil nuevo. Espejo de la politica de INSERT de perfiles (00038). */
export function puedeCrearUsuario(rol) {
  return esAdministrador(rol);
}

/**
 * Puede editar el perfil de otra persona (no el propio: eso lo permite la identidad, no el rol).
 *
 * Espejo de la politica de UPDATE de perfiles (00038): administrador, o ser el propio perfil.
 */
export function puedeEditarOtroPerfil(rol) {
  return esAdministrador(rol);
}

/** Espejo de puedeEditarOtroPerfil: desactivar o reactivar un perfil es el mismo UPDATE. */
export function puedeDesactivarUsuario(rol) {
  return esAdministrador(rol);
}

/** Espejo de puedeDesactivarUsuario. */
export function puedeReactivarUsuario(rol) {
  return esAdministrador(rol);
}

/**
 * Puede ver el listado completo de usuarios (nombres, apellidos, rol, sin datos de contacto).
 *
 * ISSUE #864: solo administrador. La vista perfiles_directorio (00038) le daba a junta directiva
 * -y solo a ella, no a socio fundador- una lectura del personal sin datos de contacto ajenos, y
 * la #756 habia abierto la ruta para que esa vista tuviera por donde llegarse. La #864 cierra
 * las dos: "Junta directiva: solo ve reportes". La 00141 reescribe la vista para que su WHERE
 * diga lo mismo que esta funcion.
 */
export function puedeVerListadoUsuarios(rol) {
  return esAdministrador(rol);
}

/**
 * Puede conceder, revocar o restablecer un permiso fino de otra persona.
 *
 * Espejo de las politicas de INSERT/UPDATE/DELETE de usuario_permiso (00038): solo
 * administrador. Cualquiera lee los suyos, pero eso es por identidad, no por rol.
 */
export function puedeGestionarPermisosFinos(rol) {
  return esAdministrador(rol);
}

/**
 * Puede ver los permisos efectivos de otra persona.
 *
 * Espejo de la politica de SELECT de usuario_permiso (00038): administrador, o ser el propio
 * perfil.
 */
export function puedeVerPermisosEfectivosDeOtro(rol) {
  return esAdministrador(rol);
}

/**
 * Puede registrar o quitar las especialidades de un perfil.
 *
 * Espejo de las politicas de INSERT y DELETE de perfil_especialidad (00085): "administrador o el
 * propio perfil". Es la primera funcion de este archivo que necesita algo mas que el rol -si la
 * fila que se edita es la de quien mira-, y por eso su firma lleva un segundo argumento.
 *
 * No existia porque hasta la 00085 la tabla no tenia ninguna politica de escritura y nadie podia
 * registrar una especialidad, ni siquiera la administradora (issue #405). La migracion que lo
 * corrigio se aplico y el cliente nunca llego a usarla: no habia funcion de API que escribiera,
 * ni componente del catalogo que dibujara una lista de etiquetas editable. Por eso un medico se
 * creaba sin poder decir de que es especialista.
 *
 * Los roles consultivos quedan fuera a proposito: la 00085 les amplio la LECTURA (es_consultivo()
 * en la politica de SELECT) y no la escritura.
 *
 * @param {string} rol Rol de quien mira la pantalla.
 * @param {{ esPropioPerfil?: boolean }} [contexto]
 */
export function puedeGestionarEspecialidades(rol, { esPropioPerfil = false } = {}) {
  return esAdministrador(rol) || esPropioPerfil;
}

/**
 * Puede conceder o retirar un permiso del valor por defecto de un rol entero (matriz de
 * permisos por rol, issue #638).
 *
 * Espejo de las politicas de INSERT/DELETE de rol_permiso (00139): solo administrador, sin el
 * "OR tiene_permiso(...)" que si tienen las politicas de usuario_permiso -la issue exige que
 * unicamente el administrador entre a esta pantalla, no un permiso fino delegable.
 */
export function puedeGestionarMatrizDePermisosPorRol(rol) {
  return esAdministrador(rol);
}

/**
 * Si `rol` puede llegar, navegando la app, al modulo dueno de un permiso -y por lo tanto si
 * concederselo en la matriz de permisos por rol (issue #638) puede tener algun efecto practico.
 *
 * Hallado probando en vivo: conceder `donaciones.registrar` a medico no cambiaba nada, porque
 * medico no esta en `rolesDelModulo("donaciones")` -nunca ve el modulo Donaciones en el menu, y
 * la ruta le cae en acceso denegado-. El permiso queda guardado y gobierna una politica real,
 * pero nadie con ese rol llega nunca a la pantalla donde importaria.
 *
 * `permisos.modulo` no siempre coincide con una entrada real de MODULOS: `usuarios` es el caso
 * conocido (la pantalla que de verdad usa `usuarios.gestionar_permisos` vive dentro de la ruta
 * `colaboradores`, ModalPermisosUsuario.jsx). Cuando `rolesDelModulo()` no encuentra ninguna
 * entrada (arreglo vacio) se asume que SI puede navegarlo -mejor no advertir de mas sobre un
 * permiso que si importa que advertir en falso.
 *
 * @param {string} rol
 * @param {string} modulo `permisos.modulo` (columna de la migracion 00003).
 * @returns {boolean}
 */
export function puedeNavegarModuloDelPermiso(rol, modulo) {
  const roles = rolesDelModulo(modulo);
  if (roles.length === 0) return true;
  return roles.includes(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las funciones sueltas ni acordarse
 * de cuales existen.
 *
 * puedeGestionarEspecialidades no esta aqui a proposito, por el mismo motivo que puedeAnularReceta
 * no esta en permisosDePacientes(): no depende solo del rol, sino de que perfil se este mirando.
 */
export function permisosDeUsuarios(rol) {
  return {
    puedeCrear: puedeCrearUsuario(rol),
    puedeEditarOtro: puedeEditarOtroPerfil(rol),
    puedeDesactivar: puedeDesactivarUsuario(rol),
    puedeReactivar: puedeReactivarUsuario(rol),
    puedeVerListado: puedeVerListadoUsuarios(rol),
    puedeGestionarPermisosFinos: puedeGestionarPermisosFinos(rol),
    puedeVerPermisosEfectivosDeOtro: puedeVerPermisosEfectivosDeOtro(rol),
  };
}
