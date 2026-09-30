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
  crearFuenteDePresupuesto,
  listarDonacionesConSaldo,
  listarFuentesDePresupuesto,
  listarOrigenesDePresupuesto,
  quitarOrigenDePresupuesto,
  registrarOrigenDePresupuesto,
} from "./origenes.api.js";
import { permisosDeOrigenDePresupuesto } from "./permisos.js";
import { validarOrigenDePresupuesto } from "./validaciones.js";

const VALORES_VACIOS = {
  origen: ORIGENES_DE_PRESUPUESTO.FONDOS_PROPIOS,
  donacionId: "",
  fuenteId: "",
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
 *
 * @returns {object} Con: permisos, origenes, total, cargando, error, recargar, campos, catalogos, crearFuente, creandoFuente, errorFuente, limpiarErrorFuente, valores, setCampo, errores, errorAlGuardar, guardando, registrar, quitar, quitandoId.
 */
export function useOrigenesDePresupuesto({ jornadaId, proyectoId = null, rol, alCambiar } = {}) {
  const permisos = permisosDeOrigenDePresupuesto(rol);

  const [origenes, setOrigenes] = useState([]);
  const [donaciones, setDonaciones] = useState([]);
  const [fuentes, setFuentes] = useState([]);
  const [creandoFuente, setCreandoFuente] = useState(false);
  const [errorFuente, setErrorFuente] = useState(null);
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
    const [lista, conSaldo, catalogoDeFuentes] = await Promise.all([
      listarOrigenesDePresupuesto(jornadaId),
      permisos.puedeGestionar
        ? listarDonacionesConSaldo({ proyectoId, jornadaId })
        : Promise.resolve({ donaciones: [], error: null }),
      permisos.puedeGestionar
        ? listarFuentesDePresupuesto()
        : Promise.resolve({ fuentes: [], error: null }),
    ]);
    setOrigenes(lista.origenes);
    setDonaciones(conSaldo.donaciones);
    setFuentes(catalogoDeFuentes.fuentes);
    setError(lista.error ?? conSaldo.error ?? catalogoDeFuentes.error);
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
        if (id === "origen" && valor !== ORIGENES_DE_PRESUPUESTO.APORTE_EXTERNO) {
          siguientes.fuenteId = "";
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

  /**
   * Agrega una fuente de aporte externo y la deja elegida en el formulario (origen "Aporte
   * externo"). Es lo que hace "Crear fuente": antes cerraba un modal sin guardar nada.
   *
   * @param {string} nombre
   * @returns {Promise<boolean>}
   */
  const crearFuente = useCallback(async (nombre) => {
    setCreandoFuente(true);
    setErrorFuente(null);
    const { fuente, error: fallo } = await crearFuenteDePresupuesto(nombre);
    setCreandoFuente(false);
    if (fallo) {
      setErrorFuente(fallo);
      return false;
    }
    setFuentes((anteriores) =>
      [...anteriores, fuente].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    );
    setValores((anteriores) => ({
      ...anteriores,
      origen: ORIGENES_DE_PRESUPUESTO.APORTE_EXTERNO,
      donacionId: "",
      fuenteId: fuente.id,
    }));
    return true;
  }, []);

  // Lo que cuenta de cada aporte es su monto menos lo devuelto al liquidar el sobrante (00160).
  const total = useMemo(
    () =>
      origenes.reduce(
        (suma, origen) => suma + (Number(origen.monto) || 0) - (Number(origen.devuelto) || 0),
        0,
      ),
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
    catalogos: {
      donacionesDisponibles: donaciones.map(opcionDeDonacionConSaldo),
      fuentesDePresupuesto: fuentes.map((fuente) => ({ value: fuente.id, label: fuente.nombre })),
    },
    crearFuente,
    creandoFuente,
    errorFuente,
    limpiarErrorFuente: () => setErrorFuente(null),
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
