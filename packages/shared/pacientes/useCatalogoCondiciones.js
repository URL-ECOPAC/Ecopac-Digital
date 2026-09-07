import { useCallback, useEffect, useState } from "react";
import {
  actualizarCondicionCatalogo,
  crearCondicionCatalogo,
  obtenerCatalogoDeCondiciones,
} from "./condiciones.api.js";
import { puedeGestionarCatalogoCondiciones } from "./condiciones.permisos.js";

/**
 * Hook de vista para la pantalla de mantenimiento del catalogo de condiciones cronicas (issue #641).
 */
export function useCatalogoCondiciones({ rol } = {}) {
  const [condiciones, setCondiciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erroresForm, setErroresForm] = useState({});

  const puedeGestionar = puedeGestionarCatalogoCondiciones(rol);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const respuesta = await obtenerCatalogoDeCondiciones({ busqueda });
    setCondiciones(respuesta.condiciones ?? []);
    setError(respuesta.error);
    setCargando(false);
  }, [busqueda]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = useCallback(
    async (nombre) => {
      if (!puedeGestionar) return { ok: false };
      setEnviando(true);
      setErroresForm({});

      const res = await crearCondicionCatalogo({ nombre });
      setEnviando(false);

      if (res.error || Object.keys(res.errores ?? {}).length > 0) {
        setErroresForm(res.errores ?? {});
        setError(res.error);
        return { ok: false };
      }

      await cargar();
      return { ok: true };
    },
    [puedeGestionar, cargar],
  );

  const editar = useCallback(
    async (id, { nombre, esVigente }) => {
      if (!puedeGestionar) return { ok: false };
      setEnviando(true);
      setErroresForm({});

      const res = await actualizarCondicionCatalogo(id, { nombre, esVigente });
      setEnviando(false);

      if (res.error || Object.keys(res.errores ?? {}).length > 0) {
        setErroresForm(res.errores ?? {});
        setError(res.error);
        return { ok: false };
      }

      await cargar();
      return { ok: true };
    },
    [puedeGestionar, cargar],
  );

  const alternarVigencia = useCallback(
    async (id, esVigenteActual) => {
      return editar(id, { esVigente: !esVigenteActual });
    },
    [editar],
  );

  return {
    condiciones,
    busqueda,
    setBusqueda,
    cargando,
    error,
    enviando,
    erroresForm,
    puedeGestionar,
    crear,
    editar,
    alternarVigencia,
    recargar: cargar,
  };
}
