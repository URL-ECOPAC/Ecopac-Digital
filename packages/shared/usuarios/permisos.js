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
// El permiso fino usuarios.gestionar_permisos gobierna usuario_permiso (00086) y, desde la 00148,
// el cliente lo lee (usuarios/acceso.js): quien lo tiene entra a Colaboradores y gestiona los
// permisos de los demas, nunca los suyos.

import { MODULOS } from "../navegacion.js";
import { accedeAModuloPorMatriz, tienePermisoFino } from "./acceso.js";
import { esAdministrador } from "./roles.js";

/**
 * Puede crear un perfil nuevo. Espejo de la politica de INSERT de perfiles (00038).
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeCrearUsuario(rol) {
  return esAdministrador(rol);
}

/**
 * Puede editar el perfil de otra persona (no el propio: eso lo permite la identidad, no el rol).
 *
 * Espejo de la politica de UPDATE de perfiles (00038): administrador, o ser el propio perfil.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeEditarOtroPerfil(rol) {
  return esAdministrador(rol);
}

/**
 * Espejo de puedeEditarOtroPerfil: desactivar o reactivar un perfil es el mismo UPDATE.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeDesactivarUsuario(rol) {
  return esAdministrador(rol);
}

/**
 * Espejo de puedeDesactivarUsuario.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeReactivarUsuario(rol) {
  return esAdministrador(rol);
}

/**
 * Puede ver el listado del personal (nombres, apellidos, rol, sin datos de contacto ajenos).
 *
 * Espejo del WHERE de perfiles_directorio (00148): la administradora, el rol al que la matriz le
 * abrio Colaboradores (solo lectura) y quien tiene usuarios.gestionar_permisos delegado, que
 * necesita el listado para llegar a la persona cuyos permisos gestiona.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeVerListadoUsuarios(rol) {
  return (
    esAdministrador(rol) ||
    accedeAModuloPorMatriz(rol, "colaboradores") ||
    tienePermisoFino(rol, "usuarios.gestionar_permisos")
  );
}

/**
 * Puede conceder, revocar o restablecer un permiso fino de OTRA persona: la administradora o quien
 * tenga usuarios.gestionar_permisos delegado (00086). Los propios no: la 00148 lo impide en la
 * politica, y la pantalla no ofrece el boton sobre la fila propia.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeGestionarPermisosFinos(rol) {
  return tienePermisoFino(rol, "usuarios.gestionar_permisos");
}

/**
 * Puede gestionar los permisos de UNA persona concreta: como puedeGestionarPermisosFinos(), pero
 * sin la propia fila si no es la administradora. Espejo de la condicion `perfil_id <> auth.uid()`
 * que la 00148 agrego a las politicas de escritura de usuario_permiso: quien recibio la gestion de
 * permisos no se concede nada a si mismo.
 *
 * @param {string} rol
 * @param {{ esPropioPerfil?: boolean }} [contexto]
 * @returns {boolean}
 */
export function puedeGestionarPermisosDe(rol, { esPropioPerfil = false } = {}) {
  if (esAdministrador(rol)) return true;
  return puedeGestionarPermisosFinos(rol) && !esPropioPerfil;
}

/**
 * Puede ver los permisos efectivos de otra persona.
 *
 * Espejo de la politica de SELECT de usuario_permiso (00086): la administradora, quien gestiona
 * permisos por delegacion, o ser el propio perfil (eso es identidad, no rol).
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeVerPermisosEfectivosDeOtro(rol) {
  return tienePermisoFino(rol, "usuarios.gestionar_permisos");
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
 * @returns {boolean}
 */
export function puedeGestionarEspecialidades(rol, { esPropioPerfil = false } = {}) {
  return esAdministrador(rol) || esPropioPerfil;
}

/**
 * Puede abrir o cerrar modulos a un rol en la matriz de acceso (00148). Espejo de las politicas
 * de INSERT/DELETE de rol_modulo: solo la administradora, no es una funcion delegable.
 *
 * @param {string} rol
 * @returns {boolean}
 */
export function puedeGestionarMatrizDePermisosPorRol(rol) {
  return esAdministrador(rol);
}

// `permisos.modulo` que no tiene entrada propia en MODULOS: `usuarios.gestionar_permisos` se usa
// dentro de Colaboradores, pero el grupo se sigue llamando por lo que gobierna.
const ETIQUETAS_DE_MODULO_SIN_PANTALLA = { usuarios: "Usuarios" };

/**
 * Titulo legible del grupo de un permiso (columna `permisos.modulo`, 00003): el nombre del modulo
 * en MODULOS, y si no hay, la clave con mayuscula inicial y sin guiones bajos. Nunca la clave
 * cruda en minusculas, que es lo que mostraba "usuarios" en la matriz.
 *
 * @param {string} modulo
 * @returns {string}
 */
export function etiquetaDeModuloDePermiso(modulo) {
  const entrada = MODULOS.find((item) => item.modulo === modulo);
  if (entrada) return entrada.nombre;
  if (ETIQUETAS_DE_MODULO_SIN_PANTALLA[modulo]) return ETIQUETAS_DE_MODULO_SIN_PANTALLA[modulo];
  const texto = String(modulo ?? "").replaceAll("_", " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las funciones sueltas ni acordarse
 * de cuales existen.
 *
 * puedeGestionarEspecialidades no esta aqui a proposito, por el mismo motivo que puedeAnularReceta
 * no esta en permisosDePacientes(): no depende solo del rol, sino de que perfil se este mirando.
 *
 * @param {string} rol
 * @returns {{ puedeCrear: boolean, puedeEditarOtro: boolean, puedeDesactivar: boolean, puedeReactivar: boolean, puedeVerListado: boolean, puedeGestionarPermisosFinos: boolean, puedeVerPermisosEfectivosDeOtro: boolean }}
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
