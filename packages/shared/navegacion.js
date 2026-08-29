// Definicion unica de la navegacion del sistema.
//
// La consumen el sidebar de la web y la tab bar de la app movil, para que un modulo nuevo
// se agregue en un solo lugar. Las secciones y el orden salen del prototipo de Figma
// (ver docs/DISENO.md).
//
// Ocultar una opcion del menu NO es control de acceso: la restriccion real vive en las
// politicas RLS y en el guard de rutas. Estos roles solo deciden que se dibuja.

import { ROLES, ROLES_CONSULTIVOS, TODOS_LOS_ROLES } from './usuarios/roles.js';

const ADMIN = [ROLES.ADMINISTRADOR];
const ADMIN_Y_CONSULTIVOS = [ROLES.ADMINISTRADOR, ...ROLES_CONSULTIVOS];

// Dos grupos "operativos" a proposito, no uno (issue #426): los roles consultivos
// (junta directiva, socio fundador) son de solo lectura en casi todo, pero por decision de la
// organizacion -misma que documenta la 00032 del lado de la base de datos- NO ven informacion
// clinica ni pacientes identificables, solo agregados. Un modulo con datos clinicos usa
// OPERATIVOS_CLINICOS; el resto (inventario, jornadas), donde los consultivos si tienen
// lectura, usa OPERATIVOS. El proximo modulo clinico que se agregue elige entre estas dos
// listas ya existentes, en vez de enumerar roles a mano y arriesgarse a repetir el error de
// incluir a los consultivos donde no corresponde.
const OPERATIVOS_CLINICOS = [ROLES.ADMINISTRADOR, ROLES.MEDICO, ROLES.VOLUNTARIO];
const OPERATIVOS = [ROLES.ADMINISTRADOR, ...ROLES_CONSULTIVOS, ROLES.MEDICO, ROLES.VOLUNTARIO];

/** Secciones del sidebar, en el orden del prototipo. */
export const SECCIONES = [
  { id: 'principal', titulo: 'Principal' },
  { id: 'atencion', titulo: 'Atencion medica' },
  { id: 'operaciones', titulo: 'Operaciones' },
  { id: 'administracion', titulo: 'Administracion' },
  { id: 'jornadas', titulo: 'Jornadas' },
];

/**
 * Los nueve modulos del sistema.
 *
 * - `modulo` coincide con la columna modulo de la tabla permisos (migracion 00003).
 * - `tabMovil` marca los cinco destinos de la tab bar de la app movil; el resto se alcanza
 *   desde la pantalla de inicio.
 */
export const MODULOS = [
  {
    id: 'inicio',
    etiqueta: 'Inicio',
    ruta: '/',
    seccion: 'principal',
    modulo: null,
    roles: TODOS_LOS_ROLES,
    tabMovil: 'Inicio',
  },
  {
    id: 'pacientes',
    etiqueta: 'Pacientes',
    ruta: '/pacientes',
    seccion: 'atencion',
    modulo: 'pacientes',
    roles: OPERATIVOS_CLINICOS,
    tabMovil: 'Pacientes',
  },
  {
    id: 'donaciones',
    etiqueta: 'Donaciones',
    ruta: '/donaciones',
    seccion: 'atencion',
    modulo: 'donaciones',
    roles: ADMIN_Y_CONSULTIVOS,
  },
  {
    id: 'inventario',
    etiqueta: 'Inventario',
    ruta: '/inventario',
    seccion: 'operaciones',
    modulo: 'inventario',
    roles: OPERATIVOS,
    tabMovil: 'Inventario',
  },
  {
    id: 'presupuestos',
    etiqueta: 'Presupuestos',
    ruta: '/presupuestos',
    seccion: 'operaciones',
    modulo: 'presupuestos',
    roles: ADMIN_Y_CONSULTIVOS,
  },
  {
    id: 'proyectos',
    etiqueta: 'Proyectos',
    ruta: '/proyectos',
    seccion: 'administracion',
    modulo: 'proyectos',
    roles: ADMIN_Y_CONSULTIVOS,
  },
  {
    id: 'reportes',
    etiqueta: 'Reportes',
    ruta: '/reportes',
    seccion: 'administracion',
    modulo: 'reportes',
    roles: ADMIN_Y_CONSULTIVOS,
    soloWeb: true, // El modulo de reportes existe unicamente en la version web
  },
  {
    id: 'jornadas',
    etiqueta: 'Kanban Jornadas',
    ruta: '/jornadas',
    seccion: 'jornadas',
    modulo: 'jornadas',
    roles: OPERATIVOS,
    tabMovil: 'Jornadas',
  },
  {
    id: 'voluntarios',
    etiqueta: 'Voluntarios',
    ruta: '/voluntarios',
    seccion: 'jornadas',
    modulo: 'usuarios',
    roles: ADMIN,
  },
];

/** Modulos que el rol puede ver, respetando el orden de la definicion. */
export function modulosVisibles(rol, { plataforma = 'web' } = {}) {
  return MODULOS.filter(
    (m) => m.roles.includes(rol) && !(plataforma === 'mobile' && m.soloWeb)
  );
}

/** Modulos visibles agrupados por seccion, para dibujar el sidebar de la web. */
export function seccionesVisibles(rol) {
  const visibles = modulosVisibles(rol);
  return SECCIONES.map((seccion) => ({
    ...seccion,
    modulos: visibles.filter((m) => m.seccion === seccion.id),
  })).filter((seccion) => seccion.modulos.length > 0);
}

/** Los cinco destinos de la tab bar movil, mas Ajustes, que no es un modulo. */
export function tabsMoviles(rol) {
  return modulosVisibles(rol, { plataforma: 'mobile' }).filter((m) => m.tabMovil);
}
