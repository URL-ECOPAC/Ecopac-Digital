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

import { accedeAModuloPorMatriz, tienePermisoFino } from "../usuarios/acceso.js";
import { esAdministrador, ROLES, ROLES_DE_CAMPO } from "../usuarios/roles.js";
// El estado se importa en vez de escribir 'emitida' a mano: el enum estado_receta lo define la
// 00066 y su unica copia en shared vive en recetas.api.js (regla del bug #365).
import { ESTADOS_RECETA } from "../enums.js";

/** Medico o voluntario general: el personal que atiende en campo (es_personal_de_campo, 00148). */
function esPersonalDeCampo(rol) {
  return ROLES_DE_CAMPO.includes(rol);
}

/**
 * Puede ver pacientes.
 *
 * Espejo de la politica de SELECT de pacientes (00148): administrador y personal de campo, y el rol
 * al que la matriz de acceso le abrio Pacientes, en solo lectura. Los roles consultivos no lo
 * tienen por defecto (docs/PERMISOS.md): en pacientes el nombre, apellidos y DPI son la fila
 * misma, asi que no hay un subconjunto "no identificable" que enmascarar; abrirselo es una
 * decision explicita de la administradora.
 */
export function puedeVerPacientes(rol) {
  return esAdministrador(rol) || esPersonalDeCampo(rol) || accedeAModuloPorMatriz(rol, "pacientes");
}

/**
 * Espejo de la politica de INSERT de pacientes (00032): administrador y personal de campo. Quien
 * tiene el modulo abierto por la matriz solo lee.
 */
export function puedeRegistrarPaciente(rol) {
  return esAdministrador(rol) || esPersonalDeCampo(rol);
}

/**
 * Puede editar un paciente ya registrado.
 *
 * Espejo de la politica de UPDATE de pacientes (00086): el permiso fino pacientes.editar, que el
 * medico y, desde la 00148, el colaborador traen por defecto, y que se puede revocar o conceder
 * por persona. La baja no esta aqui: es puedeDarDeBajaPaciente().
 */
export function puedeEditarPaciente(rol) {
  return tienePermisoFino(rol, "pacientes.editar");
}

/**
 * Puede dar de baja a un paciente (fecha_baja): eliminarlo, en la practica. Solo la
 * administradora: lo impone el trigger impedir_baja_de_paciente_sin_ser_administrador (00148).
 */
export function puedeDarDeBajaPaciente(rol) {
  return esAdministrador(rol);
}

/** Espejo de la politica de SELECT de expedientes (00032), identica a la de pacientes. */
export function puedeVerExpedientes(rol) {
  return puedeVerPacientes(rol);
}

/** Espejo de la politica de INSERT de expedientes (00032), identica a la de SELECT. */
export function puedeCrearExpediente(rol) {
  return puedeVerPacientes(rol);
}

/** Espejo de la politica de UPDATE de expedientes (00086): el mismo permiso que editar pacientes. */
export function puedeEditarExpediente(rol) {
  return puedeEditarPaciente(rol);
}

/**
 * Puede leer el historial clinico (triajes, consultas y recetas) de un paciente.
 *
 * Espejo de la politica de SELECT de consultas/recetas (00148): quien ve pacientes lo ve completo,
 * historial incluido. Hasta la 00148 el colaborador registraba pacientes y tomaba triaje sin ver
 * el historial.
 */
export function puedeVerHistorial(rol) {
  return puedeVerPacientes(rol);
}

/**
 * Puede tomar el triaje de una atencion.
 *
 * Espejo de la politica de INSERT de triajes (00033): administrador y personal de campo.
 */
export function puedeTomarTriaje(rol) {
  return esAdministrador(rol) || esPersonalDeCampo(rol);
}

/**
 * Puede corregir un triaje ya registrado.
 *
 * Espejo de la politica de UPDATE de triajes (00148): administrador y personal de campo. Hasta la
 * 00148 solo el medico; el colaborador que lo toma tambien lo corrige.
 */
export function puedeCorregirTriaje(rol) {
  return esAdministrador(rol) || esPersonalDeCampo(rol);
}

