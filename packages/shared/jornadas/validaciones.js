// Reglas de negocio de las jornadas y del personal asignado.
//
// Se aplican en el cliente antes de llamar al servidor, y web y movil las comparten para que
// digan exactamente lo mismo. La politica real la sigue aplicando la base de datos: los NOT
// NULL y el CHECK de fecha de la migracion 00012, y el UNIQUE (jornada_id, perfil_id) que
// impide asignar dos veces a la misma persona en la misma jornada. Que esto pase no significa
// que el servidor vaya a aceptarlo.
//
// Las claves del objeto de errores son los ids de CAMPOS_JORNADA y CAMPOS_ASIGNACION_PERSONAL,
// para que un formulario pueda pintar cada mensaje debajo de su campo sin traducir nada. Es la
// misma forma que devuelven packages/shared/usuarios/validaciones.js y
// packages/shared/proyectos/validaciones.js.

import { aFechaLocal } from "../formato/fechas.js";
import { esAdministrador } from "../usuarios/roles.js";
import { combinarErrores, esTextoVacio, validarConDescriptores } from "../validations/index.js";
import { CAMPOS_ASIGNACION_PERSONAL, CAMPOS_JORNADA } from "./campos.js";
import { ESTADOS_JORNADA } from "./permisos.js";

/** Cadena de hora HH:MM; los minutos van obligados, las horas de uno o dos digitos. */
const FORMA_DE_HORA = /^(\d{1,2}):(\d{2})$/;

/**
 * Transiciones de estado permitidas, indexadas por estado de origen.
 *
 * Es un ESPEJO del trigger tr_validar_transicion_estado_jornada (migracion 00051), no una
 * segunda fuente de verdad. Sirve para dar un mensaje entendible antes de gastar una llamada al
 * servidor y para deshabilitar en pantalla lo que no se puede hacer; quien de verdad impide una
 * transicion invalida sigue siendo la base de datos. Mismo patron que
 * packages/shared/proyectos/validaciones.js (TRANSICIONES_PROYECTO).
 *
 * `cancelada` queda fuera de alcance de la issue #171: ninguna transicion a/desde ese estado
 * esta en la lista.
 */
export const TRANSICIONES_JORNADA = Object.freeze({
  [ESTADOS_JORNADA.PLANIFICADA]: [ESTADOS_JORNADA.EN_CURSO],
  [ESTADOS_JORNADA.EN_CURSO]: [ESTADOS_JORNADA.FINALIZADA],
  [ESTADOS_JORNADA.FINALIZADA]: [ESTADOS_JORNADA.EN_CURSO],
  [ESTADOS_JORNADA.CANCELADA]: [],
});

/** Estados a los que se puede mover una jornada desde donde esta. Lista vacia si es terminal. */
export function transicionesDeJornadaDesde(estado) {
  return TRANSICIONES_JORNADA[estado] ?? [];
}

/** Indica si una jornada puede pasar de un estado a otro. */
export function esTransicionDeJornadaValida(desde, hacia) {
  return transicionesDeJornadaDesde(desde).includes(hacia);
}

/**
 * Valida un cambio de estado de jornada antes de mandarlo al servidor.
 *
 * La reapertura (finalizada -> en curso) es la unica transicion que ademas exige rol: el
 * criterio de aceptacion de la #171 la restringe a administrador. El resto de transiciones no
 * llevan chequeo de rol aqui porque ya las acota la politica RLS de escritura de jornadas
 * (00039: es_administrador() OR tiene_permiso('jornadas.gestionar')) -- este archivo no conoce
 * el permiso fino, asi que no puede replicar esa parte (mismo motivo documentado en
 * permisos.js).
 *
 * @param {string} estadoActual Uno de ESTADOS_JORNADA.
 * @param {string} estadoNuevo Uno de ESTADOS_JORNADA.
 * @param {string} [rol] Rol de quien hace el cambio, para la regla de reapertura.
 * @returns {Record<string, string>} Vacio si la transicion es legal.
 */
export function validarCambioDeEstadoJornada(estadoActual, estadoNuevo, rol) {
  const estados = Object.values(ESTADOS_JORNADA);

  if (!estados.includes(estadoNuevo)) {
    return { estado: `Elige un estado de la lista: ${estados.join(", ")}.` };
  }

  if (estadoActual === estadoNuevo) {
    return { estado: "La jornada ya esta en ese estado." };
  }

  if (!esTransicionDeJornadaValida(estadoActual, estadoNuevo)) {
    const posibles = transicionesDeJornadaDesde(estadoActual);
    return {
      estado:
        posibles.length === 0
          ? `Una jornada ${estadoActual} ya no cambia de estado.`
          : `Una jornada ${estadoActual} solo puede pasar a: ${posibles.join(" o ")}.`,
    };
  }

  if (estadoActual === ESTADOS_JORNADA.FINALIZADA && !esAdministrador(rol)) {
    return { estado: "Solo un administrador puede reabrir una jornada finalizada." };
  }

  return {};
}

