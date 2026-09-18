// Alta de una comunidad SIN salir del formulario que la necesita.
//
// Nacio dentro de useRegistroPaciente (issue #743): en jornada, la comunidad de la persona que se
// esta registrando muchas veces todavia no existe en el catalogo, y mandar a quien registra a otra
// pantalla a crearla pierde lo que ya llevaba escrito. La #838 lo saca a este hook porque el alta
// de jornada tiene exactamente el mismo problema -- y el mismo selector en cascada -- y hasta
// ahora no ofrecia la salida.
//
// Que NO hace: no decide quien puede crear (eso es puedeCrearComunidad, y quien decide de verdad
// es la politica RLS de la 00079), no dibuja nada y no sabe que formulario lo monta. Quien lo usa
// le pasa `alCrear`, que es lo unico especifico de cada pantalla: recargar su propio catalogo de
// comunidades y dejar seleccionada la recien creada.

import { useCallback, useState } from "react";

import { crearComunidad } from "./api.js";
import { validarComunidad } from "./comunidades.validaciones.js";
import { puedeCrearComunidad } from "./permisos.js";

/**
 * @param {object} opciones
 * @param {string|number|null} opciones.municipioId Municipio al que colgar la comunidad nueva. Sin
 *   el no se puede crear: comunidades.municipio_id es NOT NULL (00008).
 * @param {string} [opciones.rol] Rol de quien tiene el formulario abierto.
 * @param {(comunidad: object) => void|Promise<void>} [opciones.alCrear] Que hacer con la comunidad
 *   recien creada: recargar el catalogo del formulario y seleccionarla.
 * @returns {{
 *   puedeCrear: boolean,
 *   crear: (nombre: string) => Promise<{ comunidad: object|null, errores: object, error: object|null }>,
 *   errores: Record<string, string>,
 *   creando: boolean,
 * }}
 */
export function useAltaDeComunidadEnLinea({ municipioId, rol, alCrear } = {}) {
  const [errores, setErrores] = useState({});
  const [creando, setCreando] = useState(false);

  const crear = useCallback(
    async (nombre) => {
      const datos = { nombre, municipioId };
      const erroresDeValidacion = validarComunidad(datos);

      if (Object.keys(erroresDeValidacion).length > 0) {
        setErrores(erroresDeValidacion);
        return { comunidad: null, errores: erroresDeValidacion, error: null };
      }

      setCreando(true);
      setErrores({});

      const { comunidad, error } = await crearComunidad(datos);

      if (error) {
        setCreando(false);
        return { comunidad: null, errores: {}, error };
      }

      await alCrear?.(comunidad);
      setCreando(false);

      return { comunidad, errores: {}, error: null };
    },
    [municipioId, alCrear],
  );

  return {
    puedeCrear: puedeCrearComunidad(rol),
    crear,
    errores,
    creando,
  };
}
