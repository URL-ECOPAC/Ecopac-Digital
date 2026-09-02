import { calcularEdad, formatearFechaCorta } from "../formato/fechas.js";
import { TIPOS_DE_PRESENTACION } from "../descriptores.js";
import { OPCIONES_TIPO_SANGRE } from "./campos.js";
import { OPCIONES_ESTADO_CONDICION } from "./condiciones.campos.js";
import { ESTADOS_CONDICION_CRONICA } from "../enums.js";
import { puedeEditarPaciente, puedeVerHistorial } from "./permisos.js";

export const PESTANIAS_FICHA_PACIENTE = Object.freeze([
  { id: "generales", label: "Datos generales", requiereDatosClinicos: false },
  { id: "historial", label: "Historial clinico", requiereDatosClinicos: true },
  { id: "signos", label: "Signos vitales", requiereDatosClinicos: true },
  { id: "recetas", label: "Recetas", requiereDatosClinicos: true },
]);

export const PESTANIA_FICHA_POR_DEFECTO = PESTANIAS_FICHA_PACIENTE[0].id;

function etiquetaDeOpcion(opciones, valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  return opciones.find((opcion) => opcion.value === valor)?.label ?? valor;
}

export function nombreCompletoDePaciente(paciente) {
  const nombre = [paciente?.nombres, paciente?.apellidos].filter(Boolean).join(" ").trim();
  return nombre || null;
}

export function pestaniasDeFicha(rol) {
  const verClinicos = puedeVerHistorial(rol);
  return PESTANIAS_FICHA_PACIENTE.filter(
    (pestania) => !pestania.requiereDatosClinicos || verClinicos,
  );
}

export function resolverPestaniaDeFicha(id, rol) {
  const visibles = pestaniasDeFicha(rol);
  return visibles.some((pestania) => pestania.id === id) ? id : PESTANIA_FICHA_POR_DEFECTO;
}

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
  };
}

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

export function permisosDeFicha(rol) {
  return {
    puedeEditar: puedeEditarPaciente(rol),
    puedeVerDatosClinicos: puedeVerHistorial(rol),
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
  return String(valor);
}
