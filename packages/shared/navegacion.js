import { accedeAModuloPorMatriz, modulosPorPermisoFino } from "./usuarios/acceso.js";
import { ROLES, ROLES_DE_CAMPO } from "./usuarios/roles.js";

/**
 * Los once módulos del sistema, en el orden en que aparecen en el menu, en la rejilla de inicio y
 * en las pestanas de movil: primero la planificacion (proyectos, jornadas, presupuestos,
 * donaciones), despues la operacion (inventario, pacientes) y al final la consulta y la
 * administracion.
 *
 * `descripcion` es una linea de que se hace en cada modulo. La pantalla de inicio la pinta
 * debajo del nombre en cada acceso: una rejilla de nueve palabras sueltas no le dice a nadie
 * que encontrara al entrar, y menos a una voluntaria que usa el sistema por primera vez en
 * jornada. Vive aqui y no en la pantalla por la misma razon que `nombre` e `icono`: un modulo
 * nuevo aparece en el inicio, en el sidebar y en las pestanas de movil sin tocar ninguna app.
 */
export const MODULOS = [
  {
    id: "inicio",
    nombre: "Inicio",
    descripcion: "Resumen de tu dia y accesos a tus modulos.",
    ruta: "/",
    modulo: null,
    tabMovil: "Inicio",
    movil: true,
    icono: "Home",
    roles: Object.values(ROLES),
  },
  {
    id: "proyectos",
    nombre: "Proyectos",
    descripcion: "Proyectos sociales, hitos y seguimiento.",
    ruta: "/proyectos",
    modulo: "proyectos",
    tabMovil: false,
    movil: false,
    icono: "FolderKanban",
    // El personal de campo ve **solo los proyectos a los que pertenece** -por su equipo o por una
    // de sus jornadas, pertenece_a_proyecto() de la 00148, no esta lista- y en solo consulta: sin
    // presupuesto, insumos, gastos ni seguimiento (proyectos/permisos.js). La 00148 suma al
    // colaborador, que hasta ahi no lo tenia.
    roles: [ROLES.ADMINISTRADOR, ...ROLES_DE_CAMPO],
  },
  {
    id: "jornadas",
    nombre: "Jornadas",
    descripcion: "Planificacion, equipo, cuadro de turnos y cierre.",
    ruta: "/jornadas",
    modulo: "jornadas",
    tabMovil: "Jornadas",
    movil: true,
    icono: "Calendar",
    // ISSUE #864: los tres roles de operacion. La base ya solo entregaba a medico y voluntario
    // las jornadas en las que participan (00039/00079), y la 00141 le suma la que cada quien
    // tiene a su cargo como `responsable_id`.
    roles: [ROLES.ADMINISTRADOR, ROLES.MEDICO, ROLES.VOLUNTARIO],
  },
  {
    id: "presupuestos",
    nombre: "Presupuestos",
    descripcion: "Presupuesto por jornada y proyecto, gastos y aprobaciones.",
    ruta: "/presupuestos",
    modulo: "presupuestos",
    tabMovil: false,
    movil: false,
    icono: "DollarSign",
    // 00148: el personal de campo ve el presupuesto de lo suyo -RLS le entrega los gastos de sus
    // jornadas- y registra gastos, que entran pendientes. Aprobar no: esa pestana es de quien
    // tiene presupuestos.aprobar (presupuestos/permisos.js).
    roles: [ROLES.ADMINISTRADOR, ...ROLES_DE_CAMPO],
  },
  {
    id: "donaciones",
    nombre: "Donaciones",
    descripcion: "Donantes, aportes recibidos y constancias.",
    ruta: "/donaciones",
    modulo: "donaciones",
    tabMovil: false,
    movil: false,
    icono: "HeartHandshake",
    // ISSUE #864: solo la administradora. Junta directiva y socio fundador salen de aqui junto
    // con la lectura de donantes/donaciones/donacion_detalle que les retira la 00141: su unica
    // pantalla es Reportes.
    roles: [ROLES.ADMINISTRADOR],
  },
  {
    id: "inventario",
    nombre: "Inventario",
    descripcion: "Catalogo, lotes, existencias y alertas de vencimiento.",
    ruta: "/inventario",
    modulo: "inventario",
    tabMovil: "Inventario",
    movil: true,
    icono: "Package",
    // ISSUE #864: los tres roles que operan el inventario. Los consultivos ya no entran a la
    // pantalla -su unica pantalla es Reportes-, aunque SI conservan la lectura de `existencias`
    // y `lotes` en la base: los reportes de inventario las consultan directo (ver la 00141 y
    // docs/PERMISOS.md, "Divergencias").
    //
    // Antes decia Object.values(ROLES), y ademas listaba ROLES.FARMACEUTICO y ROLES.ENFERMERO,
    // dos claves que ROLES no declara -el enum real solo tiene cinco valores-, asi que
    // evaluaban a undefined; se limpiaron en la #700.
    roles: [ROLES.ADMINISTRADOR, ROLES.MEDICO, ROLES.VOLUNTARIO],
  },
  {
    id: "pacientes",
    nombre: "Pacientes",
    descripcion: "Expedientes clinicos, triaje, consultas y recetas.",
    ruta: "/pacientes",
    modulo: "pacientes",
    tabMovil: "Pacientes",
    movil: true,
    icono: "Users",
    // ROLES.ADMINISTRADOR/MEDICO/VOLUNTARIO, no los cinco: espejo de "Administrador, medico y
    // voluntario leen pacientes" (00032). Antes tambien listaba ROLES.FARMACEUTICO y
    // ROLES.ENFERMERO, dos claves que ROLES (usuarios/roles.js) no declara -el enum real solo
    // tiene cinco valores-, asi que evaluaban a undefined; sin efecto en el resultado (un
    // undefined no coincide con ningun rol real), pero se limpian por higiene.
    roles: [ROLES.ADMINISTRADOR, ROLES.MEDICO, ROLES.VOLUNTARIO],
  },
  {
    id: "reportes",
    nombre: "Reportes",
    descripcion: "Indicadores de jornada, pacientes e inventario.",
    ruta: "/reportes",
    modulo: "reportes",
    tabMovil: false,
    movil: false,
    icono: "BarChart3",
    roles: [ROLES.ADMINISTRADOR, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR],
  },
  {
    id: "colaboradores",
    nombre: "Colaboradores",
    descripcion: "Personal, roles, especialidades y permisos.",
    ruta: "/colaboradores",
    modulo: "colaboradores",
    tabMovil: false,
    movil: false,
    icono: "UserCheck",
    // ISSUE #864: solo la administradora.
    //
    // Esto revierte la #756, que habia abierto la pantalla a junta directiva porque
    // puedeVerListadoUsuarios() ya lo permitia y el guard no. La #864 es posterior y explicita
    // -"Junta directiva: solo ve reportes"-, asi que se cierran las dos capas a la vez: esta
    // lista, puedeVerListadoUsuarios() y la vista `perfiles_directorio` (00141). Queda anotado
    // en docs/PERMISOS.md para que no parezca un descuido.
    roles: [ROLES.ADMINISTRADOR],
  },
  {
    id: "matriz-permisos",
    nombre: "Matriz de permisos",
    descripcion: "Que permiso tiene cada rol por defecto, y quien lo cambio.",
    ruta: "/matriz-permisos",
    modulo: "matriz-permisos",
    tabMovil: false,
    movil: false,
    icono: "ShieldCheck",
    roles: [ROLES.ADMINISTRADOR],
  },
  {
    id: "bitacora-auditoria",
    nombre: "Bitácora de auditoría",
    descripcion: "Quién cambió qué y cuándo en los datos sensibles del sistema.",
    ruta: "/bitacora-auditoria",
    modulo: "bitacora-auditoria",
    tabMovil: false,
    movil: false,
    icono: "History",
    roles: [ROLES.ADMINISTRADOR],
  },
];

