export type TipoDonante = 'INDIVIDUAL' | 'INSTITUCIONAL';
export type TipoDonacion = 'MEDICAMENTOS' | 'DINERO' | 'EQUIPO' | 'OTROS';

export interface DetalleMedicamento {
  medicamentoId?: string;
  nombre?: string;
  cantidad: number;
  fechaVencimiento: string; // Formato YYYY-MM-DD
}

export interface DonanteInput {
  nombre: string;
  tipo: TipoDonante;
  telefono?: string;
  correo?: string;
  direccion?: string;
}

export interface DonacionInput {
  donanteId: string;
  tipo: TipoDonacion;
  fecha: string; // Formato ISO o YYYY-MM-DD
  monto?: number;
  moneda?: string;
  detallesMedicamentos?: DetalleMedicamento[];
  observaciones?: string;
}

export type ErroresValidacion = Record<string, string>;