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
  normalizarError,
} from "../api/errores-de-supabase.js";
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
const COLUMNAS_DE_CONDICION_CRONICA = [
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
 * fn_registrar_paciente retorna el tipo completo de la tabla (RETURNS pacientes, migracion
 * 00057), asi que entrega las columnas tal cual se llaman en Postgres, sin la comunidad
 * embebida. Deja la fila recien registrada en el mismo idioma que la que devuelven
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
 * NULL en pacientes, 00009- y numeroFicha -NOT NULL en expedientes, 00009-, que
 * fn_registrar_paciente inserta junto con el paciente. Nada llega al servidor sin pasar antes
 * por esta validacion.
 *
 * La atomicidad la da fn_registrar_paciente (migracion 00057): un numero_ficha duplicado, o
 * cualquier otra violacion que la validacion no haya detectado, revierte tambien el insert de
 * pacientes, para que nunca quede un paciente sin expediente.
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
        p_numero_ficha: datos.numeroFicha,
        p_dpi: datos.dpi ?? null,
        p_tipo_sangre: datos.tipoSangre ?? null,
        p_nombre_responsable: datos.nombreResponsable ?? null,
        p_parentesco_responsable: datos.parentescoResponsable ?? null,
      })
      .single();

    if (error) return { paciente: null, errores: {}, error: normalizarError(error) };

    return {
      paciente: { ...aPaciente(data), expediente: { numeroFicha: datos.numeroFicha } },
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