/**
 * Obtener los roles que tienen un modulo POR DEFECTO. Lo que abre la matriz o una delegacion no
 * esta aqui: para saber si alguien entra, puedeVerModulo().
 *
 * @param {string} moduloId
 * @returns {string[]}
 */
export function rolesDelModulo(moduloId) {
  if (!moduloId) return [];
  const mod = MODULOS.find((m) => m.id === moduloId || m.modulo === moduloId);
  return mod ? mod.roles : [];
}

/**
 * Los modulos que la matriz de acceso puede abrir a un rol (00148, chk_rol_modulo_modulo). Inicio
 * lo tiene todo el mundo; la matriz y la bitacora se quedan siempre en la administradora.
 */
export const MODULOS_DE_LA_MATRIZ = MODULOS.filter(
  (m) => !["inicio", "matriz-permisos", "bitacora-auditoria"].includes(m.id),
);

/**
 * Si el rol tiene el modulo por defecto: espejo de modulo_por_defecto() de la 00148, que tambien
 * usa la restriccion de rol_modulo para no conceder lo que el rol ya tiene.
 *
 * @param {string} rol
 * @param {string} moduloId `MODULOS[].id`.
 * @returns {boolean}
 */
export function esModuloPorDefecto(rol, moduloId) {
  return rolesDelModulo(moduloId).includes(rol);
}

