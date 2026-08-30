// Esquema declarativo de los formularios del modulo de jornadas: formulario de
// jornada (creacion/edicion), asignacion de personal y marcar asistencia.
//
// Los campos y su validacion reflejan las columnas y los CHECK reales de jornadas y
// jornada_personal (00012, mas codigo/fecha_inicio_real/fecha_fin_real/
// orden_kanban/cupo_estimado/botiquin_bodega_id/asistio agregados en la 00036), no el
// diccionario de datos original cuando difieren (ver AGENTS.md, "Fuente de verdad").
// estado, orden_kanban, fecha_inicio_real y fecha_fin_real no son campos de este
// formulario: los mueve el kanban (arrastrar una tarjeta) y las acciones de iniciar/
// finalizar jornada, no una edicion manual.

import { TIPOS_DE_CAMPO } from "../descriptores.js";
import { TODOS_LOS_ROLES, etiquetaDeRol } from "../usuarios/roles.js";

/**
 * Valores de rol_usuario (00001_initial_schema.sql), para el rol que se ejerce en la jornada.
 *
 * Se derivan de roles.js en vez de escribirse a mano. AGENTS.md lo pide explicitamente ("Los roles
 * nunca se escriben como string suelto"), y el motivo es concreto: esta lista ya estaba duplicada,
 * y una copia que se queda atras produce un INSERT que Postgres rechaza por enum invalido. Un rol
 * nuevo en el enum ahora aparece aqui solo.
 */
export const OPCIONES_ROL_EN_JORNADA = TODOS_LOS_ROLES.map((rol) => ({
  value: rol,
  label: etiquetaDeRol(rol),
}));

/**
 * Responsabilidad funcional dentro de la jornada (issue #174, criterio 1): triaje, consulta o
 * farmacia. Vive en jornada_personal.responsabilidad, una columna TEXT sin CHECK (00012): esta
 * lista es una guia para el formulario, no una restriccion de la base de datos, asi que una
 * fila existente con otro texto en esa columna sigue siendo valida.
 */
export const OPCIONES_RESPONSABILIDAD_JORNADA = [
  { value: "triaje", label: "Triaje" },
  { value: "consulta", label: "Consulta" },
  { value: "farmacia", label: "Farmacia" },
];

/** Formulario de creacion/edicion de una jornada (jornadas, 00012 + 00036). */
export const CAMPOS_JORNADA = [
  {
    id: "nombre",
    label: "Nombre",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: 150 },
  },
  {
    id: "codigo",
    label: "Codigo",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: false, maxLongitud: 30 },
  },
  {
    id: "fecha",
    label: "Fecha",
    tipo: TIPOS_DE_CAMPO.FECHA,
    validacion: { requerido: true, minFecha: "hoy" },
  },
  {
    id: "comunidad",
    label: "Comunidad",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "comunidades",
    validacion: { requerido: true },
  },
  {
    id: "responsable",
    label: "Responsable",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "perfiles",
    validacion: { requerido: true },
  },
  {
    id: "proyecto",
    label: "Proyecto",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "proyectos",
    validacion: { requerido: false },
  },
  {
    id: "cupoEstimado",
    label: "Cupo estimado",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    validacion: { requerido: false, min: 0 },
  },
  {
    id: "presupuestoAsignado",
    label: "Presupuesto asignado",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    validacion: { requerido: false, min: 0 },
  },
  {
    id: "botiquinBodega",
    label: "Bodega de botiquin",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "bodegas",
    validacion: { requerido: false },
  },
];

/**
 * Formulario de asignacion de personal a una jornada (jornada_personal, 00012).
 * asistio no esta aqui: se marca despues, con CAMPOS_MARCAR_ASISTENCIA.
 */
