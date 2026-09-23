import { ROLES, ROLES_DE_CAMPO } from "./usuarios/roles.js";

/**
 * Los once módulos del sistema.
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
    id: "donaciones",
    nombre: "Donaciones",
    descripcion: "Donantes, aportes recibidos y constancias.",
    ruta: "/donaciones",
    modulo: "donaciones",
    tabMovil: false,
    movil: false,
    icono: "HeartHandshake",
    roles: [ROLES.ADMINISTRADOR, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR],
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
    // Los cinco roles reales (ver nota de ROLES.FARMACEUTICO/ENFERMERO en el modulo "pacientes"
    // de arriba: dos claves inexistentes que aqui tambien se limpian, sin cambio de efecto).
    roles: Object.values(ROLES),
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
    roles: [ROLES.ADMINISTRADOR, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR],
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
    roles: [ROLES.ADMINISTRADOR, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR],
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
    id: "jornadas",
    nombre: "Jornadas",
    descripcion: "Planificacion, equipo, cuadro de turnos y cierre.",
    ruta: "/jornadas",
    modulo: "jornadas",
    tabMovil: "Jornadas",
    movil: true,
    icono: "Calendar",
    roles: Object.values(ROLES),
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
    // Issue #756: puedeVerListadoUsuarios() (usuarios/permisos.js) ya declaraba que junta
    // directiva podia ver el listado -perfiles_directorio (00038/00080) existe exactamente para
    // eso-, pero el guard de esta ruta la dejaba fuera, asi que nunca llegaba a la pantalla.
    roles: [ROLES.ADMINISTRADOR, ROLES.JUNTA_DIRECTIVA],
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
 * Obtener los roles autorizados para un módulo dado.
 */
export function rolesDelModulo(moduloId) {
  if (!moduloId) return [];
  const mod = MODULOS.find((m) => m.id === moduloId || m.modulo === moduloId);
  return mod ? mod.roles : [];
}

export const ROLES_CON_ACCESO_MOVIL = Object.freeze([ROLES.ADMINISTRADOR, ...ROLES_DE_CAMPO]);

export function puedeUsarAppMovil(rol) {
  return ROLES_CON_ACCESO_MOVIL.includes(rol);
}

/**
 * Módulos a los que un rol tiene acceso (Lista plana).
 */
export function modulosVisibles(rol, opciones = {}) {
  if (!rol) return [];

  const { plataforma } = opciones;

  if (plataforma === "mobile" && !puedeUsarAppMovil(rol)) return [];

  return MODULOS.filter((m) => {
    if (!m.roles.includes(rol)) return false;
    if (plataforma === "mobile" && !m.movil) return false;
    return true;
  });
}

/**
 * Secciones estructuradas requeridas por la interfaz Web (`MainLayout.jsx`).
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
 */
export function moduloDeRuta(pathname) {
  if (!pathname) return null;
  if (pathname === "/") return MODULOS.find((m) => m.ruta === "/") || null;

  return MODULOS.find((m) => m.ruta !== "/" && pathname.startsWith(m.ruta)) || null;
}

/** Destinos de la tab bar móvil según el rol */
export function tabsMoviles(rol) {
  return modulosVisibles(rol, { plataforma: "mobile" }).filter((m) => Boolean(m.tabMovil));
}
