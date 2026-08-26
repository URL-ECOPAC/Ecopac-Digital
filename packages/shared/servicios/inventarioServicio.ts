import { obtenerSupabase } from '../api/cliente.js';
import { 
  Bodega, 
  Proveedor, 
  FiltrosBodega, 
  FiltrosProveedor 
} from '../types/inventario.js';

export const inventarioServicio = {
  // ==========================================
  // BODEGAS
  // ==========================================

  async obtenerBodegas(filtros?: FiltrosBodega): Promise<Bodega[]> {
    const supabase = obtenerSupabase();

    let query = supabase
      .from('bodegas')
      .select('*, existencias:lotes(cantidad_actual)');

    if (filtros?.tipo) query = query.eq('tipo', filtros.tipo);
    if (filtros?.activa !== undefined) query = query.eq('activa', filtros.activa);

    const { data, error } = await query.order('nombre', { ascending: true });
    if (error) throw new Error(`Error al obtener bodegas: ${error.message}`);

    return (data || []).map((b: any) => {
      const existenciasTotales = (b.existencias || []).reduce(
        (acc: number, lote: { cantidad_actual: number }) => acc + (lote.cantidad_actual || 0), 
        0
      );
      return {
        id: b.id,
        nombre: b.nombre,
        tipo: b.tipo,
        ubicacion: b.ubicacion,
        activa: b.activa,
        existenciasTotales,
        creadoEn: b.created_at,
        actualizadoEn: b.updated_at,
      };
    });
  },

  async crearBodega(bodega: Omit<Bodega, 'id' | 'existenciasTotales'>): Promise<Bodega> {
    const supabase = obtenerSupabase();

    const { data, error } = await supabase
      .from('bodegas')
      .insert({
        nombre: bodega.nombre,
        tipo: bodega.tipo,
        ubicacion: bodega.ubicacion,
        activa: bodega.activa ?? true,
      })
      .select()
      .single();

    if (error) throw new Error(`Error al crear la bodega: ${error.message}`);
    return data;
  },

  async actualizarBodega(id: string, cambios: Partial<Omit<Bodega, 'id'>>): Promise<Bodega> {
    const supabase = obtenerSupabase();

    // Criterio de Aceptación: No desactivar bodega si tiene existencias > 0
    if (cambios.activa === false) {
      const { data: lotes, error: errLotes } = await supabase
        .from('lotes')
        .select('cantidad_actual')
        .eq('bodega_id', id)
        .gt('cantidad_actual', 0);

      if (errLotes) throw new Error(`Error al verificar inventario: ${errLotes.message}`);

      const totalStock = (lotes || []).reduce((sum: number, l: any) => sum + l.cantidad_actual, 0);
      if (totalStock > 0) {
        throw new Error('No se puede desactivar una bodega con existencias distintas de cero.');
      }
    }

    const payload: Record<string, any> = {};
    if (cambios.nombre !== undefined) payload.nombre = cambios.nombre;
    if (cambios.tipo !== undefined) payload.tipo = cambios.tipo;
    if (cambios.ubicacion !== undefined) payload.ubicacion = cambios.ubicacion;
    if (cambios.activa !== undefined) payload.activa = cambios.activa;

    const { data, error } = await supabase
      .from('bodegas')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Error al actualizar la bodega: ${error.message}`);
    return data;
  },

  // ==========================================
  // PROVEEDORES
  // ==========================================

  async obtenerProveedores(filtros?: FiltrosProveedor): Promise<Proveedor[]> {
    const supabase = obtenerSupabase();

    let query = supabase.from('proveedores').select('*');

    if (filtros?.tipo) query = query.eq('tipo', filtros.tipo);
    if (filtros?.activo !== undefined) query = query.eq('activo', filtros.activo);

    const { data, error } = await query.order('nombre', { ascending: true });
    if (error) throw new Error(`Error al obtener proveedores: ${error.message}`);
    return data || [];
  },

  async crearProveedor(proveedor: Omit<Proveedor, 'id'>): Promise<Proveedor> {
    const supabase = obtenerSupabase();

    const { data, error } = await supabase
      .from('proveedores')
      .insert({
        nombre: proveedor.nombre,
        tipo: proveedor.tipo,
        contacto: proveedor.contacto,
        telefono: proveedor.telefono,
        correo: proveedor.correo,
        activo: proveedor.activo ?? true,
      })
      .select()
      .single();

    if (error) throw new Error(`Error al crear el proveedor: ${error.message}`);
    return data;
  },

  async actualizarProveedor(id: string, cambios: Partial<Omit<Proveedor, 'id'>>): Promise<Proveedor> {
    const supabase = obtenerSupabase();

    const { data, error } = await supabase
      .from('proveedores')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`Error al actualizar el proveedor: ${error.message}`);
    return data;
  }
};