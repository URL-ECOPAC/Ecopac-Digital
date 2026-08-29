// Consultas de Supabase del modulo de pacientes.
//
// packages/shared/api es la infraestructura del cliente; las consultas de cada modulo van en
// el api.js de su carpeta, como indica el encabezado de api/index.js. Este archivo es el unico
// lugar del monorepo que lee y escribe la tabla pacientes, y el unico que escribe expedientes
// (padecimientos_cronicos sigue siendo del modulo que lo registre: aqui solo se lee para armar
// la ficha del paciente).
//
// Todas las funciones devuelven `{ dato, error }` en vez de lanzar, igual que supabase-js: quien
// las consume es un hook que tiene que reflejar el fallo en pantalla, no reventar el render.
//
// Ninguna funcion valida aqui quien puede leer, registrar o editar: esa regla la aplican las
// politicas de 00032_politicas_rls_pacientes_expedientes.sql (administrador, medico y voluntario
// general leen y registran; solo administrador y medico editan), y un intento sin permiso vuelve
// como error 42501, que normalizarError() ya traduce. El cliente pregunta para dibujar, el
// servidor decide.

import { obtenerSupabase } from "../api/cliente.js";
import {
  CODIGOS_DE_ERROR_DE_SUPABASE,
  construirError,
  esErrorDeCancelacion,
  normalizarError,
} from "../api/errores-de-supabase.js";
import { normalizarTexto } from "../validations/index.js";
import { ESTADOS_CONDICION_CRONICA } from "./condiciones.campos.js";
import { validarRegistroPaciente } from "./validaciones.js";

// Las columnas se enumeran en lugar de pedir "*" para que una columna nueva en pacientes no
// empiece a viajar sola hasta el cliente. comunidad se pide embebida (comunidades.nombre) para
// que la pantalla pinte el nombre sin una segunda consulta, igual que jornadas/api.js hace con
// su propia comunidad.
const COLUMNAS_DEL_PACIENTE = [
  "id",
  "nombres",
  "apellidos",
  "fechaNacimiento:fecha_nacimiento",
  "sexo",
  "comunidadId:comunidad_id",
  "telefonoContacto:telefono_contacto",
  "idioma",
  "dpi",
  "tipoSangre:tipo_sangre",
  "nombreResponsable:nombre_responsable",
  "parentescoResponsable:parentesco_responsable",
  "fechaBaja:fecha_baja",
  "createdAt:created_at",
  "updatedAt:updated_at",
  "comunidad:comunidades(nombre)",
].join(", ");

const COLUMNAS_DEL_EXPEDIENTE = [
  "id",
  "numeroFicha:numero_ficha",
  "createdAt:created_at",
  "updatedAt:updated_at",
].join(", ");

// condicion se pide embebida (condiciones_cronicas.nombre) por el mismo motivo que comunidad
// arriba: la pantalla no deberia hacer una segunda consulta solo para mostrar el nombre.
//
// Se exporta porque condiciones.api.js (issue #122), que es quien escribe esta tabla, lee las
// mismas columnas: una lista duplicada se desincroniza en cuanto alguien agregue una columna en
// un archivo y no en el otro. La regla del bug #365 aplica igual dentro de un modulo.
export const COLUMNAS_DE_CONDICION_CRONICA = [
  "id",
  "condicionId:condicion_id",
  "fechaDiagnostico:fecha_diagnostico",
  "estado",
  "notas",
  "condicion:condiciones_cronicas(nombre)",
].join(", ");

/**
 * Mapa de los campos editables de un paciente (los ids de CAMPOS_REGISTRO_PACIENTE, salvo
 * numeroFicha) a la columna de pacientes que les corresponde.
 *
 * numeroFicha no esta aqui a proposito: vive en expedientes, no en pacientes, y
 * actualizarPaciente() no la toca (criterio de aceptacion de la issue #113).
 */
const MAPA_COLUMNAS_DEL_PACIENTE = {
  nombres: "nombres",
  apellidos: "apellidos",
  fechaNacimiento: "fecha_nacimiento",
  sexo: "sexo",
  comunidad: "comunidad_id",
  telefonoContacto: "telefono_contacto",
  idioma: "idioma",
  dpi: "dpi",
  tipoSangre: "tipo_sangre",
  nombreResponsable: "nombre_responsable",
  parentescoResponsable: "parentesco_responsable",
};

