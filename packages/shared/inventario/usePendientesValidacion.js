import { useCallback, useEffect, useRef, useState } from "react";

import { esRespuestaVigente } from "../hooks/useBusquedaPacientes.js";
import { listarMovimientos } from "./movimientos.api.js";
import { aprobarMovimiento, rechazarMovimiento } from "./validacion.api.js";

/**
 * Decide si una accion de aprobar/rechazar tiene que refrescar la bandeja.
 *
 * Funcion aparte y exportada para poder probarla sin montar el hook (packages/shared corre sin
 * DOM, ver vitest.config.js): solo se recarga cuando la accion salio bien, para no pisar el
 * error que ya esta en pantalla con una consulta que solo iba a repetir el mismo fallo.
 *
 * @param {{ error: object|null }} respuesta Lo que devolvio aprobarMovimiento()/rechazarMovimiento().
 * @returns {boolean}
 */
export function debeRecargarTrasAccion(respuesta) {
  return !respuesta?.error;
}

/**
 * View model de la bandeja de movimientos de inventario pendientes de aprobacion (issue #152,
 * RF-17/RF-18), compartido por la web (#158, #159) y el movil (#268, #270). `conteo` alimenta
 * el indicador de la bandeja en el menu.
 *
 * `aprobar()`/`rechazar()` llaman a aprobarMovimiento()/rechazarMovimiento()
 * (inventario/validacion.api.js), que ya validan el rol y dejan el ajuste de existencias al
 * trigger de la base (issue #491): este hook no repite esa logica, solo refresca la bandeja
 * despues de una accion exitosa para que el movimiento aprobado o rechazado desaparezca de
 * `pendientes` sin que la pantalla tenga que pedirlo aparte.
 *
 * Se consulta al montar, no en cada render: React vuelve a montar el hook con el mismo estado
 * inicial si la pantalla se abandona y se vuelve a entrar, asi que abrir y cerrar la bandeja no
 * repite la consulta salvo que se llame recargar() a proposito.
 *
 * @param {{ usuarioId: string, rolUsuario: string }} contexto Quien esta operando la bandeja;
 *   viaja tal cual a aprobarMovimiento()/rechazarMovimiento().
 */
export function usePendientesValidacion({ usuarioId, rolUsuario } = {}) {
  const [pendientes, setPendientes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // Mismo resguardo contra respuestas fuera de orden que useInventario()/useBusquedaPacientes().
  const peticionVigente = useRef(0);

  const consultar = useCallback(async () => {
    peticionVigente.current += 1;
    const idDeEstaPeticion = peticionVigente.current;

    setCargando(true);
    setError(null);

    const respuesta = await listarMovimientos({ estado: "pendiente" });

    if (!esRespuestaVigente(idDeEstaPeticion, peticionVigente.current)) return;

    if (respuesta.error) {
      setError(respuesta.error);
      setCargando(false);
      return;
    }

    setPendientes(respuesta.datos);
    setCargando(false);
  }, []);

  useEffect(() => {
    consultar();
  }, [consultar]);

  const recargar = useCallback(() => consultar(), [consultar]);

  const aprobar = useCallback(
    async (idMovimiento) => {
      const respuesta = await aprobarMovimiento(idMovimiento, { usuarioId, rolUsuario });
      if (debeRecargarTrasAccion(respuesta)) await consultar();
      return respuesta;
    },
    [usuarioId, rolUsuario, consultar],
  );

  const rechazar = useCallback(
    async (idMovimiento, motivo) => {
      const respuesta = await rechazarMovimiento(idMovimiento, { motivo, usuarioId, rolUsuario });
      if (debeRecargarTrasAccion(respuesta)) await consultar();
      return respuesta;
    },
    [usuarioId, rolUsuario, consultar],
  );

  return {
    pendientes,
    conteo: pendientes.length,
    cargando,
    error,
    recargar,
    aprobar,
    rechazar,
  };
}
