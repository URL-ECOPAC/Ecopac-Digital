import { useMemo } from "react";

import { puedeVerDonaciones } from "./permisos.js";
import { ESTADOS_DE_DONACION } from "../enums.js";

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