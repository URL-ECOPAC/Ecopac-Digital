// Acceso de la sesion: que modulos le abrio la matriz a su rol y que permisos finos tiene la
// persona (migracion 00148, mis_accesos()).
//
// POR QUE UN ESTADO DE MODULO Y NO UN PARAMETRO MAS. Todas las funciones `puede...(rol)` de los
// permisos.js de cada modulo reciben solo el rol, y las llaman unos ciento cincuenta archivos de
// las dos apps. Hasta la 00148 eso bastaba, porque lo que alguien podia hacer dependia solo de su
// rol, y por eso la matriz y los permisos por persona no tenian ningun efecto en pantalla: el
// servidor los respetaba y el cliente no los leia (docs/PERMISOS.md, "Divergencias").
//
// useSesion() fija aqui, una vez por inicio de sesion, lo que devolvio mis_accesos(); las
// funciones de permisos lo consultan cuando el rol que les preguntan es el de la sesion. Si
// preguntan por OTRO rol -la matriz de acceso dibuja una columna por rol- responde el valor por
// defecto de ese rol, que es lo correcto: las excepciones de la persona conectada no son de su rol.
//
// Es la unica variable de modulo de estas funciones, y es a proposito: describe a quien esta
// conectado en este dispositivo, igual que `cierreDeliberado` en api/sesion.js. Sin sesion vuelve
// a vacio (limpiarAccesoDeSesion), y las pruebas que no la fijan ven el comportamiento por rol.

import { esAdministrador, ROLES } from "./roles.js";

/**
 * A que modulo de navegacion lleva cada permiso fino. Quien recibe una funcion de administracion
 * de un modulo tiene que poder llegar a ese modulo: sin esto, delegar `donaciones.registrar` a un
 * medico lo dejaba con un permiso que no podia usar porque no veia Donaciones en el menu.
 *
 * `usuarios.gestionar_permisos` se usa dentro de Colaboradores (el modal de permisos): su columna
 * `permisos.modulo` dice "usuarios", pero la pantalla es esa.
 */
export const MODULO_DE_PERMISO_FINO = Object.freeze({
  "pacientes.editar": "pacientes",
  "inventario.aprobar": "inventario",
  "jornadas.gestionar": "jornadas",
  "proyectos.gestionar": "proyectos",
  "presupuestos.registrar": "presupuestos",
  "presupuestos.aprobar": "presupuestos",
  "donaciones.registrar": "donaciones",
  "reportes.exportar": "reportes",
  "usuarios.gestionar_permisos": "colaboradores",
});

/**
 * Permisos finos que cada rol trae por defecto: espejo de las filas de rol_permiso (00003, 00037
 * y 00148). La administradora los tiene todos y no aparece. Solo se usa cuando la sesion todavia
 * no cargo sus accesos, o para responder por un rol que no es el de la sesion.
 */
const PERMISOS_POR_DEFECTO = Object.freeze({
  "pacientes.editar": [ROLES.MEDICO, ROLES.VOLUNTARIO],
  "reportes.exportar": [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR],
});

const SIN_ACCESO = Object.freeze({ rol: null, modulos: new Set(), permisos: new Set() });

let accesoVigente = SIN_ACCESO;

/**
 * Fija el acceso de la sesion. Lo llama useSesion() al resolver el perfil.
 *
 * @param {{ rol: string, modulos?: string[], permisos?: string[] }} acceso
 */
export function fijarAccesoDeSesion({ rol, modulos = [], permisos = [] } = {}) {
  accesoVigente = rol
    ? { rol, modulos: new Set(modulos), permisos: new Set(permisos) }
    : SIN_ACCESO;
}

/** Vuelve a "sin sesion". Lo llama useSesion() al cerrar sesion. */
export function limpiarAccesoDeSesion() {
  accesoVigente = SIN_ACCESO;
}

function accesoDe(rol) {
  return rol && rol === accesoVigente.rol ? accesoVigente : null;
}

/**
 * Si `rol` tiene el permiso fino `clave`: la administradora siempre; el rol de la sesion, segun
 * sus permisos efectivos (los de su rol mas sus excepciones, ya resueltos por la base); cualquier
 * otro rol, segun su valor por defecto.
 *
 * @param {string} rol
 * @param {string} clave `permisos.clave`, p. ej. "inventario.aprobar".
 * @returns {boolean}
 */
export function tienePermisoFino(rol, clave) {
  if (esAdministrador(rol)) return true;
  const acceso = accesoDe(rol);
  if (acceso) return acceso.permisos.has(clave);
  return (PERMISOS_POR_DEFECTO[clave] ?? []).includes(rol);
}

/**
 * Si la matriz de acceso le abrio `modulo` al rol de la sesion (solo lectura). Por otro rol no
 * responde nada: la matriz completa la lee la propia pantalla de la matriz.
 *
 * @param {string} rol
 * @param {string} modulo `MODULOS[].modulo`, p. ej. "donaciones".
 * @returns {boolean}
 */
export function accedeAModuloPorMatriz(rol, modulo) {
  return Boolean(accesoDe(rol)?.modulos.has(modulo));
}

/**
 * Modulos a los que el rol de la sesion llega por un permiso fino que se le delego.
 *
 * @param {string} rol
 * @returns {Set<string>}
 */
export function modulosPorPermisoFino(rol) {
  const acceso = accesoDe(rol);
  if (!acceso) return new Set();
  const modulos = new Set();
  for (const clave of acceso.permisos) {
    const modulo = MODULO_DE_PERMISO_FINO[clave];
    if (modulo) modulos.add(modulo);
  }
  return modulos;
}
