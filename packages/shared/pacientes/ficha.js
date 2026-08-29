import { calcularEdad } from "../formato/fechas.js";
import { OPCIONES_IDIOMA, OPCIONES_TIPO_SANGRE } from "./campos.js";
import { ESTADOS_CONDICION_CRONICA, OPCIONES_ESTADO_CONDICION } from "./condiciones.campos.js";
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
  return opciones.find((opcion) => opcion.valor === valor)?.etiqueta ?? valor;
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
    idioma: etiquetaDeOpcion(OPCIONES_IDIOMA, paciente.idioma),
    comunidad: paciente.comunidad?.nombre ?? null,
    telefonoContacto: paciente.telefonoContacto ?? null,
    nombreResponsable: paciente.nombreResponsable ?? null,
    parentescoResponsable: paciente.parentescoResponsable ?? null,
  };
}

export function permisosDeFicha(rol) {
  return {
    puedeEditar: puedeEditarPaciente(rol),
    puedeVerDatosClinicos: puedeVerHistorial(rol),
  };
}
