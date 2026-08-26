import { useState, useEffect, useCallback } from 'react';
import { inventarioServicio } from '../servicios/inventarioServicio';
import { Bodega, Proveedor, FiltrosBodega, FiltrosProveedor } from '../types/inventario';

export function useBodegas(filtrosIniciales?: FiltrosBodega) {
  const [bodegas, setBodegas] = useState<Bodega[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cargarBodegas = useCallback(async (filtros?: FiltrosBodega) => {
    try {
      setCargando(true);
      setError(null);
      const datos = await inventarioServicio.obtenerBodegas(filtros || filtrosIniciales);
      setBodegas(datos);
    } catch (err: any) {
      setError(err.message || 'Error al cargar bodegas');
    } finally {
      setCargando(false);
    }
  }, [filtrosIniciales]);

  useEffect(() => {
    cargarBodegas();
  }, [cargarBodegas]);

  const crearBodega = async (bodega: Omit<Bodega, 'id' | 'existenciasTotales'>) => {
    const nueva = await inventarioServicio.crearBodega(bodega);
    await cargarBodegas();
    return nueva;
  };

  const actualizarBodega = async (id: string, cambios: Partial<Omit<Bodega, 'id'>>) => {
    const actualizada = await inventarioServicio.actualizarBodega(id, cambios);
    await cargarBodegas();
    return actualizada;
  };

  return { bodegas, cargando, error, recargar: cargarBodegas, crearBodega, actualizarBodega };
}

export function useProveedores(filtrosIniciales?: FiltrosProveedor) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cargarProveedores = useCallback(async (filtros?: FiltrosProveedor) => {
    try {
      setCargando(true);
      setError(null);
      const datos = await inventarioServicio.obtenerProveedores(filtros || filtrosIniciales);
      setProveedores(datos);
    } catch (err: any) {
      setError(err.message || 'Error al cargar proveedores');
    } finally {
      setCargando(false);
    }
  }, [filtrosIniciales]);

  useEffect(() => {
    cargarProveedores();
  }, [cargarProveedores]);

  const crearProveedor = async (proveedor: Omit<Proveedor, 'id'>) => {
    const nuevo = await inventarioServicio.crearProveedor(proveedor);
    await cargarProveedores();
    return nuevo;
  };

  const actualizarProveedor = async (id: string, cambios: Partial<Omit<Proveedor, 'id'>>) => {
    const actualizado = await inventarioServicio.actualizarProveedor(id, cambios);
    await cargarProveedores();
    return actualizado;
  };

  return { proveedores, cargando, error, recargar: cargarProveedores, crearProveedor, actualizarProveedor };
}