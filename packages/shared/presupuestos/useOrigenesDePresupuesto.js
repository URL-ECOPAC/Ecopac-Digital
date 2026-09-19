// View model del origen del presupuesto de una jornada (issue #840, bloque D).
//
// La jornada ya no tiene un campo "presupuesto" que se edita: tiene una lista de aportes, cada
// uno con su origen, y el total es la suma (la mantiene la base, 00135). Esta pantalla lista los
// aportes, registra uno nuevo y quita uno que se registro por error.
//
// Una donacion de dinero se convierte en aporte sin volver a teclear el monto: al elegirla, el
// monto se llena con lo que le queda por asignar. Se puede bajar -una donacion puede repartirse
// entre varias jornadas-, pero no subir por encima de ese saldo.

import { useCallback, useEffect, useMemo, useState } from "react";

import { ORIGENES_DE_PRESUPUESTO } from "../enums.js";
import { formatearFechaCorta } from "../formato/fechas.js";
import { formatearMoneda } from "../formato/moneda.js";
import { camposDeOrigenDePresupuesto } from "./campos.js";
import {
  listarDonacionesConSaldo,
  listarOrigenesDePresupuesto,
  quitarOrigenDePresupuesto,
  registrarOrigenDePresupuesto,
} from "./origenes.api.js";
import { permisosDeOrigenDePresupuesto } from "./permisos.js";
import { validarOrigenDePresupuesto } from "./validaciones.js";

const VALORES_VACIOS = {
  origen: ORIGENES_DE_PRESUPUESTO.FONDOS_PROPIOS,
  donacionId: "",
  monto: "",
  descripcion: "",
};

/**
 * Una donacion con saldo como opcion de selector: quien dono, cuando, y cuanto le queda.
 *
 * @param {{ id: string, donanteNombre: string|null, fecha: string, disponible: number }} donacion
 * @returns {{ value: string, label: string }}
 */
export function opcionDeDonacionConSaldo(donacion) {
  const quien = donacion.donanteNombre ?? "Donante sin nombre";
  return {
    value: donacion.id,
    label: `${quien} · ${formatearFechaCorta(donacion.fecha)} · quedan ${formatearMoneda(donacion.disponible)}`,
  };
}

/**
 * @param {{ jornadaId: string, proyectoId?: string|null, rol: string,
 *   alCambiar?: () => void }} opciones `alCambiar` avisa a la pantalla que el total de la
 *   jornada cambio, para que lo vuelva a leer.
 */
export function useOrigenesDePresupuesto({ jornadaId, proyectoId = null, rol, alCambiar } = {}) {
  const permisos = permisosDeOrigenDePresupuesto(rol);

  const [origenes, setOrigenes] = useState([]);
  const [donaciones, setDonaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [valores, setValores] = useState(VALORES_VACIOS);
  const [errores, setErrores] = useState({});
  const [errorAlGuardar, setErrorAlGuardar] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [quitandoId, setQuitandoId] = useState(null);

  const cargar = useCallback(async () => {
    if (!jornadaId || !permisos.puedeVer) {
      setCargando(false);
      return;
    }
    setCargando(true);
    const [lista, conSaldo] = await Promise.all([
      listarOrigenesDePresupuesto(jornadaId),
      permisos.puedeGestionar
        ? listarDonacionesConSaldo({ proyectoId })
        : Promise.resolve({ donaciones: [], error: null }),
    ]);
    setOrigenes(lista.origenes);
    setDonaciones(conSaldo.donaciones);
    setError(lista.error ?? conSaldo.error);
    setCargando(false);
  }, [jornadaId, proyectoId, permisos.puedeVer, permisos.puedeGestionar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const donacionElegida = donaciones.find((donacion) => donacion.id === valores.donacionId);

  const setCampo = useCallback(
    (id, valor) => {
      setValores((anteriores) => {
        const siguientes = { ...anteriores, [id]: valor };
        // Elegir una donacion llena el monto con su saldo: es lo que evita volver a teclearlo.
        if (id === "donacionId") {
          const elegida = donaciones.find((donacion) => donacion.id === valor);
          if (elegida) siguientes.monto = elegida.disponible;
        }
        if (id === "origen" && valor !== ORIGENES_DE_PRESUPUESTO.DONACION) {
          siguientes.donacionId = "";
        }
        return siguientes;
      });
      setErrores((anteriores) => {
        if (!(id in anteriores)) return anteriores;
        return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
      });
    },
    [donaciones],
  );

  const registrar = useCallback(async () => {
    const erroresDeValidacion = validarOrigenDePresupuesto(valores, {
      disponibleDeDonacion: donacionElegida?.disponible ?? null,
    });
    if (Object.keys(erroresDeValidacion).length > 0) {
      setErrores(erroresDeValidacion);
      return false;
    }

    setGuardando(true);
    setErrorAlGuardar(null);
    const { error: fallo } = await registrarOrigenDePresupuesto({ jornadaId, ...valores });
    setGuardando(false);

    if (fallo) {
      setErrorAlGuardar(fallo);
      return false;
    }

    setValores(VALORES_VACIOS);
    setErrores({});
    await cargar();
    alCambiar?.();
    return true;
  }, [valores, donacionElegida, jornadaId, cargar, alCambiar]);

  const quitar = useCallback(
    async (origenId) => {
      setQuitandoId(origenId);
      setErrorAlGuardar(null);
      const { error: fallo } = await quitarOrigenDePresupuesto(origenId);
      setQuitandoId(null);
      if (fallo) {
        setErrorAlGuardar(fallo);
        return false;
      }
      await cargar();
      alCambiar?.();
      return true;
    },
    [cargar, alCambiar],
  );

  const total = useMemo(
    () => origenes.reduce((suma, origen) => suma + (Number(origen.monto) || 0), 0),
    [origenes],
  );

  return {
    permisos,
    origenes,
    total,
    cargando,
    error,
    recargar: cargar,

    campos: camposDeOrigenDePresupuesto(valores.origen),
    catalogos: { donacionesDisponibles: donaciones.map(opcionDeDonacionConSaldo) },
    valores,
    setCampo,
    errores,
    errorAlGuardar,
    guardando,
    registrar,
    quitar,
    quitandoId,
  };
}