/** Traduce del camelCase de las pantallas al snake_case de la tabla, omitiendo lo no enviado. */
function aColumnasDeTabla(datos = {}) {
  const fila = {};
  for (const [campo, columna] of Object.entries(MAPA_COLUMNAS_DEL_PACIENTE)) {
    // Solo se envia lo que venga en el objeto: un update parcial no debe borrar lo que no toca.
    if (Object.prototype.hasOwnProperty.call(datos, campo)) fila[columna] = datos[campo];
  }
  return fila;
}

/**
 * Traduce una fila de pacientes en snake_case a las claves camelCase de COLUMNAS_DEL_PACIENTE.
 *
 * fn_registrar_paciente retorna las columnas de pacientes explicitas mas numero_ficha
 * (RETURNS TABLE, migracion 00081), asi que entrega las columnas tal cual se llaman en
 * Postgres, sin la comunidad embebida; aPaciente() ignora numero_ficha (registrarPaciente() la
 * lee aparte). Deja la fila recien registrada en el mismo idioma que la que devuelven
 * obtenerPaciente() y actualizarPaciente(), salvo por ese embed.
 */
function aPaciente(fila) {
  if (!fila) return null;

  return {
    id: fila.id,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    fechaNacimiento: fila.fecha_nacimiento,
    sexo: fila.sexo,
    comunidadId: fila.comunidad_id,
    telefonoContacto: fila.telefono_contacto,
    idioma: fila.idioma,
    dpi: fila.dpi,
    tipoSangre: fila.tipo_sangre,
    nombreResponsable: fila.nombre_responsable,
    parentescoResponsable: fila.parentesco_responsable,
    fechaBaja: fila.fecha_baja,
    createdAt: fila.created_at,
    updatedAt: fila.updated_at,
  };
}

/**
 * Registra un paciente nuevo junto con su expediente.
 *
 * validarRegistroPaciente() (validaciones.js) valida contra CAMPOS_REGISTRO_PACIENTE, el
 * formulario completo de registro (campos.js): a diferencia de validarPaciente() (issue #112,
 * un subconjunto de 5 campos), cubre tambien sexo, comunidad, telefonoContacto e idioma -NOT
 * NULL en pacientes, 00009-. Nada llega al servidor sin pasar antes por esta validacion.
 *
 * numeroFicha no es un campo del formulario: fn_registrar_paciente lo genera del lado del
 * servidor (DEFAULT de expedientes.numero_ficha, migracion 00081) y lo devuelve en la misma
 * llamada.
 *
 * La atomicidad la da fn_registrar_paciente (migraciones 00057, 00081): cualquier violacion
 * que la validacion no haya detectado revierte tambien el insert de pacientes, para que nunca
 * quede un paciente sin expediente.
 *
 * @param {object} datos Campos en camelCase, los ids de CAMPOS_REGISTRO_PACIENTE.
 * @returns {Promise<{ paciente: object|null, errores: Record<string, string>, error: object|null }>}
 */
export async function registrarPaciente(datos = {}) {
  const errores = validarRegistroPaciente(datos);

  if (Object.keys(errores).length > 0) {
    return {
      paciente: null,
      errores,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK),
        mensaje: "Revisa los datos del formulario antes de registrar al paciente.",
      },
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .rpc("fn_registrar_paciente", {
        p_nombres: datos.nombres,
        p_apellidos: datos.apellidos,
        p_fecha_nacimiento: datos.fechaNacimiento,
        p_sexo: datos.sexo,
        p_comunidad_id: datos.comunidad,
        p_telefono_contacto: datos.telefonoContacto,
        p_idioma: datos.idioma,
        p_dpi: datos.dpi ?? null,
        p_tipo_sangre: datos.tipoSangre ?? null,
        p_nombre_responsable: datos.nombreResponsable ?? null,
        p_parentesco_responsable: datos.parentescoResponsable ?? null,
      })
      .single();

    if (error) return { paciente: null, errores: {}, error: normalizarError(error) };

    return {
      paciente: { ...aPaciente(data), expediente: { numeroFicha: data.numero_ficha } },
      errores: {},
      error: null,
    };
  } catch (error) {
    return { paciente: null, errores: {}, error: normalizarError(error) };
  }
}

