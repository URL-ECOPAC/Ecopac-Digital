import { TIPOS_DE_CAMPO, TIPOS_DE_PRESENTACION } from "../descriptores.js";

export const COLUMNAS_USUARIO = [
  {
    id: "avatar",
    label: "",
    tipo: TIPOS_DE_PRESENTACION.AVATAR,
    desde: "nombreCompleto",
    anchoWeb: "48px",
  },
  { id: "nombreCompleto", label: "Nombre", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "email", label: "Correo", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "rol", label: "Rol", tipo: TIPOS_DE_PRESENTACION.TEXTO, etiquetasDesde: "roles" },
  { id: "especialidades", label: "Especialidades", tipo: TIPOS_DE_PRESENTACION.CHIPS },
  { id: "jornadas", label: "Jornadas", tipo: TIPOS_DE_PRESENTACION.NUMERO },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    desde: "activo",
    etiquetasDesde: "estadoUsuario",
  },
  { id: "fechaIngreso", label: "Ingreso", tipo: TIPOS_DE_PRESENTACION.FECHA },
];

/**
 * Subconjunto de COLUMNAS_USUARIO para la tarjeta movil del listado (issue #272, criterio 3:
 * avatar, nombre, especialidad o rol y estado). Mismo patron que COLUMNAS_PACIENTE_MOVIL en
 * pacientes/columnas.js: un filtro sobre el descriptor de la web, no una copia con nombres
 * propios, para que las dos plataformas no puedan divergir en como se llama cada dato.
 */
export const COLUMNAS_USUARIO_MOVIL = COLUMNAS_USUARIO.filter((columna) =>
  ["avatar", "nombreCompleto", "rol", "especialidades", "estado"].includes(columna.id),
);

export const CAMPOS_FICHA_VOLUNTARIO = [
  { id: "nombreCompleto", label: "Nombre", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "email", label: "Correo", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "telefono", label: "Telefono", tipo: TIPOS_DE_CAMPO.TELEFONO },
  // direccion (migracion 00108): texto libre, sin formulario que lo escriba todavia (ver esa
  // migracion). Solo lectura por ahora, igual que 'notas', que no va en este arreglo porque su
  // presentacion es un bloque aparte, no una celda mas de la grilla (VoluntariosPage.jsx).
  { id: "direccion", label: "Direccion", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "rol", label: "Rol", tipo: TIPOS_DE_PRESENTACION.TEXTO, etiquetasDesde: "roles" },
  { id: "especialidades", label: "Especialidades", tipo: TIPOS_DE_PRESENTACION.CHIPS },
  { id: "fechaIngreso", label: "Fecha de ingreso", tipo: TIPOS_DE_PRESENTACION.FECHA },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    desde: "activo",
    etiquetasDesde: "estadoUsuario",
  },
];

/**
 * Historial de jornadas de una persona, dentro de su ficha.
 *
 * 'responsabilidad' es la de ESA persona en ESA jornada (jornada_personal.responsabilidad), no
 * el responsable de la jornada completa (jornadas.responsable_id): son dos columnas de dos
 * tablas distintas que solo se parecen en el nombre. 'pacientesAtendidos' es lo que esa persona
 * atendio en esa jornada puntual, no el total de la jornada.
 */
export const COLUMNAS_HISTORIAL_VOLUNTARIO = [
  { id: "nombre", label: "Jornada", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "fecha", label: "Fecha", tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: "estado", label: "Estado", tipo: TIPOS_DE_PRESENTACION.CHIP },
  { id: "responsabilidad", label: "Responsabilidad", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "pacientesAtendidos", label: "Pacientes atendidos", tipo: TIPOS_DE_PRESENTACION.NUMERO },
];
