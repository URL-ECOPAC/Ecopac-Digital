// Esquema declarativo de los formularios de proyectos, hitos y seguimiento (issue #287).
//
// ESTADOS_PROYECTO/TODOS_LOS_ESTADOS_PROYECTO/LONGITUD_MAXIMA_NOMBRE_PROYECTO se quedan en
// validaciones.js (los usa tambien TRANSICIONES_PROYECTO ahi mismo); este archivo los importa
// en vez de declarar una segunda copia.

import { labels } from "@ecopac/ui-tokens";

import { TIPOS_DE_CAMPO } from "../descriptores.js";
import { ESTADOS_PROYECTO, LONGITUD_MAXIMA_NOMBRE_PROYECTO } from "./validaciones.js";

/**
 * Catalogo de estado_proyecto (00007) para filtros y ficha de detalle. Las claves de
 * statusColors son las formas MASCULINAS agregadas en esta issue (planificado/finalizado/
 * cancelado, distintas de las femeninas de estado_jornada); 'en curso' es identico entre los
 * dos enums y reutiliza la misma etiqueta.
 */
export const OPCIONES_ESTADO_PROYECTO = [
  { valor: ESTADOS_PROYECTO.PLANIFICADO, clave: "planificado", etiqueta: labels.proyectoPlanificado },
  { valor: ESTADOS_PROYECTO.EN_CURSO, clave: "en curso", etiqueta: labels.jornadaEnCurso },
  { valor: ESTADOS_PROYECTO.FINALIZADO, clave: "finalizado", etiqueta: labels.proyectoFinalizado },
  { valor: ESTADOS_PROYECTO.CANCELADO, clave: "cancelado", etiqueta: labels.proyectoCancelado },
];

/**
 * Formulario de creacion/edicion de un proyecto (proyectos, 00007). `estado` no es un campo de
 * este formulario: el trigger de transiciones (00029) y cambiarEstadoProyecto() lo gobiernan, no
 * una edicion manual -mismo criterio que jornadas/campos.js excluye estado/orden_kanban de
 * CAMPOS_JORNADA por la misma razon ("los mueve el kanban... no una edicion manual").
 */
export const CAMPOS_PROYECTO = [
  {
    id: "nombre",
    label: "Nombre",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    validacion: { requerido: true, maxLongitud: LONGITUD_MAXIMA_NOMBRE_PROYECTO },
  },
  {
    id: "descripcion",
    label: "Descripcion",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
  { id: "fechaInicio", label: "Fecha de inicio", tipo: TIPOS_DE_CAMPO.FECHA, validacion: { requerido: false } },
  { id: "fechaFin", label: "Fecha de fin", tipo: TIPOS_DE_CAMPO.FECHA, validacion: { requerido: false } },
  {
    id: "responsableId",
    label: "Responsable",
    tipo: TIPOS_DE_CAMPO.SELECT,
    opcionesDesde: "perfiles",
    validacion: { requerido: false },
  },
];

/**
 * Formulario de un hito (proyecto_hitos, 00053). Sin proyectoId: llega del contexto de la ficha
 * del proyecto, no es algo que la persona elija en el formulario.
 */
export const CAMPOS_HITO = [
  { id: "nombre", label: "Nombre", tipo: TIPOS_DE_CAMPO.TEXTO, validacion: { requerido: true, maxLongitud: 150 } },
  {
    id: "descripcion",
    label: "Descripcion",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    validacion: { requerido: false },
  },
  { id: "fechaPrevista", label: "Fecha prevista", tipo: TIPOS_DE_CAMPO.FECHA, validacion: { requerido: true } },
  // Normalmente la pone marcarHitoCumplido()/reabrirHito() (avance.api.js), no una escritura a
  // mano; se declara para permitir una correccion administrativa puntual.
  { id: "fechaReal", label: "Fecha real de cumplimiento", tipo: TIPOS_DE_CAMPO.FECHA, validacion: { requerido: false } },
];

/**
 * Formulario de una entrada de seguimiento (proyecto_seguimiento, 00053). El CHECK de la tabla
 * exige nota O porcentaje_nuevo (al menos uno): es una regla cruzada entre dos campos, mismo
 * tratamiento que "al menos un contacto" en donaciones/campos.js -se queda del lado de
 * validaciones.js, no de este descriptor-, asi que aqui los dos van requerido:false a nivel
 * individual.
 */
export const CAMPOS_SEGUIMIENTO = [
  { id: "nota", label: "Nota", tipo: TIPOS_DE_CAMPO.TEXTO_LARGO, validacion: { requerido: false } },
  {
    id: "porcentajeNuevo",
    label: "Nuevo porcentaje de avance",
    tipo: TIPOS_DE_CAMPO.NUMERO,
    sufijo: "%",
    validacion: { requerido: false, min: 0, max: 100 },
  },
];
