export type TipoBodega = 'fija' | 'movil';

export interface Bodega {
  id: string;
  nombre: string;
  tipo: TipoBodega;
  ubicacion?: string;
  activa: boolean;
  existenciasTotales?: number; // Calculado para validación de desactivación
  creadoEn?: string;
  actualizadoEn?: string;
}

export type TipoProveedor = 'comercial' | 'donante';

export interface Proveedor {
  id: string;
  nombre: string;
  tipo: TipoProveedor;
  contacto?: string;
  telefono?: string;
  correo?: string;
  activo: boolean;
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface FiltrosBodega {
  tipo?: TipoBodega;
  activa?: boolean;
}

export interface FiltrosProveedor {
  tipo?: TipoProveedor;
  activo?: boolean;
}