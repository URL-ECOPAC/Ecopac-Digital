// Consultas de Supabase del catalogo de medicamentos.
//
// packages/shared/api es la infraestructura del cliente; las consultas de cada modulo van en
// el api.js de su carpeta, como indica el encabezado de api/index.js. Este archivo es el unico
// lugar del monorepo que lee y escribe la tabla medicamentos. Se llama medicamentos.api.js y no
// api.js por el mismo motivo que principios-activos.api.js: inventario/ lo construye mas de una
// issue en paralelo (lotes, movimientos...); un api.js unico seria un iman de conflictos.
//
// Todas las funciones devuelven `{ dato, error }` en vez de lanzar, igual que supabase-js: quien
// las consume es un hook que tiene que reflejar el fallo en pantalla, no reventar el render.
//
// Ninguna funcion valida aqui quien puede crear, editar o desactivar: esa regla la aplican las
// politicas de 00034_politicas_rls_inventario.sql y las funciones de 00050_catalogo_medicamentos.sql
// (solo administrador), y un intento sin permiso vuelve como error 42501, que normalizarError()
// ya traduce. El cliente pregunta para dibujar, el servidor decide.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  normalizarError,
} from "../api/errores-de-supabase.js";

// Las columnas se enumeran en lugar de pedir "*" para que una columna nueva no empiece a viajar
// sola hasta el cliente.
const COLUMNAS_DEL_MEDICAMENTO = [
  "id",
  "nombre",
  "concentracion",
  "presentacion",
  "marca",
  "formaFarmaceutica:forma_farmaceutica",
  "esPediatrico:es_pediatrico",
  "activo",
  "createdAt:created_at",
  "updatedAt:updated_at",
].join(", ");

/**
 * Quita los acentos de un texto para compararlo contra nombre_normalizado.
 *
 * Calcado de principios-activos.api.js: mismo tratamiento (descomposicion NFD) y mismo motivo
 * (nombre_normalizado, 00046, se calcula con lower(public.f_unaccent(nombre)); ILIKE ignora
 * mayusculas por su cuenta pero no acentos).
 */
function quitarAcentos(texto) {
  return texto.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
}

/** Escapa los comodines de ILIKE (%, _) para que una busqueda literal no se interprete como patron. */
function escaparPatron(texto) {
  return texto.replace(/[%_]/g, " ").trim();
}

