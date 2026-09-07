import { ROLES, esAdministrador } from "./usuarios/roles.js";

/**
 * Los nueve modulos del sistema.
 *
 * - `modulo` coincide con la columna modulo de la tabla permisos (migracion 00003).
 * - `tabMovil` marca los cuatro destinos de la tab bar de la app movil; el resto se alcanza
 *   desde la pantalla de inicio.
 */
export const MODULOS = [
  {
    nombre: "Inicio",
    ruta: "/",
    modulo: null,
    tabMovil: true,
    icono: "Home",
    roles: Object.values(ROLES),
  },
  {
    nombre: "Pacientes",
    ruta: "/pacientes",
    modulo: "pacientes",
    tabMovil: true,
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
    nombre: "Donaciones",
    ruta: "/donaciones",
    modulo: "donaciones",
    tabMovil: false,
    icono: "HeartHandshake",
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
    nombre: "Inventario",
    ruta: "/inventario",
    modulo: "inventario",
    tabMovil: true,
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
    nombre: "Presupuestos",
    ruta: "/presupuestos",
    modulo: "presupuestos",
    tabMovil: false,
    icono: "DollarSign",
    roles: [ROLES.ADMINISTRADOR, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR],
  },
  {
    nombre: "Proyectos",
    ruta: "/proyectos",
    modulo: "proyectos",
    tabMovil: false,
    icono: "FolderKanban",
    roles: [ROLES.ADMINISTRADOR, ROLES.MEDICO, ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR],
  },
  {
    nombre: "Reportes",
    ruta: "/reportes",
    modulo: "reportes",
    tabMovil: false,
    icono: "BarChart3",
    roles: [
      ROLES.ADMINISTRADOR,
      ROLES.MEDICO,
      ROLES.FARMACEUTICO,
      ROLES.ENFERMERO,
      ROLES.JUNTA_DIRECTIVA,
      ROLES.SOCIO_FUNDADOR,
    ],
  },
  {
    nombre: "Jornadas",
    ruta: "/jornadas",
    modulo: "jornadas",
    tabMovil: true,
    icono: "Calendar",
    roles: Object.values(ROLES),
  },
  {
    nombre: "Colaboradores",
    ruta: "/colaboradores",
    modulo: "colaboradores",
    tabMovil: false,
    icono: "UserCheck",
    roles: [ROLES.ADMINISTRADOR],
  },
];

/**
 * Modulos a los que un rol tiene acceso.
 *
 * @param {string} rol
 * @param {object} [opciones]
 * @param {'web'|'mobile'} [opciones.plataforma]
 * @returns {Array}
 */
export function modulosVisibles(rol, opciones = {}) {
  const { plataforma } = opciones;

  return MODULOS.filter((m) => {
    if (!m.roles.includes(rol)) return false;
    if (plataforma === "mobile" && m.ruta === "/colaboradores") return false;
    return true;
  });
}

/** Los cuatro destinos de la tab bar movil, mas Ajustes, que no es un modulo. */
export function tabsMoviles(rol) {
  return modulosVisibles(rol, { plataforma: "mobile" }).filter((m) => m.tabMovil);
}
