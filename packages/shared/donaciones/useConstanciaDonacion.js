import { useMemo } from "react";

const ROLES_LECTURA = ["Administrador", "Junta Directiva", "Socio Fundador"];

export function useConstanciaDonacion({ usuarioRol, donacion, onImprimir }) {
  const tieneAccesoLectura = ROLES_LECTURA.includes(usuarioRol);

  const esValidaParaConstancia = useMemo(() => {
    if (!donacion) return false;
    return donacion.estado !== "anulada";
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