/** Traduce del camelCase de las pantallas al snake_case de la tabla, omitiendo lo no enviado. */
function aColumnasDeTabla(datos = {}) {
  const mapa = {
    nombre: "nombre",
    concentracion: "concentracion",
    presentacion: "presentacion",
    marca: "marca",
    formaFarmaceutica: "forma_farmaceutica",
    esPediatrico: "es_pediatrico",
  };

  const fila = {};
  for (const [campo, columna] of Object.entries(mapa)) {
    // Solo se envia lo que venga en el objeto: un update parcial no debe borrar lo que no toca.
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

/**
 * Traduce una fila de medicamentos en snake_case a las claves camelCase de
 * COLUMNAS_DEL_MEDICAMENTO.
 *
 * fn_registrar_medicamento retorna el tipo completo de la tabla (RETURNS medicamentos, 00050),
 * asi que entrega las columnas tal cual se llaman en Postgres. Las demas funciones de este
 * archivo piden las columnas con alias camelCase; este mapeo deja la fila recien registrada en
 * el mismo idioma que la que devuelven listarMedicamentos() o actualizarMedicamento().
 */
function aMedicamento(fila) {
  if (!fila) return null;

  return {
    id: fila.id,
    nombre: fila.nombre,
    concentracion: fila.concentracion,
    presentacion: fila.presentacion,
    marca: fila.marca,
    formaFarmaceutica: fila.forma_farmaceutica,
    esPediatrico: fila.es_pediatrico,
    activo: fila.activo,
    createdAt: fila.created_at,
    updatedAt: fila.updated_at,
  };
}

/**
 * Arma una consulta nueva sobre medicamentos con los filtros directos aplicados.
 *
 * Se construye desde cero cada vez que hace falta (nunca se reutiliza un query builder ya
 * encadenado): los de supabase-js no estan pensados para bifurcarse despues de armados.
 */
function consultaDeMedicamentos({ presentacion, esPediatrico, soloActivos = true } = {}) {
  let consulta = obtenerSupabase().from("medicamentos").select(COLUMNAS_DEL_MEDICAMENTO);

  if (soloActivos) consulta = consulta.eq("activo", true);
  if (presentacion) consulta = consulta.eq("presentacion", presentacion);
  if (typeof esPediatrico === "boolean") consulta = consulta.eq("es_pediatrico", esPediatrico);

  return consulta;
}

/**
 * Ids de los medicamentos cuyo principio activo coincide con el texto, sin distinguir acentos.
 *
 * Dos consultas encadenadas (principios_activos -> medicamento_principio) en vez de un JOIN
 * filtrado: PostgREST no combina limpiamente un OR sobre columnas propias de medicamentos con
 * un OR sobre una tabla embebida sin forzar un inner join, que excluiria del resultado a los
 * medicamentos que coinciden por nombre pero no tienen match por principio activo. Mismo
 * criterio "sin RPC solo para busqueda" que documenta 00046_catalogo_principios_activos.sql,
 * extendido al caso de dos tablas.
 */
async function idsPorPrincipioActivo(texto) {
  const supabase = obtenerSupabase();

  const { data: principios, error: errorPrincipios } = await supabase
    .from("principios_activos")
    .select("id")
    .ilike("nombre_normalizado", `%${texto}%`);
  if (errorPrincipios) throw errorPrincipios;
  if (!principios || principios.length === 0) return [];

  const { data: vinculos, error: errorVinculos } = await supabase
    .from("medicamento_principio")
    .select("medicamento_id")
    .in(
      "principio_id",
      principios.map((principio) => principio.id),
    );
  if (errorVinculos) throw errorVinculos;

  return [...new Set((vinculos ?? []).map((vinculo) => vinculo.medicamento_id))];
}

/**
 * Lista los medicamentos del catalogo, opcionalmente filtrados.
 *
 * `busqueda` compara contra nombre, marca y concentracion (mismo alcance que ya promete el
 * placeholder de FILTROS_MEDICAMENTOS: "Nombre, marca o concentracion") y tambien contra el
 * principio activo asociado, fusionando ambos resultados sin duplicar. `soloActivos` es true
 * por defecto: el catalogo no muestra medicamentos desactivados salvo que se pida lo contrario
 * explicitamente.
 *
 * @param {{ busqueda?: string, presentacion?: string, esPediatrico?: boolean, soloActivos?: boolean }} [filtros]
 * @returns {Promise<{ medicamentos: object[], error: object|null }>}
 */
export async function listarMedicamentos({
  busqueda,
  presentacion,
  esPediatrico,
  soloActivos = true,
} = {}) {
  try {
    const filtros = { presentacion, esPediatrico, soloActivos };
    const texto = typeof busqueda === "string" ? escaparPatron(quitarAcentos(busqueda)) : "";

    if (texto === "") {
      const { data, error } = await consultaDeMedicamentos(filtros).order("nombre", {
        ascending: true,
      });
      if (error) return { medicamentos: [], error: normalizarError(error) };
      return { medicamentos: data ?? [], error: null };
    }

    const [porTexto, idsDePrincipio] = await Promise.all([
      consultaDeMedicamentos(filtros).or(
        `nombre.ilike.%${texto}%,marca.ilike.%${texto}%,concentracion.ilike.%${texto}%`,
      ),
      idsPorPrincipioActivo(texto),
    ]);

    if (porTexto.error) return { medicamentos: [], error: normalizarError(porTexto.error) };

    let filasPorPrincipio = [];
    if (idsDePrincipio.length > 0) {
      const porPrincipio = await consultaDeMedicamentos(filtros).in("id", idsDePrincipio);
      if (porPrincipio.error) {
        return { medicamentos: [], error: normalizarError(porPrincipio.error) };
      }
      filasPorPrincipio = porPrincipio.data ?? [];
    }

    const combinados = new Map();
    for (const fila of [...(porTexto.data ?? []), ...filasPorPrincipio]) {
      combinados.set(fila.id, fila);
    }

    return {
      medicamentos: [...combinados.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      error: null,
    };
  } catch (error) {
    // idsPorPrincipioActivo lanza en vez de devolver { error }; un fallo de red tambien llega
    // aqui como excepcion del fetch.
    return { medicamentos: [], error: normalizarError(error) };
  }
}

/**
 * Registra un medicamento con sus principios activos en una sola transaccion
 * (fn_registrar_medicamento, migracion 00050): si algun principio_id no existe, o si el arreglo
 * viene vacio, no queda un medicamento huerfano sin principio activo.
 *
 * La combinacion nombre+concentracion+presentacion+marca no se repite: lo exige el UNIQUE de
 * medicamentos (00016), dentro de la misma funcion. La validacion amable de formulario (campos
 * vacios, largo maximo) queda para el hook que construya la pantalla, con CAMPOS_MEDICAMENTO de
 * campos.js, igual que el resto de modulos del repo -- salvo principiosActivosIds, que se
 * comprueba aqui porque un arreglo vacio produciria un error generico de base de datos en vez
 * de uno claro.
 *
 * @param {object} datos Campos en camelCase, los ids de CAMPOS_MEDICAMENTO, mas
 *   `principiosActivosIds` (arreglo de UUID, obligatorio: al menos uno).
 * @returns {Promise<{ medicamento: object|null, error: object|null }>}
 */
export async function registrarMedicamento(datos = {}) {
  const principiosActivosIds = Array.isArray(datos.principiosActivosIds)
    ? datos.principiosActivosIds
    : [];

  if (principiosActivosIds.length === 0) {
    return {
      medicamento: null,
      error: construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CAMPO_REQUERIDO),
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .rpc("fn_registrar_medicamento", {
        p_nombre: datos.nombre,
        p_concentracion: datos.concentracion,
        p_presentacion: datos.presentacion,
        p_marca: datos.marca,
        p_principios_ids: principiosActivosIds,
        p_forma_farmaceutica: datos.formaFarmaceutica ?? null,
        p_es_pediatrico: datos.esPediatrico ?? false,
      })
      .single();

    if (error) return { medicamento: null, error: normalizarError(error) };
    return { medicamento: aMedicamento(data), error: null };
  } catch (error) {
    return { medicamento: null, error: normalizarError(error) };
  }
}

/**
 * Actualiza los datos de un medicamento. No toca sus principios activos: editar esa relacion no
 * esta en los criterios de aceptacion de esta issue.
 *
 * @param {string} id UUID del medicamento.
 * @param {object} datos Campos en camelCase, los ids de CAMPOS_MEDICAMENTO.
 * @returns {Promise<{ medicamento: object|null, error: object|null }>}
 */
export async function actualizarMedicamento(id, datos) {
  const fila = aColumnasDeTabla(datos);
  if (Object.keys(fila).length === 0) return { medicamento: null, error: null };

  try {
    const { data, error } = await obtenerSupabase()
      .from("medicamentos")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DEL_MEDICAMENTO)
      .maybeSingle();

    if (error) return { medicamento: null, error: normalizarError(error) };
    return { medicamento: data ?? null, error: null };
  } catch (error) {
    return { medicamento: null, error: normalizarError(error) };
  }
}

/**
 * Desactiva un medicamento, o rechaza la operacion con un error explicativo si todavia tiene
 * existencias disponibles (fn_medicamento_tiene_existencias, migracion 00050).
 *
 * Mismo patron que cambiarEstadoProyecto (packages/shared/proyectos/api.js) y el
 * guard de personal_registro_atenciones (packages/shared/jornadas/api.js): se reusa la
 * clasificacion LLAVE_FORANEA (el medicamento esta relacionado con existencias) con un mensaje
 * propio.
 *
 * @param {string} id UUID del medicamento.
 * @returns {Promise<{ medicamento: object|null, error: object|null }>}
 */
export async function desactivarMedicamento(id) {
  if (!id) return { medicamento: null, error: null };

  try {
    const supabase = obtenerSupabase();

    const { data: tieneExistencias, error: errorDeChequeo } = await supabase.rpc(
      "fn_medicamento_tiene_existencias",
      { p_medicamento_id: id },
    );
    if (errorDeChequeo) return { medicamento: null, error: normalizarError(errorDeChequeo) };

    if (tieneExistencias) {
      return {
        medicamento: null,
        error: {
          ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.LLAVE_FORANEA),
          mensaje:
            "No se puede desactivar un medicamento con existencias disponibles en inventario.",
        },
      };
    }

    const { data, error } = await supabase
      .from("medicamentos")
      .update({ activo: false })
      .eq("id", id)
      .select(COLUMNAS_DEL_MEDICAMENTO)
      .maybeSingle();

    if (error) return { medicamento: null, error: normalizarError(error) };
    return { medicamento: data ?? null, error: null };
  } catch (error) {
    return { medicamento: null, error: normalizarError(error) };
  }
}
