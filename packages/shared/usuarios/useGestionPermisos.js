// Hook de pantalla de gestion de permisos individuales de un usuario (issue #108).
//
// Envuelve obtenerPermisosEfectivos/concederPermiso/revocarPermiso/restablecerPermiso de
// permisos.api.js, que ya resuelven el catalogo, la combinacion con rol_permiso/usuario_permiso
// y la escritura. Esta capa no repite esa logica: solo orquesta el estado de pantalla y decide
// cuando volver a leer.
//
// Despues de cada conceder/revocar/restablecer se vuelve a llamar obtenerPermisosEfectivos() y
// se pinta lo que devuelva, en vez de voltear un booleano local (PLAN.md, seccion 6): un UPDATE
// o el tramo UPDATE de un upsert que no pasa el USING de RLS corre sin afectar filas y sin
// lanzar error (docs/PERMISOS.md, "Como se comprueba una negativa"), asi que la ausencia de
// excepcion no es prueba de que el cambio se aplico. Comparar el permiso antes/despues de la
// relectura (huboCambioEnPermiso) es lo que permite avisar cuando el cambio no tuvo efecto en
// vez de mostrar como concedido algo que la base rechazo en silencio.

import { useCallback, useEffect, useState } from "react";

import {
  ORIGEN_PERMISO,
  concederPermiso,
  obtenerPermisosEfectivos,
  restablecerPermiso,
  revocarPermiso,
} from "./permisos.api.js";

export const MENSAJE_SIN_EFECTO =
  "El cambio no se aplico. Puede que ya no tengas permiso para modificarlo.";

/**
 * Busca un permiso por su clave en la forma agrupada por modulo que devuelve
 * obtenerPermisosEfectivos()/listarCatalogoPermisos().
 *
 * Funcion pura y exportada aparte del hook: packages/shared corre vitest con environment
 * "node", mismo motivo que evaluarBloqueoSincronico() en useDesactivacionUsuario.js.
 *
 * @param {Array<{ modulo: string, permisos: object[] }>} modulos
 * @param {string} clave
 * @returns {object|null}
 */
export function buscarPermiso(modulos, clave) {
  for (const modulo of modulos ?? []) {
    const permiso = modulo.permisos.find((p) => p.clave === clave);
    if (permiso) return permiso;
  }
  return null;
}

/**
 * Que acciones ofrecer para un permiso segun su estado actual. El modelo tiene tres estados,
 * no dos (PLAN.md, decision 1): hereda del rol sin excepcion, excepcion individual concedida,
 * excepcion individual revocada. Un permiso con `concedido: false` por herencia de rol y uno
 * revocado a mano se ven igual en `concedido`, pero solo el segundo tiene algo que restablecer.
 *
 * @param {{ concedido: boolean, origen: string }} permiso
 * @returns {{ mostrarConceder: boolean, mostrarRevocar: boolean, mostrarRestablecer: boolean }}
 */
export function accionesDisponibles(permiso) {
  return {
    mostrarConceder: !permiso.concedido,
    mostrarRevocar: permiso.concedido,
    mostrarRestablecer: permiso.origen === ORIGEN_PERMISO.INDIVIDUAL,
  };
}

/**
 * Si un permiso cambio de valor u origen entre dos lecturas. `null` en cualquiera de los dos
 * lados (la clave no aparecio en el catalogo leido) se trata como "si hubo cambio": es preferible
 * no mostrar un aviso de "sin efecto" incorrecto a partir de un dato que no se pudo comparar.
 *
 * @param {{ concedido: boolean, origen: string }|null} antes
 * @param {{ concedido: boolean, origen: string }|null} despues
 * @returns {boolean}
 */
export function huboCambioEnPermiso(antes, despues) {
  if (!antes || !despues) return true;
  return antes.concedido !== despues.concedido || antes.origen !== despues.origen;
}

/**
 * Estado y acciones de la pantalla de permisos individuales de un usuario (issue #108).
 *
 * @param {string} idUsuario UUID de perfiles.id cuyos permisos se administran.
 * @returns {{
 *   modulos: Array<{ modulo: string, permisos: object[] }>,
 *   cargando: boolean,
 *   error: object|null,
 *   claveEnProceso: string|null,
 *   avisoSinEfecto: { clave: string, mensaje: string }|null,
 *   conceder: (clave: string) => Promise<void>,
 *   revocar: (clave: string) => Promise<void>,
 *   restablecer: (clave: string) => Promise<void>,
 * }}
 */
export function useGestionPermisos(idUsuario) {
  const [modulos, setModulos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [claveEnProceso, setClaveEnProceso] = useState(null);
  const [avisoSinEfecto, setAvisoSinEfecto] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const resultado = await obtenerPermisosEfectivos(idUsuario);
    setModulos(resultado.modulos);
    setError(resultado.error);
    setCargando(false);
    return resultado.modulos;
  }, [idUsuario]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ejecutar = useCallback(
    async (clave, escribir) => {
      setClaveEnProceso(clave);
      setAvisoSinEfecto(null);
      const antes = buscarPermiso(modulos, clave);

      const { error: errorDeEscritura } = await escribir();
      if (errorDeEscritura) {
        setError(errorDeEscritura);
        setClaveEnProceso(null);
        return;
      }

      const modulosNuevos = await cargar();
      const despues = buscarPermiso(modulosNuevos, clave);
      if (!huboCambioEnPermiso(antes, despues)) {
        setAvisoSinEfecto({ clave, mensaje: MENSAJE_SIN_EFECTO });
      }
      setClaveEnProceso(null);
    },
    [modulos, cargar],
  );

  const conceder = useCallback(
    (clave) => ejecutar(clave, () => concederPermiso(idUsuario, clave)),
    [ejecutar, idUsuario],
  );
  const revocar = useCallback(
    (clave) => ejecutar(clave, () => revocarPermiso(idUsuario, clave)),
    [ejecutar, idUsuario],
  );
  const restablecer = useCallback(
    (clave) => ejecutar(clave, () => restablecerPermiso(idUsuario, clave)),
    [ejecutar, idUsuario],
  );

  return { modulos, cargando, error, claveEnProceso, avisoSinEfecto, conceder, revocar, restablecer };
}