/**
 * Motivo por el que una jornada no admite registro, indexado por estado.
 *
 * Cada mensaje dice el estado en el que esta la jornada y que hacer para continuar, que es lo
 * que pide el criterio de aceptacion 2 de la issue #172: un "no se puede" a secas deja a quien
 * esta en campo sin saber si tiene que esperar, avisarle a alguien o cambiarse de jornada.
 *
 * `en curso` no aparece: es el unico estado que si admite registro.
 */
const MOTIVO_POR_ESTADO = Object.freeze({
  [ESTADOS_JORNADA.PLANIFICADA]:
    "La jornada todavia esta planificada. Pedile a quien la coordina que la inicie para poder registrar.",
  [ESTADOS_JORNADA.FINALIZADA]:
    "La jornada ya esta finalizada. Solo un administrador puede reabrirla para seguir registrando.",
  [ESTADOS_JORNADA.CANCELADA]:
    "La jornada esta cancelada y no admite registros. Registra la atencion en la jornada que corresponda.",
});

/**
 * Indica si una jornada admite registrar atenciones y consultas, y por que no cuando no.
 *
 * Es un ESPEJO del trigger de base, no la garantia: `validar_jornada_en_curso()` (migracion
 * 00018) protege `consultas` y `validar_jornada_en_curso_atenciones()` (migracion 00055)
 * protege `atenciones`. Esta funcion sirve para deshabilitar el formulario y explicar el
 * motivo antes de gastar una llamada que el servidor va a rechazar igual. Mismo criterio que
 * TRANSICIONES_JORNADA con su propio trigger.
 *
 * Recibe el estado y no un id a proposito: una pantalla que ya cargo la jornada no tiene por
 * que volver a consultarla. Cuando solo se tiene el id, la envoltura es
 * puedeRegistrarConsulta() en api.js.
 *
 * Un estado desconocido -o ausente- se trata como que NO admite registro. Es lo unico seguro:
 * si el enum crece y este archivo no se entera, la respuesta segura es bloquear en el cliente
 * y dejar que el servidor tenga la ultima palabra, no al reves.
 *
 * @param {string} estado Uno de ESTADOS_JORNADA.
 * @returns {{ puede: boolean, motivo: string }} `motivo` es cadena vacia cuando `puede` es true.
 */
export function puedeRegistrarEnJornada(estado) {
  if (estado === ESTADOS_JORNADA.EN_CURSO) return { puede: true, motivo: "" };

  return {
    puede: false,
    motivo:
      MOTIVO_POR_ESTADO[estado] ??
      "No se pudo confirmar que la jornada este en curso, asi que no se puede registrar todavia.",
  };
}

/**
 * Valida los datos de una jornada.
 *
 * Lo que el descriptor puede expresar -obligatorio, longitud maxima- se aplica desde
 * CAMPOS_JORNADA; encima se suma la regla que un descriptor aun no declara para el motor: la
 * fecha no puede ser anterior a hoy. La columna fecha de la migracion 00012 ademas tiene un
 * CHECK contra created_at, pero aqui se valida contra el dia actual, que es lo que una persona
 * entiende por "fecha pasada".
 *
 * @param {object} valores Valores indexados por el id de CAMPOS_JORNADA.
 * @returns {Record<string, string>} Errores por campo. Vacio si todo esta bien.
 */
export function validarJornada(valores) {
  const porDescriptor = validarConDescriptores(CAMPOS_JORNADA, valores);
  return combinarErrores(porDescriptor, validarFechaJornada(valores));
}

/**
 * Valida una fila de asignacion de personal a una jornada.
 *
 * Aplica los obligatorios de CAMPOS_ASIGNACION_PERSONAL y la coherencia de horario: la hora de
 * fin tiene que ser posterior a la de inicio, espejo del CHECK chk_jornada_personal_horario de
 * la migracion 00012.
 *
 * @param {object} valores Valores indexados por el id de CAMPOS_ASIGNACION_PERSONAL.
 * @returns {Record<string, string>} Errores por campo. Vacio si todo esta bien.
 */
export function validarAsignacionPersonal(valores) {
  const porDescriptor = validarConDescriptores(CAMPOS_ASIGNACION_PERSONAL, valores);
  return combinarErrores(porDescriptor, validarHorario(valores));
}

/**
 * Valida el conjunto de asignaciones de una jornada.
 *
 * La regla de campo no alcanza para esto: el mismo perfil puede aparecer una sola vez en la
 * lista. Es espejo del UNIQUE (jornada_id, perfil_id) de la migracion 00012. Se agrupa bajo la
 * clave "perfil" porque es el campo que el usuario tendria que corregir.
 *
 * @param {Array<{ perfil: string }>} asignaciones Filas del formulario de personal.
 * @returns {Record<string, string>} Errores. Vacio si nadie esta repetido.
 */
