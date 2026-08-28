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
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las funciones sueltas ni acordarse
 * de cuales existen.
 */
export function permisosDePacientes(rol) {
  return {
    puedeVer: puedeVerPacientes(rol),
    puedeCrear: puedeRegistrarPaciente(rol),
    puedeEditar: puedeEditarPaciente(rol),
    puedeVerHistorial: puedeVerHistorial(rol),
    puedeTomarTriaje: puedeTomarTriaje(rol),
    puedeCorregirTriaje: puedeCorregirTriaje(rol),
  };
}
