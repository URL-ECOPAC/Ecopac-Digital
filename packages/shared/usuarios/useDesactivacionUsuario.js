// Hook de pantalla de la confirmacion de desactivar/reactivar un usuario (issue #107,
// criterios 2, 4 y 5).
//
// El chequeo de "no sos vos" (criterio 4) y "no es el ultimo administrador activo" (criterio
// 5) corre aca, en el cliente, ANTES de llamar al servidor: es UX -evita ofrecer una accion
// que el servidor va a rechazar, con un mensaje propio y especifico en vez del generico que
// deja el error del servidor (ver PLAN.md de #107, verificacion B)-, no la defensa real. La
// defensa real son los triggers impedir_autodesactivacion() e
// impedir_dejar_sin_administrador_activo() de la migracion 00071: un chequeo que solo viviera
// aca seria evadible con la misma anon/authenticated key que usa cualquier cliente legitimo,
// llamando a Supabase directo.
//
// No revisa perfil.activo del propio perfil para decidir "no sos vos": compara ids nomas,
// porque impedir_autodesactivacion() tampoco distingue rol (ver el encabezado de la
// migracion 00071) y este hook tiene que anticipar exactamente lo que el servidor va a
// rechazar.

import { useCallback, useState } from "react";

import { contarAdministradoresActivos, desactivarUsuario, reactivarUsuario } from "./api.js";
import { ROLES } from "./roles.js";

export const MENSAJE_AUTODESACTIVACION = "No puedes desactivar tu propia cuenta.";
export const MENSAJE_ULTIMO_ADMINISTRADOR =
  "No puede quedar el sistema sin ningun administrador activo.";

/**
 * Parte sincronica del chequeo de cliente: "no sos vos". No hace falta ninguna consulta para
 * saberlo, asi que se resuelve antes de tocar el servidor (issue #107, criterio 4).
 *
 * Funcion pura y exportada aparte, en vez de codigo suelto dentro del hook, por el mismo motivo
 * que nombreCompletoDe() en useUsuariosListado.js: packages/shared corre vitest con environment
 * "node", asi que el hook en si no se puede montar para probarlo.
 *
 * @param {{ id?: string }|null} perfilObjetivo
 * @param {string|undefined} idSesionActual
 * @returns {string|null} El mensaje de bloqueo, o null si esta parte del chequeo no lo impide.
 */
export function evaluarBloqueoSincronico(perfilObjetivo, idSesionActual) {
  if (!perfilObjetivo) return null;
  if (perfilObjetivo.id === idSesionActual) return MENSAJE_AUTODESACTIVACION;
  return null;
}

/**
 * Si hace falta contar administradores activos antes de continuar (issue #107, criterio 5).
 *
 * Reactivar nunca puede dejar el sistema sin administrador, y desactivar a alguien que no es
 * administrador activo tampoco: el conteo (una consulta al servidor) solo se gasta cuando de
 * verdad puede cambiar la respuesta.
 *
 * @param {{ activo?: boolean, rol?: string }|null} perfilObjetivo
 * @returns {boolean}
 */
export function requiereContarAdministradoresActivos(perfilObjetivo) {
  return Boolean(perfilObjetivo) && perfilObjetivo.activo === true && perfilObjetivo.rol === ROLES.ADMINISTRADOR;
}

/**
 * Estado y envio de la confirmacion de desactivar/reactivar un perfil.
 *
 * `abrir(perfil)` hace el chequeo de cliente y deja el resultado en `bloqueo` (un mensaje
 * especifico) si la accion no se puede completar; si `bloqueo` queda vacio, `confirmar()` sigue
 * disponible. Reactivar nunca puede dejar el sistema sin administrador -por eso el chequeo del
 * criterio 5 solo corre cuando se va a desactivar a un administrador activo-, y tampoco hace
 * falta para el criterio 4: reactivar la propia cuenta no tiene sentido de UI (nadie puede
 * llegar a la pantalla si esta desactivado), pero igual se deja pasar sin chequeo si llegara a
 * pedirse, porque no hay ninguna regla que lo prohiba.
 *
 * @param {{ idSesionActual: string }} opciones Id del perfil de la sesion que esta usando la
 *   pantalla. packages/shared no puede leerlo por su cuenta: no tiene acceso a la sesion
 *   compartida de cada app, que es estado de React de la plataforma.
 * @returns {{
 *   perfil: object|null,
 *   verificando: boolean,
 *   bloqueo: string|null,
 *   enviando: boolean,
 *   error: object|null,
 *   abrir: (perfil: object) => Promise<void>,
 *   cerrar: () => void,
 *   confirmar: () => Promise<{ ok: boolean, perfil?: object|null }>,
 * }}
 */
export function useDesactivacionUsuario({ idSesionActual } = {}) {
  const [perfil, setPerfil] = useState(null);
  const [verificando, setVerificando] = useState(false);
  const [bloqueo, setBloqueo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const abrir = useCallback(
    async (perfilObjetivo) => {
      setPerfil(perfilObjetivo ?? null);
      setError(null);
      setBloqueo(null);

      if (!perfilObjetivo) return;

      const bloqueoSincronico = evaluarBloqueoSincronico(perfilObjetivo, idSesionActual);
      if (bloqueoSincronico) {
        setBloqueo(bloqueoSincronico);
        return;
      }

      if (!requiereContarAdministradoresActivos(perfilObjetivo)) return;

      setVerificando(true);
      const { total, error: errorDeConteo } = await contarAdministradoresActivos();
      setVerificando(false);

      if (errorDeConteo) {
        setError(errorDeConteo);
        return;
      }

      if (total <= 1) {
        setBloqueo(MENSAJE_ULTIMO_ADMINISTRADOR);
      }
    },
    [idSesionActual],
  );

  const cerrar = useCallback(() => {
    setPerfil(null);
    setVerificando(false);
    setBloqueo(null);
    setEnviando(false);
    setError(null);
  }, []);

  const confirmar = useCallback(async () => {
    if (!perfil?.id || bloqueo) return { ok: false };

    setEnviando(true);
    const accion = perfil.activo ? desactivarUsuario : reactivarUsuario;
    const resultado = await accion(perfil.id);
    setEnviando(false);

    if (resultado.error) {
      setError(resultado.error);
      return { ok: false };
    }

    return { ok: true, perfil: resultado.perfil };
  }, [perfil, bloqueo]);

  return { perfil, verificando, bloqueo, enviando, error, abrir, cerrar, confirmar };
}
