// Filtros comunes de las pantallas de reporte (issue #208): periodo, comunidad, jornada y
// proyecto, con presets de rango, retardo antes de consultar y serializacion hacia/desde la URL.
//
// packages/shared/reportes/filtros.js (issue #289) ya declara la forma DECLARATIVA de estos
// filtros (FILTROS_REPORTES), pero deja fuera a proposito la logica con estado: que preset esta
// activo, como se resuelve "este mes" a fechas concretas, y homogeneizar que cada API de reporte
// recibe el rango con un nombre distinto. Eso es lo que vive aca.
//
// OJO CON EL SHAPE DE `periodo`. FilterBar (apps/web/src/components/FilterBar.jsx y su
// equivalente movil) tiene hardcodeado que un filtro TIPOS_DE_FILTRO.RANGO viaja como
// { min, max } -es el mismo contrato que ya usa rangoEdad en pacientes/filtros.js- y DateField
// entrega/recibe esos limites como cadena ISO "YYYY-MM-DD". FILTROS_REPORTES_VACIOS
// (filtros.js, issue #289) declaraba `periodo: { fechaInicio, fechaFin }`, que FilterBar no
// sabia leer ni escribir -nunca se habia probado contra el componente real-; se corrigio en el
// mismo PR de esta issue, asi que este archivo ya puede importarla directo en vez de mantener
// su propia copia. `fechaInicio`/`fechaFin` solo aparecen como nombres de parametro al
// serializar a la URL o al traducir para cada API especifica de reporte, nunca como la forma
// del estado.
//
// Este hook NO llama a obtenerIndicadoresImpacto() ni a ninguna otra API de reporte: eso sigue
// siendo trabajo del hook de cada pantalla (#211/#212/#213), que consume filtrosAplicados y las
// funciones aParametrosDe*() de aca abajo para armar su propia consulta.

import { useCallback, useEffect, useRef, useState } from "react";

import { listarJornadas } from "../jornadas/api.js";
import { listarProyectos } from "../proyectos/api.js";
import { listarComunidades } from "../territorio/api.js";
import { FILTROS_REPORTES_VACIOS } from "./filtros.js";

/** Milisegundos de inactividad antes de aplicar los filtros. Se baja en las pruebas. */
export const RETARDO_DE_FILTROS_MS = 500;

export const PRESETS_DE_RANGO = {
  ESTE_MES: "este_mes",
  ULTIMO_TRIMESTRE: "ultimo_trimestre",
  ESTE_ANIO: "este_anio",
  PERSONALIZADO: "personalizado",
};

function conDosDigitos(numero) {
  return String(numero).padStart(2, "0");
}

/** Convierte un Date a "YYYY-MM-DD" leyendo sus componentes locales, sin pasar por UTC. */
function aCadenaFecha(fecha) {
  return `${fecha.getFullYear()}-${conDosDigitos(fecha.getMonth() + 1)}-${conDosDigitos(fecha.getDate())}`;
}

/**
 * Resuelve un preset de rango a fechas concretas.
 *
 * Los tres presets con nombre son "a la fecha": arrancan en el primer dia del periodo que
 * corresponda y terminan hoy, no al final del periodo -un reporte filtra datos que ya
 * ocurrieron, y un `max` en el futuro no excluye nada que no excluya ya `hoy`-.
 * `ULTIMO_TRIMESTRE` es una ventana movil de tres meses hacia atras desde hoy, no el trimestre
 * calendario anterior: es coherente con que los otros dos presets tambien sean "a la fecha" y no
 * saltan de un criterio a otro segun el preset. `PERSONALIZADO` no calcula nada: el rango a mano
 * lo pone la persona.
 *
 * @param {string} preset Uno de PRESETS_DE_RANGO.
 * @param {Date} [hoy] Entra por parametro para poder fijarlo en la prueba.
 * @returns {{ min: string|null, max: string|null }}
 */
export function resolverRangoDePreset(preset, hoy = new Date()) {
  const max = aCadenaFecha(hoy);

  switch (preset) {
    case PRESETS_DE_RANGO.ESTE_MES:
      return { min: aCadenaFecha(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), max };
    case PRESETS_DE_RANGO.ULTIMO_TRIMESTRE:
      return {
        min: aCadenaFecha(new Date(hoy.getFullYear(), hoy.getMonth() - 3, hoy.getDate())),
        max,
      };
    case PRESETS_DE_RANGO.ESTE_ANIO:
      return { min: aCadenaFecha(new Date(hoy.getFullYear(), 0, 1)), max };
    default:
      return { min: null, max: null };
  }
}

