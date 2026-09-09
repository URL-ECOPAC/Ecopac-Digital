// Columnas de la lista de posibles duplicados (issue #637). Los datos vienen de
// listarPosiblesDuplicados() (duplicados.api.js) y useDuplicadosPacientes.js los aplana a la
// forma que espera esta tabla: nombreCompletoA/B ya viene armado, no nombresA/apellidosA sueltos.

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";

export const COLUMNAS_DUPLICADOS_PACIENTE = [
  { id: "nombreCompletoA", label: "Paciente A", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "numeroFichaA", label: "Ficha A", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "nombreCompletoB", label: "Paciente B", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: "numeroFichaB", label: "Ficha B", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "fechaNacimiento", label: "Fecha de nacimiento", tipo: TIPOS_DE_PRESENTACION.FECHA },
  // similitud de fn_detectar_pacientes_duplicados (00101) es 0..1; similitudPorcentaje ya viene
  // redondeada a entero desde useDuplicadosPacientes.js, no se formatea aqui.
  { id: "similitudPorcentaje", label: "Similitud", tipo: TIPOS_DE_PRESENTACION.NUMERO, sufijo: "%" },
];
