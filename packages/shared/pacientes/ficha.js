import { calcularEdad, formatearFechaConHora, formatearFechaCorta } from "../formato/fechas.js";
import { TIPOS_DE_PRESENTACION } from "../descriptores.js";
import { OPCIONES_TIPO_SANGRE } from "./campos.js";
import { OPCIONES_ESTADO_CONDICION } from "./condiciones.campos.js";
import { ESTADOS_CONDICION_CRONICA } from "../enums.js";
import {
  puedeEditarPaciente,
  puedeEmitirReceta,
  puedeCrearConsulta,
  puedeTomarTriaje,
  puedeVerHistorial,
} from "./permisos.js";

/**
 * Las pestanas de la ficha (issue #840, bloque F y G3).
 *
 * Eran cuatro: datos generales, historial, signos vitales y recetas. Signos y recetas como
 * pestanas hermanas del historial partian cada visita en tres lugares, y en el ancho de un
 * telefono las cuatro no cabian. Ahora el historial es una lista de visitas y cada una trae dentro
 * sus signos, su consulta y su receta; la evolucion de los signos en el tiempo vive dentro del
 * historial, como una vista mas de lo mismo.
 */
export const PESTANIAS_FICHA_PACIENTE = Object.freeze([
  { id: "generales", label: "Datos generales", requiereDatosClinicos: false },
  { id: "historial", label: "Historial clínico", requiereDatosClinicos: true },
]);

export const PESTANIA_FICHA_POR_DEFECTO = PESTANIAS_FICHA_PACIENTE[0].id;

function etiquetaDeOpcion(opciones, valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  return opciones.find((opcion) => opcion.value === valor)?.label ?? valor;
}

/**
 * @param {{ nombres?: string, apellidos?: string } | null} paciente
 * @returns {string|null} Nombres y apellidos unidos, o `null` si no hay ninguno.
 */
export function nombreCompletoDePaciente(paciente) {
  const nombre = [paciente?.nombres, paciente?.apellidos].filter(Boolean).join(" ").trim();
  return nombre || null;
}

/**
 * Las pestanas de la ficha que ve un rol: las clinicas solo si puede ver el historial.
 *
 * @param {string} rol Valor de `ROLES`.
 * @returns {object[]} Subconjunto de `PESTANIAS_FICHA_PACIENTE`.
 */
export function pestaniasDeFicha(rol) {
  const verClinicos = puedeVerHistorial(rol);
  return PESTANIAS_FICHA_PACIENTE.filter(
    (pestania) => !pestania.requiereDatosClinicos || verClinicos,
  );
}

/**
 * La pestana a abrir: la pedida si el rol la ve, y si no la de por defecto.
 *
 * @param {string} id Pestana pedida (por ejemplo, desde la URL).
 * @param {string} rol Valor de `ROLES`.
 * @returns {string} Id de pestana valido para ese rol.
 */
export function resolverPestaniaDeFicha(id, rol) {
  const visibles = pestaniasDeFicha(rol);
  return visibles.some((pestania) => pestania.id === id) ? id : PESTANIA_FICHA_POR_DEFECTO;
}

/**
 * Condiciones cronicas que se destacan en la cabecera: las que no estan resueltas.
 *
 * @param {{ condicionesCronicas?: object[] } | null} paciente
 * @returns {{ id: string, nombre: string, estado: string, etiquetaEstado: string }[]}
 */
export function condicionesDestacadas(paciente) {
  return (paciente?.condicionesCronicas ?? [])
    .filter((condicion) => condicion?.estado !== ESTADOS_CONDICION_CRONICA.RESUELTA)
    .map((condicion) => {
      const estado = condicion.estado ?? ESTADOS_CONDICION_CRONICA.ACTIVA;
      return {
        id: condicion.id,
        nombre: condicion.condicion?.nombre ?? null,
        estado,
        etiquetaEstado: etiquetaDeOpcion(OPCIONES_ESTADO_CONDICION, estado),
      };
    })
    .filter((condicion) => condicion.nombre);
}

/**
 * Datos de la cabecera de la ficha.
 *
 * @param {object|null} paciente Paciente ya normalizado por la API.
 * @returns {{ numeroFicha: string|null, nombreCompleto: string|null, edad: string|null,
 *   comunidad: string|null, condiciones: object[] } | null}
 */
export function cabeceraDePaciente(paciente) {
  if (!paciente) return null;

  return {
    numeroFicha: paciente.expediente?.numeroFicha ?? null,
    nombreCompleto: nombreCompletoDePaciente(paciente),
    edad: calcularEdad(paciente.fechaNacimiento)?.texto ?? null,
    comunidad: paciente.comunidad?.nombre ?? null,
    condiciones: condicionesDestacadas(paciente),
  };
}

/**
 * Valores para los campos de la pestana de datos generales, con los catalogos ya traducidos a su
 * etiqueta (tipo de sangre, idioma, territorio).
 *
 * @param {object|null} paciente Paciente ya normalizado por la API.
 * @returns {Record<string, string|null>} Valor por id de campo; `{}` sin paciente.
 */
