import { calcularEdad } from "../formato/fechas.js";
import { nombreCompletoDePaciente } from "./ficha.js";
import { describirMedicamento, describirPosologia } from "./useRecetasPaciente.js";

export const ENCABEZADO_DE_RECETA = Object.freeze({
  organizacion: "Ecopac Guatemala",
  documento: "Receta medica",
});

export function datosDeRecetaImprimible({ receta, paciente } = {}) {
  if (!receta) return null;

  return {
    ...ENCABEZADO_DE_RECETA,
    folio: receta.folio ?? null,
    fecha: receta.createdAt ?? null,
    estado: receta.estado ?? null,
    anulada: receta.anulada === true,
    motivoAnulacion: receta.motivoAnulacion ?? null,
    anuladaEn: receta.anuladaEn ?? null,
    medico: receta.medico ?? null,
    jornada: receta.jornada ?? null,
    fechaDeJornada: receta.fechaDeJornada ?? null,
    indicacionesGenerales: receta.indicacionesGenerales ?? null,
    paciente: {
      nombre: nombreCompletoDePaciente(paciente),
      numeroFicha: paciente?.expediente?.numeroFicha ?? null,
      edad: calcularEdad(paciente?.fechaNacimiento)?.texto ?? null,
      sexo: paciente?.sexo ?? null,
      comunidad: paciente?.comunidad?.nombre ?? null,
    },
    medicamentos: (receta.detalle ?? []).map((renglon) => ({
      id: renglon.id,
      descripcion: describirMedicamento(renglon),
      posologia: describirPosologia(renglon),
      cantidadEntregada: renglon.cantidadEntregada ?? null,
    })),
  };
}
