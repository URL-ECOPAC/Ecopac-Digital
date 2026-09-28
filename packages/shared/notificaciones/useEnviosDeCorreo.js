import { useCallback, useEffect, useMemo, useState } from "react";

import { TIPOS_DE_FILTRO, TIPOS_DE_PRESENTACION } from "../descriptores.js";
import { ETIQUETAS_CATEGORIA_NOTIFICACION } from "../enums.js";
import { ESTADOS_DE_CORREO, ETIQUETAS_ESTADO_DE_CORREO, listarEnviosDeCorreo } from "./api.js";

/** Columnas de la seccion "Correos de notificaciones" de la bitacora. */
export const COLUMNAS_ENVIOS_DE_CORREO = [
  {
    id: "createdAt",
    label: "Fecha y hora",
    tipo: TIPOS_DE_PRESENTACION.FECHA_HORA,
  },
  { id: "titulo", label: "Notificación", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  {
    id: "categoria",
    label: "Categoría",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    etiquetasDesde: "categorias",
  },
  { id: "destinatarioNombre", label: "Para", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  {
    id: "estadoCorreo",
    label: "Correo",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    etiquetasDesde: "estadosDeCorreo",
  },
  { id: "correoError", label: "Motivo del fallo", tipo: TIPOS_DE_PRESENTACION.TEXTO },
];

/** Filtro por estado del correo. */
export const FILTROS_ENVIOS_DE_CORREO = [
  {
    id: "estado",
    label: "Estado del correo",
    tipo: TIPOS_DE_FILTRO.SELECT,
    opcionesDesde: "estadosDeCorreo",
  },
];

const aOpciones = (etiquetas) =>
  Object.entries(etiquetas).map(([value, label]) => ({ value, label }));

/**
 * View model de la seccion de envios de correo de la bitacora (00149): si el correo de cada
 * notificacion salio, fallo o sigue pendiente, y por que fallo.
 *
 * @param {{ activo?: boolean }} [opciones] `activo` en false no consulta nada: la seccion se pide
 *   al abrirla, no al entrar a la bitacora.
 *
 * @returns {object} Con: columnas, filtrosDisponibles, envios, totalFallidos, filtros, setFiltro, limpiarFiltros, hayFiltros, catalogos, cargando, error, recargar.
 */
export function useEnviosDeCorreo({ activo = true } = {}) {
  const [envios, setEnvios] = useState([]);
  const [filtros, setFiltros] = useState({ estado: "" });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    if (!activo) return;
    setCargando(true);
    const respuesta = await listarEnviosDeCorreo({ estado: filtros.estado || undefined });
    setEnvios(respuesta.envios);
    setError(respuesta.error);
    setCargando(false);
  }, [activo, filtros.estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const catalogos = useMemo(
    () => ({
      estadosDeCorreo: aOpciones(ETIQUETAS_ESTADO_DE_CORREO),
      categorias: aOpciones(ETIQUETAS_CATEGORIA_NOTIFICACION),
    }),
    [],
  );

  const fallidos = envios.filter((envio) => envio.estadoCorreo === ESTADOS_DE_CORREO.FALLIDO);

  return {
    columnas: COLUMNAS_ENVIOS_DE_CORREO,
    filtrosDisponibles: FILTROS_ENVIOS_DE_CORREO,
    envios,
    totalFallidos: fallidos.length,
    filtros,
    setFiltro: (id, valor) => setFiltros((anteriores) => ({ ...anteriores, [id]: valor })),
    limpiarFiltros: () => setFiltros({ estado: "" }),
    hayFiltros: Boolean(filtros.estado),
    catalogos,
    cargando,
    error,
    recargar: cargar,
  };
}
