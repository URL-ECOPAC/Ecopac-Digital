// Esquema declarativo de las columnas/ficha de donantes y donaciones (issue #287).
//
// Mismo patron que packages/shared/pacientes/columnas.js: COLUMNAS_X para el listado (o tarjeta
// movil) y CAMPOS_FICHA_X para el detalle.

import { TIPOS_DE_PRESENTACION } from "../descriptores.js";

export const COLUMNAS_DONANTE = [
  {
    id: "avatar",
    label: "",
    tipo: TIPOS_DE_PRESENTACION.AVATAR,
    desde: "nombre",
    anchoWeb: "48px",
  },
  { id: "nombre", label: "Nombre", tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  {
    id: "tipo",
    label: "Tipo",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    etiquetasDesde: "tiposDeDonante",
  },
  { id: "contacto", label: "Contacto", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "telefono", label: "Telefono", tipo: TIPOS_DE_PRESENTACION.TELEFONO },
  { id: "email", label: "Correo", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  // donante.activo es booleano, no el string a mostrar: ESTADO + etiquetasDesde, mismo patron
  // que usuarios/columnas.js (estado -> desde:'activo', etiquetasDesde:'estadoUsuario').
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    desde: "activo",
    etiquetasDesde: "estadoDonante",
  },
];

export const CAMPOS_FICHA_DONANTE = [
  { id: "nombre", label: "Nombre", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  {
    id: "tipo",
    label: "Tipo",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    etiquetasDesde: "tiposDeDonante",
  },
  { id: "contacto", label: "Contacto", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "telefono", label: "Telefono", tipo: TIPOS_DE_PRESENTACION.TELEFONO },
  { id: "email", label: "Correo", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "direccion", label: "Direccion", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  {
    id: "estado",
    label: "Estado",
    tipo: TIPOS_DE_PRESENTACION.ESTADO,
    desde: "activo",
    etiquetasDesde: "estadoDonante",
  },
];

export const COLUMNAS_DONACION = [
  { id: "fecha", label: "Fecha", tipo: TIPOS_DE_PRESENTACION.FECHA },
  // 'donante' no es una columna de `donaciones`: sale del join con donante_id. La pantalla que
  // arma la fila tiene que alias-earla a `donanteNombre`.
  {
    id: "donante",
    label: "Donante",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    desde: "donanteNombre",
    principal: true,
  },
  {
    id: "tipo",
    label: "Tipo",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    etiquetasDesde: "tiposDeDonacion",
  },
  // El valor guardado en donaciones.estado YA es 'registrada'/'anulada': CHIP, no ESTADO, mismo
  // patron que COLUMNAS_JORNADA/COLUMNAS_MOVIMIENTO/COLUMNAS_GASTO.
  { id: "estado", label: "Estado", tipo: TIPOS_DE_PRESENTACION.CHIP },
];

// Nota deliberada: no hay columna de monto/total aqui. `donaciones` no tiene columna de importe
// (el dinero vive por renglon en donacion_detalle.monto, ver donaciones/campos.js); un total
// -solo aplica cuando tipo = 'dinero'- es un valor DERIVADO que calcula la pantalla, mismo
// tratamiento que pacientes le da a edad/nombreCompleto. Tampoco hay COLUMNAS_DETALLE_DONACION:
// no hay precedente de columnas para una tabla de detalle (pacientes tampoco las tiene para
// receta_detalle); mostrar los renglones de una donacion ya registrada queda fuera de #287.

export const CAMPOS_FICHA_DONACION = [
  { id: "donante", label: "Donante", tipo: TIPOS_DE_PRESENTACION.TEXTO, desde: "donanteNombre" },
  { id: "fecha", label: "Fecha", tipo: TIPOS_DE_PRESENTACION.FECHA },
  {
    id: "tipo",
    label: "Tipo",
    tipo: TIPOS_DE_PRESENTACION.TEXTO,
    etiquetasDesde: "tiposDeDonacion",
  },
  { id: "estado", label: "Estado", tipo: TIPOS_DE_PRESENTACION.CHIP },
  { id: "observaciones", label: "Observaciones", tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: "motivoAnulacion", label: "Motivo de anulacion", tipo: TIPOS_DE_PRESENTACION.TEXTO },
];