/**
 * Lee un paciente con su comunidad, su expediente y sus condiciones cronicas.
 *
 * El detalle se arma con tres consultas en paralelo, igual que obtenerJornada()
 * (packages/shared/jornadas/api.js): la fila de pacientes (con la comunidad embebida), la fila
 * de expedientes y las filas de padecimientos_cronicos (con el nombre de cada condicion
 * embebido). `paciente` llega en null sin error cuando la fila no existe o cuando RLS no la deja
 * ver; son casos distintos para la base de datos pero el mismo para el cliente.
 *
 * Un paciente sin expediente no deberia existir (fn_registrar_paciente los crea juntos), pero si
 * RLS deja ver el paciente y no el expediente, `expediente` llega en null en vez de hacer fallar
 * toda la lectura.
 *
 * @param {string} id UUID del paciente.
 * @returns {Promise<{ paciente: object|null, error: object|null }>} El paciente trae
 *   `expediente` (objeto o null) y `condicionesCronicas` (arreglo) dentro.
 */
export async function obtenerPaciente(id) {
  if (!id) return { paciente: null, error: null };

  try {
    const supabase = obtenerSupabase();
    const [respuestaPaciente, respuestaExpediente, respuestaCondiciones] = await Promise.all([
      supabase.from("pacientes").select(COLUMNAS_DEL_PACIENTE).eq("id", id).maybeSingle(),
      supabase
        .from("expedientes")
        .select(COLUMNAS_DEL_EXPEDIENTE)
        .eq("paciente_id", id)
        .maybeSingle(),
      supabase.from("padecimientos_cronicos").select(COLUMNAS_DE_CONDICION_CRONICA).eq("paciente_id", id),
    ]);

    if (respuestaPaciente.error) return { paciente: null, error: normalizarError(respuestaPaciente.error) };
    if (respuestaExpediente.error) return { paciente: null, error: normalizarError(respuestaExpediente.error) };
    if (respuestaCondiciones.error) return { paciente: null, error: normalizarError(respuestaCondiciones.error) };

    const fila = respuestaPaciente.data;
    if (!fila) return { paciente: null, error: null };

    return {
      paciente: {
        ...fila,
        expediente: respuestaExpediente.data ?? null,
        condicionesCronicas: respuestaCondiciones.data ?? [],
      },
      error: null,
    };
  } catch (error) {
    return { paciente: null, error: normalizarError(error) };
  }
}

/**
 * Actualiza los datos de un paciente ya registrado.
 *
 * No permite modificar el numero de ficha (criterio de aceptacion de la issue #113):
 * MAPA_COLUMNAS_DEL_PACIENTE no incluye numeroFicha, asi que aColumnasDeTabla() nunca la traduce
 * a una columna; si el llamador la incluye en `datos` de todos modos, esta funcion la rechaza
 * explicitamente en vez de ignorarla en silencio, para que quien la llamo se entere de que ese
 * cambio no se aplico.
 *
 * validarRegistroPaciente() (CAMPOS_REGISTRO_PACIENTE, el mismo descriptor que usa
 * registrarPaciente()) se corre sobre `datos` completo, pero solo bloquea la actualizacion por
 * los campos que de verdad se estan editando (los que aparecen en `fila`): mismo criterio que
 * actualizarUsuario() (packages/shared/usuarios/api.js) para no exigir
 * nombres/apellidos/fechaNacimiento/comunidad en una edicion parcial que no los toca. numeroFicha
 * nunca puede estar entre esos campos: MAPA_COLUMNAS_DEL_PACIENTE no la incluye, y el chequeo de
 * arriba ya corta la funcion si el llamador la manda de todos modos.
 *
 * @param {string} id UUID del paciente.
 * @param {object} datos Campos en camelCase, los ids de MAPA_COLUMNAS_DEL_PACIENTE.
 * @returns {Promise<{ paciente: object|null, errores: Record<string, string>, error: object|null }>}
 */
