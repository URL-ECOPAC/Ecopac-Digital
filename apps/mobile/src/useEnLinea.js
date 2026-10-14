import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

/**
 * Decide si un estado de NetInfo cuenta como "sin conexion".
 *
 * Solo `false` cuenta: NetInfo arranca con `isConnected` e `isInternetReachable` en `null`
 * ("todavia no se sabe"), y un aviso de "sin conexion" que parpadea al abrir la app enseña a
 * ignorarlo. `isInternetReachable === false` si cuenta, y es el caso mas comun en jornada: el
 * telefono sigue conectado a una red -el wifi del centro de salud, una antena con una raya- que no
 * llega a internet.
 *
 * @param {{ isConnected?: boolean|null, isInternetReachable?: boolean|null } | null | undefined} estado
 * @returns {boolean}
 */
export function estaEnLinea(estado) {
  if (!estado) return true;
  return estado.isConnected !== false && estado.isInternetReachable !== false;
}

/**
 * Si el telefono tiene red (issue #762, "fallos de red"). Espejo de apps/web/src/hooks/useEnLinea.js.
 *
 * Vive en apps/mobile y no en packages/shared porque escucha un modulo nativo que shared no puede
 * importar. Igual que en web, alimenta un aviso y no una decision: quien sabe si una escritura
 * llego es la respuesta de la API, que ya se pinta en la pantalla que la hizo.
 *
 * @returns {boolean}
 */
export function useEnLinea() {
  const [enLinea, setEnLinea] = useState(true);

  useEffect(() => {
    const cancelar = NetInfo.addEventListener((estado) => setEnLinea(estaEnLinea(estado)));
    return cancelar;
  }, []);

  return enLinea;
}
