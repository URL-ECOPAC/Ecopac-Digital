// Recarga una pantalla cuando cambian las tablas que muestra (00163, Supabase Realtime).
//
// No usa el contenido del aviso: cuando llega un cambio de cualquiera de las tablas, espera un
// momento -varios cambios seguidos, como un gasto y su notificacion, se juntan en una sola
// recarga- y llama a la recarga de siempre del hook. Asi lo que se ve sigue saliendo de la misma
// consulta, con el mismo RLS, y no hay una segunda forma de armar los datos que pueda divergir.
//
// La base solo avisa de las filas que la persona puede leer (Realtime aplica el RLS), y solo de
// las tablas que estan en la publicacion supabase_realtime (00163).
//
// Funciona igual en la web y en el movil: supabase-js abre un solo socket por cliente y cada
// pantalla montada agrega su canal.

import { useEffect, useRef } from "react";

import { obtenerSupabase } from "../api/cliente.js";

/** Cuanto se espera despues del ultimo aviso antes de recargar. */
export const ESPERA_DE_TIEMPO_REAL_MS = 400;

let siguienteCanal = 0;

/**
 * Se suscribe a los cambios de `tablas` y llama a `alCambiar` una vez por racha de avisos.
 *
 * Pura respecto de React: recibe el cliente, para probarla con uno de mentira.
 *
 * @param {{ channel: Function, removeChannel: Function }} cliente Cliente de Supabase.
 * @param {string[]} tablas Tablas del esquema public.
 * @param {() => void} alCambiar
 * @param {{ espera?: number }} [opciones]
 * @returns {() => void} Cancela la suscripcion y la recarga que estuviera por salir.
 */
export function suscribirACambios(
  cliente,
  tablas,
  alCambiar,
  { espera = ESPERA_DE_TIEMPO_REAL_MS } = {},
) {
  siguienteCanal += 1;
  const canal = cliente.channel(`cambios-${siguienteCanal}`);
  let temporizador = null;

  const avisar = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(alCambiar, espera);
  };

  for (const tabla of tablas) {
    canal.on("postgres_changes", { event: "*", schema: "public", table: tabla }, avisar);
  }
  canal.subscribe();

  return () => {
    clearTimeout(temporizador);
    cliente.removeChannel(canal);
  };
}

/**
 * Recarga la pantalla cuando cambian sus tablas.
 *
 * @param {string[]} tablas Tablas que muestra la pantalla.
 * @param {() => void} alCambiar La recarga del hook. Puede cambiar entre renders: se usa siempre
 *   la ultima, sin volver a suscribirse.
 * @param {{ activo?: boolean }} [opciones] `activo: false` no se suscribe (por ejemplo, mientras
 *   no hay jornada elegida).
 * @returns {void}
 */
export function useCambiosEnTiempoReal(tablas, alCambiar, { activo = true } = {}) {
  const ultimaRecarga = useRef(alCambiar);
  useEffect(() => {
    ultimaRecarga.current = alCambiar;
  });

  const clave = (tablas ?? []).join(",");

  useEffect(() => {
    if (!activo || !clave) return undefined;
    // Sin cliente (una prueba que monta la pantalla sin inicializarlo) no hay a que suscribirse.
    // La carga de la pantalla ya dice su propio error por la misma causa -las funciones de
    // *.api.js lo devuelven en `error`-; el tiempo real solo la mantiene al dia.
    let cliente;
    try {
      cliente = obtenerSupabase();
    } catch {
      return undefined;
    }
    return suscribirACambios(cliente, clave.split(","), () => ultimaRecarga.current?.());
  }, [clave, activo]);
}
