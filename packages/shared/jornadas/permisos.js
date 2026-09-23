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

import { esAdministrador, ROLES, ROLES_DE_CAMPO } from "../usuarios/roles.js";
import { ESTADOS_JORNADA } from "../enums.js";

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
 * Puede ver el personal COMPLETO asignado a una jornada, o solo su propia fila (issue #182,
 * criterio 5).
 *
 * Espejo de la politica de SELECT de jornada_personal, **tal como la deja la 00141**:
 *
 *   USING (
 *     public.es_administrador()
 *     OR public.participa_en_jornada(jornada_id)
 *     OR perfil_id = auth.uid()
 *   )
 *
 * ISSUE #864, y son dos cambios en direcciones opuestas:
 *
 * - Junta directiva sale. La politica la nombraba por su valor literal desde la 00039 y la
 *   00080 le sumo socio fundador con es_consultivo(); los dos roles consultivos se quedan con
 *   Reportes como unica pantalla, asi que ni siquiera llegan al detalle de una jornada.
 * - Medico y voluntario entran, pero por participacion, no por rol: el criterio 6 de la issue
 *   pide que el medico vea "el resumen, el equipo y los pacientes atendidos" de la jornada, y
 *   hasta ahora veia una sola fila -- la suya -- con un aviso de vista limitada. Quien esta en
 *   el cuadro de turnos ve el cuadro entero de ESA jornada, no de las demas.
 *
 * Por eso esta funcion se queda en administrador y los dos roles de campo: para un rol de campo,
 * la jornada que puede abrir es, por RLS, una en la que participa, asi que "completo" y "el de
 * mi jornada" son lo mismo. La otra rama -- ver solo la propia fila -- ya no le toca a ningun
 * rol que llegue a la pantalla, y se conserva por si una politica futura vuelve a acotarla.
 *
 * No vive en un archivo aparte ni en el hook de #182: es una regla de "que puede ver cada rol",
 * que es exactamente lo que este archivo declara para el resto del modulo.
 */
export function puedeVerRosterCompleto(rol) {
  return esAdministrador(rol) || ROLES_DE_CAMPO.includes(rol);
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
 * Puede ver el historial de cambios de estado de una jornada (issue #181, criterio 3).
 *
 * Espejo exacto de la politica de SELECT de jornada_estado_historial (00039:83-85): solo
 * administrador, sin la excepcion de tiene_permiso('jornadas.gestionar') que si tienen otras
 * escrituras de este modulo. Para cualquier otro rol la consulta a esa tabla no falla, RLS la
 * filtra y devuelve una lista vacia sin error -- por eso la pantalla debe ocultar la seccion
 * entera en vez de mostrarla vacia (mismo criterio que el guion de pacientesAtendidos en
 * useJornadasKanban.js): una lista vacia visible diria "esta jornada no tiene historial" cuando
 * en realidad es "no tenes permiso para verlo".
 *
 * No es una funcion "espejo" de puedeVerHistorial() de pacientes/permisos.js: esa cubre
 * consultas/recetas (00033, administrador o medico); esta cubre jornada_estado_historial
 * (00039, solo administrador). Son dos politicas RLS distintas, sobre tablas distintas, y por
 * eso dos funciones distintas.
 */
export function puedeVerHistorialJornada(rol) {
  return esAdministrador(rol);
}

/**
 * Permisos de un rol, en la forma que consume una pantalla.
 *
 * Se devuelven juntos para que un hook no tenga que llamar a las funciones sueltas ni acordarse
 * de cuales existen.
 */
export function permisosDeJornadas(rol) {
  return {
    puedeVer: puedeVerJornadas(rol),
    puedeCrear: puedeAdministrarJornadas(rol),
    puedeEditar: puedeAdministrarJornadas(rol),
    puedeReabrir: puedeReabrirJornada(rol),
    puedeVerHistorial: puedeVerHistorialJornada(rol),
  };
}
