import { ROLES } from "./usuarios/roles.js";

/**
 * Los nueve módulos del sistema.
 */
export const MODULOS = [
  {
    id: "inicio",
    nombre: "Inicio",
    ruta: "/",
    modulo: null,
    tabMovil: "Inicio",
    soloWeb: false,
    icono: "Home",
    roles: Object.values(ROLES),
  },
  {
    id: "pacientes",
    nombre: "Pacientes",
    ruta: "/pacientes",
    modulo: "pacientes",
    tabMovil: "Pacientes",
    soloWeb: false,
    icono: "Users",
    roles: [
      ROLES.ADMINISTRADOR,
      ROLES.MEDICO,
      ROLES.FARMACEUTICO,
      ROLES.ENFERMERO,
      ROLES.VOLUNTARIO,
    ],
  },
  {
    id: "donaciones",
    nombre: "Donaciones",
    ruta: "/donaciones",
    modulo: "donaciones",
    tabMovil: false,
    soloWeb: false,
    icono: "HeartHandshake",
    roles: [ROLES.ADMINISTRADOR, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR],
  },
  {
    id: "inventario",
    nombre: "Inventario",
    ruta: "/inventario",
    modulo: "inventario",
    tabMovil: "Inventario",
    soloWeb: false,
    icono: "Package",
    roles: [
      ROLES.ADMINISTRADOR,
      ROLES.MEDICO,
      ROLES.FARMACEUTICO,
      ROLES.ENFERMERO,
      ROLES.VOLUNTARIO,
      ROLES.JUNTA_DIRECTIVA,
      ROLES.SOCIO_FUNDADOR,
    ],
  },
  {
    id: "presupuestos",
    nombre: "Presupuestos",
    ruta: "/presupuestos",
    modulo: "presupuestos",
    tabMovil: false,
    soloWeb: false,
    icono: "DollarSign",
    roles: [ROLES.ADMINISTRADOR, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR],
  },
  {
    id: "proyectos",
    nombre: "Proyectos",
    ruta: "/proyectos",
    modulo: "proyectos",
    tabMovil: false,
    soloWeb: false,
    icono: "FolderKanban",
    roles: [ROLES.ADMINISTRADOR, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR],
  },
  {
    id: "reportes",
    nombre: "Reportes",
    ruta: "/reportes",
    modulo: "reportes",
    tabMovil: false,
    soloWeb: true,
    icono: "BarChart3",
    roles: [ROLES.ADMINISTRADOR, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR],
  },
  {
    id: "jornadas",
    nombre: "Jornadas",
    ruta: "/jornadas",
    modulo: "jornadas",
    tabMovil: "Jornadas",
    soloWeb: false,
    icono: "Calendar",
    roles: Object.values(ROLES),
  },
  {
    id: "colaboradores",
    nombre: "Colaboradores",
    ruta: "/colaboradores",
    modulo: "colaboradores",
    tabMovil: false,
    soloWeb: true,
    icono: "UserCheck",
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

/**
 * Módulos a los que un rol tiene acceso (Lista plana).
 */
export function modulosVisibles(rol, opciones = {}) {
  if (!rol) return [];

  const { plataforma } = opciones;

  return MODULOS.filter((m) => {
    if (!m.roles.includes(rol)) return false;
    if (
      plataforma === "mobile" &&
      (m.soloWeb || m.ruta === "/colaboradores" || m.ruta === "/reportes")
    ) {
      return false;
    }
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