/**
 * Puede registrar una consulta medica.
 *
 * Espejo de la politica de INSERT de consultas (00033), "Medico registra consultas en su jornada
 * asignada; administrador en cualquiera". La parte de "en su jornada asignada" NO se replica
 * aqui: depende de la jornada concreta, no del rol, y quien la comprueba de verdad es la
 * politica. Esta funcion decide unicamente si se ofrece el boton.
 *
 * Faltaba, y por eso la web no tenia por donde registrar una consulta: existian el hook
 * (hoy useConsulta) y la API (registrarConsulta), montados solo en ConsultaScreen de movil.
 */
export function puedeCrearConsulta(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}

/**
 * Puede emitir una receta.
 *
 * Espejo de la politica de INSERT de recetas (00033), "Medico emite recetas como si mismo;
 * administrador cualquiera". El `medico_id = auth.uid()` de la politica tampoco se replica:
 * useGeneracionReceta ya firma con el perfil de la sesion.
 */
export function puedeEmitirReceta(rol) {
  return esAdministrador(rol) || rol === ROLES.MEDICO;
}

/**
 * Puede corregir una consulta ya guardada.
 *
 * Espejo de la politica de UPDATE de consultas (00033): a diferencia de puedeCorregirTriaje(),
 * que alcanza a cualquier medico, aqui la regla mira quien la escribio -- "el medico que creo la
 * consulta la edita; administrador cualquiera" es literal en el DoD que respalda esa politica.
 *
 * @param {string} rol Rol de quien mira la pantalla.
 * @param {{ profesionalId?: string }} consulta El evento de consulta, como lo arma aEventos()
 *   (historial.api.js): trae medico_id en `profesionalId`.
 * @param {string} perfilId UUID del perfil de la sesion.
 * @returns {boolean}
 */
export function puedeCorregirConsulta(rol, consulta, perfilId) {
  if (esAdministrador(rol)) return true;
  if (!consulta || !perfilId) return false;

  return rol === ROLES.MEDICO && consulta.profesionalId === perfilId;
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
    puedeDarDeBaja: puedeDarDeBajaPaciente(rol),
    puedeVerHistorial: puedeVerHistorial(rol),
    puedeTomarTriaje: puedeTomarTriaje(rol),
    puedeCorregirTriaje: puedeCorregirTriaje(rol),
    puedeCrearConsulta: puedeCrearConsulta(rol),
    puedeEmitirReceta: puedeEmitirReceta(rol),
    puedeFusionarPacientes: puedeFusionarPacientes(rol),
    puedeVerCatalogoDiagnosticos: puedeVerCatalogoDiagnosticos(rol),
    puedeAdministrarDiagnosticos: puedeAdministrarDiagnosticos(rol),
  };
}

/**
 * Puede ver la pantalla del catalogo de diagnosticos (issue #639).
 *
 * Espejo de la politica de SELECT de diagnosticos (00148): quien ve pacientes. El colaborador
 * entra desde la 00148, que le abre pacientes por completo.
 */
export function puedeVerCatalogoDiagnosticos(rol) {
  return puedeVerPacientes(rol);
}

/**
 * Puede mantener el catalogo de diagnosticos: agregar uno nuevo, corregir los existentes y
 * reactivar uno retirado.
 *
 * Espejo de las politicas de INSERT y UPDATE (00148): administrador y personal de campo. Retirarlo
 * no: es puedeRetirarDiagnostico().
 *
 * No hay `puedeEliminarDiagnostico`: consulta_diagnostico referencia diagnosticos ON DELETE
 * RESTRICT (00018) y no hay GRANT de DELETE. Un diagnostico ya usado es historia clinica.
 */
export function puedeAdministrarDiagnosticos(rol) {
  return esAdministrador(rol) || esPersonalDeCampo(rol);
}

/**
 * Puede retirar un diagnostico del selector (activo = false): sacarlo de uso, lo mas parecido a
 * eliminarlo. Solo la administradora (trigger impedir_desactivar_sin_ser_administrador, 00148).
 */
export function puedeRetirarDiagnostico(rol) {
  return esAdministrador(rol);
}
