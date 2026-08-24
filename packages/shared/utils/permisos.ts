import { RolUsuario } from '../types';
export const PERMISOS_POR_ROL: Record<string, string[]> = {
  Administrador: [
    'usuarios:read',
    'usuarios:write',
    'pacientes:read',
    'pacientes:write',
    'inventario:read',
    'inventario:write',
    'jornadas:read',
    'jornadas:write',
    'donaciones:read',
    'donaciones:write',
    'reportes:read',
    'configuracion:admin',
  ],
  'Junta Directiva': [
    'pacientes:read',
    'inventario:read',
    'jornadas:read',
    'donaciones:read',
    'donaciones:write',
    'reportes:read',
  ],
  Medico: [
    'pacientes:read',
    'pacientes:write',
    'inventario:read',
    'jornadas:read',
  ],
  Voluntario: [
    'pacientes:read',
    'jornadas:read',
  ],
};

/**
 * Resuelve si un usuario posee un determinado código de permiso combinando
 * los permisos de su rol con los permisos individuales concedidos.
 * 
 * Ante duda, datos faltantes o error, el resultado por defecto es siempre DENIED (false).
 *
 * @param codigo - Código del permiso a evaluar (ej. 'usuarios:read', 'configuracion:admin').
 * @param rol - Rol actual del usuario.
 * @param permisosIndividuales - Arreglo de códigos de permisos asignados individualmente al usuario.
 * @returns boolean - true si tiene el permiso, false en caso contrario.
 */
export function puede(
  codigo: string,
  rol?: RolUsuario | string | null,
  permisosIndividuales: string[] = []
): boolean {
  if (!codigo || typeof codigo !== 'string') return false;

  // Si no hay rol ni permisos individuales, denegar por defecto
  if (!rol && (!permisosIndividuales || permisosIndividuales.length === 0)) {
    return false;
  }

  // Permisos base otorgados por el rol
  const permisosDelRol = rol && PERMISOS_POR_ROL[rol] ? PERMISOS_POR_ROL[rol] : [];

  // Combinar rol y permisos individuales (evitando duplicados)
  const todosLosPermisos = new Set([...permisosDelRol, ...(permisosIndividuales || [])]);

  // Si tiene el permiso wildcard de admin o el código exacto
  if (todosLosPermisos.has('*') || todosLosPermisos.has('configuracion:admin') && rol === 'Administrador') {
    if (codigo === 'configuracion:admin' && rol !== 'Administrador') {
      // El rol Médico o Voluntario nunca debe obtener configuración administrativa
      return false;
    }
  }

  return todosLosPermisos.has(codigo);
}