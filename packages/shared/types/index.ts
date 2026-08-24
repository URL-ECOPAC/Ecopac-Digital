// Tipos TypeScript compartidos entre web y mobile
// - Patient: datos y historial clínico
// - Medicine: medicamento, lote, fecha de vencimiento
// - OutreachDay: jornada, voluntarios, locación
// - Recurso, Donación, Reporte, etc.
export type RolUsuario = 'Administrador' | 'Junta Directiva' | 'Medico' | 'Voluntario';
export interface Permiso {
  codigo: string;
  descripcion: string;
}