/**
 * Serializa los filtros a un objeto plano de strings, listo para volcar en una URLSearchParams.
 *
 * Pura a proposito: packages/shared no toca `window` ni conoce react-router (ver
 * docs/ARQUITECTURA-FRONTEND.md). La pantalla web es quien arma la URLSearchParams de verdad con
 * esto. Las claves nulas o vacias se omiten para que el link compartido quede corto y legible.
 *
 * @param {typeof FILTROS_REPORTES_VACIOS} valores
 * @param {string|null} [presetActivo]
 * @returns {Record<string, string>}
 */
export function serializarFiltrosReportes(valores, presetActivo = null) {
  const parametros = {};

  if (presetActivo) parametros.preset = presetActivo;
  if (valores?.periodo?.min) parametros.fechaInicio = valores.periodo.min;
  if (valores?.periodo?.max) parametros.fechaFin = valores.periodo.max;
  if (valores?.comunidad) parametros.comunidad = valores.comunidad;
  if (valores?.jornada) parametros.jornada = valores.jornada;
  if (valores?.proyecto) parametros.proyecto = valores.proyecto;

  return parametros;
}

/**
 * Lee un objeto plano de parametros (la pantalla web pasa `Object.fromEntries(searchParams)`,
 * nunca la instancia de URLSearchParams) y devuelve un estado de filtros valido, cayendo a
 * vacio ante cualquier valor faltante. Mismo criterio que resolverPestaniaDeFicha() en
 * pacientes/ficha.js: nunca deja pasar un parametro de URL sin validar hacia el estado.
 *
 * @param {Record<string, string>} [parametros]
 * @returns {{ valores: typeof FILTROS_REPORTES_VACIOS, presetActivo: string|null }}
 */
export function resolverFiltrosReportesDesdeParametros(parametros = {}) {
  const preset = Object.values(PRESETS_DE_RANGO).includes(parametros.preset)
    ? parametros.preset
    : null;

  return {
    valores: {
      periodo: {
        min: parametros.fechaInicio || null,
        max: parametros.fechaFin || null,
      },
      comunidad: parametros.comunidad || null,
      jornada: parametros.jornada || null,
      proyecto: parametros.proyecto || null,
    },
    presetActivo: preset,
  };
}

/**
 * Traduce filas de catalogo `{id, nombre}` a la forma `{label, value}` que espera el prop
 * `catalogos` de FilterBar. Mismo criterio que catalogoComunidadesDePacientes() en
 * pacientes/usePacientesListado.js.
 *
 * @param {object[]} filas
 * @param {{ valor?: string, etiqueta?: string }} [claves] Que columna de la fila alimenta cada lado.
 * @returns {Array<{ label: string, value: string }>}
 */
export function mapearCatalogoAOpciones(filas, { valor = "id", etiqueta = "nombre" } = {}) {
  return (filas ?? []).map((fila) => ({ value: fila[valor], label: fila[etiqueta] }));
}

/**
 * Traduce los filtros aplicados al shape que espera obtenerIndicadoresImpacto()
 * (packages/shared/reportes/api.js): `periodo` anidado con `fechaInicio`/`fechaFin`.
 *
 * @param {typeof FILTROS_REPORTES_VACIOS} filtrosAplicados
 */
export function aParametrosDeIndicadoresImpacto(filtrosAplicados) {
  return {
    periodo: {
      fechaInicio: filtrosAplicados?.periodo?.min ?? null,
      fechaFin: filtrosAplicados?.periodo?.max ?? null,
    },
    comunidad: filtrosAplicados?.comunidad ?? undefined,
    jornada: filtrosAplicados?.jornada ?? undefined,
    proyecto: filtrosAplicados?.proyecto ?? undefined,
  };
}

/**
 * Traduce los filtros aplicados al shape que espera obtenerReportePacientesAtendidos()
 * (packages/shared/reportes/pacientes.api.js): rango plano (`desde`/`hasta`, no `periodo`) y
 * SIN `proyecto` -esa API no admite ese filtro hoy; no es un olvido de esta funcion, es un
 * limite real de la API que quien trabaje #211 tendra que resolver si hace falta filtrar por
 * proyecto ahi tambien-.
 *
 * @param {typeof FILTROS_REPORTES_VACIOS} filtrosAplicados
 */
export function aParametrosDeReportePacientes(filtrosAplicados) {
  return {
    desde: filtrosAplicados?.periodo?.min ?? undefined,
    hasta: filtrosAplicados?.periodo?.max ?? undefined,
    comunidad: filtrosAplicados?.comunidad ?? undefined,
    jornada: filtrosAplicados?.jornada ?? undefined,
  };
}

