// Reglas de negocio de los proyectos sociales.
//
// Se aplican en el cliente antes de llamar al servidor, y web y movil las comparten para que
// digan exactamente lo mismo. La politica real la sigue aplicando la base de datos: el
// VARCHAR(150) de nombre, el CHECK de porcentaje_avance y el trigger de transiciones de la
// migracion 00029. Que esto pase no significa que el servidor vaya a aceptarlo.
//
// Las claves del objeto de errores son los ids de los campos, para que un formulario pueda
// pintar cada mensaje debajo del suyo sin traducir nada. Es la misma forma que devuelve
// packages/shared/usuarios/validaciones.js.

import { aFechaLocal } from "../formato/fechas.js";
import { combinarErrores, esTextoVacio, normalizarTexto } from "../validations/index.js";
import { ESTADOS_PROYECTO } from "../enums.js";

/**
 * Estados de un proyecto.
 *
 * Los valores son exactamente los del enum estado_proyecto de
 * supabase/migrations/00007_proyectos.sql. La base de datos es la fuente de verdad: si aqui se
 * escribe un estado que el enum no tiene, la consulta falla en tiempo de ejecucion.
 */
export const TODOS_LOS_ESTADOS_PROYECTO = Object.values(ESTADOS_PROYECTO);

/** Longitud maxima del nombre, la del VARCHAR(150) de la tabla. */
export const LONGITUD_MAXIMA_NOMBRE_PROYECTO = 150;

/**
 * Transiciones de estado permitidas, indexadas por estado de origen.
 *
 * Es un ESPEJO del trigger tr_validar_transicion_estado_proyecto (migracion 00029), no una
 * segunda fuente de verdad. Sirve para dar un mensaje entendible antes de gastar una llamada al
 * servidor y para deshabilitar en pantalla lo que no se puede hacer; quien de verdad impide una
 * transicion invalida sigue siendo la base de datos.
 *
 * `finalizado` y `cancelado` son terminales: no se retrocede ni se reabre un proyecto.
 */
export const TRANSICIONES_PROYECTO = Object.freeze({
  [ESTADOS_PROYECTO.PLANIFICADO]: [ESTADOS_PROYECTO.EN_CURSO, ESTADOS_PROYECTO.CANCELADO],
  [ESTADOS_PROYECTO.EN_CURSO]: [ESTADOS_PROYECTO.FINALIZADO, ESTADOS_PROYECTO.CANCELADO],
  [ESTADOS_PROYECTO.FINALIZADO]: [],
  [ESTADOS_PROYECTO.CANCELADO]: [],
});

/** Estados a los que se puede mover un proyecto desde donde esta. Lista vacia si es terminal. */
export function transicionesDeProyectoDesde(estado) {
  return TRANSICIONES_PROYECTO[estado] ?? [];
}

/** Indica si un proyecto puede pasar de un estado a otro. */
export function esTransicionDeProyectoValida(desde, hacia) {
  return transicionesDeProyectoDesde(desde).includes(hacia);
}

/**
 * Valida los datos de un proyecto.
 *
 * @param {object} valores
 * @returns {Record<string, string>} Errores por campo. Vacio si todo esta bien.
 */
export function validarProyecto(valores) {
  const errores = {};

  const nombre = normalizarTexto(valores?.nombre);
  if (nombre === "") {
    errores.nombre = "El nombre del proyecto es obligatorio.";
  } else if (nombre.length > LONGITUD_MAXIMA_NOMBRE_PROYECTO) {
    errores.nombre = `El nombre no puede pasar de ${LONGITUD_MAXIMA_NOMBRE_PROYECTO} caracteres.`;
  }

  if (!esTextoVacio(valores?.estado) && !TODOS_LOS_ESTADOS_PROYECTO.includes(valores.estado)) {
    errores.estado = `Elige un estado de la lista: ${TODOS_LOS_ESTADOS_PROYECTO.join(", ")}.`;
  }

  return combinarErrores(errores, validarFechas(valores), validarPorcentaje(valores));
}

/**
 * Las dos fechas son opcionales, pero si vienen las dos tienen que tener sentido entre si.
 *
 * Se comparan con aFechaLocal() y no con new Date(): una cadena AAAA-MM-DD leida por Date se
 * interpreta como medianoche UTC y en Guatemala se corre un dia, asi que un proyecto que empieza
 * y termina el mismo dia podria parecer invalido.
 */
function validarFechas(valores) {
  const errores = {};
  const inicio = aFechaLocal(valores?.fechaInicio);
  const fin = aFechaLocal(valores?.fechaFin);

  if (!esTextoVacio(valores?.fechaInicio) && !inicio) {
    errores.fechaInicio = "La fecha de inicio no es una fecha valida.";
  }
  if (!esTextoVacio(valores?.fechaFin) && !fin) {
    errores.fechaFin = "La fecha de fin no es una fecha valida.";
  }
  if (inicio && fin && fin < inicio) {
    errores.fechaFin = "La fecha de fin no puede ser anterior a la de inicio.";
  }

  return errores;
}

/**
 * El porcentaje de avance, espejo del CHECK chk_proyectos_porcentaje_avance.
 *
 * Aqui solo se valida lo que se escriba. La pantalla que lo ACTUALIZA, con sus hitos y su
 * bitacora, es la issue #195 y no vive en este archivo.
 */
function validarPorcentaje(valores) {
  const valor = valores?.porcentajeAvance;
  if (valor === null || valor === undefined || valor === "") return {};

  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0 || numero > 100) {
    return { porcentajeAvance: "El avance debe ser un numero entero entre 0 y 100." };
  }
  return {};
}

/**
 * Valida un cambio de estado antes de mandarlo al servidor.
 *
 * @returns {Record<string, string>} Vacio si la transicion es legal.
 */
export function validarCambioDeEstadoProyecto(estadoActual, estadoNuevo) {
  if (!TODOS_LOS_ESTADOS_PROYECTO.includes(estadoNuevo)) {
    return { estado: `Elige un estado de la lista: ${TODOS_LOS_ESTADOS_PROYECTO.join(", ")}.` };
  }

  if (estadoActual === estadoNuevo) {
    return { estado: "El proyecto ya esta en ese estado." };
  }

  if (!esTransicionDeProyectoValida(estadoActual, estadoNuevo)) {
    const posibles = transicionesDeProyectoDesde(estadoActual);
    return {
      estado:
        posibles.length === 0
          ? `Un proyecto ${estadoActual} ya no cambia de estado.`
          : `Un proyecto ${estadoActual} solo puede pasar a: ${posibles.join(" o ")}.`,
    };
  }

  return {};
}
