import { TIPOS_DE_CAMPO, TIPOS_DE_PRESENTACION } from '../descriptores.js';

export const COLUMNAS_USUARIO = [
  { id: 'avatar', label: '', tipo: TIPOS_DE_PRESENTACION.AVATAR, desde: 'nombreCompleto', anchoWeb: '48px' },
  { id: 'nombreCompleto', label: 'Nombre', tipo: TIPOS_DE_PRESENTACION.TEXTO, principal: true },
  { id: 'email', label: 'Correo', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'rol', label: 'Rol', tipo: TIPOS_DE_PRESENTACION.TEXTO, etiquetasDesde: 'roles' },
  { id: 'estado', label: 'Estado', tipo: TIPOS_DE_PRESENTACION.ESTADO, desde: 'activo', etiquetasDesde: 'estadoUsuario' },
  { id: 'fechaIngreso', label: 'Ingreso', tipo: TIPOS_DE_PRESENTACION.FECHA },
];

export const CAMPOS_FICHA_VOLUNTARIO = [
  { id: 'nombreCompleto', label: 'Nombre', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'email', label: 'Correo', tipo: TIPOS_DE_PRESENTACION.TEXTO },
  { id: 'telefono', label: 'Telefono', tipo: TIPOS_DE_CAMPO.TELEFONO },
  { id: 'rol', label: 'Rol', tipo: TIPOS_DE_PRESENTACION.TEXTO, etiquetasDesde: 'roles' },
  { id: 'especialidades', label: 'Especialidades', tipo: TIPOS_DE_PRESENTACION.CHIPS },
  { id: 'fechaIngreso', label: 'Fecha de ingreso', tipo: TIPOS_DE_PRESENTACION.FECHA },
  { id: 'estado', label: 'Estado', tipo: TIPOS_DE_PRESENTACION.ESTADO, desde: 'activo', etiquetasDesde: 'estadoUsuario' },
];
