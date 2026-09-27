// Hook de pantalla de la matriz de acceso a modulos por rol (migracion 00148).
//
// Reemplaza a useMatrizPermisosPorRol (issue #638), que editaba rol_permiso: los nueve permisos
// finos por defecto de cada rol. Esa matriz prometia algo que el sistema no hacia -el cliente no
// leia rol_permiso-, y la 00148 la cambia por lo que se pidio: que modulo ve cada rol. Las funciones
// de administracion se delegan por persona, desde el modal de permisos de Colaboradores.
//
// Mismo criterio de "escribir y releer" que useGestionPermisos.js (issue #108): un INSERT o un
// DELETE que RLS no deja pasar no siempre lanza, asi que despues de abrir o cerrar se vuelve a leer
// la matriz y se compara la celda, en vez de voltear un booleano local.

import { useCallback, useEffect, useMemo, useState } from "react";

import { MODULOS_DE_LA_MATRIZ, esModuloPorDefecto } from "../navegacion.js";
import { abrirModuloARol, cerrarModuloARol, listarAccesosPorRol } from "./permisos.api.js";
import { ROLES } from "./roles.js";

/** Columnas de la matriz: la administradora primero, siempre con todo, y despues los demas. */
export const ROLES_DE_LA_MATRIZ = Object.freeze([
  ROLES.ADMINISTRADOR,
  ROLES.JUNTA_DIRECTIVA,
  ROLES.SOCIO_FUNDADOR,
  ROLES.MEDICO,
  ROLES.VOLUNTARIO,
]);

/** Lo que dice cada celda de la matriz. */
export const ESTADOS_DE_ACCESO = Object.freeze({
  /** La administradora: todo, siempre. No es una casilla. */
  SIEMPRE: "siempre",
  /** El modulo es del rol: lo usa con todas sus funciones de rol. No se puede cerrar aqui. */
  POR_DEFECTO: "por-defecto",
  /** La administradora se lo abrio: lo ve en solo lectura. */
  ABIERTO: "abierto",
  /** No lo ve. */
  CERRADO: "cerrado",
});

export const MENSAJE_SIN_EFECTO_MATRIZ =
  "El cambio no se aplico. Puede que ya no tengas permiso para modificar la matriz.";

const clave = (rol, modulo) => `${rol}|${modulo}`;

/**
 * Estado de una celda. Funcion pura y exportada para probarla sin montar el hook.
 *
 * @param {string} rol
 * @param {{ id: string, modulo: string }} modulo Entrada de MODULOS_DE_LA_MATRIZ.
 * @param {Set<string>} abiertos Claves "rol|modulo" de rol_modulo.
 * @returns {string} Un valor de ESTADOS_DE_ACCESO.
 */
export function estadoDeCeldaDeAcceso(rol, modulo, abiertos) {
  if (rol === ROLES.ADMINISTRADOR) return ESTADOS_DE_ACCESO.SIEMPRE;
  if (esModuloPorDefecto(rol, modulo.id)) return ESTADOS_DE_ACCESO.POR_DEFECTO;
  return abiertos.has(clave(rol, modulo.modulo))
    ? ESTADOS_DE_ACCESO.ABIERTO
    : ESTADOS_DE_ACCESO.CERRADO;
}

/**
 * Estado y acciones de la matriz de acceso a modulos.
 *
 * @returns {{
 *   filas: Array<{ id: string, modulo: string, nombre: string, descripcion: string,
 *     icono: string, celdas: Array<{ rol: string, estado: string }> }>,
 *   modulosPorRol: Record<string, number>,
 *   totalDeModulos: number,
 *   cargando: boolean,
 *   error: object|null,
 *   celdaEnProceso: { rol: string, modulo: string }|null,
 *   avisoSinEfecto: { rol: string, modulo: string, mensaje: string }|null,
 *   alternar: (rol: string, modulo: string, abiertoActual: boolean) => Promise<void>,
 * }}
 */
export function useMatrizDeAccesoPorRol() {
  const [abiertos, setAbiertos] = useState(() => new Set());
  // Quien abrio cada celda y cuando, por clave "rol|modulo".
  const [otorgamientos, setOtorgamientos] = useState(() => new Map());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [celdaEnProceso, setCeldaEnProceso] = useState(null);
  const [avisoSinEfecto, setAvisoSinEfecto] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const { accesos, error: errorDeCarga } = await listarAccesosPorRol();
    const nuevos = new Set(accesos.map((fila) => clave(fila.rol, fila.modulo)));
    setAbiertos(nuevos);
    setOtorgamientos(
      new Map(
        accesos.map((fila) => [
          clave(fila.rol, fila.modulo),
          {
            otorgadoEn: fila.otorgadoEn ?? null,
            otorgadoPorNombre: fila.otorgadoPorNombre ?? null,
          },
        ]),
      ),
    );
    setError(errorDeCarga);
    setCargando(false);
    return nuevos;
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const alternar = useCallback(
    async (rol, modulo, abiertoActual) => {
      setCeldaEnProceso({ rol, modulo });
      setAvisoSinEfecto(null);

      const { error: errorDeEscritura } = abiertoActual
        ? await cerrarModuloARol(rol, modulo)
        : await abrirModuloARol(rol, modulo);

      if (errorDeEscritura) {
        setError(errorDeEscritura);
        setCeldaEnProceso(null);
        return;
      }

      const nuevos = await cargar();
      if (nuevos.has(clave(rol, modulo)) === abiertoActual) {
        setAvisoSinEfecto({ rol, modulo, mensaje: MENSAJE_SIN_EFECTO_MATRIZ });
      }
      setCeldaEnProceso(null);
    },
    [cargar],
  );

  const filas = useMemo(
    () =>
      MODULOS_DE_LA_MATRIZ.map((modulo) => ({
        id: modulo.id,
        modulo: modulo.modulo,
        nombre: modulo.nombre,
        descripcion: modulo.descripcion,
        icono: modulo.icono,
        celdas: ROLES_DE_LA_MATRIZ.map((rol) => ({
          rol,
          estado: estadoDeCeldaDeAcceso(rol, modulo, abiertos),
          otorgamiento: otorgamientos.get(clave(rol, modulo.modulo)) ?? null,
        })),
      })),
    [abiertos, otorgamientos],
  );

  // Cuantos modulos ve cada rol, por defecto mas lo que se le abrio: es la pregunta con la que se
  // entra a esta pantalla.
  const modulosPorRol = useMemo(() => {
    const conteo = Object.fromEntries(ROLES_DE_LA_MATRIZ.map((rol) => [rol, 0]));
    for (const fila of filas) {
      for (const celda of fila.celdas) {
        if (celda.estado !== ESTADOS_DE_ACCESO.CERRADO) conteo[celda.rol] += 1;
      }
    }
    return conteo;
  }, [filas]);

  return {
    filas,
    modulosPorRol,
    totalDeModulos: MODULOS_DE_LA_MATRIZ.length,
    cargando,
    error,
    celdaEnProceso,
    avisoSinEfecto,
    alternar,
  };
}
