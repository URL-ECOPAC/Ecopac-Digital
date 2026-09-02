import { useState, useCallback, useMemo } from "react";
import { listarBodegas, registrarBodega, actualizarBodega } from "./bodegas.api.js";
import { listarProveedores, registrarProveedor, actualizarProveedor } from "./proveedores.api.js";

// 📦 Tipos según migración
export const TIPO_BODEGA = {
  FIJA: "fija",
  MOVIL: "movil",
};

export const TIPO_PROVEEDOR = {
  COMERCIAL: "comercial",
  DONANTE: "donante",
};

export function useAdministracionBodegasProveedores() {
  // ─── BODEGAS ───
  const [bodegas, setBodegas] = useState([]);
  const [cargandoBodegas, setCargandoBodegas] = useState(false);

  const cargarBodegas = useCallback(async () => {
    setCargandoBodegas(true);
    try {
      const respuesta = await listarBodegas({ conExistencias: true });
      // ✅ EXTRAER el arreglo de adentro
      setBodegas(respuesta.bodegas ?? []);
    } catch (err) {
      console.error("Error bodegas:", err);
      setBodegas([]);
    } finally {
      setCargandoBodegas(false);
    }
  }, []);
  // ✅ Existencia total por bodega
  const existenciaPorBodega = useMemo(() => {
    // Asegurarse de que sea un arreglo antes de usar reduce
    const lista = Array.isArray(bodegas) ? bodegas : [];
    return lista.reduce((mapa, bodega) => {
      mapa[bodega.id] = bodega.existenciasTotales ?? 0;
      return mapa;
    }, {});
  }, [bodegas]);

  const guardarBodega = useCallback(
    async (bodega) => {
      const tieneExistencias = existenciaPorBodega[bodega.id] ?? 0;
      if (tieneExistencias > 0 && bodega.esMovil) {
        throw new Error("No se puede convertir en bodega móvil mientras tenga existencias");
      }

      const datos = {
        nombre: bodega.nombre?.trim(),
        ubicacion: bodega.ubicacion?.trim() || null,
        esMovil: Boolean(bodega.esMovil), // ← ¡OJO! La API espera esMovil (camelCase)
      };

      if (!datos.nombre) throw new Error("El nombre es obligatorio");
      if (datos.nombre.length > 100)
        throw new Error("Nombre demasiado largo (máx. 100 caracteres)");

      let resultado;
      if (bodega.id) {
        resultado = await actualizarBodega(bodega.id, datos);
      } else {
        // ✅ CORREGIR: usar registrarBodega y manejar { bodega, error }
        resultado = await registrarBodega(datos);
      }

      // ✅ La API devuelve { bodega, error }, NO lanza excepciones
      if (resultado.error) throw new Error(resultado.error.mensaje || "Error al guardar");

      await cargarBodegas();
    },
    [existenciaPorBodega, cargarBodegas],
  );

  // ─── PROVEEDORES ───
  const [proveedores, setProveedores] = useState([]);
  const [cargandoProveedores, setCargandoProveedores] = useState(false);

  const cargarProveedores = useCallback(async () => {
    setCargandoProveedores(true);
    try {
      const respuesta = await listarProveedores();
      // ✅ EXTRAER el arreglo de adentro
      setProveedores(respuesta.proveedores ?? []);
    } catch (err) {
      console.error("Error proveedores:", err);
      setProveedores([]);
    } finally {
      setCargandoProveedores(false);
    }
  }, []);

  const guardarProveedor = useCallback(
    async (proveedor) => {
      const datos = {
        nombre: proveedor.nombre?.trim(),
        contacto: proveedor.contacto?.trim() || null,
        tipo: proveedor.tipo, // ✅ "comercial" o "donante"
      };

      if (!datos.nombre) throw new Error("El nombre es obligatorio");
      if (!datos.tipo) throw new Error("El tipo es obligatorio");

      let resultado;
      if (proveedor.id) {
        // ✅ Editar
        resultado = await actualizarProveedor(proveedor.id, datos);
      } else {
        // ✅ Crear NUEVO — usa registrarProveedor
        resultado = await registrarProveedor(datos);
      }

      // ✅ Manejar respuesta { proveedor, error }
      if (resultado.error) {
        throw new Error(resultado.error.mensaje || "Error al guardar proveedor");
      }

      await cargarProveedores();
    },
    [cargarProveedores],
  );

  return {
    // Bodegas
    bodegas,
    cargandoBodegas,
    cargarBodegas,
    guardarBodega,
    existenciaPorBodega,
    TIPO_BODEGA,

    // Proveedores
    proveedores,
    cargandoProveedores,
    cargarProveedores,
    guardarProveedor,
    TIPO_PROVEEDOR,
  };
}
