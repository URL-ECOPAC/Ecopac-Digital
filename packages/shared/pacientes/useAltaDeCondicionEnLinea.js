// Alta de una condicion cronica en el catalogo SIN salir de la ficha del paciente.
//
// Es el mismo problema que la #743 resolvio para comunidades, y la decision de la #850 lo dice
// explicito: una condicion que falta se descubre en jornada, con el paciente delante. Mandar a
// quien atiende a la pantalla de catalogo y de vuelta pierde lo que ya llevaba escrito en el
// formulario, y esperar a que la administracion la de de alta pierde el dato entero.
//
// Molde: territorio/useAltaDeComunidadEnLinea.js. Que NO hace: no decide quien puede crear (eso
// es puedeCrearCondicionDelCatalogo, y quien decide de verdad es la politica de INSERT de la
// 00140), no dibuja nada y no sabe que formulario lo monta. Quien lo usa le pasa `alCrear`, que
// es lo unico especifico de cada pantalla: recargar su catalogo y dejar seleccionada la nueva.
//
// LO QUE NO SE DUPLICA
//
// Antes de llamar al servidor se mira si el nombre escrito ya esta en el catalogo, ignorando
// mayusculas, acentos y espacios de mas (buscarOpcionPorEtiqueta, formato/opciones.js). Si esta,
// se elige la que existe en vez de crear otra. Es lo que ya hace MultiSelector al escribir un
// diagnostico. Esto es comodidad de la pantalla, no la garantia: la garantia es el indice unico
// sobre el nombre normalizado que agrega la 00140, y por eso un 23505 sigue teniendo su mensaje.

import { useCallback, useState } from "react";

import { buscarOpcionPorEtiqueta } from "../formato/opciones.js";
import { crearCondicionCatalogo } from "./condiciones.api.js";
import { puedeCrearCondicionDelCatalogo } from "./condiciones.permisos.js";
import { validarCondicionCatalogo } from "./condiciones.validaciones.js";

/**
 * Que hacer con el nombre que alguien escribio en el selector, antes de tocar el servidor.
 *
 * Es la decision no trivial de este hook, y va aparte para poder probarla sin renderHook: el
 * vitest.config.js de packages/shared corre en entorno "node", sin DOM, igual que ya explican
 * useRegistroDonacion.test.js y useNuevaContrasena.test.js.
 *
 * @param {{ value: unknown, label: string }[]} opciones El catalogo tal como lo ve el selector.
 * @param {string} nombre Lo que se escribio.
 * @returns {{ accion: "rechazar", errores: Record<string,string> }
 *          | { accion: "elegir", existente: { value: unknown, label: string } }
 *          | { accion: "crear" }}
 */
export function resolverCondicionEscrita(opciones = [], nombre = "") {
  const errores = validarCondicionCatalogo({ nombre });
  if (Object.keys(errores).length > 0) return { accion: "rechazar", errores };

  const existente = buscarOpcionPorEtiqueta(opciones, nombre);
  if (existente) return { accion: "elegir", existente };

  return { accion: "crear" };
}

/**
 * @param {object} parametros
 * @param {string} [parametros.rol] Rol de quien tiene el formulario abierto.
 * @param {{ value: unknown, label: string }[]} [parametros.opciones] El catalogo tal como lo ve el
 *   selector, para poder elegir una que ya existe en vez de duplicarla.
 * @param {(condicion: object) => void|Promise<void>} [parametros.alCrear] Que hacer con la
 *   condicion recien creada: recargar el catalogo del formulario y seleccionarla.
 * @param {(value: unknown) => void} [parametros.alElegirExistente] Que hacer cuando el nombre
 *   escrito ya estaba en el catalogo. Por defecto no hace nada mas que devolverla.
 * @returns {{
 *   puedeCrear: boolean,
 *   crear: (nombre: string) => Promise<{ condicion: object|null, yaExistia: boolean, errores: object, error: object|null }>,
 *   errores: Record<string, string>,
 *   creando: boolean,
 * }}
 */
export function useAltaDeCondicionEnLinea({ rol, opciones = [], alCrear, alElegirExistente } = {}) {
  const [errores, setErrores] = useState({});
  const [creando, setCreando] = useState(false);

  const crear = useCallback(
    async (nombre) => {
      const resuelto = resolverCondicionEscrita(opciones, nombre);

      if (resuelto.accion === "rechazar") {
        setErrores(resuelto.errores);
        return { condicion: null, yaExistia: false, errores: resuelto.errores, error: null };
      }

      setErrores({});

      if (resuelto.accion === "elegir") {
        const { existente } = resuelto;
        await alElegirExistente?.(existente.value);
        return {
          condicion: { id: existente.value, nombre: existente.label, esVigente: true },
          yaExistia: true,
          errores: {},
          error: null,
        };
      }

      setCreando(true);

      const {
        condicion,
        errores: erroresDelAlta,
        error,
      } = await crearCondicionCatalogo({ nombre });

      if (error || Object.keys(erroresDelAlta ?? {}).length > 0) {
        setErrores(erroresDelAlta ?? {});
        setCreando(false);
        return { condicion: null, yaExistia: false, errores: erroresDelAlta ?? {}, error };
      }

      await alCrear?.(condicion);
      setCreando(false);

      return { condicion, yaExistia: false, errores: {}, error: null };
    },
    [opciones, alCrear, alElegirExistente],
  );

  return {
    puedeCrear: puedeCrearCondicionDelCatalogo(rol),
    crear,
    errores,
    creando,
  };
}
