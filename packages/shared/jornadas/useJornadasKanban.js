// View model del tablero kanban de jornadas (issue #178).
//
// /jornadas es una sola pantalla -el kanban de tres etapas que describe
// docs/ARQUITECTURA-FRONTEND.md:19-21 y que ya rotula el placeholder de JornadasPage.jsx-, no un
// listado separado: ver PLAN.md, seccion 2, pregunta 1, decision (A). Este hook construye la
// parte de mostrar y filtrar ese tablero; el arrastre de tarjetas (onMover de KanbanBoard, ya
// soportado por cambiarEstadoJornada()) queda para una issue posterior del rango #179-#183 y no
// se conecta aqui.
//
// No llama a useSesion() por su cuenta: recibe `rol` de quien lo usa (en la web,
// useSesionCompartida()), mismo motivo que usePerfilPropio() documenta en usuarios/ para no
// abrir una segunda suscripcion a la sesion.

import { useCallback, useEffect, useMemo, useState } from "react";

import { contarPacientesAtendidosPorJornada, listarJornadas } from "./api.js";
import { FILTROS_JORNADA_VACIOS, OPCIONES_ESTADO_JORNADA } from "./filtros.js";
import { permisosDeJornadas } from "./permisos.js";

/**
 * Traduce el estado de filtros de la pantalla a los parametros que listarJornadas() (#170)
 * entiende. `busqueda` no viaja: no es parte de FILTROS_JORNADA_VACIOS (ver filtros.js) porque
 * listarJornadas() no acepta ningun parametro de busqueda de texto.
 */
function aFiltrosDeApi(filtros = {}) {
  return {
    estado: filtros.estado || undefined,
    comunidad: filtros.comunidad || undefined,
    fechaInicio: filtros.rangoFecha?.min || undefined,
    fechaFin: filtros.rangoFecha?.max || undefined,
  };
}

/**
 * Catalogo de comunidades para el filtro `comunidad`, derivado de las jornadas ya cargadas.
 *
 * No existe en packages/shared una funcion que liste la tabla comunidades (ni jornadas/api.js
 * declara ser dueño de ella), pero listarJornadas() ya trae `comunidadId` y
 * `comunidad: comunidades(nombre)` embebidos en cada fila (api.js:52,63): los pares (id, nombre)
 * salen de ahi sin una consulta nueva. Una jornada cuya comunidad RLS no deja ver llega con el
 * embed en null (api.js:44-45) y se omite del catalogo, no como una entrada rota.
 *
 * @param {object[]} jornadas
 * @returns {{ valor: string, etiqueta: string }[]}
 */
export function catalogoComunidadesDesde(jornadas = []) {
  const mapa = new Map();
  for (const jornada of jornadas) {
    if (jornada.comunidadId && jornada.comunidad?.nombre && !mapa.has(jornada.comunidadId)) {
      mapa.set(jornada.comunidadId, jornada.comunidad.nombre);
    }
  }
  return Array.from(mapa, ([valor, etiqueta]) => ({ valor, etiqueta })).sort((a, b) =>
    a.etiqueta.localeCompare(b.etiqueta, "es"),
  );
}

/**
 * Arma la tarjeta de una jornada con exactamente los seis datos del criterio 1 de #178: nombre,
 * fecha, comunidad, responsable, estado y pacientes atendidos. `codigo` y `cupoEstimado` existen
 * en COLUMNAS_JORNADA pero esta pantalla no los pinta (ver columnas.js).
 *
 * `pacientesAtendidos` solo se agrega cuando `pacientesPorJornada` trae una fila para esta
 * jornada: una jornada ausente de ese mapa (medico o voluntario, sin SELECT sobre
 * vista_reporte_impacto, 00064) se queda sin la clave, para que la pantalla pinte un guion en
 * vez de un 0 que afirmaria una atencion que no se puede confirmar.
 */
function armarTarjeta(jornada, pacientesPorJornada) {
  const tarjeta = {
    id: jornada.id,
    nombre: jornada.nombre,
    fecha: jornada.fecha,
    comunidad: jornada.comunidad?.nombre ?? "",
    responsable: [jornada.responsable?.nombres, jornada.responsable?.apellidos]
      .filter(Boolean)
      .join(" "),
    estado: jornada.estado,
  };

  if (Object.prototype.hasOwnProperty.call(pacientesPorJornada, jornada.id)) {
    tarjeta.pacientesAtendidos = pacientesPorJornada[jornada.id];
  }

  return tarjeta;
}