export async function actualizarPaciente(id, datos = {}) {
  if (!id) return { paciente: null, errores: {}, error: null };

  if (Object.prototype.hasOwnProperty.call(datos ?? {}, "numeroFicha")) {
    return {
      paciente: null,
      errores: {},
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK),
        mensaje: "El numero de ficha no se puede modificar desde la edicion del paciente.",
      },
    };
  }

  const fila = aColumnasDeTabla(datos);
  if (Object.keys(fila).length === 0) return { paciente: null, errores: {}, error: null };

  const erroresCompletos = validarRegistroPaciente(datos);
  const errores = {};
  for (const campo of Object.keys(MAPA_COLUMNAS_DEL_PACIENTE)) {
    if (Object.prototype.hasOwnProperty.call(datos, campo) && erroresCompletos[campo]) {
      errores[campo] = erroresCompletos[campo];
    }
  }

  if (Object.keys(errores).length > 0) {
    return {
      paciente: null,
      errores,
      error: {
        ...construirError(CODIGOS_DE_ERROR_DE_SUPABASE.CHECK),
        mensaje: "Revisa los datos del formulario antes de guardar.",
      },
    };
  }

  try {
    const { data, error } = await obtenerSupabase()
      .from("pacientes")
      .update(fila)
      .eq("id", id)
      .select(COLUMNAS_DEL_PACIENTE)
      .maybeSingle();

    if (error) return { paciente: null, errores: {}, error: normalizarError(error) };
    return { paciente: data ?? null, errores: {}, error: null };
  } catch (error) {
    return { paciente: null, errores: {}, error: normalizarError(error) };
  }
}

// ============================================================================
// Busqueda de pacientes (issue #115)
// ============================================================================
// EXCEPCION DE ALCANCE AUTORIZADA: fn_buscar_pacientes (migracion 00068) existe porque
// PostgREST no puede reproducir la expresion del indice de trigramas de #70
// (00011_indices_busqueda_pacientes.sql) ni ordenar por similarity(), que depende del
// termino de busqueda y por eso no puede ser una columna que .order() acepte. Ver la
// cabecera de 00068 para el detalle completo.
//
// Bajo un solo cuadro de busqueda (FILTROS_PACIENTE.busqueda, filtros.js) conviven tres
// modos: nombre (tolerante a acentos y errores de tipeo), comunidad y numero de ficha
// exacto. buscarPacientes() no decide cual es "el" modo por el formato del termino:
// numero_ficha es VARCHAR(30) sin CHECK (00009). Lo que genera fn_registrar_paciente de aqui
// en adelante tiene un formato fijo (6 digitos, migracion 00081), pero la columna sigue sin
// una restriccion que lo obligue -por si algun dia hay que buscar un numero heredado con otro
// formato-, asi que la busqueda sigue sin asumirlo. En su lugar prueba los dos caminos en
// paralelo -la sonda exacta de ficha es una lectura por indice unico, practicamente
// gratis- y combina lo que encuentre.

// Nombres de menos de 3 caracteres no generan un trigrama completo: pg_trgm los rellena
// y la similitud contra un nombre completo cae muy por debajo de cualquier umbral util,
// asi que la busqueda por nombre no aporta nada por debajo de este limite. La sonda de
// ficha NO tiene este limite (ver mas abajo): la columna no impone un formato minimo,
// aunque lo generado desde la 00081 siempre tenga 6 digitos.
const LONGITUD_MINIMA_BUSQUEDA_POR_NOMBRE = 3;

const POR_PAGINA_POR_DEFECTO = 20;