/**
 * Si el rol entra a un modulo: por defecto, porque la matriz se lo abrio (solo lectura), o porque a
 * la persona de la sesion se le delego una funcion de ese modulo (usuarios/acceso.js). Es lo que
 * deciden el menu y el guard de rutas de las dos apps.
 *
 * @param {string} rol
 * @param {string} moduloId `MODULOS[].id`.
 * @returns {boolean}
 */
export function puedeVerModulo(rol, moduloId) {
  if (!rol) return false;
  const mod = MODULOS.find((m) => m.id === moduloId);
  if (!mod) return false;
  if (mod.roles.includes(rol)) return true;
  if (!MODULOS_DE_LA_MATRIZ.includes(mod)) return false;
  return accedeAModuloPorMatriz(rol, mod.modulo) || modulosPorPermisoFino(rol).has(mod.id);
}

export const ROLES_CON_ACCESO_MOVIL = Object.freeze([ROLES.ADMINISTRADOR, ...ROLES_DE_CAMPO]);

/**
 * Si un rol puede usar la app movil: el administrador y los roles de campo. Los consultivos no.
 *
 * @param {string} rol Valor de `ROLES`.
 * @returns {boolean}
 */
export function puedeUsarAppMovil(rol) {
  return ROLES_CON_ACCESO_MOVIL.includes(rol);
}

/**
 * Módulos a los que un rol tiene acceso (Lista plana).
 *
 * @param {string} rol
 * @param {object} [opciones]
 * @returns {object[]}
 */
export function modulosVisibles(rol, opciones = {}) {
  if (!rol) return [];

  const { plataforma } = opciones;

  if (plataforma === "mobile" && !puedeUsarAppMovil(rol)) return [];

  return MODULOS.filter((m) => {
    if (!puedeVerModulo(rol, m.id)) return false;
    if (plataforma === "mobile" && !m.movil) return false;
    return true;
  });
}

/**
 * Secciones estructuradas requeridas por la interfaz Web (`MainLayout.jsx`).
 *
 * @param {string} rol
 * @returns {object[]}
 */
export function seccionesVisibles(rol) {
  const modulos = modulosVisibles(rol);
  if (!modulos.length) return [];

  return [
    {
      id: "principal",
      titulo: "Navegación",
      modulos: modulos,
    },
  ];
}

/**
 * Encuentra el módulo correspondiente según la ruta actual de la Web.
 *
 * @param {string} pathname
 * @returns {object|null} El modulo de MODULOS, o null.
 */
export function moduloDeRuta(pathname) {
  if (!pathname) return null;
  if (pathname === "/") return MODULOS.find((m) => m.ruta === "/") || null;

  return MODULOS.find((m) => m.ruta !== "/" && pathname.startsWith(m.ruta)) || null;
}

/**
 * Destinos de la tab bar móvil según el rol
 *
 * @param {string} rol
 * @returns {object[]}
 */
export function tabsMoviles(rol) {
  return modulosVisibles(rol, { plataforma: "mobile" }).filter((m) => Boolean(m.tabMovil));
}