/**
 * Agrupa las jornadas en columnas de KanbanBoard, una por valor de OPCIONES_ESTADO_JORNADA
 * (filtros.js), en el mismo orden en que ese descriptor las declara. No hay una lista de estados
 * separada a mano: agregar o quitar un valor del enum solo requiere tocar ese descriptor.
 *
 * @param {object[]} jornadas Filas de listarJornadas().
 * @param {Record<string, number>} pacientesPorJornada De contarPacientesAtendidosPorJornada().
 * @returns {{ id: string, titulo: string, tarjetas: object[] }[]}
 */
export function agruparJornadasPorEstado(jornadas = [], pacientesPorJornada = {}) {
  const columnas = OPCIONES_ESTADO_JORNADA.map((opcion) => ({
    id: opcion.valor,
    titulo: opcion.etiqueta,
    tarjetas: [],
  }));
  const columnaPorEstado = new Map(columnas.map((columna) => [columna.id, columna]));

  for (const jornada of jornadas) {
    const columna = columnaPorEstado.get(jornada.estado);
    if (!columna) continue;
    columna.tarjetas.push(armarTarjeta(jornada, pacientesPorJornada));
  }

  return columnas;
}

/**
 * View model del tablero de jornadas, compartido por la pantalla web (#178) y la futura movil
 * (#186): ninguna decision de aqui abajo depende de la plataforma.
 *
 * `listarJornadas()` ya ordena por fecha ascendente (api.js:182-184); dentro de cada columna eso
 * ya deja primero la jornada mas proxima, que es lo que agrupar por estado necesita del criterio
 * 3 sin tocar esa funcion (#170, ya cerrada).
 *
 * @param {string} [rol] Rol de la sesion actual (useSesionCompartida().rol en la web), para
 *   resolver `puedeCrear` con permisosDeJornadas(). Un rol ausente resuelve a `puedeCrear: false`,
 *   igual que permisosDeJornadas(undefined).
 */
export function useJornadasKanban(rol) {
  const [filtros, setFiltros] = useState(FILTROS_JORNADA_VACIOS);
  const [jornadas, setJornadas] = useState([]);
  const [comunidades, setComunidades] = useState([]);
  const [pacientesPorJornada, setPacientesPorJornada] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const { jornadas: filas, error: errorDeLista } = await listarJornadas(aFiltrosDeApi(filtros));

    if (errorDeLista) {
      setJornadas([]);
      setPacientesPorJornada({});
      setError(errorDeLista);
      setCargando(false);
      return;
    }

    setJornadas(filas);
    // El catalogo de comunidades se fija una sola vez, con la primera carga (filtros arranca en
    // FILTROS_JORNADA_VACIOS, sin filtrar). Recargar por un cambio de filtro no debe vaciar las
    // opciones del propio selector de comunidad.
    setComunidades((anteriores) =>
      anteriores.length > 0 ? anteriores : catalogoComunidadesDesde(filas),
    );

    // Dato de contexto, no el contenido de la pantalla: si esta consulta falla, el tablero se
    // dibuja igual y cada tarjeta queda sin `pacientesAtendidos` (guion), nunca en cero.
    const { conteos } = await contarPacientesAtendidosPorJornada(
      filas.map((jornada) => jornada.id),
    );
    setPacientesPorJornada(conteos);
    setCargando(false);
  }, [filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const setFiltro = useCallback((id, valor) => {
    setFiltros((anteriores) => ({ ...anteriores, [id]: valor }));
  }, []);

  const limpiarFiltros = useCallback(() => {
    setFiltros(FILTROS_JORNADA_VACIOS);
  }, []);

  const columnas = useMemo(
    () => agruparJornadasPorEstado(jornadas, pacientesPorJornada),
    [jornadas, pacientesPorJornada],
  );

  return {
    columnas,
    filtros,
    setFiltro,
    limpiarFiltros,
    cargando,
    error,
    recargar: cargar,
    total: jornadas.length,
    // Catalogos que FilterBar resuelve por `opcionesDesde` (FILTROS_JORNADA.comunidad).
    catalogos: { comunidades },
    puedeCrear: permisosDeJornadas(rol).puedeCrear,
  };
}
