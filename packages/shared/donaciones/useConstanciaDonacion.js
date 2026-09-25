import { useMemo } from "react";

import { puedeVerDonaciones } from "./permisos.js";
import { ESTADOS_DE_DONACION } from "../enums.js";

/**
 * Estado de la pantalla de constancia de una donacion: si el rol puede verla, si la donacion
 * admite constancia (cualquiera que no este anulada) y el correlativo que se imprime.
 *
 * @param {object} opciones
 * @param {string} opciones.usuarioRol Rol de la sesion (`ROLES`).
 * @param {object|null} opciones.donacion La donacion ya cargada.
 * @param {() => void} [opciones.onImprimir] Lo que hace la plataforma al imprimir.
 * @returns {{ tieneAccesoLectura: boolean, esValidaParaConstancia: boolean, correlativo: string,
 *   manejarImpresion: () => void }} `correlativo` es `CONST-0000` mientras no hay donacion.
 */
export function useConstanciaDonacion({ usuarioRol, donacion, onImprimir }) {
  const tieneAccesoLectura = puedeVerDonaciones(usuarioRol);

  const esValidaParaConstancia = useMemo(() => {
    if (!donacion) return false;
    return donacion.estado !== ESTADOS_DE_DONACION.ANULADA;
  }, [donacion]);

  const correlativo = useMemo(() => {
    if (!donacion?.id) return "CONST-0000";
    return `CONST-${String(donacion.id).padStart(6, "0")}`;
  }, [donacion]);

  const manejarImpresion = () => {
    if (!esValidaParaConstancia) return;
    if (typeof onImprimir === "function") {
      onImprimir();
    }
  };

  return {
    tieneAccesoLectura,
    esValidaParaConstancia,
    correlativo,
    manejarImpresion,
  };
}
