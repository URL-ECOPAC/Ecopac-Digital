// Esquema declarativo del formulario de alta/edicion del catalogo de diagnosticos (issue #639).
//
// Los tres campos reflejan columnas nullable salvo nombre (migracion 00018): codigo y
// descripcion son opcionales, igual que ya valida crearDiagnostico()/actualizarDiagnostico() en
// consultas.api.js. La columna `activo` (00113) no esta aca a proposito: no se edita como un
// campo de formulario mas, se alterna con una accion propia (desactivarDiagnostico/
// activarDiagnostico), igual que medicamentos separa actualizarMedicamento() de
// desactivarMedicamento().

import { TIPOS_DE_CAMPO } from "../descriptores.js";

export const CAMPOS_DIAGNOSTICO = [
  {
    id: "codigo",
    label: "Codigo CIE-10",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    placeholder: "Ej: J00 (opcional)",
    validacion: { requerido: false, maxLongitud: 20 },
  },
  {
    id: "nombre",
    label: "Nombre",
    tipo: TIPOS_DE_CAMPO.TEXTO,
    placeholder: "Descripcion clinica del diagnostico",
    validacion: { requerido: true, maxLongitud: 255 },
  },
  {
    id: "descripcion",
    label: "Notas",
    tipo: TIPOS_DE_CAMPO.TEXTO_LARGO,
    placeholder: "Notas para quien lo elija en la consulta (opcional)",
    validacion: { requerido: false },
  },
];