// Mismas columnas que necesita la ficha clinica (COLUMNAS_DEL_PACIENTE), pero solo el
// subconjunto minimo para una lista de resultados de busqueda (columnas.js,
// COLUMNAS_PACIENTE): sin datos de contacto, que no ayudan a elegir entre resultados y
// cuestan un join de mas. Las condiciones cronicas SI viajan desde la issue #535: la
// columna de chips que COLUMNAS_PACIENTE declara desde el PR #311 no tenia de donde leer,
// y se resuelven con un embebido en vez de una segunda consulta. fechaBaja viaja para
// poder excluir de buscarPacientePorFicha() a quien este dado de baja (mismo criterio que
// fn_buscar_pacientes) y se descarta antes de devolver el paciente.
const COLUMNAS_DE_BUSQUEDA_PACIENTE = [
  "id",
  "nombres",
  "apellidos",
  "fechaNacimiento:fecha_nacimiento",
  "sexo",
  "comunidadId:comunidad_id",
  "fechaBaja:fecha_baja",
  "comunidad:comunidades(nombre)",
  `condicionesCronicas:padecimientos_cronicos(${COLUMNAS_DE_CONDICION_CRONICA})`,
].join(", ");

/**
 * Reduce los padecimientos de un paciente a los nombres de los que sigue padeciendo.
 *
 * Vigente es estado distinto de resuelta -- o sea activa y controlada -- misma definicion que
 * usa soloVigentes en obtenerCondicionesDelPaciente() (#122): una condicion controlada se sigue
 * padeciendo. La 00077 aplica esta misma regla del lado del servidor, para la busqueda por
 * nombre; aqui se repite porque la sonda por numero de ficha no pasa por esa funcion.
 *
 * @param {object[]} padecimientos
 * @returns {string[]} Nombres ordenados, listos para la columna de chips.
 */
function nombresDeCondicionesVigentes(padecimientos = []) {
  return padecimientos
    .filter((uno) => uno?.estado !== ESTADOS_CONDICION_CRONICA.RESUELTA)
    .map((uno) => uno?.condicion?.nombre)
    .filter(Boolean)
    .sort((uno, otro) => uno.localeCompare(otro, "es"));
}

/** Traduce una fila de fn_buscar_pacientes (snake_case) a un paciente de resultado de busqueda. */
function aPacienteDeBusqueda(fila) {
  return {
    id: fila.paciente_id,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    fechaNacimiento: fila.fecha_nacimiento,
    sexo: fila.sexo,
    comunidadId: fila.comunidad_id,
    comunidad: fila.comunidad_nombre ? { nombre: fila.comunidad_nombre } : null,
    numeroFicha: fila.numero_ficha,
    ultimaAtencion: fila.ultima_atencion ?? null,
    // La 00077 la devuelve siempre como arreglo, vacio incluido. El ?? [] cubre a un cliente
    // que todavia hable con una base sin esa migracion aplicada.
    condiciones: fila.condiciones ?? [],
    relevancia: fila.relevancia,
  };
}

/**
 * Busca un paciente por su numero de ficha exacto (criterio de aceptacion 3 de la issue
 * #115: "de inmediato"). No pasa por trigramas ni por fn_buscar_pacientes: numero_ficha es
 * UNIQUE (00009), asi que es una lectura por indice unico normal, sin RPC.
 *
 * Excluye pacientes dados de baja, igual que fn_buscar_pacientes (00068): una ficha vieja
 * de alguien dado de baja no deberia aparecer como si estuviera activo.
 *
 * @param {string} numeroFicha
 * @returns {Promise<{ paciente: object|null, error: object|null }>}
 */
export async function buscarPacientePorFicha(numeroFicha, { signal } = {}) {
  const ficha = normalizarTexto(numeroFicha);
  if (ficha === "") return { paciente: null, error: null };

  try {
    let consulta = obtenerSupabase()
      .from("expedientes")
      .select(`numeroFicha:numero_ficha, paciente:pacientes(${COLUMNAS_DE_BUSQUEDA_PACIENTE})`)
      .eq("numero_ficha", ficha);

    // Solo se encadena cuando hay senal: abortSignal(undefined) dejaria la consulta atada a un
    // AbortSignal inexistente, y quien llama sin cancelacion no tiene por que pagar ese paso.
    if (signal) consulta = consulta.abortSignal(signal);

    const { data, error } = await consulta.maybeSingle();

    if (esErrorDeCancelacion(error)) return { paciente: null, error: null, cancelada: true };
    if (error) return { paciente: null, error: normalizarError(error) };
    if (!data?.paciente || data.paciente.fechaBaja) return { paciente: null, error: null };

    const paciente = {
      ...data.paciente,
      numeroFicha: data.numeroFicha,
      condiciones: nombresDeCondicionesVigentes(data.paciente.condicionesCronicas),
    };
    delete paciente.fechaBaja;
    delete paciente.condicionesCronicas;
    return { paciente, error: null };
  } catch (error) {
    if (esErrorDeCancelacion(error)) return { paciente: null, error: null, cancelada: true };
    return { paciente: null, error: normalizarError(error) };
  }
}

