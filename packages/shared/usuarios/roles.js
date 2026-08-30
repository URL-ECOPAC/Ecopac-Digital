// Roles del sistema.
//
// Los valores son exactamente los del enum rol_usuario de
// supabase/migrations/00001_initial_schema.sql. La base de datos es la fuente de verdad:
// si aqui se escribe un rol que el enum no tiene, la consulta falla en tiempo de ejecucion
// y ninguna politica RLS lo reconoce.
//
// Van congelados, igual que los enums de enums.js, y no solo por higiene: es lo que hace que el
// tipo RolUsuario de types/index.js sea la union de los cinco roles. Sin Object.freeze,
// TypeScript infiere `string` para los valores de un objeto literal y `perfil.rol` deja de
// autocompletar (issue #48).

export const ROLES = Object.freeze({
  ADMINISTRADOR: "administrador",
  JUNTA_DIRECTIVA: "junta directiva",
  SOCIO_FUNDADOR: "socio fundador",
  MEDICO: "medico",
  VOLUNTARIO: "voluntario general",
});

/** Etiqueta legible de cada rol, para mostrar en la interfaz. */
export const ETIQUETAS_ROL = Object.freeze({
  [ROLES.ADMINISTRADOR]: "Administradora",
  [ROLES.JUNTA_DIRECTIVA]: "Junta directiva",
  [ROLES.SOCIO_FUNDADOR]: "Socio fundador",
  [ROLES.MEDICO]: "Medico",
  [ROLES.VOLUNTARIO]: "Voluntario",
});

/** Roles con acceso administrativo completo. */
export const ROLES_ADMINISTRATIVOS = [ROLES.ADMINISTRADOR];

/** Roles de gobernanza: ven casi todo, pero solo de lectura. */
export const ROLES_CONSULTIVOS = [ROLES.JUNTA_DIRECTIVA, ROLES.SOCIO_FUNDADOR];

/** Roles que operan en campo durante una jornada. */
export const ROLES_DE_CAMPO = [ROLES.MEDICO, ROLES.VOLUNTARIO];

export const TODOS_LOS_ROLES = Object.values(ROLES);

export function esAdministrador(rol) {
  return rol === ROLES.ADMINISTRADOR;
}

export function esConsultivo(rol) {
  return ROLES_CONSULTIVOS.includes(rol);
}

export function etiquetaDeRol(rol) {
  return ETIQUETAS_ROL[rol] ?? rol;
}