export function valoresDeFichaPaciente(paciente) {
  if (!paciente) return {};

  return {
    numeroFicha: paciente.expediente?.numeroFicha ?? null,
    dpi: paciente.dpi ?? null,
    fechaNacimiento: paciente.fechaNacimiento ?? null,
    sexo: paciente.sexo ?? null,
    tipoSangre: etiquetaDeOpcion(OPCIONES_TIPO_SANGRE, paciente.tipoSangre),
    // El nombre lo trae el catalogo embebido (00110); el codigo crudo queda de respaldo por si
    // la consulta no pidio el embebido.
    idioma: paciente.catalogoIdioma?.nombre ?? paciente.idioma ?? null,
    departamento: paciente.comunidad?.municipio?.departamento?.nombre ?? null,
    municipio: paciente.comunidad?.municipio?.nombre ?? null,
    comunidad: paciente.comunidad?.nombre ?? null,
    telefonoContacto: paciente.telefonoContacto ?? null,
    nombreResponsable: paciente.nombreResponsable ?? null,
    parentescoResponsable: paciente.parentescoResponsable ?? null,
    // La API ya traia fecha_baja pero la ficha no la dibujaba, asi que un paciente dado de baja
    // se veia igual que uno activo (issue #656).
    fechaBaja: paciente.fechaBaja ?? null,
    // Mismo caso que fechaBaja: COLUMNAS_DEL_PACIENTE (api.js) pide created_at y updated_at
    // desde siempre y nadie los pintaba. Se renombran a `registradoEn`/`actualizadoEn` para la
    // vista -- la convencion de nombres de AGENTS.md usa el sufijo `_en` para la marca de tiempo
    // de una accion -- sin tocar el nombre que devuelve la API.
    registradoEn: paciente.createdAt ?? null,
    actualizadoEn: paciente.updatedAt ?? null,
  };
}

/**
 * Resumen de la ultima atencion del paciente para la ficha.
 *
 * @param {{ ultimaAtencion?: object } | null} paciente
 * @returns {{ tipo: string|null, fecha: string|null, jornada: string|null, comunidad: string|null,
 *   profesional: string|null, diagnostico: string|null } | null}
 */
export function resumenDeUltimaAtencion(paciente) {
  const evento = paciente?.ultimaAtencion;
  if (!evento) return null;

  return {
    tipo: evento.tipo ?? null,
    fecha: evento.fecha ?? evento.fechaDeJornada ?? null,
    jornada: evento.jornada ?? null,
    comunidad: evento.comunidad ?? null,
    profesional: evento.profesional ?? null,
    diagnostico: evento.diagnosticoPrincipal?.nombre ?? null,
  };
}

/**
 * Que acciones de la ficha ofrece la interfaz a un rol. La restriccion real es RLS.
 *
 * @param {string} rol Valor de `ROLES`.
 * @returns {{ puedeEditar: boolean, puedeVerDatosClinicos: boolean, puedeTomarTriaje: boolean,
 *   puedeCrearConsulta: boolean, puedeEmitirReceta: boolean, puedeNuevaConsulta: boolean }}
 */
export function permisosDeFicha(rol) {
  return {
    puedeEditar: puedeEditarPaciente(rol),
    puedeVerDatosClinicos: puedeVerHistorial(rol),
    // Los tres permisos de captura clinica. La ficha de web no los preguntaba porque no tenia
    // nada que ofrecer: registrar triaje, consulta y receta solo existia en movil.
    puedeTomarTriaje: puedeTomarTriaje(rol),
    puedeCrearConsulta: puedeCrearConsulta(rol),
    puedeEmitirReceta: puedeEmitirReceta(rol),
    // "Nueva consulta" es la unica accion de captura clinica desde la #840: no hay "Nuevo
    // triaje". La ve quien puede registrar al menos una de sus partes -un voluntario, los signos.
    puedeNuevaConsulta: puedeTomarTriaje(rol) || puedeCrearConsulta(rol),
  };
}

/**
 * Texto que se pinta en un campo de la ficha, listo para mostrar.
 *
 * Vivia dentro de FichaPacientePage.jsx, que es donde no debe estar: la regla de
 * docs/ARQUITECTURA-FRONTEND.md dice que las apps no formatean. Sube aqui porque la ficha movil
 * (#658) necesita exactamente lo mismo, y dos copias de la misma regla de presentacion se
 * desincronizan en cuanto una de las dos cambie.
 *
 * El guion largo, y no una cadena vacia, es deliberado: un campo sin dato tiene que verse como
 * un hueco, para que se note que falta capturarlo.
 *
 * @param {{ id: string, tipo?: string }} campo Una entrada de CAMPOS_FICHA_PACIENTE.
 * @param {Record<string, unknown>} valores Lo que devuelve valoresDeFichaPaciente().
 * @returns {string}
 */
export function textoDeCampoDeFicha(campo, valores = {}) {
  const valor = valores[campo?.id];
  if (valor === null || valor === undefined || valor === "") return "—";
  if (campo?.tipo === TIPOS_DE_PRESENTACION.FECHA) return formatearFechaCorta(valor);
  if (campo?.tipo === TIPOS_DE_PRESENTACION.FECHA_HORA) return formatearFechaConHora(valor);
  return String(valor);
}