/**
 * Busca pacientes por nombre (tolerante a acentos y errores de tipeo), opcionalmente
 * filtrado por comunidad, y en paralelo prueba si el termino es un numero de ficha exacto.
 *
 * Sin termino ni comunidad devuelve vacio sin error: una pantalla recien abierta, con los
 * filtros en FILTROS_PACIENTE_VACIOS, no deberia mostrar un error antes de que nadie
 * escriba nada. Con comunidad y sin termino devuelve el listado paginado de esa comunidad
 * (fn_buscar_pacientes lo resuelve solo, filtrando por comunidad_id sin condicion de
 * nombre).
 *
 * Si la pagina pedida cae despues de la ultima con resultados, fn_buscar_pacientes
 * devuelve la ultima pagina real en vez de una lista vacia (ver comentario de cabecera de
 * la migracion 00068): por eso `pagina` y `porPagina` en la respuesta reflejan lo que el
 * servidor efectivamente sirvio, no necesariamente lo pedido.
 *
 * Si cualquiera de las dos consultas (la busqueda por nombre o la sonda de ficha) falla,
 * la funcion falla cerrado: devuelve el error normalizado y nunca
 * `{ pacientes: [], total: 0, error: null }`, porque esa forma es indistinguible de "no
 * hay resultados" para quien la llama.
 *
 * @param {{ termino?: string, comunidadId?: string, condicionCronicaId?: string,
 *   sexo?: string, edadMin?: number, edadMax?: number, listarTodos?: boolean,
 *   pagina?: number, porPagina?: number }} [filtros]
 * @returns {Promise<{
 *   pacientes: object[],
 *   total: number,
 *   pagina: number,
 *   porPagina: number,
 *   coincidenciaExacta: boolean,
 *   terminoDemasiadoCorto: boolean,
 *   error: object|null,
 * }>}
 */
