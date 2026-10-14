import { useCallback, useEffect, useState } from "react";

import { idsEditables } from "../formularios.js";

import {
  actualizarCondicion,
  asociarCondicion,
  desasociarCondicion,
  obtenerCatalogoDeCondiciones,
  obtenerCondicionesDelPaciente,
  quitarCondicion,
} from "./condiciones.api.js";
import {
  CAMPOS_CONDICION_CRONICA,
  CAMPOS_CORRECCION_CONDICION,
  OPCIONES_ESTADO_CONDICION,
} from "./condiciones.campos.js";
import {
  puedeEditarCondicion,
  puedeQuitarCondicion,
  puedeRegistrarCondicion,
  puedeVerCondiciones,
} from "./condiciones.permisos.js";
import { useAltaDeCondicionEnLinea } from "./useAltaDeCondicionEnLinea.js";

/** El id del campo del formulario que elige una condicion del catalogo. */
const CAMPO_CONDICION = "condicion";

const VALORES_INICIALES = CAMPOS_CONDICION_CRONICA.reduce((valores, campo) => {
  valores[campo.id] = "";
  return valores;
}, {});

/**
 * Que puede hacer un rol con las condiciones cronicas de un paciente. La restriccion real es RLS.
 *
 * @param {string} rol Valor de `ROLES`.
 * @returns {{ puedeVer: boolean, puedeRegistrar: boolean, puedeEditar: boolean,
 *   puedeQuitar: boolean }}
 */
export function permisosDeCondiciones(rol) {
  return {
    puedeVer: puedeVerCondiciones(rol),
    puedeRegistrar: puedeRegistrarCondicion(rol),
    puedeEditar: puedeEditarCondicion(rol),
    puedeQuitar: puedeQuitarCondicion(rol),
  };
}

/**
 * Condiciones cronicas de un paciente: listar, agregar, corregir, marcar resuelta y quitar, y dar de
 * alta en el catalogo una condicion que falte.
 *
 * @param {string} pacienteId
 * @param {object} [opciones]
 * @param {string} [opciones.rol] Rol de la sesion; decide `permisos`.
 * @returns {object} `{ condiciones, campos, valores, errores, error, errorDeAlta, enviando,
 *   cargando, permisos, setCampo, agregar, marcarResuelta, recargar, catalogos, ... }`. Las acciones
 *   devuelven `{ ok }` y dejan el motivo de un fallo en `errorDeAlta`.
 */
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

  // Solo las condiciones vigentes: una retirada del catalogo (es_vigente = FALSE, 00115) deja de
  // ofrecerse al asignar, aunque siga visible en las fichas que ya la citan.
  //
  // Se lee `respuesta.condiciones` y nada mas. Antes habia un `?? respuesta.catalogo ?? []`
  // detras: `catalogo` no es una clave que obtenerCatalogoDeCondiciones devuelva -- nunca lo fue
  // --, asi que lo unico que podia hacer era tapar en silencio un cambio de contrato con una
  // lista vacia. Es justo lo que AGENTS.md prohibe y lo que vigila npm run verificar:contratos.
  const cargarCatalogo = useCallback(async () => {
    const respuesta = await obtenerCatalogoDeCondiciones({ soloVigentes: true });
    setCatalogo(respuesta.condiciones.map((fila) => ({ value: fila.id, label: fila.nombre })));
    return respuesta.condiciones;
  }, []);

  useEffect(() => {
    let vigente = true;
    obtenerCatalogoDeCondiciones({ soloVigentes: true }).then((respuesta) => {
      if (!vigente) return;
      setCatalogo(respuesta.condiciones.map((fila) => ({ value: fila.id, label: fila.nombre })));
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

  const elegirCondicion = useCallback(
    (condicionId) => setCampo(CAMPO_CONDICION, condicionId),
    [setCampo],
  );

  // Alta de una condicion que el catalogo no trae, sin salir de la ficha (issue #850). Recarga el
  // catalogo y deja elegida la recien creada, que es lo unico especifico de esta pantalla.
  const altaEnLinea = useAltaDeCondicionEnLinea({
    rol,
    opciones: catalogo,
    alCrear: async (condicion) => {
      await cargarCatalogo();
      elegirCondicion(condicion?.id);
    },
    alElegirExistente: elegirCondicion,
  });

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

  /** Corrige la fecha de diagnostico y/o las notas de un padecimiento ya asociado. */
  const corregir = useCallback(
    async (id, cambios) => {
      // Solo viaja lo que la correccion deja cambiar: el formulario tambien lleva, de solo
      // lectura, la condicion y el estado (issue #840, B1).
      const editables = Object.fromEntries(
        idsEditables(CAMPOS_CORRECCION_CONDICION)
          .filter((campo) => cambios?.[campo] !== undefined)
          .map((campo) => [campo, cambios[campo]]),
      );

      setEnviando(true);
      const resultado = await actualizarCondicion(id, editables);
      setEnviando(false);

      if (resultado.error || Object.keys(resultado.errores ?? {}).length > 0) {
        return { ok: false, errores: resultado.errores, error: resultado.error };
      }
      await cargar();
      return { ok: true, condicion: resultado.condicion };
    },
    [cargar],
  );

  return {
    condiciones,
    campos: CAMPOS_CONDICION_CRONICA,
    camposCorreccion: CAMPOS_CORRECCION_CONDICION,
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
    corregir,
    recargar: cargar,
    recargarCatalogo: cargarCatalogo,
    // Alta en linea del catalogo (issue #850). Se reexporta con nombres que dicen de que catalogo
    // hablan, igual que useRegistroPaciente.js hace con la comunidad: en una pantalla con dos
    // altas encima, "puedeCrear" a secas no dice cual.
    puedeCrearCondicion: altaEnLinea.puedeCrear,
    registrarCondicion: altaEnLinea.crear,
    erroresCondicionNueva: altaEnLinea.errores,
    creandoCondicion: altaEnLinea.creando,
    catalogos: {
      condicionesCronicas: catalogo,
      estadosCondicionCronica: OPCIONES_ESTADO_CONDICION,
    },
  };
}
