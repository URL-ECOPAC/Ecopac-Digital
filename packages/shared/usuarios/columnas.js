import { TIPOS_DE_CAMPO } from '../descriptores.js';

export const COLUMNAS_USUARIO = [
  { id: 'avatar', label: '', tipo: 'avatar', desde: 'nombreCompleto', anchoWeb: '48px' },
  { id: 'nombreCompleto', label: 'Nombre', tipo: 'texto', principal: true },
  { id: 'email', label: 'Correo', tipo: 'texto' },
  { id: 'rol', label: 'Rol', tipo: 'texto', etiquetasDesde: 'roles' },
  { id: 'estado', label: 'Estado', tipo: 'estado', desde: 'activo', etiquetasDesde: 'estadoUsuario' },
  { id: 'fechaIngreso', label: 'Ingreso', tipo: 'fecha' },
];

export const CAMPOS_FICHA_VOLUNTARIO = [
  { id: 'nombreCompleto', label: 'Nombre', tipo: 'texto' },
  { id: 'email', label: 'Correo', tipo: 'texto' },
  { id: 'telefono', label: 'Telefono', tipo: TIPOS_DE_CAMPO.TELEFONO },
  { id: 'rol', label: 'Rol', tipo: 'texto', etiquetasDesde: 'roles' },
  { id: 'especialidades', label: 'Especialidades', tipo: 'chips' },
  { id: 'fechaIngreso', label: 'Fecha de ingreso', tipo: 'fecha' },
  { id: 'estado', label: 'Estado', tipo: 'estado', desde: 'activo', etiquetasDesde: 'estadoUsuario' },
];