export function validarAsignaciones(asignaciones) {
  const vistos = new Set();

  for (const asignacion of asignaciones ?? []) {
    const perfil = asignacion?.perfil;
    if (esTextoVacio(perfil)) continue;

    if (vistos.has(perfil)) {
      return {
        perfil: "No puedes asignar a la misma persona dos veces a la misma jornada.",
      };
    }
    vistos.add(perfil);
  }

  return {};
}

/**
 * Advierte si la persona ya esta asignada a otra jornada el mismo dia.
 *
 * No es un error: la base de datos si permite que una persona este en dos jornadas distintas el
 * mismo dia. Es una advertencia para que quien asigna se fije antes de guardar. Devuelve null
 * cuando no hay choque, para que la pantalla decida si muestra algo.
 *
 * @param {object} args
 * @param {string} args.perfil Id del perfil que se esta asignando.
 * @param {string} args.jornadaActualId Id de la jornada que se edita (sus propias asignaciones
 *   no cuentan como choque).
 * @param {Array<{ jornadaId: string, jornadaNombre: string, perfil: string }>} args.asignacionesDelDia
 *   Asignaciones de todas las jornadas que caen en la misma fecha.
 * @returns {string|null} Texto de la advertencia, o null si no hay choque.
 */
export function advertirChoqueDeHorario({ perfil, jornadaActualId, asignacionesDelDia } = {}) {
  if (esTextoVacio(perfil)) return null;

  const choque = (asignacionesDelDia ?? []).find(
    (asignacion) => asignacion?.perfil === perfil && asignacion?.jornadaId !== jornadaActualId,
  );

  if (!choque) return null;

  const nombre = choque.jornadaNombre?.trim();
  return nombre
    ? `Esta persona ya esta asignada a otra jornada el mismo dia: ${nombre}.`
    : "Esta persona ya esta asignada a otra jornada el mismo dia.";
}

/**
 * Advierte si ya existe una jornada en la misma comunidad y fecha (issue #179, criterio 4).
 *
 * No es un error: no hay ningun UNIQUE en la base sobre (comunidad_id, fecha)
 * (00012_jornadas.sql no declara ninguno), asi que dos jornadas ahi conviven sin problema para
 * el servidor. Es una advertencia para que quien crea o edita se fije antes de guardar, y nunca
 * debe impedir el guardado -- mismo criterio que advertirChoqueDeHorario() de mas arriba.
 *
 * @param {object} args
 * @param {object[]} args.jornadas Filas de listarJornadas({ comunidad, fechaInicio: fecha,
 *   fechaFin: fecha }).
 * @param {string} [args.jornadaActualId] Id de la jornada que se esta editando, para no advertir
 *   contra si misma. En el alta no hay id todavia, asi que ninguna fila se excluye.
 * @returns {string|null} Texto de la advertencia, o null si no hay coincidencia.
 */
export function advertirJornadaDuplicada({ jornadas, jornadaActualId } = {}) {
  const coincidencias = (jornadas ?? []).filter((jornada) => jornada.id !== jornadaActualId);
  if (coincidencias.length === 0) return null;

  const nombres = coincidencias
    .map((jornada) => jornada.nombre)
    .filter(Boolean)
    .join(", ");

  return nombres
    ? `Ya existe una jornada en esta comunidad y fecha: ${nombres}.`
    : "Ya existe una jornada en esta comunidad y fecha.";
}

/** Reglas de la fecha de una jornada, mas alla de lo que expresa el descriptor. */
function validarFechaJornada(valores) {
  const fecha = valores?.fecha;
  if (esTextoVacio(fecha)) return {};

  const comoFecha = aFechaLocal(fecha);
  if (!comoFecha) {
    return { fecha: "La fecha no es una fecha valida." };
  }

  if (aDiaDeCalendario(comoFecha) < aDiaDeCalendario(new Date())) {
    return { fecha: "La fecha no puede ser anterior a hoy." };
  }

  return {};
}

/** Reglas del horario de una asignacion: horaFin posterior a horaInicio. */
function validarHorario(valores) {
  const inicio = valores?.horaInicio;
  const fin = valores?.horaFin;

  if (esTextoVacio(inicio) || esTextoVacio(fin)) return {};

  const minutosInicio = aMinutos(inicio);
  const minutosFin = aMinutos(fin);

  if (minutosInicio === null || minutosFin === null) {
    return { horaFin: "Escribe la hora en formato HH:MM." };
  }

  if (minutosFin <= minutosInicio) {
    return { horaFin: "La hora de fin debe ser posterior a la de inicio." };
  }

  return {};
}

/** Dia de calendario de una fecha, como milisegundos de su medianoche local. */
function aDiaDeCalendario(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

/** Minutos desde la medianoche de una cadena HH:MM, o null si no es una hora valida. */
function aMinutos(hora) {
  if (typeof hora !== "string") return null;

  const partes = FORMA_DE_HORA.exec(hora.trim());
  if (!partes) return null;

  const horas = Number(partes[1]);
  const minutos = Number(partes[2]);
  if (horas > 23 || minutos > 59) return null;

  return horas * 60 + minutos;
}
