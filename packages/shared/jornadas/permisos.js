// Que puede hacer cada rol con las jornadas.
//
// ESTO DECIDE QUE MUESTRA LA INTERFAZ, NO QUE PROTEGE EL SERVIDOR.
//
// La distincion importa: un boton escondido no es seguridad, solo es una pantalla que no
// ofrece lo que la persona no puede hacer. Quien de verdad impide escribir es Row Level
// Security en la base de datos (migracion 00039).
//
// La politica de escritura de 00039 es `es_administrador() OR tiene_permiso('jornadas.gestionar')`.
// El permiso fino es una llave que solo el servidor puede abrir (lee rol_permiso y
// usuario_permiso): el cliente solo conoce el rol, asi que aqui se decide por rol. Por eso
// puedeAdministrarJornadas() refleja unicamente el rol administrador, y el permiso fino queda
// como excepcion que el servidor puede conceder sin que la interfaz la anuncie.
//
// Por la misma razon, ninguna funcion de jornadas/api.js consulta este archivo antes de
// llamar: el cliente pregunta para dibujar; el servidor decide.

import { esAdministrador, ROLES } from "../usuarios/roles.js";

/**
 * Estados del enum estado_jornada (00001_initial_schema.sql).
 *
 * La base de datos es la fuente de verdad: si aqui se escribe un estado que el enum no tiene,
 * la consulta falla en tiempo de ejecucion.
 */
export const ESTADOS_JORNADA = Object.freeze({
  PLANIFICADA: "planificada",
  EN_CURSO: "en curso",
  FINALIZADA: "finalizada",
  CANCELADA: "cancelada",
});

/**
 * Puede crear y modificar jornadas (asignacion de personal incluida).
 *
 * Espejo del rol de la politica de escritura de 00039. El permiso fino `jornadas.gestionar`
 * no se refleja aqui porque el cliente no puede evaluarlo.
 */
export function puedeAdministrarJornadas(rol) {
  return esAdministrador(rol);
}

/**
 * Puede ver el listado y la ficha de una jornada.
 *
 * Cualquier rol conocido: lo que ve de cada fila lo acota RLS, no esta funcion. Un medico o
 * voluntario solo ve las jornadas donde esta asignado; quien no esta en ninguna no ve nada.
 */
export function puedeVerJornadas(rol) {
  return Object.values(ROLES).includes(rol);
}

/**
 * Puede editar una jornada en su estado actual.
 *
 * Encapsula la regla del criterio de aceptacion: una jornada finalizada no se edita salvo por
 * la administradora. El resto de estados solo los edita quien administra jornadas.
 */
export function puedeEditarJornada(rol, estado) {
  if (estado === ESTADOS_JORNADA.FINALIZADA) {
    return esAdministrador(rol);
  }
  return puedeAdministrarJornadas(rol);
}

/**
 * Puede reabrir una jornada finalizada (volverla a 'en curso').
 *
 * Espejo del trigger tr_validar_transicion_estado_jornada (migracion 00051, issue #171): la
 * reapertura exige es_administrador() ahi, sin excepcion del permiso fino. Igual que el resto
 * de este archivo, esto decide que muestra la interfaz; quien impide de verdad la reapertura es
 * el trigger.
 */
export function puedeReabrirJornada(rol) {
  return esAdministrador(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las tres por separado ni
 * acordarse de cuales existen.
 */
export function permisosDeJornadas(rol) {
  return {
    puedeVer: puedeVerJornadas(rol),
    puedeCrear: puedeAdministrarJornadas(rol),
    puedeEditar: puedeAdministrarJornadas(rol),
    puedeReabrir: puedeReabrirJornada(rol),
  };
}
