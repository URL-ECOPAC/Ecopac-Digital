import { useCallback, useEffect, useMemo, useState } from "react";

import { contarJornadasPorPerfil, listarCatalogoEspecialidades, listarUsuarios } from "./api.js";
import { ESTADOS_USUARIO, OPCIONES_ROL } from "./campos.js";
import { FILTROS_USUARIO_VACIOS } from "./filtros.js";

export const USUARIOS_POR_PAGINA = 20;

/**
 * Nombre para mostrar de un perfil. Es una funcion aparte y exportada, y no codigo dentro del
 * hook, por el mismo motivo que haVencidoPorInactividad() en hooks/: asi se prueba sin montar
 * un componente, que este paquete no puede hacer (vitest corre con environment "node").
 *
 * @param {{ nombres?: string, apellidos?: string }} perfil
 * @returns {string}
 */
export function nombreCompletoDe(perfil = {}) {
  return [perfil.nombres, perfil.apellidos].filter(Boolean).join(" ").trim();
}

/**
 * Combina los perfiles de la pagina con el conteo de jornadas de cada uno.
 *
 * Un perfil que no aparece en `jornadasPorPerfil` queda en cero, no en undefined: la columna
 * de jornadas tiene que mostrar un numero siempre.
 *
 * @param {object[]} usuarios Perfiles tal como llegan de listarUsuarios().
 * @param {object} jornadasPorPerfil Conteos de contarJornadasPorPerfil().
 * @returns {object[]}
 */
export function armarFilas(usuarios = [], jornadasPorPerfil = {}) {
  return usuarios.map((perfil) => ({
    ...perfil,
    nombreCompleto: nombreCompletoDe(perfil),
    jornadas: jornadasPorPerfil[perfil.id] ?? 0,
  }));
}

/**
 * Cuantas paginas hacen falta para `total` filas. Nunca menos de una: una lista vacia sigue
 * siendo la pagina 1, no la pagina 0.
 *
 * @param {number} total Filas que cumplen los filtros, sin paginar.
 * @param {number} porPagina
 * @returns {number}
 */
export function calcularPaginas(total, porPagina) {
  const tamano = Math.max(1, Number(porPagina) || USUARIOS_POR_PAGINA);
  return Math.max(1, Math.ceil((Number(total) || 0) / tamano));
}

/**
 * View model del listado de personal, compartido por la pantalla web (#105) y la movil (#272).
 *
 * Aqui vive todo lo que no es JSX: el estado de los filtros, la paginacion, la carga, el
 * armado de cada fila y los catalogos que alimentan los selects. La pantalla solo dibuja lo
 * que este hook le entrega, sin decidir nada (criterio 7 de la #105).
 *
 * La lista se pide paginada a listarUsuarios(): el criterio 4 pide explicitamente no cargar
 * todos los perfiles de una vez. El conteo de jornadas de cada persona se resuelve aparte, con
 * una sola consulta para toda la pagina, para no disparar una llamada por fila.
 *
 * Cambiar un filtro devuelve a la pagina 1: mantenerse en la pagina 5 despues de filtrar deja
 * la lista vacia sin explicacion.
 *
 * Quien puede ver esta pantalla NO se decide aqui: lo hace el guard de rutas de la #52 y, en
 * ultima instancia, la politica RLS de perfiles (00038), que a quien no es administrador solo
 * le devuelve su propia fila.
 *
 * @param {{ porPagina?: number }} [opciones]
 */
export function useUsuariosListado({ porPagina = USUARIOS_POR_PAGINA } = {}) {
  const [filtros, setFiltros] = useState(FILTROS_USUARIO_VACIOS);
  const [pagina, setPagina] = useState(1);
  const [usuarios, setUsuarios] = useState([]);
  const [total, setTotal] = useState(0);
  const [jornadasPorPerfil, setJornadasPorPerfil] = useState({});
  const [especialidades, setEspecialidades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const { usuarios: filas, total: cuantos, error: errorDeLista } = await listarUsuarios({
      ...filtros,
      limite: porPagina,
      pagina,
    });

    if (errorDeLista) {
      setUsuarios([]);
      setTotal(0);
      setJornadasPorPerfil({});
      setError(errorDeLista);
      setCargando(false);
      return;
    }

    setUsuarios(filas);
    setTotal(cuantos);

    // El conteo de jornadas no bloquea la tabla: si falla, la lista se dibuja igual y esa
    // columna queda en cero. Es un dato de contexto, no el contenido de la pantalla.
    const { conteos } = await contarJornadasPorPerfil(filas.map((perfil) => perfil.id));
    setJornadasPorPerfil(conteos);
    setCargando(false);
  }, [filtros, pagina, porPagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    let vigente = true;
    listarCatalogoEspecialidades().then(({ especialidades: catalogo }) => {
      if (vigente) setEspecialidades(catalogo ?? []);
    });
    return () => {
      vigente = false;
    };
  }, []);

  const setFiltro = useCallback((id, valor) => {
    setPagina(1);
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor }));
  }, []);

  const limpiarFiltros = useCallback(() => {
    setPagina(1);
    setFiltros(FILTROS_USUARIO_VACIOS);
  }, []);

  const filas = useMemo(
    () => armarFilas(usuarios, jornadasPorPerfil),
    [usuarios, jornadasPorPerfil],
  );

  const paginas = calcularPaginas(total, porPagina);

  return {
    filas,
    filtros,
    setFiltro,
    limpiarFiltros,
    cargando,
    error,
    recargar: cargar,
    pagina,
    paginas,
    total,
    hayPaginaAnterior: pagina > 1,
    hayPaginaSiguiente: pagina < paginas,
    irAPaginaAnterior: () => setPagina((actual) => Math.max(1, actual - 1)),
    irAPaginaSiguiente: () => setPagina((actual) => Math.min(paginas, actual + 1)),
    // Catalogos que FilterBar y DataList resuelven por nombre desde los descriptores.
    //
    // ESTADOS_USUARIO viaja tal cual, sin mapear: su `valor` es el booleano que guarda
    // perfiles.activo, que es lo que la columna de estado compara, y su `clave` es la que
    // indexa statusColors. El filtro tambien lo acepta asi, porque aFiltroDeActivo() de api.js
    // reconoce booleanos. Mapearlo a la clave romperia la columna.
    catalogos: {
      roles: OPCIONES_ROL,
      estadoUsuario: ESTADOS_USUARIO,
      especialidades,
    },
  };
}
