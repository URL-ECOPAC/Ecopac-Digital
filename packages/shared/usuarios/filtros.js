import { TIPOS_DE_FILTRO } from '../descriptores.js';

export const FILTROS_USUARIO = [
  {
    id: 'busqueda',
    tipo: TIPOS_DE_FILTRO.BUSQUEDA,
    label: 'Buscar usuario',
    placeholder: 'Nombre, apellido o correo',
  },
  {
    id: 'rol',
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: 'Rol',
    opcionesDesde: 'roles',
  },
  {
    id: 'estado',
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: 'Estado',
    opcionesDesde: 'estadoUsuario',
  },
  {
    id: 'especialidad',
    tipo: TIPOS_DE_FILTRO.SELECT,
    label: 'Especialidad',
    opcionesDesde: 'especialidades',
  },
];

export const FILTROS_USUARIO_VACIOS = {
  busqueda: '',
  rol: null,
  estado: null,
  especialidad: null,
};
