// View model de la bandeja de gastos pendientes de aprobacion (issue #304).
//
// No hay una pantalla web de #158 (bandeja de validacion de movimientos de inventario) que
// copiar: su hook (inventario/usePendientesValidacion.js, issues #152/#158/#159) existe, pero
// ninguna pantalla de apps/web lo consume todavia. Lo que se sigue de #158 es la FORMA de ese
// hook -- pendientes/conteo/cargando/error/recargar/aprobar/rechazar, con recarga automatica
// tras una accion exitosa-, que este hook replica para gastos. `debeRecargarTrasAccion()` se
// reutiliza tal cual (importada, no duplicada): es una regla generica ("solo recargar si la
// accion no fallo"), sin nada especifico de inventario.

import { useCallback, useEffect, useState } from "react";

import { debeRecargarTrasAccion } from "../inventario/usePendientesValidacion.js";
import { listarUsuarios } from "../usuarios/api.js";
import { nombreCompletoDe } from "../usuarios/useUsuariosListado.js";
import { aprobarGasto, rechazarGasto } from "./aprobacionGastosApi.js";
import { listarGastos } from "./api.js";

function aOpciones(filas, etiquetaDe) {
  return (filas ?? []).map((fila) => ({ value: fila.id, label: etiquetaDe(fila) }));
}

/**
 * @param {{ usuarioId: string }} contexto Quien opera la bandeja; viaja tal cual a
 *   aprobarGasto()/rechazarGasto().
 */
export function usePendientesAprobacionGastos({ usuarioId } = {}) {
  const [pendientes, setPendientes] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const consultar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const { gastos, error: errorDeLista } = await listarGastos({ estado: "pendiente" });

    if (errorDeLista) {
      setPendientes([]);
      setError(errorDeLista);
      setCargando(false);
      return;
    }

    setPendientes(gastos);
    setCargando(false);
  }, []);

  // Catalogo para traducir registrado_por (un UUID) al nombre de quien registro el gasto
  // (criterio 1). Se carga una sola vez: no cambia mientras la bandeja esta abierta.
  useEffect(() => {
    let vigente = true;
    listarUsuarios({ estado: true }).then(({ usuarios }) => {
      if (vigente) setPerfiles(aOpciones(usuarios, nombreCompletoDe));
    });
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    consultar();
  }, [consultar]);

  const recargar = useCallback(() => consultar(), [consultar]);

  const aprobar = useCallback(
    async (gastoId) => {
      const respuesta = await aprobarGasto({ gastoId, usuarioId });
      if (debeRecargarTrasAccion(respuesta)) await consultar();
      return respuesta;
    },
    [usuarioId, consultar],
  );

  const rechazar = useCallback(
    async (gastoId, motivo) => {
      const respuesta = await rechazarGasto({ gastoId, usuarioId, motivo });
      if (debeRecargarTrasAccion(respuesta)) await consultar();
      return respuesta;
    },
    [usuarioId, consultar],
  );

  return {
    pendientes,
    conteo: pendientes.length,
    catalogos: { perfiles },
    cargando,
    error,
    recargar,
    aprobar,
    rechazar,
  };
}