/**
 * View model de la barra de filtros comun a las pantallas de reporte.
 *
 * Funciona igual en web y en movil: no toca `document`, `window` ni ninguna API de plataforma,
 * solo `setTimeout` (igual que useBusquedaPacientes.js, el ejemplar de referencia para un hook
 * con retardo).
 *
 * Guarda dos copias del estado: `valores` es el borrador que ata directo a FilterBar (cada
 * `setFiltro` lo actualiza al toque, para que la persona vea lo que esta escribiendo), y
 * `filtrosAplicados` es lo que cualquier hook de pantalla de reporte debe usar para consultar.
 * `valores` se copia a `filtrosAplicados` sola despues de `retardoMs` de inactividad, o de
 * inmediato si se llama a `aplicarFiltros()` -cubre el criterio de la issue de "no dispara
 * consultas hasta que el usuario confirma o pasa el retardo"-.
 *
 * @param {{ retardoMs?: number, valoresIniciales?: { valores: object, presetActivo: string|null } }} [opciones]
 */
export function useFiltrosReportes({ retardoMs = RETARDO_DE_FILTROS_MS, valoresIniciales } = {}) {
  const [valores, setValores] = useState(valoresIniciales?.valores ?? FILTROS_REPORTES_VACIOS);
  const [filtrosAplicados, setFiltrosAplicados] = useState(
    valoresIniciales?.valores ?? FILTROS_REPORTES_VACIOS,
  );
  const [presetActivo, setPresetActivo] = useState(valoresIniciales?.presetActivo ?? null);

  const [catalogos, setCatalogos] = useState({ comunidades: [], jornadas: [], proyectos: [] });
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [errorDeCatalogos, setErrorDeCatalogos] = useState(null);

  // El temporizador del retardo vive en una ref: cancelarlo no debe redibujar nada.
  const temporizador = useRef(null);

  const setFiltro = useCallback((id, valor) => {
    setValores((actuales) => ({ ...actuales, [id]: valor }));
    // Editar el periodo a mano rompe cualquier preset que estuviera activo. setPreset() de
    // abajo NO pasa por aca: si delegara, el valor final de presetActivo dependeria de en que
    // orden se llamen los dos setPresetActivo dentro del mismo batch de React, un acoplamiento
    // fragil que un reordenamiento futuro rompe en silencio.
    if (id === "periodo") setPresetActivo(PRESETS_DE_RANGO.PERSONALIZADO);
  }, []);

  const setPreset = useCallback((preset, hoy = new Date()) => {
    const rango = resolverRangoDePreset(preset, hoy);
    setValores((actuales) => ({ ...actuales, periodo: rango }));
    setPresetActivo(preset);
  }, []);

  const limpiarFiltro = useCallback((id) => {
    setValores((actuales) => ({ ...actuales, [id]: FILTROS_REPORTES_VACIOS[id] }));
    if (id === "periodo") setPresetActivo(null);
  }, []);

  const limpiarFiltros = useCallback(() => {
    setValores(FILTROS_REPORTES_VACIOS);
    setPresetActivo(null);
  }, []);

  const aplicarFiltros = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    setFiltrosAplicados(valores);
  }, [valores]);

  // Los filtros llegan como objeto nuevo en cada render; se compara por contenido para no
  // reprogramar el temporizador en cada redibujado sin cambios reales (mismo criterio que
  // useBusquedaPacientes.js con sus `filtros`).
  const claveDeValores = JSON.stringify(valores);

  useEffect(() => {
    temporizador.current = setTimeout(() => setFiltrosAplicados(valores), retardoMs);
    return () => clearTimeout(temporizador.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveDeValores, retardoMs]);

  useEffect(() => {
    let cancelado = false;

    async function cargarCatalogos() {
      setCargandoCatalogos(true);
      setErrorDeCatalogos(null);

      const [
        { comunidades, error: errorDeComunidades },
        { jornadas, error: errorDeJornadas },
        { proyectos, error: errorDeProyectos },
      ] = await Promise.all([listarComunidades(), listarJornadas(), listarProyectos()]);

      if (cancelado) return;

      const error = errorDeComunidades ?? errorDeJornadas ?? errorDeProyectos;
      if (error) setErrorDeCatalogos(error);

      setCatalogos({
        comunidades: mapearCatalogoAOpciones(comunidades),
        jornadas: mapearCatalogoAOpciones(jornadas),
        proyectos: mapearCatalogoAOpciones(proyectos),
      });
      setCargandoCatalogos(false);
    }

    cargarCatalogos();
    return () => {
      cancelado = true;
    };
  }, []);

  return {
    valores,
    filtrosAplicados,
    presetActivo,
    setFiltro,
    setPreset,
    limpiarFiltro,
    limpiarFiltros,
    aplicarFiltros,
    catalogos,
    cargandoCatalogos,
    errorDeCatalogos,
  };
}
