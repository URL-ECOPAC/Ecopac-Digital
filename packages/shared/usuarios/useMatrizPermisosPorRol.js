// Hook de pantalla de la matriz de permisos por rol (issue #638).
//
// Mismo criterio de "escribir y releer" que useGestionPermisos.js (issue #108): un INSERT o un
// DELETE que no pasa el WITH CHECK/USING de RLS no lanza error, simplemente no afecta ninguna
// fila -asi que despues de concederPermisoARol()/revocarPermisoARol() se vuelve a llamar
// obtenerMatrizDePermisosPorRol() y se compara la celda antes/despues, en vez de voltear un
// booleano local. Las politicas de escritura de rol_permiso (00139) son nuevas y sin historial
// de uso, asi que el mismo riesgo de fallo silencioso aplica igual o mas que en usuario_permiso.
//
// Adaptado a pares (rol, clave) en vez de solo clave: aqui la celda que cambia es una interseccion
// de rol y permiso, no un permiso de una sola persona.

import { useCallback, useEffect, useState } from "react";

import { buscarPermiso } from "./useGestionPermisos.js";
import {
  celdaConcedida,
  concederPermisoARol,
  obtenerMatrizDePermisosPorRol,
  revocarPermisoARol,
} from "./permisos.api.js";

export const MENSAJE_SIN_EFECTO_ROL =
  "El cambio no se aplico. Puede que ya no tengas permiso para modificar la matriz.";

/**
 * Estado y acciones de la pantalla de la matriz de permisos por rol (issue #638).
 *
 * @returns {{
 *   modulos: Array<{ modulo: string, permisos: object[] }>,
 *   cargando: boolean,
 *   error: object|null,
 *   celdaEnProceso: { rol: string, clave: string }|null,
 *   avisoSinEfecto: { rol: string, clave: string, mensaje: string }|null,
 *   alternar: (rol: string, clave: string, concedidoActual: boolean) => Promise<void>,
 * }}
 */
export function useMatrizPermisosPorRol() {
  const [modulos, setModulos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [celdaEnProceso, setCeldaEnProceso] = useState(null);
  const [avisoSinEfecto, setAvisoSinEfecto] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const resultado = await obtenerMatrizDePermisosPorRol();
    setModulos(resultado.modulos);
    setError(resultado.error);
    setCargando(false);
    return resultado.modulos;
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const alternar = useCallback(
    async (rol, clave, concedidoActual) => {
      setCeldaEnProceso({ rol, clave });
      setAvisoSinEfecto(null);

      const escribir = concedidoActual
        ? () => revocarPermisoARol(rol, clave)
        : () => concederPermisoARol(rol, clave);

      const { error: errorDeEscritura } = await escribir();
      if (errorDeEscritura) {
        setError(errorDeEscritura);
        setCeldaEnProceso(null);
        return;
      }

      const modulosNuevos = await cargar();
      const permiso = buscarPermiso(modulosNuevos, clave);
      const despues = permiso ? celdaConcedida(permiso, rol) : null;
      if (despues === null || despues === concedidoActual) {
        setAvisoSinEfecto({ rol, clave, mensaje: MENSAJE_SIN_EFECTO_ROL });
      }
      setCeldaEnProceso(null);
    },
    [cargar],
  );

  return { modulos, cargando, error, celdaEnProceso, avisoSinEfecto, alternar };
}
