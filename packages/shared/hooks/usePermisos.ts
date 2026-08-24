import { useState, useEffect, useCallback, useMemo } from 'react';
import { puede, PERMISOS_POR_ROL } from '../utils/permisos';

interface UsePermisosParams {
  rol?: string | null;
  permisosIndividuales?: string[];
  sesionId?: string | null;
}

export function usePermisos({ rol, permisosIndividuales = [], sesionId }: UsePermisosParams = {}) {
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [permisosActivos, setPermisosActivos] = useState<Set<string>>(new Set());

  // Recargar permisos al cambiar la sesión o las dependencias
  useEffect(() => {
    setCargando(true);
    setError(false);

    try {
      const baseRol = rol && PERMISOS_POR_ROL[rol] ? PERMISOS_POR_ROL[rol] : [];
      const combinados = new Set([...baseRol, ...permisosIndividuales]);
      
      setPermisosActivos(combinados);
    } catch (err) {
      // Ante cualquier error de carga, fallback seguro a denegar todo
      setError(true);
      setPermisosActivos(new Set());
    } finally {
      setCargando(false);
    }
  }, [rol, JSON.stringify(permisosIndividuales), sesionId]);

  /**
   * Función para consultar un permiso individual.
   * Si hay error de carga, por defecto deniega todo.
   */
  const evaluarPuede = useCallback(
    (codigoPermiso: string): boolean => {
      if (error || cargando) return false;
      return puede(codigoPermiso, rol, permisosIndividuales);
    },
    [rol, permisosIndividuales, error, cargando]
  );

  return useMemo(
    () => ({
      puede: evaluarPuede,
      cargando,
      error,
      permisos: Array.from(permisosActivos),
    }),
    [evaluarPuede, cargando, error, permisosActivos]
  );
}