import { ROLES } from '@ecopac/shared';

// UNICO punto del codigo web con un usuario simulado.
//
// Provisional hasta que #98 entregue el hook de sesion compartido en packages/shared.
// Cuando exista, este archivo se borra y los componentes importan useSesion desde shared:
// la firma de retorno ya es la misma a proposito, para que el cambio sea un reemplazo de
// import y nada mas.
//
// Para probar el filtrado de navegacion por rol, cambiar ROL_SIMULADO por cualquier valor
// de ROLES (ver packages/shared/usuarios/roles.js).
const ROL_SIMULADO = ROLES.ADMINISTRADOR;

export function useUsuarioActual() {
  return {
    usuario: {
      nombres: 'Astrid',
      apellidos: 'Conde',
      rol: ROL_SIMULADO,
      area: 'Gerencia',
    },
    cargando: false,
    error: null,
  };
}