export async function buscarPacientes({
  termino,
  comunidadId,
  condicionCronicaId,
  sexo,
  edadMin,
  edadMax,
  listarTodos = false,
  pagina = 1,
  porPagina = POR_PAGINA_POR_DEFECTO,
  signal,
} = {}) {
  const terminoNormalizado = normalizarTexto(termino).replace(/\s+/g, " ");
  const hayTermino = terminoNormalizado !== "";
  const terminoDemasiadoCorto =
    hayTermino && terminoNormalizado.length < LONGITUD_MINIMA_BUSQUEDA_POR_NOMBRE;

  const respuestaVacia = (error = null) => ({
    pacientes: [],
    total: 0,
    pagina,
    porPagina,
    coincidenciaExacta: false,
    terminoDemasiadoCorto,
    error,
    cancelada: false,
  });

  // Una peticion abortada no es un fallo: es lo que se pidio. Se devuelve marcada para que
  // quien llama sepa que no debe pintar nada -ni resultados vacios ni un error-, en vez de
  // hacerle deducir el aborto de una respuesta vacia indistinguible de "no hubo coincidencias".
  const respuestaCancelada = () => ({ ...respuestaVacia(), cancelada: true });

  // Sin termino y sin comunidad no hay nada que filtrar: devolver la tabla entera
  // paginada no es lo que pidio nadie, y no es un error tampoco (una pantalla recien
  // abierta, con los filtros vacios, no deberia mostrar uno). No llega a tocar el
  // cliente.
  // La guarda original (issue #115) solo miraba termino y comunidad, asi que filtrar unicamente
  // por sexo, edad o condicion cronica tambien devolvia vacio sin consultar. Ahora cualquier
  // filtro cuenta como criterio.
  const hayAlgunFiltro = Boolean(
    comunidadId || condicionCronicaId || sexo || edadMin != null || edadMax != null,
  );

  // `listarTodos` es la puerta explicita para una pantalla de LISTADO, no de busqueda: la #124
  // necesita mostrar pacientes al entrar, sin que nadie haya escrito nada. Se pide con una
  // bandera en vez de relajar la guarda para todos, porque el comportamiento por defecto de
  // esta funcion -no volcar la tabla entera a quien no pidio nada- es deliberado de la #115 y
  // sigue intacto. El volcado no es tal: fn_buscar_pacientes pagina de 20 en 20.
  if (!hayTermino && !hayAlgunFiltro && !listarTodos) return respuestaVacia();

  // El corte de 3 caracteres se aplica solo al camino por nombre: un termino corto no
  // produce trigramas utiles (ver LONGITUD_MINIMA_BUSQUEDA_POR_NOMBRE). Si ademas hay
  // comunidad, igual conviene llamar a fn_buscar_pacientes -sin el termino- para servir
  // el listado de esa comunidad en vez de nada; terminoDemasiadoCorto sigue en true para
  // que la pantalla explique por que el nombre no filtro.
  const terminoParaBusquedaPorNombre = hayTermino && !terminoDemasiadoCorto ? terminoNormalizado : null;
  const debeConsultarBusqueda =
    terminoParaBusquedaPorNombre !== null || hayAlgunFiltro || listarTodos;

  try {
    const supabase = obtenerSupabase();

    // Solo se encadena abortSignal cuando hay senal, por el mismo motivo que en
    // buscarPacientePorFicha: quien no necesita cancelar no tiene por que pagar ese paso.
    const consultaDeBusqueda = (argumentos) => {
      const consulta = supabase.rpc("fn_buscar_pacientes", argumentos);
      return signal ? consulta.abortSignal(signal) : consulta;
    };

    const [respuestaBusqueda, respuestaFicha] = await Promise.all([
      debeConsultarBusqueda
        ? consultaDeBusqueda({
            p_termino: terminoParaBusquedaPorNombre,
            p_comunidad_id: comunidadId || null,
            p_pagina: pagina,
            p_por_pagina: porPagina,
            p_condicion_cronica_id: condicionCronicaId || null,
            p_sexo: sexo || null,
            p_edad_min: edadMin ?? null,
            p_edad_max: edadMax ?? null,
          })
        : Promise.resolve({ data: [], error: null }),
      // La sonda de ficha no tiene minimo de longitud: numero_ficha no tiene formato ni
      // prefijo (00009), asi que un termino corto puede ser una ficha valida.
      hayTermino
        ? buscarPacientePorFicha(terminoNormalizado, { signal })
        : Promise.resolve({ paciente: null, error: null }),
    ]);

    // El aborto se comprueba antes que el error: las dos consultas viajan con la misma senal,
    // asi que cancelar deja a las dos con un error que no hay que ensenarle a nadie.
    if (esErrorDeCancelacion(respuestaBusqueda.error) || respuestaFicha.cancelada === true) {
      return respuestaCancelada();
    }

    if (respuestaBusqueda.error) return respuestaVacia(normalizarError(respuestaBusqueda.error));
    if (respuestaFicha.error) return respuestaVacia(respuestaFicha.error);

    const filas = respuestaBusqueda.data ?? [];
    const pacientePorFicha = respuestaFicha.paciente;
    const pacientesPorNombre = filas.map(aPacienteDeBusqueda);

    const pacientes =
      pacientePorFicha && !pacientesPorNombre.some((p) => p.id === pacientePorFicha.id)
        ? [pacientePorFicha, ...pacientesPorNombre]
        : pacientesPorNombre;

    const primeraFila = filas[0];
    return {
      pacientes,
      total: primeraFila ? Number(primeraFila.total) : pacientes.length,
      pagina: primeraFila ? primeraFila.pagina : 1,
      porPagina: primeraFila ? primeraFila.por_pagina : porPagina,
      coincidenciaExacta: Boolean(pacientePorFicha),
      terminoDemasiadoCorto,
      error: null,
      cancelada: false,
    };
  } catch (error) {
    if (esErrorDeCancelacion(error)) return respuestaCancelada();
    return respuestaVacia(normalizarError(error));
  }
}
