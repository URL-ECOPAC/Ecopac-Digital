// Que puede hacer cada rol con pacientes, expedientes, el historial clinico y el triaje.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// Quien de verdad impide leer o escribir es Row Level Security: las cuatro politicas de
// pacientes y expedientes en 00032_politicas_rls_pacientes_expedientes.sql, y las de
// consultas/recetas/triajes en 00033_politicas_rls_atenciones_consultas_recetas.sql. Por la
// misma razon, ninguna funcion de api.js/historial.api.js/triaje.api.js consulta este archivo
// antes de llamar: el cliente pregunta para dibujar; el servidor decide.
//
// puedeVerHistorial (antes en historial.api.js) y puedeCorregirTriaje/puedeTomarTriaje (antes
// en triaje.api.js) vivian sueltas fuera de un permisos.js -- divergencia #13 de
// docs/PERMISOS.md. Se mudan aqui sin cambiar su logica; esos archivos las siguen exportando
// via reexport nombrado para no romper lo que ya los importa.
//
// condiciones.permisos.js cubre las condiciones cronicas por separado: es otra tabla
// (padecimientos_cronicos, 00010) con su propia matriz de roles, y se queda como esta.

import { esAdministrador, ROLES } from "../usuarios/roles.js";
// El estado se importa en vez de escribir 'emitida' a mano: el enum estado_receta lo define la
// 00066 y su unica copia en shared vive en recetas.api.js (regla del bug #365).
import { ESTADOS_RECETA } from "./recetas.api.js";

/**
 * Puede ver pacientes.
 *
 * Espejo de la politica de SELECT de pacientes (00032): administrador, medico y voluntario
 * general. Los roles consultivos no tienen ninguna politica sobre esta tabla a proposito
 * (docs/PERMISOS.md): en pacientes el nombre, apellidos y DPI son la fila misma, asi que no hay
 * un subconjunto de columnas "no identificable" que enmascarar con una vista.
 */
export function puedeVerPacientes(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO || rol === ROLES.VOLUNTARIO;
}

/** Espejo de la politica de INSERT de pacientes (00032), identica a la de SELECT. */
export function puedeRegistrarPaciente(rol) {
  return puedeVerPacientes(rol);
}

/**
 * Puede editar un paciente ya registrado, incluida la baja logica (UPDATE de fecha_baja).
 *
 * Espejo de la politica de UPDATE de pacientes (00032): mas estrecha que registrar, solo
 * administrador y medico. Nadie tiene politica de DELETE: ademas del default-deny, un trigger
 * (00026) bloquea cualquier borrado fisico.
 */
export function puedeEditarPaciente(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}

/** Espejo de la politica de SELECT de expedientes (00032), identica a la de pacientes. */
export function puedeVerExpedientes(rol) {
  return puedeVerPacientes(rol);
}

/** Espejo de la politica de INSERT de expedientes (00032), identica a la de SELECT. */
export function puedeCrearExpediente(rol) {
  return puedeVerPacientes(rol);
}

/** Espejo de la politica de UPDATE de expedientes (00032): solo administrador y medico. */
export function puedeEditarExpediente(rol) {
  return puedeEditarPaciente(rol);
}

/**
 * Puede leer el historial clinico (triajes, consultas y recetas) de un paciente.
 *
 * Espejo de la politica de SELECT de consultas/recetas (00033): solo administrador y medico.
 * Un voluntario general registra pacientes y toma triaje, pero el historial clinico completo no
 * lo ve.
 */
export function puedeVerHistorial(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}

/**
 * Puede tomar el triaje de una atencion.
 *
 * Espejo de la politica de INSERT de triajes (00033): administrador, medico y voluntario
 * general.
 */
export function puedeTomarTriaje(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO || rol === ROLES.VOLUNTARIO;
}

/**
 * Puede corregir un triaje ya registrado.
 *
 * Espejo de la politica de UPDATE de triajes (00033), mas estrecha que la de INSERT: solo
 * administrador y medico.
 */
export function puedeCorregirTriaje(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}

/**
 * Puede anular una receta concreta.
 *
 * Espejo de la politica de UPDATE de recetas (00075, issue #510). Es la primera funcion de este
 * archivo que **no depende solo del rol**, y por eso su firma es distinta: la regla mira quien
 * firmo la receta y en que estado esta.
 *
 *   - La administradora anula cualquiera, en cualquier estado. Es la via de correccion.
 *   - El medico anula unicamente las que el firmo, y solo mientras sigan emitidas: anular es un
 *     hecho registrado, y reescribirlo destruiria la trazabilidad que protege la 00026.
 *
 * @param {string} rol Rol de quien mira la pantalla.
 * @param {{ medicoId?: string, estado?: string }} receta La receta, como la devuelve
 *   obtenerReceta(): en camelCase.
 * @param {string} perfilId UUID del perfil de la sesion.
 * @returns {boolean}
 */
export function puedeAnularReceta(rol, receta, perfilId) {
  if (esAdministrador(rol)) return true;
  if (!receta || !perfilId) return false;

  return (
    rol === ROLES.MEDICO && receta.medicoId === perfilId && receta.estado === ESTADOS_RECETA.EMITIDA
  );
}

/**
 * Puede fusionar dos expedientes duplicados.
 *
 * Espejo del chequeo interno de fn_fusionar_pacientes (00101): solo administrador, mas estrecho
 * que puedeEditarPaciente (que tambien alcanza a medico). La deteccion de posibles duplicados no
 * tiene guarda propia: la ve quien ya puede ver pacientes (puedeVerPacientes).
 */
export function puedeFusionarPacientes(rol) {
  return esAdministrador(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las funciones sueltas ni acordarse
 * de cuales existen.
 *
 * puedeAnularReceta no esta aqui a proposito: no depende solo del rol, sino de la receta que se
 * este mirando, asi que se pregunta fila por fila y meterla en este objeto obligaria a recalcular
 * el bloque entero por cada receta de la lista.
 */
export function permisosDePacientes(rol) {
  return {
    puedeVer: puedeVerPacientes(rol),
    puedeCrear: puedeRegistrarPaciente(rol),
    puedeEditar: puedeEditarPaciente(rol),
    puedeVerHistorial: puedeVerHistorial(rol),
    puedeTomarTriaje: puedeTomarTriaje(rol),
    puedeCorregirTriaje: puedeCorregirTriaje(rol),
    puedeFusionarPacientes: puedeFusionarPacientes(rol),
  };
}
