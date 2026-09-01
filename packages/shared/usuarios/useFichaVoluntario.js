// View model de una ficha de personal, cargada por id (issue #273, movil).
//
// No existe un useFichaUsuario() que reusar (ver el comentario de useHistorialDePersona.js): ese
// hook se retiro cuando #184 fusiono listado y ficha en una sola pantalla web, que arma su panel
// de detalle con la fila que ya tiene en memoria de useUsuariosListado() en vez de volver a
// pedir el perfil. La pantalla movil, en cambio, se navega por id (mismo patron que
// FichaPacienteScreen + usePaciente(id)) y puede abrirse sin haber pasado por el listado en la
// misma sesion, asi que necesita su propio fetch.
//
// El historial de jornadas y los permisos efectivos NO viven aca: la pantalla los pide aparte
// con useHistorialDePersona(perfilId) y useGestionPermisos(perfilId), que ya existen y ya
// resuelven eso, igual que hace VoluntariosPage.jsx (web) con el panel de detalle.

import { useCallback, useEffect, useState } from "react";

import { obtenerEspecialidadesDePerfil, obtenerPerfil } from "./api.js";
import { nombreCompletoDe } from "./useUsuariosListado.js";

/**
 * Combina un perfil suelto con sus especialidades en la forma que consumen los descriptores de
 * ficha (CAMPOS_FICHA_VOLUNTARIO), agregando nombreCompleto igual que armarFilas() lo hace para
 * el listado. Funcion pura y exportada aparte del hook: packages/shared corre vitest con
 * environment "node", mismo motivo que armarFilas() en useUsuariosListado.js.
 *
 * @param {object|null} perfil
 * @param {string[]} especialidades
 * @returns {object|null}
 */
export function armarFichaVoluntario(perfil, especialidades = []) {
  if (!perfil) return null;
  return { ...perfil, nombreCompleto: nombreCompletoDe(perfil), especialidades };
}

/**
 * @param {string|null} perfilId
 * @returns {{
 *   ficha: object|null,
 *   cargando: boolean,
 *   error: object|null,
 *   recargar: () => Promise<void>,
 * }}
 */
export function useFichaVoluntario(perfilId) {
  const [ficha, setFicha] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!perfilId) {
      setFicha(null);
      setError(null);
      setCargando(false);
      return;
    }

    setCargando(true);

    const [{ perfil, error: errorDePerfil }, { especialidades }] = await Promise.all([
      obtenerPerfil(perfilId),
      obtenerEspecialidadesDePerfil(perfilId),
    ]);

    setFicha(armarFichaVoluntario(perfil, especialidades));
    setError(errorDePerfil);
    setCargando(false);
  }, [perfilId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { ficha, cargando, error, recargar: cargar };
}
