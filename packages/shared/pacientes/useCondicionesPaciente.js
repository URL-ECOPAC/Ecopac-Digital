import { useCallback, useEffect, useState } from "react";

import {
  asociarCondicion,
  desasociarCondicion,
  obtenerCatalogoDeCondiciones,
  obtenerCondicionesDelPaciente,
  quitarCondicion,
} from "./condiciones.api.js";
import { CAMPOS_CONDICION_CRONICA, OPCIONES_ESTADO_CONDICION } from "./condiciones.campos.js";
import {
  puedeEditarCondicion,
  puedeQuitarCondicion,
  puedeRegistrarCondicion,
  puedeVerCondiciones,
} from "./condiciones.permisos.js";

const VALORES_INICIALES = CAMPOS_CONDICION_CRONICA.reduce((valores, campo) => {
  valores[campo.id] = "";
  return valores;
}, {});

export function permisosDeCondiciones(rol) {
  return {
    puedeVer: puedeVerCondiciones(rol),
    puedeRegistrar: puedeRegistrarCondicion(rol),
    puedeEditar: puedeEditarCondicion(rol),
    puedeQuitar: puedeQuitarCondicion(rol),
  };
}

export function useCondicionesPaciente(pacienteId, { rol } = {}) {
  const [condiciones, setCondiciones] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [valores, setValores] = useState(VALORES_INICIALES);
  const [errores, setErrores] = useState({});
  const [errorDeAlta, setErrorDeAlta] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const permisos = permisosDeCondiciones(rol);

  const cargar = useCallback(async () => {
    if (!pacienteId || !permisos.puedeVer) {
      setCondiciones([]);
      setCargando(false);
      return;
    }

    setCargando(true);
    setError(null);

    const respuesta = await obtenerCondicionesDelPaciente(pacienteId);
    setCondiciones(respuesta.condiciones ?? []);
    setError(respuesta.error);
    setCargando(false);
  }, [pacienteId, permisos.puedeVer]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    let vigente = true;
    obtenerCatalogoDeCondiciones().then((respuesta) => {
      if (!vigente) return;
      const filas = respuesta.condiciones ?? respuesta.catalogo ?? [];
      setCatalogo(filas.map((fila) => ({ value: fila.id, label: fila.nombre })));
    });
    return () => {
      vigente = false;
    };
  }, []);

  const setCampo = useCallback((id, valor) => {
    setValores((anteriores) => ({ ...anteriores, [id]: valor }));
    setErrores((anteriores) => {
      if (!(id in anteriores)) return anteriores;
      return Object.fromEntries(Object.entries(anteriores).filter(([clave]) => clave !== id));
    });
  }, []);

  const reiniciar = useCallback(() => {
    setValores(VALORES_INICIALES);
    setErrores({});
    setErrorDeAlta(null);
  }, []);

  const agregar = useCallback(async () => {
    setEnviando(true);
    const resultado = await asociarCondicion({ ...valores, pacienteId });
    setEnviando(false);
    setErrores(resultado.errores ?? {});
    setErrorDeAlta(resultado.error);

    if (resultado.error || Object.keys(resultado.errores ?? {}).length > 0) return { ok: false };

    setValores(VALORES_INICIALES);
    await cargar();
    return { ok: true, condicion: resultado.condicion };
  }, [valores, pacienteId, cargar]);

  const marcarResuelta = useCallback(
    async (id) => {
      setEnviando(true);
      const resultado = await desasociarCondicion(id);
      setEnviando(false);
      setErrorDeAlta(resultado.error);

      if (resultado.error) return { ok: false };
      await cargar();
      return { ok: true };
    },
    [cargar],
  );

  const borrar = useCallback(
    async (id) => {
      setEnviando(true);
      const resultado = await quitarCondicion(id);
      setEnviando(false);
      setErrorDeAlta(resultado.error);

      if (resultado.error || !resultado.quitada) return { ok: false };
      await cargar();
      return { ok: true };
    },
    [cargar],
  );

  return {
    condiciones,
    campos: CAMPOS_CONDICION_CRONICA,
    valores,
    errores,
    error,
    errorDeAlta,
    enviando,
    cargando,
    permisos,
    setCampo,
    reiniciar,
    agregar,
    marcarResuelta,
    borrar,
    recargar: cargar,
    catalogos: { condicionesCronicas: catalogo, estadosCondicionCronica: OPCIONES_ESTADO_CONDICION },
  };
}