export const CAMPOS_ASIGNACION_PERSONAL = [
  {
    id: "perfil",
    label: "Perfil",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "perfiles",
    validacion: { requerido: true },
  },
  {
    id: "rolEnJornada",
    label: "Rol en la jornada",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_ROL_EN_JORNADA,
    validacion: { requerido: true },
  },
  {
    id: "horaInicio",
    label: "Hora de inicio",
    tipo: TIPOS_DE_CAMPO.HORA,
    validacion: { requerido: true },
  },
  {
    id: "horaFin",
    label: "Hora de fin",
    tipo: TIPOS_DE_CAMPO.HORA,
    validacion: { requerido: true, mayorQueCampo: "horaInicio" },
  },
  {
    id: "responsabilidad",
    label: "Responsabilidad",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opciones: OPCIONES_RESPONSABILIDAD_JORNADA,
    validacion: { requerido: false },
  },
];

/**
 * CAMPOS_ASIGNACION_PERSONAL sin el campo `perfil` (issue #182).
 *
 * La pantalla de asignar personal elige a quien asignar con un buscador (ModalAsignarPersonal.jsx,
 * useAsignacionPersonal.js), no con el <select> que declara `opcionesDesde: 'perfiles'`: ese
 * campo no tiene sentido una vez que la persona ya se eligio en el paso anterior. Se filtra aca,
 * al lado del descriptor original, para que el resto del modulo (y la futura version movil de
 * esta misma pantalla) lo reuse sin repetir el filtro.
 */
export const CAMPOS_ASIGNACION_PERSONAL_SIN_PERFIL = CAMPOS_ASIGNACION_PERSONAL.filter(
  (campo) => campo.id !== "perfil",
);

/**
 * Subconjunto de CAMPOS_ASIGNACION_PERSONAL para editar el horario y la responsabilidad de
 * alguien que YA esta asignado a la jornada (issue #185, criterio 2). Sin `perfil` (se edita una
 * fila existente, no se elige a quien) ni `rolEnJornada` (el criterio de aceptacion solo pide
 * editar horario y responsabilidad; el rol en la jornada se define al asignar, en el modal de
 * #182, y esta pantalla no lo toca).
 */
const IDS_CAMPOS_EDICION_TURNO = ["horaInicio", "horaFin", "responsabilidad"];

export const CAMPOS_EDICION_TURNO = CAMPOS_ASIGNACION_PERSONAL.filter((campo) =>
  IDS_CAMPOS_EDICION_TURNO.includes(campo.id),
);

/** Marcar la asistencia de un perfil ya asignado (jornada_personal.asistio, 00036). */
export const CAMPOS_MARCAR_ASISTENCIA = [
  {
    id: "asistio",
    label: "Asistio",
    tipo: TIPOS_DE_CAMPO.BOOLEANO,
    validacion: { requerido: false },
  },
];

/**
 * Subconjunto de CAMPOS_JORNADA para el formulario de alta/edicion de jornada (issue #179).
 *
 * Los cinco campos que la revision del plan confirmo: nombre, fecha, comunidad, responsable y
 * proyecto (PLAN.md, seccion 7, decision 3). Quedan fuera codigo, cupoEstimado,
 * presupuestoAsignado y botiquinBodega: ninguno esta en el objetivo del issue.
 *
 * Hallazgo de esa misma revision: ninguna pantalla del repo escribe cupoEstimado. Al no estar en
 * este formulario tampoco, la columna cupo_estimado queda NULL en toda jornada nueva, y
 * cualquier futura barra de progreso de cupo (COLUMNAS_JORNADA ya reserva esa clave, ver
 * columnas.js) se dibujaria vacia hasta que otro issue la resuelva.
 *
 * "observaciones" no aparece: el objetivo original del issue #179 la nombra, pero la tabla
 * jornadas (00012 + 00036) no tiene esa columna. No se propone ninguna migracion para agregarla
 * (PLAN.md, seccion 7, decision 2).
 *
 * No se repiten aca ni el label ni el tipo ni las opciones: se filtra el descriptor completo,
 * mismo patron que CAMPOS_ALTA_USUARIO en usuarios/useAltaUsuario.js.
 */
const IDS_CAMPOS_FORMULARIO_JORNADA = ["nombre", "fecha", "comunidad", "responsable", "proyecto"];

export const CAMPOS_FORMULARIO_JORNADA = CAMPOS_JORNADA.filter((campo) =>
  IDS_CAMPOS_FORMULARIO_JORNADA.includes(campo.id),
);
