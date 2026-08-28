// Consultas de Supabase del catalogo territorial: departamentos, municipios y comunidades.
//
// Excepcion de alcance autorizada para el issue #179 (ver PLAN.md, seccion 7, decision 6):
// jornadas/api.js declara explicitamente no ser dueño de estas tablas
// (useJornadasKanban.js documenta el hueco), y la cascada del criterio 2 necesita leer las tres,
// no una -- meterlas en jornadas/api.js habria contradicho su comentario de cabecera de forma
// insostenible. Este archivo es el unico lugar del monorepo que lee departamentos, municipios y
// comunidades. pacientes/filtros.js y pacientes/campos.js tienen el mismo
// `opcionesDesde: 'comunidades'` sin resolver (mismo hueco); este modulo les sirve igual, aunque
// pacientes/ no se toca en este issue.
//
// departamentos.id y municipios.id son INT (00006_departamentos_municipios.sql), no UUID: son
// el catalogo geografico oficial de Guatemala, con ids ya fijados por seed.sql, no una tabla
// nueva del proyecto. comunidades.id si es UUID (00008_ajustes_departamentos_municipios.sql).
//
// La migracion 00073 completo el GRANT SELECT que le faltaba a departamentos y municipios para
// `authenticated` (00006 ya tenia la politica de lectura publica desde el principio, issue
// #406); comunidades ya tenia su GRANT desde 00041.
//
// Todas las funciones devuelven `{ dato, error }` en vez de lanzar, igual que supabase-js: quien
// las consume es un hook que tiene que reflejar el fallo en pantalla, no reventar el render.

import { obtenerSupabase } from "../api/cliente.js";
import { normalizarError } from "../api/errores-de-supabase.js";

const COLUMNAS_DEPARTAMENTO = ["id", "nombre"].join(", ");

const COLUMNAS_MUNICIPIO = ["id", "nombre", "departamentoId:departamento_id"].join(", ");

const COLUMNAS_COMUNIDAD = ["id", "nombre", "municipioId:municipio_id"].join(", ");

// Comunidad con su municipio embebido, solo para obtenerComunidad(): resuelve la cascada
// completa al editar una jornada existente. La fila de jornadas trae comunidadId pero no
// municipioId ni departamentoId (ver jornadas/api.js, COLUMNAS_DE_JORNADA), y sin ellos no hay
// forma de preseleccionar los dos primeros pasos del selector en cascada.
const COLUMNAS_COMUNIDAD_CON_TERRITORIO = [
  "id",
  "nombre",
  "municipioId:municipio_id",
  "municipio:municipios(departamentoId:departamento_id)",
].join(", ");

/**
 * Lista los departamentos de Guatemala (22 filas en `seed.sql`).
 *
 * @returns {Promise<{ departamentos: object[], error: object|null }>}
 */
export async function listarDepartamentos() {
  try {
    const { data, error } = await obtenerSupabase()
      .from("departamentos")
      .select(COLUMNAS_DEPARTAMENTO)
      .order("nombre", { ascending: true });

    if (error) return { departamentos: [], error: normalizarError(error) };
    return { departamentos: data ?? [], error: null };
  } catch (error) {
    return { departamentos: [], error: normalizarError(error) };
  }
}

/**
 * Lista los municipios de un departamento. Sin `departamentoId` devuelve los 340 completos: la
 * cascada del formulario de jornada siempre lo pasa, pero no hay motivo para negarlo a quien no
 * lo necesite.
 *
 * @param {{ departamentoId?: number|string }} [filtros]
 * @returns {Promise<{ municipios: object[], error: object|null }>}
 */
export async function listarMunicipios({ departamentoId } = {}) {
  try {
    let consulta = obtenerSupabase()
      .from("municipios")
      .select(COLUMNAS_MUNICIPIO)
      .order("nombre", { ascending: true });

    if (departamentoId) consulta = consulta.eq("departamento_id", departamentoId);

    const { data, error } = await consulta;

    if (error) return { municipios: [], error: normalizarError(error) };
    return { municipios: data ?? [], error: null };
  } catch (error) {
    return { municipios: [], error: normalizarError(error) };
  }
}

/**
 * Lista las comunidades de un municipio. Sin `municipioId` devuelve todas las que existan.
 *
 * @param {{ municipioId?: number|string }} [filtros]
 * @returns {Promise<{ comunidades: object[], error: object|null }>}
 */
export async function listarComunidades({ municipioId } = {}) {
  try {
    let consulta = obtenerSupabase()
      .from("comunidades")
      .select(COLUMNAS_COMUNIDAD)
      .order("nombre", { ascending: true });

    if (municipioId) consulta = consulta.eq("municipio_id", municipioId);

    const { data, error } = await consulta;

    if (error) return { comunidades: [], error: normalizarError(error) };
    return { comunidades: data ?? [], error: null };
  } catch (error) {
    return { comunidades: [], error: normalizarError(error) };
  }
}

/**
 * Lee una comunidad con su municipio y departamento embebidos.
 *
 * Existe solo para preseleccionar la cascada completa al editar una jornada existente (issue
 * #179): la fila de jornadas solo trae `comunidadId`, nunca `municipioId` ni `departamentoId`
 * (ver jornadas/api.js). `comunidad` llega en null sin error cuando la fila no existe o cuando
 * RLS no deja verla.
 *
 * @param {string} id UUID de la comunidad.
 * @returns {Promise<{ comunidad: { id: string, nombre: string, municipioId: number,
 *   departamentoId: number|null }|null, error: object|null }>}
 */
export async function obtenerComunidad(id) {
  if (!id) return { comunidad: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("comunidades")
      .select(COLUMNAS_COMUNIDAD_CON_TERRITORIO)
      .eq("id", id)
      .maybeSingle();

    if (error) return { comunidad: null, error: normalizarError(error) };
    if (!data) return { comunidad: null, error: null };

    return {
      comunidad: {
        id: data.id,
        nombre: data.nombre,
        municipioId: data.municipioId,
        departamentoId: data.municipio?.departamentoId ?? null,
      },
      error: null,
    };
  } catch (error) {
    return { comunidad: null, error: normalizarError(error) };
  }
}
